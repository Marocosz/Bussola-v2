"""
=======================================================================================
ARQUIVO: mcp_auth.py (Serviço - Autenticação do servidor MCP)
=======================================================================================

OBJETIVO:
    Regras do Authorization Server OAuth 2.1 embutido no Bussola (registro dinâmico
    de cliente, código de autorização com PKCE S256, emissão e rotação de tokens) e
    dos tokens pessoais (PAT) usados pelo Claude Code. Só o hash SHA-256 de tokens
    e códigos vai para o banco.
=======================================================================================
"""

import base64
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

from sqlalchemy.orm import Session

from app.models.mcp import McpAuthCode, McpClient, McpToken
from app.models.user import User

ESCOPOS_VALIDOS = ("bussola:read", "bussola:write")
ACCESS_TTL = timedelta(hours=1)
REFRESH_TTL = timedelta(days=30)
CODE_TTL = timedelta(minutes=10)


class OAuthErro(Exception):
    """Erro no formato OAuth (RFC 6749 §5.2): `codigo` vai no campo `error`."""

    def __init__(self, codigo: str, descricao: str):
        super().__init__(descricao)
        self.codigo = codigo
        self.descricao = descricao


def agora() -> datetime:
    """UTC naive — o SQLite não guarda fuso, então comparamos tudo assim."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def hash_token(valor: str) -> str:
    return hashlib.sha256(valor.encode()).hexdigest()


def redirect_uri_permitida(uri: str) -> bool:
    """HTTPS, ou HTTP só em loopback (Claude Code abre um callback local)."""
    partes = urlparse(uri)
    if partes.scheme == "https" and partes.netloc:
        return True
    return partes.scheme == "http" and partes.hostname in ("localhost", "127.0.0.1")


def normalizar_escopos(escopos) -> list[str]:
    """Lista ou string separada por espaço -> escopos válidos em ordem canônica.
    Vazio = todos. Escrita implica leitura."""
    if isinstance(escopos, str):
        escopos = escopos.split()
    pedidos = set(escopos or [])
    if not pedidos:
        return list(ESCOPOS_VALIDOS)
    invalidos = pedidos - set(ESCOPOS_VALIDOS)
    if invalidos:
        raise OAuthErro("invalid_scope", f"Escopos inválidos: {', '.join(sorted(invalidos))}")
    if "bussola:write" in pedidos:
        pedidos.add("bussola:read")
    return [e for e in ESCOPOS_VALIDOS if e in pedidos]


def _pkce_confere(verifier: str, challenge: str) -> bool:
    calculado = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    return secrets.compare_digest(calculado, challenge)


class McpAuthService:

    # --- Clientes (RFC 7591) ---

    def registrar_cliente(self, db: Session, client_name: str | None, redirect_uris: list[str]) -> McpClient:
        if not redirect_uris:
            raise OAuthErro("invalid_redirect_uri", "Informe ao menos uma redirect_uri.")
        for uri in redirect_uris:
            if not redirect_uri_permitida(uri):
                raise OAuthErro("invalid_redirect_uri", f"redirect_uri não permitida: {uri}")
        cliente = McpClient(
            client_id=secrets.token_urlsafe(24),
            client_name=(client_name or "Cliente MCP")[:200],
            redirect_uris=list(redirect_uris),
        )
        db.add(cliente)
        db.commit()
        db.refresh(cliente)
        return cliente

    def get_cliente(self, db: Session, client_id: str) -> McpClient | None:
        return db.query(McpClient).filter(McpClient.client_id == client_id).first()

    # --- Código de autorização + PKCE ---

    def criar_codigo(self, db: Session, client_id: str, user_id: int, redirect_uri: str,
                     code_challenge: str, escopos: list[str]) -> str:
        codigo = secrets.token_urlsafe(32)
        db.add(McpAuthCode(
            code_hash=hash_token(codigo), client_id=client_id, user_id=user_id,
            redirect_uri=redirect_uri, code_challenge=code_challenge,
            scopes=" ".join(escopos), expires_at=agora() + CODE_TTL,
        ))
        db.commit()
        return codigo

    def trocar_codigo(self, db: Session, client_id: str, codigo: str, redirect_uri: str, code_verifier: str) -> dict:
        reg = db.query(McpAuthCode).filter(McpAuthCode.code_hash == hash_token(codigo)).first()
        if (not reg or reg.used or reg.expires_at < agora()
                or reg.client_id != client_id or reg.redirect_uri != redirect_uri):
            raise OAuthErro("invalid_grant", "Código de autorização inválido ou expirado.")
        if not _pkce_confere(code_verifier, reg.code_challenge):
            raise OAuthErro("invalid_grant", "code_verifier não confere (PKCE).")
        reg.used = True
        return self._emitir_par(db, reg.user_id, client_id, reg.scopes.split())

    def renovar(self, db: Session, client_id: str, refresh_token: str) -> dict:
        reg = db.query(McpToken).filter(
            McpToken.token_hash == hash_token(refresh_token), McpToken.kind == "refresh"
        ).first()
        if not reg or reg.revoked or reg.client_id != client_id or reg.expires_at < agora():
            raise OAuthErro("invalid_grant", "Refresh token inválido ou expirado.")
        reg.revoked = True  # rotação: o refresh usado morre
        return self._emitir_par(db, reg.user_id, client_id, reg.scopes.split())

    def _emitir_par(self, db: Session, user_id: int, client_id: str, escopos: list[str]) -> dict:
        cliente = self.get_cliente(db, client_id)
        nome = cliente.client_name if cliente else client_id
        access = "bsl_" + secrets.token_urlsafe(32)
        refresh = "bsl_rt_" + secrets.token_urlsafe(32)
        momento = agora()
        scopes = " ".join(escopos)
        db.add_all([
            McpToken(token_hash=hash_token(access), user_id=user_id, client_id=client_id, kind="access",
                     name=nome, scopes=scopes, expires_at=momento + ACCESS_TTL),
            McpToken(token_hash=hash_token(refresh), user_id=user_id, client_id=client_id, kind="refresh",
                     name=nome, scopes=scopes, expires_at=momento + REFRESH_TTL),
        ])
        db.commit()
        return {
            "access_token": access,
            "token_type": "Bearer",
            "expires_in": int(ACCESS_TTL.total_seconds()),
            "refresh_token": refresh,
            "scope": scopes,
        }

    # --- Tokens pessoais (PAT) ---

    def criar_pat(self, db: Session, user_id: int, nome: str, escopos, validade_dias: int) -> tuple[McpToken, str]:
        token = "bsl_pat_" + secrets.token_urlsafe(32)
        reg = McpToken(
            token_hash=hash_token(token), user_id=user_id, client_id=None, kind="pat",
            name=nome[:200], scopes=" ".join(normalizar_escopos(escopos)),
            expires_at=agora() + timedelta(days=validade_dias),
        )
        db.add(reg)
        db.commit()
        db.refresh(reg)
        return reg, token

    # --- Verificação (cada chamada ao /mcp) ---

    def verificar(self, db: Session, token: str) -> McpToken | None:
        reg = db.query(McpToken).filter(
            McpToken.token_hash == hash_token(token), McpToken.kind.in_(("access", "pat"))
        ).first()
        if not reg or reg.revoked or (reg.expires_at and reg.expires_at < agora()):
            return None
        user = db.get(User, reg.user_id)
        if not user or not user.is_active:
            return None
        reg.last_used_at = agora()
        db.commit()
        return reg

    # --- Tela "Conexões MCP" ---

    def listar_conexoes(self, db: Session, user_id: int) -> list[dict]:
        momento = agora()
        tokens = db.query(McpToken).filter(McpToken.user_id == user_id, McpToken.revoked.is_(False)).all()
        pats, clientes = [], {}
        for t in tokens:
            if t.expires_at and t.expires_at < momento:
                continue
            if t.kind == "pat":
                pats.append({"id": t.id, "tipo": "pat", "nome": t.name, "escopos": t.scopes.split(),
                             "criado_em": t.created_at, "ultimo_uso": t.last_used_at,
                             "expira_em": t.expires_at, "client_id": None})
                continue
            conexao = clientes.setdefault(t.client_id, {
                "id": None, "tipo": "oauth", "nome": t.name, "escopos": t.scopes.split(),
                "criado_em": t.created_at, "ultimo_uso": None, "expira_em": None, "client_id": t.client_id,
            })
            if t.last_used_at and (conexao["ultimo_uso"] is None or t.last_used_at > conexao["ultimo_uso"]):
                conexao["ultimo_uso"] = t.last_used_at
        return pats + list(clientes.values())

    def revogar_pat(self, db: Session, user_id: int, token_id: int) -> bool:
        reg = db.query(McpToken).filter(
            McpToken.id == token_id, McpToken.user_id == user_id, McpToken.kind == "pat"
        ).first()
        if not reg:
            return False
        reg.revoked = True
        db.commit()
        return True

    def revogar_cliente(self, db: Session, user_id: int, client_id: str) -> bool:
        afetados = db.query(McpToken).filter(
            McpToken.user_id == user_id, McpToken.client_id == client_id, McpToken.revoked.is_(False)
        ).update({"revoked": True}, synchronize_session=False)
        db.commit()
        return afetados > 0


mcp_auth_service = McpAuthService()
