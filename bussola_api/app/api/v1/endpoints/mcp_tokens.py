"""
=======================================================================================
ARQUIVO: mcp_tokens.py (Endpoints - Conexões MCP do usuário)
=======================================================================================

OBJETIVO:
    Tela "Conexões MCP": listar clientes OAuth autorizados e tokens pessoais (PAT),
    gerar PAT para o Claude Code (o token é devolvido UMA única vez) e revogar.
=======================================================================================
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api import deps
from app.services.mcp_auth import ESCOPOS_VALIDOS, OAuthErro, mcp_auth_service

router = APIRouter()


class TokenCreate(BaseModel):
    nome: str = Field(min_length=1, max_length=100)
    escopos: List[str] = list(ESCOPOS_VALIDOS)
    validade_dias: int = Field(default=90, ge=1, le=365)


@router.get("")
def listar_conexoes(db: Session = Depends(deps.get_db), current_user=Depends(deps.get_current_user)):
    return jsonable_encoder(mcp_auth_service.listar_conexoes(db, current_user.id))


@router.post("")
def criar_token(dados: TokenCreate, db: Session = Depends(deps.get_db), current_user=Depends(deps.get_current_user)):
    try:
        reg, token = mcp_auth_service.criar_pat(db, current_user.id, dados.nome, dados.escopos, dados.validade_dias)
    except OAuthErro as erro:
        raise HTTPException(status_code=400, detail=erro.descricao)
    return jsonable_encoder({
        "id": reg.id, "nome": reg.name, "escopos": reg.scopes.split(), "expira_em": reg.expires_at, "token": token,
    })


@router.delete("/pat/{token_id}")
def revogar_pat(token_id: int, db: Session = Depends(deps.get_db), current_user=Depends(deps.get_current_user)):
    if not mcp_auth_service.revogar_pat(db, current_user.id, token_id):
        raise HTTPException(status_code=404, detail="Token não encontrado.")
    return {"status": "success"}


@router.delete("/cliente/{client_id}")
def revogar_cliente(client_id: str, db: Session = Depends(deps.get_db), current_user=Depends(deps.get_current_user)):
    if not mcp_auth_service.revogar_cliente(db, current_user.id, client_id):
        raise HTTPException(status_code=404, detail="Conexão não encontrada.")
    return {"status": "success"}
