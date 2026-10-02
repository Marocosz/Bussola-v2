"""
=======================================================================================
ARQUIVO: mcp.py (Modelos de Dados - Autenticação do servidor MCP)
=======================================================================================

OBJETIVO:
    Clientes OAuth registrados dinamicamente (claude.ai, Claude Code), códigos de
    autorização e tokens (OAuth e PAT) que dão ao Claude acesso ao Bussola via MCP.
    Tokens e códigos são guardados SÓ como hash SHA-256.
=======================================================================================
"""

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String

from app.db.base_class import Base
from app.core.timezone import now_utc


class McpClient(Base):
    """Cliente OAuth público (sem secret) registrado via RFC 7591."""
    __tablename__ = "mcp_client"

    id = Column(Integer, primary_key=True)
    client_id = Column(String(64), unique=True, nullable=False, index=True)
    client_name = Column(String(200), nullable=False)
    redirect_uris = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=now_utc)


class McpAuthCode(Base):
    """Código de autorização (uso único, 10 min) amarrado ao PKCE do cliente."""
    __tablename__ = "mcp_auth_code"

    id = Column(Integer, primary_key=True)
    code_hash = Column(String(64), unique=True, nullable=False, index=True)
    client_id = Column(String(64), nullable=False)
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    redirect_uri = Column(String(500), nullable=False)
    code_challenge = Column(String(128), nullable=False)
    scopes = Column(String(200), nullable=False)      # separados por espaço
    expires_at = Column(DateTime, nullable=False)     # UTC naive
    used = Column(Boolean, nullable=False, default=False)


class McpToken(Base):
    """Token emitido: access/refresh (OAuth, com client_id) ou pat (sem client_id)."""
    __tablename__ = "mcp_token"

    id = Column(Integer, primary_key=True)
    token_hash = Column(String(64), unique=True, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    client_id = Column(String(64), nullable=True, index=True)
    kind = Column(String(10), nullable=False)          # access | refresh | pat
    name = Column(String(200), nullable=False)
    scopes = Column(String(200), nullable=False)       # separados por espaço
    expires_at = Column(DateTime, nullable=True)       # UTC naive
    last_used_at = Column(DateTime, nullable=True)
    revoked = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=now_utc)
