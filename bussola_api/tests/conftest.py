import os
# Desliga o create_all do app no import (os testes criam o próprio schema em
# SQLite in-memory). Precisa vir ANTES de importar app.main.
os.environ["SKIP_DB_CREATE_ALL"] = "1"

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.db.base_class import Base
import app.models  # noqa: F401 — registra todas as tabelas no metadata
from app.main import app
from app.api import deps
from app.models.user import User


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def user(db):
    u = User(email="teste@bussola.dev", hashed_password="x", is_active=True)
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@pytest.fixture
def client(db, user):
    app.dependency_overrides[deps.get_db] = lambda: db
    app.dependency_overrides[deps.get_current_user] = lambda: user
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def outro_user(db):
    u = User(email="outro@bussola.dev", hashed_password="x", is_active=True)
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@pytest.fixture
def mcp_db(db, monkeypatch):
    """Faz o MCP (app.mcp.context.sessao) usar a sessão de teste sem fechá-la."""
    from app.mcp import context as mcp_context
    monkeypatch.setattr(mcp_context, "SessionLocal", lambda: db)
    monkeypatch.setattr(db, "close", lambda: None)
    return db


@pytest.fixture
def mcp_call(mcp_db, user):
    """Chama uma tool do MCP em processo, autenticado como `user` (ou `usuario=`)."""
    import anyio
    from mcp.server.auth.middleware.auth_context import auth_context_var
    from mcp.server.auth.middleware.bearer_auth import AuthenticatedUser
    from mcp.server.auth.provider import AccessToken
    from app.mcp.server import mcp

    def _call(nome, /, escopos=("bussola:read", "bussola:write"), usuario=None, **args):
        alvo = usuario or user
        token = AccessToken(token="teste", client_id="teste", scopes=list(escopos), subject=str(alvo.id))
        marca = auth_context_var.set(AuthenticatedUser(token))
        try:
            resultado = anyio.run(mcp.call_tool, nome, args)
        finally:
            auth_context_var.reset(marca)
        return resultado.structured_content

    return _call
