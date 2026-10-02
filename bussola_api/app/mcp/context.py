"""
=======================================================================================
ARQUIVO: context.py (MCP - contexto de execução das tools)
=======================================================================================

OBJETIVO:
    Abrir a sessão de banco, identificar o usuário dono do token da chamada, checar
    o escopo e traduzir erros dos services em ToolError legível pelo Claude.
=======================================================================================
"""

from contextlib import contextmanager

from fastapi import HTTPException
from mcp.server.auth.middleware.auth_context import get_access_token
from mcp.server.mcpserver.exceptions import ToolError

from app.db.session import SessionLocal
from app.models.user import User

ESCOPO_LEITURA = "bussola:read"
ESCOPO_ESCRITA = "bussola:write"


@contextmanager
def sessao():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def usuario_e_db(escopo: str = ESCOPO_LEITURA):
    """`with usuario_e_db(ESCOPO_ESCRITA) as (db, user):` — tudo que a tool faz fica aqui dentro."""
    token = get_access_token()
    if token is None or token.subject is None:
        raise ToolError("Chamada sem autenticação.")
    if escopo not in token.scopes:
        raise ToolError(f"Este token não tem o escopo {escopo}, necessário para esta ação.")
    with sessao() as db:
        user = db.get(User, int(token.subject))
        if not user or not user.is_active:
            raise ToolError("Usuário inválido ou inativo.")
        try:
            yield db, user
        except HTTPException as erro:
            db.rollback()
            raise ToolError(str(erro.detail)) from erro
        except (ValueError, PermissionError) as erro:
            db.rollback()
            raise ToolError(str(erro)) from erro


def exigir(obj, mensagem: str):
    """Service devolveu None/False -> ToolError com a mensagem."""
    if not obj:
        raise ToolError(mensagem)
    return obj


def apenas_informados(**campos) -> dict:
    """Remove os None — base do upsert parcial (`salvar_*` com id edita só o que veio)."""
    return {chave: valor for chave, valor in campos.items() if valor is not None}
