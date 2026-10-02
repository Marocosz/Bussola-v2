"""
=======================================================================================
ARQUIVO: oauth.py (Endpoints - Authorization Server OAuth 2.1 do MCP)
=======================================================================================

OBJETIVO:
    Descoberta (RFC 8414 / RFC 9728), registro dinâmico de cliente (RFC 7591),
    authorize com PKCE S256, consentimento (chamado pelo SPA com o JWT normal) e
    emissão de tokens. `public_router` fica FORA de /api/v1 — a descoberta OAuth
    exige caminhos na raiz; `router` fica em /api/v1/oauth.
=======================================================================================
"""

import time
from typing import List, Optional
from urllib.parse import urlencode, urlparse

from fastapi import APIRouter, Depends, Form, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel, ConfigDict
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from app.api import deps
from app.core.config import settings
from app.services.mcp_auth import ESCOPOS_VALIDOS, OAuthErro, mcp_auth_service, normalizar_escopos

def _ip_cliente(request: Request) -> str:
    # O nginx define X-Real-IP a partir de $remote_addr (cliente não consegue forjar por ele).
    return request.headers.get("x-real-ip") or get_remote_address(request)


limiter = Limiter(key_func=_ip_cliente)
public_router = APIRouter(include_in_schema=False)
router = APIRouter()


def _base() -> str:
    return settings.PUBLIC_BASE_URL.rstrip("/")


def _erro_oauth(erro: OAuthErro) -> JSONResponse:
    return JSONResponse(
        status_code=400,
        content={"error": erro.codigo, "error_description": erro.descricao},
        headers={"Cache-Control": "no-store"},
    )


def _com_query(uri: str, params: dict) -> str:
    separador = "&" if "?" in uri else "?"
    return f"{uri}{separador}{urlencode({k: v for k, v in params.items() if v is not None})}"


def _validar_pedido(db: Session, client_id: str, redirect_uri: str, code_challenge: Optional[str],
                    code_challenge_method: Optional[str], response_type: str = "code") -> None:
    """Cliente/redirect inválidos -> HTTPException 400 (não dá pra confiar no redirect).
    Demais problemas -> OAuthErro, devolvido ao cliente pelo redirect."""
    cliente = mcp_auth_service.get_cliente(db, client_id)
    if not cliente:
        raise HTTPException(status_code=400, detail="client_id desconhecido.")
    if redirect_uri not in cliente.redirect_uris:
        raise HTTPException(status_code=400, detail="redirect_uri não registrada para este cliente.")
    if response_type != "code":
        raise OAuthErro("unsupported_response_type", "Use response_type=code.")
    if not code_challenge or code_challenge_method != "S256":
        raise OAuthErro("invalid_request", "PKCE com code_challenge_method=S256 é obrigatório.")


# --- Descoberta ---

@public_router.get("/.well-known/oauth-authorization-server")
def metadata_authorization_server():
    base = _base()
    return {
        "issuer": base,
        "authorization_endpoint": f"{base}/oauth/authorize",
        "token_endpoint": f"{base}/oauth/token",
        "registration_endpoint": f"{base}/oauth/register",
        "scopes_supported": list(ESCOPOS_VALIDOS),
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code", "refresh_token"],
        "token_endpoint_auth_methods_supported": ["none"],
        "code_challenge_methods_supported": ["S256"],
    }


@public_router.get("/.well-known/oauth-protected-resource")
@public_router.get("/.well-known/oauth-protected-resource/mcp")
def metadata_protected_resource():
    """Metadados do recurso (raiz e variante /mcp) com os dois escopos anunciados."""
    base = _base()
    return {
        "resource": f"{base}/mcp",
        "authorization_servers": [base],
        "scopes_supported": list(ESCOPOS_VALIDOS),
        "bearer_methods_supported": ["header"],
    }


# --- Registro dinâmico ---

class RegistroClienteIn(BaseModel):
    model_config = ConfigDict(extra="allow")  # RFC 7591: metadados extras são ignorados

    redirect_uris: List[str]
    client_name: Optional[str] = None


@public_router.post("/oauth/register", status_code=201)
@limiter.limit("20/hour")
def registrar_cliente(request: Request, dados: RegistroClienteIn, db: Session = Depends(deps.get_db)):
    try:
        cliente = mcp_auth_service.registrar_cliente(db, dados.client_name, dados.redirect_uris)
    except OAuthErro as erro:
        return _erro_oauth(erro)
    return {
        "client_id": cliente.client_id,
        "client_id_issued_at": int(time.time()),
        "client_name": cliente.client_name,
        "redirect_uris": cliente.redirect_uris,
        "token_endpoint_auth_method": "none",
        "grant_types": ["authorization_code", "refresh_token"],
        "response_types": ["code"],
    }


# --- Authorize -> tela de consentimento do SPA ---

@public_router.get("/oauth/authorize")
def authorize(
    request: Request,
    client_id: str,
    redirect_uri: str,
    response_type: str = "code",
    code_challenge: Optional[str] = None,
    code_challenge_method: Optional[str] = None,
    scope: Optional[str] = None,
    state: Optional[str] = None,
    db: Session = Depends(deps.get_db),
):
    try:
        _validar_pedido(db, client_id, redirect_uri, code_challenge, code_challenge_method, response_type)
        normalizar_escopos(scope)
    except OAuthErro as erro:
        destino = _com_query(redirect_uri, {"error": erro.codigo, "error_description": erro.descricao, "state": state})
        return RedirectResponse(destino, status_code=302)
    return RedirectResponse(
        f"{settings.FRONTEND_URL.rstrip('/')}/conexoes/autorizar?{request.url.query}", status_code=302
    )


@router.get("/clientes/{client_id}")
def ler_cliente(client_id: str, db: Session = Depends(deps.get_db), current_user=Depends(deps.get_current_user)):
    cliente = mcp_auth_service.get_cliente(db, client_id)
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")
    hosts = sorted({urlparse(uri).hostname for uri in cliente.redirect_uris if urlparse(uri).hostname})
    return {"client_id": cliente.client_id, "client_name": cliente.client_name, "redirect_hosts": hosts}


class ConsentimentoIn(BaseModel):
    client_id: str
    redirect_uri: str
    code_challenge: Optional[str] = None
    code_challenge_method: Optional[str] = None
    state: Optional[str] = None
    escopos: List[str] = []
    aprovado: bool


@router.post("/consent")
def consentir(dados: ConsentimentoIn, db: Session = Depends(deps.get_db), current_user=Depends(deps.get_current_user)):
    try:
        _validar_pedido(db, dados.client_id, dados.redirect_uri, dados.code_challenge, dados.code_challenge_method)
        if not dados.aprovado:
            raise OAuthErro("access_denied", "O usuário negou o acesso.")
        escopos = normalizar_escopos(dados.escopos)
    except OAuthErro as erro:
        return {"redirect_url": _com_query(dados.redirect_uri, {
            "error": erro.codigo, "error_description": erro.descricao, "state": dados.state,
        })}
    codigo = mcp_auth_service.criar_codigo(
        db, dados.client_id, current_user.id, dados.redirect_uri, dados.code_challenge, escopos
    )
    return {"redirect_url": _com_query(dados.redirect_uri, {"code": codigo, "state": dados.state})}


# --- Token ---

@public_router.post("/oauth/token")
@limiter.limit("60/minute")
def token(
    request: Request,
    grant_type: str = Form(...),
    client_id: str = Form(...),
    code: Optional[str] = Form(None),
    redirect_uri: Optional[str] = Form(None),
    code_verifier: Optional[str] = Form(None),
    refresh_token: Optional[str] = Form(None),
    db: Session = Depends(deps.get_db),
):
    try:
        if grant_type == "authorization_code":
            if not (code and redirect_uri and code_verifier):
                raise OAuthErro("invalid_request", "code, redirect_uri e code_verifier são obrigatórios.")
            par = mcp_auth_service.trocar_codigo(db, client_id, code, redirect_uri, code_verifier)
        elif grant_type == "refresh_token":
            if not refresh_token:
                raise OAuthErro("invalid_request", "refresh_token é obrigatório.")
            par = mcp_auth_service.renovar(db, client_id, refresh_token)
        else:
            raise OAuthErro("unsupported_grant_type", f"grant_type não suportado: {grant_type}")
    except OAuthErro as erro:
        return _erro_oauth(erro)
    return JSONResponse(par, headers={"Cache-Control": "no-store"})
