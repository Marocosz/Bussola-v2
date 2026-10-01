# MCP Server do Bussola — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expor o Bussola como servidor MCP remoto em `https://bussola.marocos.dev/mcp`, com OAuth 2.1 (claude.ai/app) e PAT (Claude Code), cobrindo todos os módulos existentes.

**Architecture:** SDK oficial `mcp` 2.2 (`MCPServer`) ligado ao FastAPI por duas rotas explícitas (`/mcp` e `/.well-known/oauth-protected-resource/mcp`), transporte Streamable HTTP stateless. As tools (≈49, curadas) chamam os services existentes com `user_id` do token. O próprio backend é o Authorization Server OAuth (router escrito à mão em `/oauth/*` + `/.well-known/*`); tokens ficam no banco só como hash SHA-256.

**Tech Stack:** Python 3.12, FastAPI 0.123, SQLAlchemy 2.0, `mcp==2.2.0`, slowapi, pytest; React 19 + Vite, axios.

**Spec:** `docs/superpowers/specs/2026-10-01-mcp-server-design.md`

## Global Constraints

- SDK: `mcp==2.2.0`. Em 2.x **não existe** `mcp.server.fastmcp`; use `from mcp.server.mcpserver import MCPServer`. `ToolAnnotations` vem de `mcp_types` (campos `read_only_hint`, `destructive_hint`).
- Escopos: exatamente `bussola:read` e `bussola:write`. Toda tool de leitura exige `bussola:read`; todo o resto exige `bussola:write`. `bussola:write` implica `bussola:read`.
- Tokens: prefixo `bsl_` (access), `bsl_rt_` (refresh), `bsl_pat_` (PAT); 32 bytes de `secrets.token_urlsafe`; banco guarda só `sha256`. Access 1h, refresh 30 dias com rotação, código 10 min uso único, PAT padrão 90 dias (1–365).
- PKCE `S256` obrigatório. `redirect_uri` com match exato contra o registrado; só `https://` ou `http://localhost` / `http://127.0.0.1`.
- Cofre: nenhuma tool chama `get_decrypted_value` nem expõe `valor_criptografado`.
- Camada MCP não contém regra de negócio: se falta um método, ele é criado no service.
- Serviços seguem o padrão do projeto: singleton no fim do módulo, métodos `(db, ..., user_id)`, todo query filtra por `user_id`.
- Tools: nomes em português `verbo_objeto`, docstring em português (vira a descrição), retorno sempre `dict[str, Any]` (listas vão em `{"itens": [...]}`), datas ISO, dinheiro em reais.
- Erros esperados → `ToolError` com mensagem em português. Exceções inesperadas o SDK já loga e devolve mensagem genérica — não capture `Exception`.
- Rodar testes de `bussola_api/` com `venvbussola/Scripts/python.exe -m pytest ... -q`. Frontend: gate é `npm run build` + nenhum erro NOVO de `npm run lint` nos arquivos tocados.
- Não fazer `git push` (push na `main` dispara deploy no Coolify). Trabalhar no branch `feat/mcp-server`.
- Commits terminam com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Categoria homônima em receita e despesa** (ex.: "Investimentos" nos dois tipos) → `salvar_transacao(categoria="Investimentos")` sem `tipo` deve responder "ambíguo" listando opções, e com `tipo` deve funcionar. Teste na Task 6.
2. **Claude repetindo a mesma chamada** (retry de rede/modelo) em `marcar_pagamento`, `checkin_habito`, `marcar_subtarefa` → o estado final é o pedido, nunca desfeito. Testes nas Tasks 6, 9 e 10.
3. **PAT revogado na tela enquanto o Claude Code está conectado** → a próxima requisição em `/mcp` volta 401 (não 500, não sucesso). Teste HTTP na Task 4.
4. **`mes` em formato humano** ("outubro", "10/2026") → `ToolError` em português explicando `AAAA-MM`, não traceback/mensagem em inglês. Teste na Task 6.
5. **Editar anotação mandando só o título** → conteúdo, grupo e links preservados (o `update_anotacao` do service sobrescreve tudo; a tool precisa mesclar). Teste na Task 9.

## Ajustes à spec descobertos no planejamento

A spec é atualizada na Task 0 com estes pontos (todos decorrem do código/SDK real):
- O app Starlette do SDK serve `/mcp` e `/.well-known/oauth-protected-resource/mcp` a partir da própria raiz, então ele **não** é montado em `/mcp` (viraria `/mcp/mcp`) nem na raiz (um mount em `/` desliga o redirect de barra final da API). O FastAPI registra duas rotas explícitas que apontam para ele.
- A tela de consentimento do SPA fica em **`/conexoes/autorizar`** (não `/oauth/consent`), porque `nginx` encaminha o prefixo `/oauth/` ao backend.
- `excluir_meta` vira **`arquivar_meta`** (o service faz soft delete). `movimentar_meta.tipo` = `aporte`/`retirada` (enum real).
- `panorama_geral(de, ate)` em vez de `periodo` (o service recebe intervalo). `listar_tarefas(status)` sem `grupo` (tarefa não tem grupo).
- SDK 2.2: proteção de DNS rebinding precisa ser desligada explicitamente (senão rejeita `Host: bussola.marocos.dev`), e o session manager só roda uma vez por instância (o app MCP é recriado a cada lifespan).

---

## File Structure

**Backend — novos**
- `bussola_api/app/models/mcp.py` — `McpClient`, `McpAuthCode`, `McpToken`.
- `bussola_api/alembic/versions/c7e2a9d4f1b3_add_mcp_auth_tables.py` — migration à mão.
- `bussola_api/app/services/mcp_auth.py` — `McpAuthService` (registro, código+PKCE, tokens, PAT, verificação, conexões).
- `bussola_api/app/api/v1/endpoints/oauth.py` — `public_router` (`/.well-known/*`, `/oauth/*`) + `router` (`/api/v1/oauth/*`).
- `bussola_api/app/api/v1/endpoints/mcp_tokens.py` — gestão de conexões/PAT.
- `bussola_api/app/mcp/__init__.py`, `server.py`, `auth.py`, `context.py`, `resolvers.py`.
- `bussola_api/app/mcp/tools/__init__.py` + `perfil.py`, `financas.py`, `metas.py`, `agenda.py`, `registros.py`, `habitos.py`, `ritmo.py`, `panorama.py`, `cofre.py`.
- Testes: `tests/test_mcp_auth_service.py`, `test_mcp_oauth_api.py`, `test_mcp_tokens_api.py`, `test_mcp_server.py`, `test_financas_service_mcp.py`, `test_mcp_financas.py`, `test_mcp_metas.py`, `test_mcp_agenda.py`, `test_mcp_registros.py`, `test_mcp_habitos.py`, `test_mcp_ritmo.py`, `test_mcp_panorama_cofre.py`.

**Backend — modificados**
- `requirements.txt` (+`mcp==2.2.0`), `app/core/config.py` (+`PUBLIC_BASE_URL`), `app/models/__init__.py`, `app/db/base.py`, `app/main.py`, `app/api/v1/router.py`, `tests/conftest.py`.
- `app/services/financas.py` (+ métodos de consulta/categoria/exclusão), `app/api/v1/endpoints/financas.py` (endpoints passam a usar esses métodos).
- `app/services/agenda.py` (+`listar_periodo`), `app/services/registros.py` (+`listar_anotacoes`, `get_anotacao`, `listar_tarefas`, `definir_subtarefa`, `definir_checkin`).

**Frontend**
- `bussola_web/nginx.conf` (+3 `location`).
- `bussola_web/src/services/api.ts` (+wrappers), `src/routes/index.jsx` (+`RequireAuth`, rota), `src/pages/Login/index.jsx` (decode único do `next`).
- Novos: `src/pages/Auth/AutorizarConexao.jsx` + `.css`, `src/components/UserDrawer/ConexoesMcp.jsx` + `.css`; `src/components/UserDrawer/index.jsx` (renderiza a seção).

**Docs**: `docs/MCP.md` (novo), `CLAUDE.md` (linha na tabela de módulos).

---

### Task 0: Branch e ajustes da spec

**Files:**
- Modify: `docs/superpowers/specs/2026-10-01-mcp-server-design.md`

- [ ] **Step 1: Criar o branch**

```bash
git checkout -b feat/mcp-server
```

- [ ] **Step 2: Atualizar a spec** com a seção "Ajustes à spec descobertos no planejamento" acima: adicionar ao fim da spec uma seção `## 9. Ajustes do planejamento` copiando os 5 bullets, e corrigir no corpo: §3.2 (duas rotas explícitas apontando para `mcp_asgi`, em vez de mount), §4.2/§4.4 (`/oauth/consent` do SPA → `/conexoes/autorizar`), §5.2 (`excluir_meta` → `arquivar_meta`, `panorama_geral(de, ate)`, `listar_tarefas(status)`).

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-10-01-mcp-server-design.md
git commit -m "docs(spec): ajustes do MCP descobertos no planejamento

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 1: Dependência, models, migration e `McpAuthService`

**Files:**
- Modify: `bussola_api/requirements.txt`, `bussola_api/app/core/config.py`, `bussola_api/app/models/__init__.py`, `bussola_api/app/db/base.py`
- Create: `bussola_api/app/models/mcp.py`, `bussola_api/alembic/versions/c7e2a9d4f1b3_add_mcp_auth_tables.py`, `bussola_api/app/services/mcp_auth.py`
- Test: `bussola_api/tests/test_mcp_auth_service.py`

**Interfaces:**
- Produces (`app/services/mcp_auth.py`):
  - `ESCOPOS_VALIDOS: tuple[str, str] = ("bussola:read", "bussola:write")`
  - `class OAuthErro(Exception)` com `.codigo: str`, `.descricao: str`
  - `agora() -> datetime` (UTC naive), `hash_token(valor: str) -> str`, `redirect_uri_permitida(uri: str) -> bool`, `normalizar_escopos(escopos: list[str] | str | None) -> list[str]`
  - `mcp_auth_service` com: `registrar_cliente(db, client_name: str | None, redirect_uris: list[str]) -> McpClient`; `get_cliente(db, client_id: str) -> McpClient | None`; `criar_codigo(db, client_id, user_id, redirect_uri, code_challenge, escopos: list[str]) -> str`; `trocar_codigo(db, client_id, codigo, redirect_uri, code_verifier) -> dict`; `renovar(db, client_id, refresh_token) -> dict`; `criar_pat(db, user_id, nome, escopos, validade_dias) -> tuple[McpToken, str]`; `verificar(db, token) -> McpToken | None`; `listar_conexoes(db, user_id) -> list[dict]`; `revogar_pat(db, user_id, token_id) -> bool`; `revogar_cliente(db, user_id, client_id) -> bool`.
  - O dict de `trocar_codigo`/`renovar`: `{"access_token", "token_type": "Bearer", "expires_in": 3600, "refresh_token", "scope"}`.
  - Cada item de `listar_conexoes`: `{"id": int | None, "tipo": "pat" | "oauth", "nome", "escopos": list[str], "criado_em", "ultimo_uso", "expira_em", "client_id": str | None}`.
- Produces (`app/core/config.py`): `settings.PUBLIC_BASE_URL: str`.

- [ ] **Step 1: Instalar o SDK e registrar a dependência**

Adicionar ao fim de `bussola_api/requirements.txt`:
```
mcp==2.2.0
```
Run (em `bussola_api/`): `venvbussola/Scripts/python.exe -m pip install mcp==2.2.0`
Expected: instala `mcp`, `mcp-types`, `httpx2`, `pyjwt`, `sse-starlette`, sem rebaixar `starlette`, `pydantic` ou `anyio`. Confirme com `venvbussola/Scripts/python.exe -c "from mcp.server.mcpserver import MCPServer; print('ok')"`.

- [ ] **Step 2: Adicionar a setting**

Em `app/core/config.py`, logo abaixo de `FRONTEND_URL: str = "http://localhost:5173"`:
```python
    # URL pública do backend vista pelos clientes MCP (issuer OAuth e resource /mcp).
    # Em produção: https://bussola.marocos.dev
    PUBLIC_BASE_URL: str = "http://localhost:8000"
```

- [ ] **Step 3: Criar os models** — `app/models/mcp.py`:

```python
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
```

Registrar em `app/models/__init__.py` (nova linha ao fim):
```python
from .mcp import McpClient, McpAuthCode, McpToken
```
E em `app/db/base.py`, junto dos outros imports de models (o `create_all` do `main.py` usa esse módulo):
```python
from app.models.mcp import McpClient, McpAuthCode, McpToken  # noqa: F401
```

- [ ] **Step 4: Migration à mão** — `alembic/versions/c7e2a9d4f1b3_add_mcp_auth_tables.py`:

```python
"""add_mcp_auth_tables

Revision ID: c7e2a9d4f1b3
Revises: b3d9f2a1c4e7
Create Date: 2026-10-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c7e2a9d4f1b3'
down_revision: Union[str, Sequence[str], None] = 'b3d9f2a1c4e7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Tabelas do Authorization Server do MCP (clientes, códigos, tokens).

    Escrita à mão: o create_all() do boot já cria as tabelas em prod; em um banco
    já populado use `alembic stamp head` (ver CLAUDE.md).
    """
    op.create_table(
        "mcp_client",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("client_id", sa.String(length=64), nullable=False),
        sa.Column("client_name", sa.String(length=200), nullable=False),
        sa.Column("redirect_uris", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_mcp_client_client_id", "mcp_client", ["client_id"], unique=True)

    op.create_table(
        "mcp_auth_code",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code_hash", sa.String(length=64), nullable=False),
        sa.Column("client_id", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("user.id"), nullable=False),
        sa.Column("redirect_uri", sa.String(length=500), nullable=False),
        sa.Column("code_challenge", sa.String(length=128), nullable=False),
        sa.Column("scopes", sa.String(length=200), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("used", sa.Boolean(), nullable=False),
    )
    op.create_index("ix_mcp_auth_code_code_hash", "mcp_auth_code", ["code_hash"], unique=True)

    op.create_table(
        "mcp_token",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("user.id"), nullable=False),
        sa.Column("client_id", sa.String(length=64), nullable=True),
        sa.Column("kind", sa.String(length=10), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("scopes", sa.String(length=200), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("last_used_at", sa.DateTime(), nullable=True),
        sa.Column("revoked", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_mcp_token_token_hash", "mcp_token", ["token_hash"], unique=True)
    op.create_index("ix_mcp_token_client_id", "mcp_token", ["client_id"], unique=False)


def downgrade() -> None:
    """Remove as tabelas do MCP."""
    op.drop_index("ix_mcp_token_client_id", table_name="mcp_token")
    op.drop_index("ix_mcp_token_token_hash", table_name="mcp_token")
    op.drop_table("mcp_token")
    op.drop_index("ix_mcp_auth_code_code_hash", table_name="mcp_auth_code")
    op.drop_table("mcp_auth_code")
    op.drop_index("ix_mcp_client_client_id", table_name="mcp_client")
    op.drop_table("mcp_client")
```

- [ ] **Step 5: Escrever os testes que falham** — `tests/test_mcp_auth_service.py`:

```python
import base64
import hashlib
from datetime import timedelta

import pytest

from app.models.mcp import McpAuthCode, McpToken
from app.services.mcp_auth import (
    OAuthErro, agora, hash_token, mcp_auth_service, normalizar_escopos,
)

REDIRECT = "https://claude.ai/api/mcp/auth_callback"


def _pkce():
    verifier = "verificador-pkce-" + "x" * 40
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    return verifier, challenge


def _par(db, user, escopos=("bussola:read", "bussola:write")):
    cliente = mcp_auth_service.registrar_cliente(db, "Claude", [REDIRECT])
    verifier, challenge = _pkce()
    codigo = mcp_auth_service.criar_codigo(db, cliente.client_id, user.id, REDIRECT, challenge, list(escopos))
    return cliente, mcp_auth_service.trocar_codigo(db, cliente.client_id, codigo, REDIRECT, verifier)


def test_registrar_cliente_rejeita_redirect_http_externo(db):
    with pytest.raises(OAuthErro) as erro:
        mcp_auth_service.registrar_cliente(db, "x", ["http://evil.com/cb"])
    assert erro.value.codigo == "invalid_redirect_uri"


def test_registrar_cliente_aceita_loopback_e_nome_padrao(db):
    cliente = mcp_auth_service.registrar_cliente(db, None, ["http://localhost:33418/callback"])
    assert cliente.client_name == "Cliente MCP"
    assert mcp_auth_service.get_cliente(db, cliente.client_id).id == cliente.id


def test_fluxo_codigo_emite_par_e_guarda_so_hash(db, user):
    _, par = _par(db, user, ("bussola:read",))
    assert par["access_token"].startswith("bsl_")
    assert par["refresh_token"].startswith("bsl_rt_")
    assert par["scope"] == "bussola:read"
    assert db.query(McpToken).filter(McpToken.token_hash == par["access_token"]).first() is None
    assert mcp_auth_service.verificar(db, par["access_token"]).user_id == user.id


def test_codigo_nao_pode_ser_reutilizado(db, user):
    cliente = mcp_auth_service.registrar_cliente(db, "Claude", [REDIRECT])
    verifier, challenge = _pkce()
    codigo = mcp_auth_service.criar_codigo(db, cliente.client_id, user.id, REDIRECT, challenge, ["bussola:read"])
    mcp_auth_service.trocar_codigo(db, cliente.client_id, codigo, REDIRECT, verifier)
    with pytest.raises(OAuthErro) as erro:
        mcp_auth_service.trocar_codigo(db, cliente.client_id, codigo, REDIRECT, verifier)
    assert erro.value.codigo == "invalid_grant"


def test_pkce_errado_e_redirect_diferente_falham(db, user):
    cliente = mcp_auth_service.registrar_cliente(db, "Claude", [REDIRECT])
    verifier, challenge = _pkce()
    codigo = mcp_auth_service.criar_codigo(db, cliente.client_id, user.id, REDIRECT, challenge, ["bussola:read"])
    with pytest.raises(OAuthErro):
        mcp_auth_service.trocar_codigo(db, cliente.client_id, codigo, REDIRECT, "outro-verificador-" + "y" * 40)
    with pytest.raises(OAuthErro):
        mcp_auth_service.trocar_codigo(db, cliente.client_id, codigo, "https://outro.dev/cb", verifier)


def test_codigo_expirado(db, user):
    cliente = mcp_auth_service.registrar_cliente(db, "Claude", [REDIRECT])
    verifier, challenge = _pkce()
    codigo = mcp_auth_service.criar_codigo(db, cliente.client_id, user.id, REDIRECT, challenge, ["bussola:read"])
    reg = db.query(McpAuthCode).filter(McpAuthCode.code_hash == hash_token(codigo)).first()
    reg.expires_at = agora() - timedelta(seconds=1)
    db.commit()
    with pytest.raises(OAuthErro):
        mcp_auth_service.trocar_codigo(db, cliente.client_id, codigo, REDIRECT, verifier)


def test_refresh_rotaciona_e_antigo_morre(db, user):
    cliente, par1 = _par(db, user)
    par2 = mcp_auth_service.renovar(db, cliente.client_id, par1["refresh_token"])
    assert par2["access_token"] != par1["access_token"]
    assert mcp_auth_service.verificar(db, par2["access_token"]) is not None
    with pytest.raises(OAuthErro):
        mcp_auth_service.renovar(db, cliente.client_id, par1["refresh_token"])


def test_refresh_nao_serve_como_access(db, user):
    _, par = _par(db, user)
    assert mcp_auth_service.verificar(db, par["refresh_token"]) is None


def test_verificar_rejeita_revogado_expirado_e_usuario_inativo(db, user):
    reg, token = mcp_auth_service.criar_pat(db, user.id, "CLI", ["bussola:read"], 30)
    assert mcp_auth_service.verificar(db, token) is not None
    assert reg.last_used_at is not None

    reg.expires_at = agora() - timedelta(seconds=1)
    db.commit()
    assert mcp_auth_service.verificar(db, token) is None

    reg.expires_at = agora() + timedelta(days=1)
    reg.revoked = True
    db.commit()
    assert mcp_auth_service.verificar(db, token) is None

    reg.revoked = False
    user.is_active = False
    db.commit()
    assert mcp_auth_service.verificar(db, token) is None


def test_conexoes_listam_pat_e_cliente_e_revogam(db, user):
    reg, _ = mcp_auth_service.criar_pat(db, user.id, "Claude Code", ["bussola:read", "bussola:write"], 90)
    cliente, _ = _par(db, user)
    conexoes = mcp_auth_service.listar_conexoes(db, user.id)
    assert {c["tipo"] for c in conexoes} == {"pat", "oauth"}
    oauth = next(c for c in conexoes if c["tipo"] == "oauth")
    assert oauth["client_id"] == cliente.client_id and oauth["nome"] == "Claude"

    assert mcp_auth_service.revogar_pat(db, user.id, reg.id) is True
    assert mcp_auth_service.revogar_cliente(db, user.id, cliente.client_id) is True
    assert mcp_auth_service.listar_conexoes(db, user.id) == []
    assert mcp_auth_service.revogar_pat(db, user.id, 9999) is False


def test_normalizar_escopos():
    assert normalizar_escopos(None) == ["bussola:read", "bussola:write"]
    assert normalizar_escopos("bussola:write") == ["bussola:read", "bussola:write"]
    assert normalizar_escopos(["bussola:read"]) == ["bussola:read"]
    with pytest.raises(OAuthErro):
        normalizar_escopos(["admin"])
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `venvbussola/Scripts/python.exe -m pytest tests/test_mcp_auth_service.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.mcp_auth'`.

- [ ] **Step 7: Implementar** — `app/services/mcp_auth.py`:

```python
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
```

- [ ] **Step 8: Rodar e ver passar**

Run: `venvbussola/Scripts/python.exe -m pytest tests/test_mcp_auth_service.py tests/test_migrations.py -q`
Expected: PASS (11 + 1).

- [ ] **Step 9: Commit**

```bash
git add requirements.txt app/core/config.py app/models/mcp.py app/models/__init__.py app/db/base.py alembic/versions/c7e2a9d4f1b3_add_mcp_auth_tables.py app/services/mcp_auth.py tests/test_mcp_auth_service.py
git commit -m "feat(mcp): models, migration e servico de auth (OAuth + PAT)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Endpoints OAuth (descoberta, registro, authorize, consent, token)

**Files:**
- Create: `bussola_api/app/api/v1/endpoints/oauth.py`
- Modify: `bussola_api/app/api/v1/router.py`, `bussola_api/app/main.py`
- Test: `bussola_api/tests/test_mcp_oauth_api.py`

**Interfaces:**
- Consumes: tudo de `app.services.mcp_auth` (Task 1); `settings.PUBLIC_BASE_URL`, `settings.FRONTEND_URL`.
- Produces: `oauth.public_router` (incluído em `main.py` sem prefixo); `oauth.router` (em `/api/v1/oauth`): `GET /clientes/{client_id}` → `{"client_id", "client_name"}`; `POST /consent` body `{client_id, redirect_uri, code_challenge, code_challenge_method, state, escopos: list[str], aprovado: bool}` → `{"redirect_url": str}`. `GET /oauth/authorize` válido → 302 para `{FRONTEND_URL}/conexoes/autorizar?<query original>`.

- [ ] **Step 1: Escrever os testes que falham** — `tests/test_mcp_oauth_api.py`:

```python
import base64
import hashlib
from urllib.parse import parse_qs, urlparse

REDIRECT = "https://claude.ai/api/mcp/auth_callback"


def _pkce():
    verifier = "verificador-pkce-" + "z" * 40
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    return verifier, challenge


def _registrar(client):
    r = client.post("/oauth/register", json={"client_name": "Claude", "redirect_uris": [REDIRECT]})
    assert r.status_code == 201, r.text
    return r.json()["client_id"]


def _consentir(client, client_id, challenge, aprovado=True, escopos=("bussola:read", "bussola:write")):
    r = client.post("/api/v1/oauth/consent", json={
        "client_id": client_id, "redirect_uri": REDIRECT, "code_challenge": challenge,
        "code_challenge_method": "S256", "state": "xyz", "escopos": list(escopos), "aprovado": aprovado,
    })
    assert r.status_code == 200, r.text
    return parse_qs(urlparse(r.json()["redirect_url"]).query)


def test_metadata_do_authorization_server_e_do_recurso(client):
    meta = client.get("/.well-known/oauth-authorization-server").json()
    assert meta["code_challenge_methods_supported"] == ["S256"]
    assert meta["token_endpoint"].endswith("/oauth/token")
    assert meta["registration_endpoint"].endswith("/oauth/register")
    recurso = client.get("/.well-known/oauth-protected-resource").json()
    assert recurso["resource"].endswith("/mcp")


def test_register_rejeita_redirect_inseguro(client):
    r = client.post("/oauth/register", json={"redirect_uris": ["http://evil.com/cb"]})
    assert r.status_code == 400
    assert r.json()["error"] == "invalid_redirect_uri"


def test_authorize_valido_vai_para_tela_de_consentimento(client):
    cid = _registrar(client)
    _, challenge = _pkce()
    r = client.get("/oauth/authorize", params={
        "response_type": "code", "client_id": cid, "redirect_uri": REDIRECT,
        "code_challenge": challenge, "code_challenge_method": "S256", "state": "abc",
    }, follow_redirects=False)
    assert r.status_code == 302
    assert "/conexoes/autorizar?" in r.headers["location"]
    assert f"client_id={cid}" in r.headers["location"]


def test_authorize_sem_pkce_devolve_erro_ao_cliente(client):
    cid = _registrar(client)
    r = client.get("/oauth/authorize", params={
        "response_type": "code", "client_id": cid, "redirect_uri": REDIRECT, "state": "abc",
    }, follow_redirects=False)
    assert r.status_code == 302
    assert r.headers["location"].startswith(REDIRECT)
    assert "error=invalid_request" in r.headers["location"]
    assert "state=abc" in r.headers["location"]


def test_authorize_com_redirect_nao_registrado_nao_redireciona(client):
    cid = _registrar(client)
    _, challenge = _pkce()
    r = client.get("/oauth/authorize", params={
        "response_type": "code", "client_id": cid, "redirect_uri": "https://evil.dev/cb",
        "code_challenge": challenge, "code_challenge_method": "S256",
    }, follow_redirects=False)
    assert r.status_code == 400


def test_fluxo_completo_token_e_refresh(client):
    cid = _registrar(client)
    verifier, challenge = _pkce()
    query = _consentir(client, cid, challenge)
    assert query["state"] == ["xyz"]

    r = client.post("/oauth/token", data={
        "grant_type": "authorization_code", "client_id": cid, "code": query["code"][0],
        "redirect_uri": REDIRECT, "code_verifier": verifier,
    })
    assert r.status_code == 200, r.text
    assert r.headers["cache-control"] == "no-store"
    par = r.json()
    assert par["token_type"] == "Bearer" and par["scope"] == "bussola:read bussola:write"

    r2 = client.post("/oauth/token", data={
        "grant_type": "refresh_token", "client_id": cid, "refresh_token": par["refresh_token"],
    })
    assert r2.status_code == 200
    assert r2.json()["access_token"] != par["access_token"]

    r3 = client.post("/oauth/token", data={
        "grant_type": "refresh_token", "client_id": cid, "refresh_token": par["refresh_token"],
    })
    assert r3.status_code == 400 and r3.json()["error"] == "invalid_grant"


def test_token_com_pkce_errado(client):
    cid = _registrar(client)
    _, challenge = _pkce()
    query = _consentir(client, cid, challenge)
    r = client.post("/oauth/token", data={
        "grant_type": "authorization_code", "client_id": cid, "code": query["code"][0],
        "redirect_uri": REDIRECT, "code_verifier": "errado-" + "e" * 50,
    })
    assert r.status_code == 400 and r.json()["error"] == "invalid_grant"


def test_consentimento_negado_volta_access_denied(client):
    cid = _registrar(client)
    _, challenge = _pkce()
    query = _consentir(client, cid, challenge, aprovado=False)
    assert query["error"] == ["access_denied"]
    assert "code" not in query


def test_ler_cliente_para_a_tela(client):
    cid = _registrar(client)
    assert client.get(f"/api/v1/oauth/clientes/{cid}").json()["client_name"] == "Claude"
    assert client.get("/api/v1/oauth/clientes/inexistente").status_code == 404
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `venvbussola/Scripts/python.exe -m pytest tests/test_mcp_oauth_api.py -q`
Expected: FAIL — 404 nas rotas `/.well-known/...` e `/oauth/...`.

- [ ] **Step 3: Implementar** — `app/api/v1/endpoints/oauth.py`:

```python
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
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, Form, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel, ConfigDict
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from app.api import deps
from app.core.config import settings
from app.services.mcp_auth import ESCOPOS_VALIDOS, OAuthErro, mcp_auth_service, normalizar_escopos

limiter = Limiter(key_func=get_remote_address)
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
def metadata_protected_resource():
    """Variante na raiz; a variante /mcp é servida pelo próprio SDK."""
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
    return {"client_id": cliente.client_id, "client_name": cliente.client_name}


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
```

Em `app/api/v1/router.py`, importar `oauth` junto dos outros endpoints e registrar:
```python
api_router.include_router(oauth.router, prefix="/oauth", tags=["OAuth MCP"])
```
Em `app/main.py`, logo após `app.include_router(api_router, prefix=settings.API_V1_STR)`:
```python
from app.api.v1.endpoints import oauth  # noqa: E402 — descoberta OAuth precisa ficar na raiz
app.include_router(oauth.public_router)
```

- [ ] **Step 4: Rodar e ver passar**

Run: `venvbussola/Scripts/python.exe -m pytest tests/test_mcp_oauth_api.py -q`
Expected: PASS (9 testes).

- [ ] **Step 5: Commit**

```bash
git add app/api/v1/endpoints/oauth.py app/api/v1/router.py app/main.py tests/test_mcp_oauth_api.py
git commit -m "feat(mcp): authorization server OAuth 2.1 (descoberta, DCR, PKCE, token)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Endpoints de conexões / PAT

**Files:**
- Create: `bussola_api/app/api/v1/endpoints/mcp_tokens.py`
- Modify: `bussola_api/app/api/v1/router.py`
- Test: `bussola_api/tests/test_mcp_tokens_api.py`

**Interfaces:**
- Consumes: `mcp_auth_service.criar_pat/listar_conexoes/revogar_pat/revogar_cliente`, `OAuthErro`.
- Produces (prefixo `/api/v1/mcp-tokens`): `GET ""` → lista de conexões (formato da Task 1, datas ISO); `POST ""` body `{nome, escopos?, validade_dias?}` → `{"id", "nome", "escopos", "expira_em", "token"}`; `DELETE /pat/{id}`; `DELETE /cliente/{client_id}`; 404 quando nada foi revogado.

- [ ] **Step 1: Testes que falham** — `tests/test_mcp_tokens_api.py`:

```python
from app.services.mcp_auth import mcp_auth_service


def test_criar_pat_retorna_token_uma_vez_e_lista(client, db, user):
    r = client.post("/api/v1/mcp-tokens", json={"nome": "Claude Code", "escopos": ["bussola:read"]})
    assert r.status_code == 200, r.text
    corpo = r.json()
    assert corpo["token"].startswith("bsl_pat_") and corpo["escopos"] == ["bussola:read"]
    assert mcp_auth_service.verificar(db, corpo["token"]).user_id == user.id

    lista = client.get("/api/v1/mcp-tokens").json()
    assert len(lista) == 1 and lista[0]["nome"] == "Claude Code"
    assert "token" not in lista[0]


def test_escopo_invalido_e_validade_fora_da_faixa(client):
    assert client.post("/api/v1/mcp-tokens", json={"nome": "x", "escopos": ["admin"]}).status_code == 400
    assert client.post("/api/v1/mcp-tokens", json={"nome": "x", "validade_dias": 999}).status_code == 422


def test_revogar_pat_e_cliente(client, db, user):
    pat_id = client.post("/api/v1/mcp-tokens", json={"nome": "CLI"}).json()["id"]
    assert client.delete(f"/api/v1/mcp-tokens/pat/{pat_id}").status_code == 200
    assert client.delete(f"/api/v1/mcp-tokens/pat/{pat_id}").status_code == 200  # já revogado: idempotente
    assert client.delete("/api/v1/mcp-tokens/pat/9999").status_code == 404
    assert client.delete("/api/v1/mcp-tokens/cliente/nao-existe").status_code == 404
    assert client.get("/api/v1/mcp-tokens").json() == []
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `venvbussola/Scripts/python.exe -m pytest tests/test_mcp_tokens_api.py -q`
Expected: FAIL — 404/405 em `/api/v1/mcp-tokens`.

- [ ] **Step 3: Implementar** — `app/api/v1/endpoints/mcp_tokens.py`:

```python
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
```

Em `app/api/v1/router.py`, importar `mcp_tokens` e registrar:
```python
api_router.include_router(mcp_tokens.router, prefix="/mcp-tokens", tags=["Conexões MCP"])
```

- [ ] **Step 4: Rodar e ver passar**

Run: `venvbussola/Scripts/python.exe -m pytest tests/test_mcp_tokens_api.py -q`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add app/api/v1/endpoints/mcp_tokens.py app/api/v1/router.py tests/test_mcp_tokens_api.py
git commit -m "feat(mcp): endpoints de conexoes e tokens pessoais

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Núcleo do servidor MCP (verificador, contexto, resolvers, montagem, `meu_perfil`)

**Files:**
- Create: `bussola_api/app/mcp/__init__.py`, `app/mcp/context.py`, `app/mcp/auth.py`, `app/mcp/resolvers.py`, `app/mcp/server.py`, `app/mcp/tools/__init__.py`, `app/mcp/tools/perfil.py`
- Modify: `bussola_api/app/main.py`, `bussola_api/tests/conftest.py`
- Test: `bussola_api/tests/test_mcp_server.py`

**Interfaces:**
- Consumes: `mcp_auth_service.verificar` (Task 1).
- Produces:
  - `app.mcp.context`: `ESCOPO_LEITURA = "bussola:read"`, `ESCOPO_ESCRITA = "bussola:write"`, `sessao()` (context manager → `Session`), `usuario_e_db(escopo=ESCOPO_LEITURA)` (context manager → `(db, user)`; traduz `HTTPException`/`ValueError`/`PermissionError` em `ToolError`), `exigir(obj, mensagem) -> obj`, `apenas_informados(**campos) -> dict`.
  - `app.mcp.resolvers`: `normalizar(texto) -> str`, `resolver(db, model, user_id, valor, rotulo, campo="nome", filtros=())`, `resolver_categoria(db, user_id, valor, tipo=None)`, `resolver_meta(db, user_id, valor)`, `resolver_grupo(db, user_id, valor)`, `resolver_habito(db, user_id, valor)`.
  - `app.mcp.tools`: `LEITURA`, `ESCRITA`, `DESTRUTIVA` (`ToolAnnotations`), `registrar(mcp, leitura=(), escrita=(), destrutivas=())`.
  - `app.mcp.server`: `mcp` (`MCPServer`), `mcp_asgi`, `mcp_lifespan()`, tupla `MODULOS` (cada módulo com `register(mcp)`).
  - Fixtures de teste: `mcp_db`, `outro_user`, `mcp_call(nome, escopos=(...), usuario=None, **args) -> dict` (devolve `structured_content`; erros sobem como `ToolError`).

- [ ] **Step 1: Fixtures de teste** — acrescentar ao fim de `tests/conftest.py`:

```python
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

    def _call(nome, escopos=("bussola:read", "bussola:write"), usuario=None, **args):
        alvo = usuario or user
        token = AccessToken(token="teste", client_id="teste", scopes=list(escopos), subject=str(alvo.id))
        marca = auth_context_var.set(AuthenticatedUser(token))
        try:
            resultado = anyio.run(mcp.call_tool, nome, args)
        finally:
            auth_context_var.reset(marca)
        return resultado.structured_content

    return _call
```

- [ ] **Step 2: Testes que falham** — `tests/test_mcp_server.py`:

```python
import anyio
import pytest
from mcp.server.mcpserver.exceptions import ToolError

from app.mcp.auth import BussolaTokenVerifier
from app.mcp.server import mcp
from app.services.mcp_auth import mcp_auth_service

MCP_HEADERS = {
    "Accept": "application/json, text/event-stream",
    "Content-Type": "application/json",
    "MCP-Protocol-Version": "2025-11-25",
}
LISTAR_TOOLS = {"jsonrpc": "2.0", "id": 1, "method": "tools/list"}


def test_mcp_sem_token_responde_401_com_descoberta(client):
    r = client.post("/mcp", json=LISTAR_TOOLS, headers=MCP_HEADERS)
    assert r.status_code == 401
    assert "/.well-known/oauth-protected-resource/mcp" in r.headers["www-authenticate"]


def test_metadata_do_recurso_servida_pelo_sdk(client):
    r = client.get("/.well-known/oauth-protected-resource/mcp")
    assert r.status_code == 200
    assert r.json()["resource"].endswith("/mcp")


def test_pat_valido_lista_tools_e_revogado_volta_401(client, mcp_db, user):
    reg, token = mcp_auth_service.criar_pat(mcp_db, user.id, "CLI", ["bussola:read"], 30)
    headers = {**MCP_HEADERS, "Authorization": f"Bearer {token}"}
    r = client.post("/mcp", json=LISTAR_TOOLS, headers=headers)
    assert r.status_code == 200, r.text
    assert "meu_perfil" in r.text

    mcp_auth_service.revogar_pat(mcp_db, user.id, reg.id)
    assert client.post("/mcp", json=LISTAR_TOOLS, headers=headers).status_code == 401


def test_rotas_do_mcp_nao_engolem_o_resto_da_api(client):
    # Um mount na raiz responderia 404 em texto puro e quebraria o redirect de barra final.
    assert client.get("/nao-existe").json() == {"detail": "Not Found"}
    assert client.get("/api/v1/financas", follow_redirects=False).status_code == 307


def test_verificador_resolve_pat(mcp_db, user):
    _, token = mcp_auth_service.criar_pat(mcp_db, user.id, "CLI", ["bussola:read"], 30)
    acesso = anyio.run(BussolaTokenVerifier().verify_token, token)
    assert acesso.subject == str(user.id)
    assert acesso.scopes == ["bussola:read"]
    assert anyio.run(BussolaTokenVerifier().verify_token, "bsl_invalido") is None


def test_meu_perfil(mcp_call):
    perfil = mcp_call("meu_perfil")
    assert perfil["email"] == "teste@bussola.dev"
    assert len(perfil["hoje"]) == 10


def test_sem_escopo_de_leitura_e_bloqueado(mcp_call):
    with pytest.raises(ToolError, match="bussola:read"):
        mcp_call("meu_perfil", escopos=())


def test_sem_autenticacao_e_bloqueado(mcp_db):
    with pytest.raises(ToolError, match="sem autenticação"):
        anyio.run(mcp.call_tool, "meu_perfil", {})
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `venvbussola/Scripts/python.exe -m pytest tests/test_mcp_server.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.mcp'`.

- [ ] **Step 4: Implementar o pacote** —

`app/mcp/__init__.py`:
```python
"""Servidor MCP do Bussola: expõe os módulos como tools para o Claude."""
```

`app/mcp/context.py`:
```python
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
```

`app/mcp/auth.py`:
```python
"""Verificador de Bearer do MCP: token -> McpToken (por hash) -> AccessToken do SDK."""

from datetime import timezone

import anyio
from mcp.server.auth.provider import AccessToken

from app.mcp.context import sessao
from app.services.mcp_auth import mcp_auth_service


def verificar_token(token: str) -> AccessToken | None:
    with sessao() as db:
        reg = mcp_auth_service.verificar(db, token)
        if not reg:
            return None
        expira = int(reg.expires_at.replace(tzinfo=timezone.utc).timestamp()) if reg.expires_at else None
        return AccessToken(
            token=token,
            client_id=reg.client_id or f"pat:{reg.id}",
            scopes=reg.scopes.split(),
            expires_at=expira,
            subject=str(reg.user_id),
        )


class BussolaTokenVerifier:
    async def verify_token(self, token: str) -> AccessToken | None:
        return await anyio.to_thread.run_sync(verificar_token, token)
```

`app/mcp/resolvers.py`:
```python
"""Resolve "nome ou id" -> registro do usuário, sem diferenciar maiúsculas/acentos."""

import unicodedata

from mcp.server.mcpserver.exceptions import ToolError

from app.models.financas import Categoria
from app.models.metas import Meta
from app.models.registros import GrupoAnotacao, Habito


def normalizar(texto: str) -> str:
    sem_acento = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    return sem_acento.casefold().strip()


def resolver(db, model, user_id: int, valor, rotulo: str, campo: str = "nome", filtros=()):
    query = db.query(model).filter(model.user_id == user_id, *filtros)
    texto = str(valor).strip()
    if texto.isdigit():
        reg = query.filter(model.id == int(texto)).first()
        if not reg:
            raise ToolError(f"{rotulo} com id {texto} não encontrado(a).")
        return reg

    alvo = normalizar(texto)
    candidatos = query.all()
    exatos = [c for c in candidatos if normalizar(getattr(c, campo) or "") == alvo]
    if len(exatos) == 1:
        return exatos[0]
    parciais = exatos or [c for c in candidatos if alvo in normalizar(getattr(c, campo) or "")]
    if len(parciais) == 1:
        return parciais[0]

    def descrever(c):
        tipo = getattr(c, "tipo", None)
        return f"{getattr(c, campo)} ({tipo})" if tipo else str(getattr(c, campo))

    opcoes = ", ".join(sorted(descrever(c) for c in (parciais or candidatos))) or "nenhum cadastrado"
    motivo = "é ambíguo" if parciais else "não foi encontrado"
    raise ToolError(f"{rotulo} '{texto}' {motivo}. Opções: {opcoes}")


def resolver_categoria(db, user_id: int, valor, tipo: str | None = None):
    filtros = (Categoria.tipo == tipo,) if tipo else ()
    return resolver(db, Categoria, user_id, valor, "Categoria", filtros=filtros)


def resolver_meta(db, user_id: int, valor):
    return resolver(db, Meta, user_id, valor, "Meta", filtros=(Meta.status != "arquivada",))


def resolver_grupo(db, user_id: int, valor):
    return resolver(db, GrupoAnotacao, user_id, valor, "Grupo")


def resolver_habito(db, user_id: int, valor):
    return resolver(db, Habito, user_id, valor, "Hábito", campo="titulo")
```

`app/mcp/tools/__init__.py`:
```python
"""Tools MCP por módulo. Cada módulo expõe `register(mcp)`."""

from mcp_types import ToolAnnotations

LEITURA = ToolAnnotations(read_only_hint=True)
ESCRITA = ToolAnnotations(read_only_hint=False, destructive_hint=False)
DESTRUTIVA = ToolAnnotations(read_only_hint=False, destructive_hint=True)


def registrar(mcp, leitura=(), escrita=(), destrutivas=()):
    for fn in leitura:
        mcp.tool(annotations=LEITURA)(fn)
    for fn in escrita:
        mcp.tool(annotations=ESCRITA)(fn)
    for fn in destrutivas:
        mcp.tool(annotations=DESTRUTIVA)(fn)
```

`app/mcp/tools/perfil.py`:
```python
"""Tools de perfil: quem é o usuário e que dia é hoje (base para datas relativas)."""

from typing import Any

from app.core.timezone import PROJECT_TIMEZONE, now_local
from app.mcp.context import usuario_e_db
from app.mcp.tools import registrar

DIAS = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"]


def meu_perfil() -> dict[str, Any]:
    """Nome, email e cidade do usuário e a data/hora atual no fuso dele.
    Chame antes de interpretar datas relativas ("amanhã", "mês passado")."""
    with usuario_e_db() as (db, user):
        agora = now_local()
        return {
            "nome": user.full_name,
            "email": user.email,
            "cidade": user.city,
            "agora": agora.strftime("%Y-%m-%dT%H:%M"),
            "hoje": agora.date().isoformat(),
            "dia_semana": DIAS[agora.weekday()],
            "fuso": str(PROJECT_TIMEZONE),
        }


def register(mcp):
    registrar(mcp, leitura=(meu_perfil,))
```

`app/mcp/server.py`:
```python
"""
=======================================================================================
ARQUIVO: server.py (MCP - servidor do Bussola)
=======================================================================================

OBJETIVO:
    Instância MCPServer com auth (o Bussola é o resource server e o authorization
    server), registro das tools de cada módulo e o app ASGI ligado ao
    FastAPI — o app do SDK serve /mcp e /.well-known/oauth-protected-resource/mcp.
=======================================================================================
"""

from contextlib import asynccontextmanager

from mcp.server.auth.settings import AuthSettings
from mcp.server.mcpserver import MCPServer
from mcp.server.transport_security import TransportSecuritySettings

from app.core.config import settings
from app.mcp.auth import BussolaTokenVerifier
from app.mcp.context import ESCOPO_LEITURA
from app.mcp.tools import perfil

MODULOS = (perfil,)

_base = settings.PUBLIC_BASE_URL.rstrip("/")

mcp = MCPServer(
    name="bussola",
    title="Bússola",
    instructions=(
        "Sistema operacional pessoal do usuário: finanças, metas (cofrinhos), agenda, "
        "anotações, tarefas, hábitos, saúde (Ritmo) e cofre de senhas (só metadados). "
        "Chame meu_perfil para saber a data de hoje. Valores em reais; datas ISO (AAAA-MM-DD). "
        "Categorias, metas, grupos e hábitos aceitam nome ou id."
    ),
    token_verifier=BussolaTokenVerifier(),
    auth=AuthSettings(
        issuer_url=_base,
        resource_server_url=f"{_base}/mcp",
        required_scopes=[ESCOPO_LEITURA],
        validate_token_resource=False,  # nosso verificador já confere o token no banco
    ),
)

for modulo in MODULOS:
    modulo.register(mcp)


class McpAsgi:
    """App ASGI apontado pelas rotas /mcp do FastAPI. O SDK só deixa o session manager rodar UMA vez por
    instância e o lifespan do FastAPI roda a cada TestClient — então cada lifespan
    recria o app Starlette do MCP (e com ele um session manager novo)."""

    def __init__(self):
        self.app = None

    async def __call__(self, scope, receive, send):
        await self.app(scope, receive, send)


mcp_asgi = McpAsgi()


@asynccontextmanager
async def mcp_lifespan():
    mcp_asgi.app = mcp.streamable_http_app(
        streamable_http_path="/mcp",
        stateless_http=True,   # 2 workers do uvicorn: nada de sessão em memória
        json_response=True,
        # O default liga proteção de DNS rebinding só para localhost e rejeitaria
        # Host: bussola.marocos.dev. Servidor remoto com Bearer não precisa dela.
        transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
    )
    async with mcp.session_manager.run():
        yield
```

- [ ] **Step 5: Montar no `main.py`**

No topo de `app/main.py` (junto dos imports do FastAPI):
```python
from contextlib import asynccontextmanager
```
Após o import do `api_router`:
```python
from app.mcp.server import mcp_asgi, mcp_lifespan
```
Antes de `app = FastAPI(`:
```python
@asynccontextmanager
async def lifespan(_app: FastAPI):
    async with mcp_lifespan():
        yield
```
Adicionar `lifespan=lifespan,` aos argumentos de `FastAPI(...)`. E, ao fim do arquivo (depois de `def root()`):
```python
# MCP: só os dois caminhos que o app do SDK serve. NÃO usar app.mount("/") — um mount
# na raiz casa qualquer caminho e desliga o redirect de barra final da API inteira.
app.router.add_route("/mcp", mcp_asgi, include_in_schema=False)
app.router.add_route("/.well-known/oauth-protected-resource/mcp", mcp_asgi, include_in_schema=False)
```
(Uma `Route` cujo endpoint é um app ASGI aceita todos os métodos e repassa o `scope` intacto; o app Starlette do SDK roteia pelo mesmo path.)

- [ ] **Step 6: Rodar e ver passar**

Run: `venvbussola/Scripts/python.exe -m pytest tests/test_mcp_server.py -q`
Expected: PASS (8 testes). Se `test_pat_valido_lista_tools...` responder 400/406, confira os headers `Accept` e `MCP-Protocol-Version` contra `mcp/server/streamable_http.py` do SDK instalado antes de mexer no servidor.

- [ ] **Step 7: Suíte inteira (o lifespan agora roda em todo TestClient)**

Run: `venvbussola/Scripts/python.exe -m pytest -q`
Expected: PASS em tudo (inclusive os testes antigos de financas/metas/registros).

- [ ] **Step 8: Commit**

```bash
git add app/mcp app/main.py tests/conftest.py tests/test_mcp_server.py
git commit -m "feat(mcp): servidor MCP montado no backend com auth e meu_perfil

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Finanças — regras que estavam nos endpoints vão para o service

**Files:**
- Modify: `bussola_api/app/services/financas.py`, `bussola_api/app/api/v1/endpoints/financas.py`
- Test: `bussola_api/tests/test_financas_service_mcp.py` (+ existentes `test_financas_*.py`)

**Interfaces:**
- Produces (métodos novos em `FinancasService`):
  - `listar_transacoes(db, user_id, mes: str | None = None, categoria_id: int | None = None, tipo: str | None = None, status: str | None = None, busca: str | None = None, limite: int = 50) -> list[Transacao]` (`mes` = `"AAAA-MM"`, `tipo` = tipo da categoria)
  - `listar_categorias(db, user_id, tipo: str | None = None) -> list[Categoria]`
  - `definir_status_transacao(db, id, status, user_id) -> Transacao | None`
  - `excluir_transacao(db, id, user_id) -> bool` — `ValueError` se a série tem efetivadas
  - `criar_categoria(db, dados: CategoriaCreate, user_id) -> Categoria` — `ValueError` (nome reservado/duplicado)
  - `atualizar_categoria(db, id, dados: CategoriaUpdate, user_id) -> Categoria | None` — `PermissionError` (Indefinida)
  - `excluir_categoria(db, id, user_id) -> bool` — `PermissionError` (Indefinida)

- [ ] **Step 1: Testes que falham** — `tests/test_financas_service_mcp.py`:

```python
from datetime import datetime

import pytest

from app.models.financas import Categoria, Transacao
from app.schemas.financas import CategoriaCreate, CategoriaUpdate, TransacaoCreate
from app.services.financas import financas_service


@pytest.fixture
def cats(db, user):
    mercado = Categoria(nome="Mercado", tipo="despesa", user_id=user.id)
    salario = Categoria(nome="Salário", tipo="receita", user_id=user.id)
    db.add_all([mercado, salario])
    db.commit()
    return mercado, salario


def _t(db, user, cat, descricao, valor, data, **extra):
    return financas_service.criar_transacao(
        db, TransacaoCreate(descricao=descricao, valor=valor, data=data, categoria_id=cat.id, **extra), user.id
    )


def test_listar_transacoes_filtros(db, user, cats):
    mercado, salario = cats
    _t(db, user, mercado, "Feira", 10, datetime(2026, 10, 1))
    _t(db, user, salario, "Salário", 5000, datetime(2026, 10, 5))
    _t(db, user, mercado, "Antiga", 7, datetime(2026, 9, 1))
    assert [t.descricao for t in financas_service.listar_transacoes(db, user.id, mes="2026-10", tipo="despesa")] == ["Feira"]
    assert len(financas_service.listar_transacoes(db, user.id, categoria_id=mercado.id)) == 2
    assert [t.descricao for t in financas_service.listar_transacoes(db, user.id, busca="feir")] == ["Feira"]
    assert len(financas_service.listar_transacoes(db, user.id, limite=1)) == 1


def test_definir_status_e_excluir_pontual(db, user, cats):
    t = _t(db, user, cats[0], "Feira", 10, datetime(2026, 10, 1))
    assert financas_service.definir_status_transacao(db, t.id, "Pendente", user.id).status == "Pendente"
    assert financas_service.excluir_transacao(db, t.id, user.id) is True
    assert financas_service.excluir_transacao(db, t.id, user.id) is False


def test_excluir_serie_com_efetivada_bloqueia(db, user, cats):
    t = _t(db, user, cats[0], "TV", 300, datetime(2026, 10, 1), tipo_recorrencia="parcelada", total_parcelas=3)
    financas_service.definir_status_transacao(db, t.id, "Efetivada", user.id)
    with pytest.raises(ValueError, match="efetivados"):
        financas_service.excluir_transacao(db, t.id, user.id)


def test_categoria_crud_regras(db, user):
    c = financas_service.criar_categoria(db, CategoriaCreate(nome="Pets", tipo="despesa"), user.id)
    with pytest.raises(ValueError, match="Já existe"):
        financas_service.criar_categoria(db, CategoriaCreate(nome="pets", tipo="despesa"), user.id)
    with pytest.raises(ValueError, match="reservado"):
        financas_service.criar_categoria(db, CategoriaCreate(nome="Indefinida", tipo="despesa"), user.id)
    assert financas_service.atualizar_categoria(db, c.id, CategoriaUpdate(meta_limite=200), user.id).meta_limite == 200
    indef = financas_service.get_or_create_indefinida(db, "despesa", user.id)
    with pytest.raises(PermissionError):
        financas_service.excluir_categoria(db, indef.id, user.id)
    assert [x.nome for x in financas_service.listar_categorias(db, user.id, tipo="despesa")] == ["Indefinida (Despesa)", "Pets"]


def test_excluir_categoria_move_transacoes_so_do_usuario(db, user, cats):
    mercado = cats[0]
    t = _t(db, user, mercado, "Feira", 10, datetime(2026, 10, 1))
    assert financas_service.excluir_categoria(db, mercado.id, user.id) is True
    db.refresh(t)
    assert t.categoria.nome == "Indefinida (Despesa)"
    assert financas_service.excluir_categoria(db, mercado.id, user.id) is False
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `venvbussola/Scripts/python.exe -m pytest tests/test_financas_service_mcp.py -q`
Expected: FAIL — `AttributeError: 'FinancasService' object has no attribute 'listar_transacoes'`.

- [ ] **Step 3: Implementar no service** — em `app/services/financas.py`, trocar o import de schemas por:
```python
from app.schemas.financas import CategoriaCreate, CategoriaUpdate, TransacaoCreate, TransacaoUpdate
```
e adicionar à classe `FinancasService` (antes do `financas_service = FinancasService()` do fim):

```python
    # --- Consultas e regras usadas pelos endpoints e pelo MCP ---

    def listar_transacoes(self, db: Session, user_id: int, mes: str = None, categoria_id: int = None,
                          tipo: str = None, status: str = None, busca: str = None, limite: int = 50):
        """Transações do usuário com filtros. `mes` = 'AAAA-MM'; `tipo` = tipo da categoria."""
        query = db.query(Transacao).join(Categoria).filter(Transacao.user_id == user_id)
        if mes:
            inicio = datetime.strptime(mes, "%Y-%m")
            query = query.filter(Transacao.data >= inicio, Transacao.data < inicio + relativedelta(months=1))
        if categoria_id:
            query = query.filter(Transacao.categoria_id == categoria_id)
        if tipo:
            query = query.filter(Categoria.tipo == tipo)
        if status:
            query = query.filter(Transacao.status == status)
        if busca:
            query = query.filter(Transacao.descricao.ilike(f"%{busca}%"))
        return query.order_by(Transacao.data.desc(), Transacao.id.desc()).limit(limite).all()

    def listar_categorias(self, db: Session, user_id: int, tipo: str = None):
        query = db.query(Categoria).filter(Categoria.user_id == user_id)
        if tipo:
            query = query.filter(Categoria.tipo == tipo)
        return query.order_by(Categoria.tipo, Categoria.nome).all()

    def definir_status_transacao(self, db: Session, id: int, status: str, user_id: int):
        transacao = db.query(Transacao).filter(Transacao.id == id, Transacao.user_id == user_id).first()
        if not transacao:
            return None
        transacao.status = status
        db.commit()
        db.refresh(transacao)
        return transacao

    def excluir_transacao(self, db: Session, id: int, user_id: int) -> bool:
        """
        Exclui protegendo o histórico efetivado.
        - Pontual: excluída normalmente.
        - Recorrente/Parcelada: se QUALQUER ocorrência já foi 'Efetivada', bloqueia
          (ValueError) — use encerrar_recorrencia. Se nenhuma foi, remove a série inteira.
        """
        transacao = db.query(Transacao).filter(Transacao.id == id, Transacao.user_id == user_id).first()
        if not transacao:
            return False

        if transacao.id_grupo_recorrencia and transacao.tipo_recorrencia in ['recorrente', 'parcelada']:
            grupo = db.query(Transacao).filter(
                Transacao.id_grupo_recorrencia == transacao.id_grupo_recorrencia,
                Transacao.user_id == user_id,
            )
            if grupo.filter(Transacao.status == 'Efetivada').count() > 0:
                raise ValueError(
                    "Série com lançamentos efetivados não pode ser excluída. "
                    "Encerre a recorrência para cancelar os pendentes."
                )
            grupo.delete(synchronize_session=False)
        else:
            db.delete(transacao)

        db.commit()
        return True

    def criar_categoria(self, db: Session, dados: CategoriaCreate, user_id: int) -> Categoria:
        if "indefinida" in dados.nome.strip().lower():
            raise ValueError("O nome 'Indefinida' é reservado pelo sistema.")
        existe = db.query(Categoria).filter(
            func.lower(Categoria.nome) == dados.nome.lower(),
            Categoria.tipo == dados.tipo,
            Categoria.user_id == user_id,
        ).first()
        if existe:
            raise ValueError(f"Já existe uma categoria '{dados.nome}' do tipo {dados.tipo.value}.")
        categoria = Categoria(**dados.model_dump(), user_id=user_id)
        db.add(categoria)
        db.commit()
        db.refresh(categoria)
        return categoria

    def atualizar_categoria(self, db: Session, id: int, dados: CategoriaUpdate, user_id: int):
        categoria = db.query(Categoria).filter(Categoria.id == id, Categoria.user_id == user_id).first()
        if not categoria:
            return None
        if "indefinida" in categoria.nome.lower():
            raise PermissionError("A categoria padrão do sistema não pode ser editada.")
        for chave, valor in dados.model_dump(exclude_unset=True).items():
            setattr(categoria, chave, valor)
        db.commit()
        db.refresh(categoria)
        return categoria

    def excluir_categoria(self, db: Session, id: int, user_id: int) -> bool:
        """Exclui a categoria; transações dela vão para a 'Indefinida' do mesmo tipo."""
        categoria = db.query(Categoria).filter(Categoria.id == id, Categoria.user_id == user_id).first()
        if not categoria:
            return False
        if "indefinida" in categoria.nome.lower():
            raise PermissionError("A categoria padrão do sistema não pode ser excluída.")

        transacoes = db.query(Transacao).filter(Transacao.categoria_id == id, Transacao.user_id == user_id).all()
        if transacoes:
            destino = self.get_or_create_indefinida(db, categoria.tipo, user_id)
            for transacao in transacoes:
                transacao.categoria_id = destino.id

        db.delete(categoria)
        db.commit()
        return True
```

- [ ] **Step 4: Endpoints passam a usar o service** — em `app/api/v1/endpoints/financas.py`, substituir os corpos de `delete_transacao`, `create_categoria`, `update_categoria` e `delete_categoria` (mantendo decorators, assinaturas e docstrings) por:

```python
# delete_transacao
    try:
        excluida = financas_service.excluir_transacao(db, id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not excluida:
        raise HTTPException(status_code=404, detail="Transação não encontrada")
    return {"status": "success"}

# create_categoria
    try:
        return financas_service.criar_categoria(db, cat_in, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# update_categoria
    try:
        cat = financas_service.atualizar_categoria(db, id, cat_in, current_user.id)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    if not cat:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    return cat

# delete_categoria
    try:
        excluida = financas_service.excluir_categoria(db, id, current_user.id)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    if not excluida:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    return {"status": "success", "message": "Categoria excluída e transações movidas."}
```
Depois remova imports que ficaram sem uso no arquivo de endpoint (ex.: `func`, se nada mais o usa — confira com grep antes).

- [ ] **Step 5: Rodar e ver passar (novos + antigos)**

Run: `venvbussola/Scripts/python.exe -m pytest tests/test_financas_service_mcp.py tests/test_financas_delete.py tests/test_financas_grupos.py tests/test_financas_money.py tests/test_financas_resumo.py tests/test_caixa.py -q`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/services/financas.py app/api/v1/endpoints/financas.py tests/test_financas_service_mcp.py
git commit -m "refactor(financas): regras de categoria e exclusao no service + consultas filtradas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Tools de Finanças

**Files:**
- Create: `bussola_api/app/mcp/tools/financas.py`
- Modify: `bussola_api/app/mcp/server.py` (adicionar `financas` a `MODULOS`)
- Test: `bussola_api/tests/test_mcp_financas.py`

**Interfaces:**
- Consumes: Task 4 (`usuario_e_db`, `exigir`, `apenas_informados`, `resolver_categoria`, `registrar`), Task 5 (métodos do service), `panorama_service.get_dashboard_data(db, user_id, start_date, end_date)`.
- Produces (tools): `resumo_financeiro(mes)`, `listar_transacoes(mes, categoria, tipo, status, busca, limite)`, `listar_categorias(tipo)`, `salvar_transacao(...)`, `marcar_pagamento(id, pago)`, `encerrar_recorrencia(id)`, `excluir_transacao(id)`, `salvar_categoria(...)`, `excluir_categoria(categoria)`, `salvar_ajuste_caixa(...)`, `excluir_ajuste_caixa(id)`. Helper `parse_mes(mes: str | None) -> datetime` (primeiro dia do mês; `None` = mês atual) — reutilizado por nenhum outro módulo, fica local.

- [ ] **Step 1: Testes que falham** — `tests/test_mcp_financas.py`:

```python
from datetime import date

import pytest
from mcp.server.mcpserver.exceptions import ToolError

from app.models.financas import Categoria


@pytest.fixture
def categorias(db, user):
    db.add_all([
        Categoria(nome="Mercado", tipo="despesa", user_id=user.id),
        Categoria(nome="Salário", tipo="receita", user_id=user.id),
    ])
    db.commit()


def _feira(mcp_call, **extra):
    return mcp_call("salvar_transacao", descricao="Feira", valor=42.9, data="2026-10-01",
                    categoria="mercado", **extra)


def test_cria_transacao_por_nome_de_categoria(mcp_call, categorias):
    t = _feira(mcp_call, tipo_pagamento="debito")
    assert t["categoria"] == "Mercado" and t["valor"] == 42.9
    assert t["status"] == "Efetivada" and t["tipo_pagamento"] == "debito"


def test_categoria_inexistente_lista_opcoes(mcp_call, categorias):
    with pytest.raises(ToolError, match="não foi encontrado. Opções: .*Mercado"):
        mcp_call("salvar_transacao", descricao="X", valor=1, categoria="mercadoo")


def test_categoria_homonima_pede_tipo(mcp_call, db, user):
    db.add_all([Categoria(nome="Investimentos", tipo="despesa", user_id=user.id),
                Categoria(nome="Investimentos", tipo="receita", user_id=user.id)])
    db.commit()
    with pytest.raises(ToolError, match="ambíguo"):
        mcp_call("salvar_transacao", descricao="Aporte", valor=100, categoria="Investimentos")
    t = mcp_call("salvar_transacao", descricao="Aporte", valor=100, categoria="Investimentos", tipo="despesa")
    assert t["tipo"] == "despesa"


def test_criar_exige_campos(mcp_call, categorias):
    with pytest.raises(ToolError, match="descricao, valor e categoria"):
        mcp_call("salvar_transacao", descricao="Sem valor", categoria="Mercado")
    with pytest.raises(ToolError, match="total_parcelas"):
        mcp_call("salvar_transacao", descricao="TV", valor=900, categoria="Mercado", tipo_recorrencia="parcelada")


def test_listar_transacoes_filtra_e_valida_mes(mcp_call, categorias):
    _feira(mcp_call)
    mcp_call("salvar_transacao", descricao="Salário", valor=5000, data="2026-10-05", categoria="Salário")
    mcp_call("salvar_transacao", descricao="Antiga", valor=7, data="2026-09-01", categoria="Mercado")
    r = mcp_call("listar_transacoes", mes="2026-10", tipo="despesa")
    assert [t["descricao"] for t in r["itens"]] == ["Feira"]
    with pytest.raises(ToolError, match="AAAA-MM"):
        mcp_call("listar_transacoes", mes="outubro")


def test_editar_altera_so_o_enviado(mcp_call, categorias):
    t = _feira(mcp_call)
    r = mcp_call("salvar_transacao", id=t["id"], valor=50)
    assert r["valor"] == 50 and r["descricao"] == "Feira" and r["categoria"] == "Mercado"


def test_marcar_pagamento_e_idempotente(mcp_call, categorias):
    t = mcp_call("salvar_transacao", descricao="TV", valor=300, data="2026-10-10", categoria="Mercado",
                 tipo_recorrencia="parcelada", total_parcelas=3)
    assert t["status"] == "Pendente"
    assert mcp_call("marcar_pagamento", id=t["id"], pago=True)["status"] == "Efetivada"
    assert mcp_call("marcar_pagamento", id=t["id"], pago=True)["status"] == "Efetivada"
    assert mcp_call("marcar_pagamento", id=t["id"], pago=False)["status"] == "Pendente"


def test_excluir_e_isolamento(mcp_call, categorias, outro_user):
    t = _feira(mcp_call)
    with pytest.raises(ToolError, match="não encontrada"):
        mcp_call("excluir_transacao", usuario=outro_user, id=t["id"])
    assert mcp_call("listar_transacoes", usuario=outro_user)["itens"] == []
    assert mcp_call("excluir_transacao", id=t["id"]) == {"ok": True}


def test_escopo_de_leitura_nao_escreve(mcp_call, categorias):
    with pytest.raises(ToolError, match="bussola:write"):
        _feira(mcp_call, escopos=("bussola:read",))


def test_categorias_crud(mcp_call):
    c = mcp_call("salvar_categoria", nome="Pets", tipo="despesa", meta_limite=200)
    assert c["meta_limite"] == 200
    assert mcp_call("salvar_categoria", id=c["id"], cor="#ff0000")["cor"] == "#ff0000"
    with pytest.raises(ToolError, match="reservado"):
        mcp_call("salvar_categoria", nome="Indefinida", tipo="despesa")
    assert "Pets" in [x["nome"] for x in mcp_call("listar_categorias", tipo="despesa")["itens"]]
    assert mcp_call("excluir_categoria", categoria="pets") == {"ok": True}


def test_resumo_financeiro_e_ajuste_de_caixa(mcp_call, categorias):
    hoje = date.today().isoformat()
    mcp_call("salvar_transacao", descricao="Feira", valor=10, data=hoje, categoria="Mercado")
    ajuste = mcp_call("salvar_ajuste_caixa", valor=1000)
    resumo = mcp_call("resumo_financeiro")
    assert resumo["despesa"] == 10
    assert resumo["caixa"] == 990
    assert mcp_call("excluir_ajuste_caixa", id=ajuste["id"]) == {"ok": True}
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `venvbussola/Scripts/python.exe -m pytest tests/test_mcp_financas.py -q`
Expected: FAIL — `ToolError: Unknown tool: salvar_transacao`.

- [ ] **Step 3: Implementar** — `app/mcp/tools/financas.py`:

```python
"""
=======================================================================================
ARQUIVO: tools/financas.py (MCP - Finanças)
=======================================================================================

OBJETIVO:
    Transações, categorias e ajustes de caixa. Só traduz argumentos para o
    financas_service — a regra de negócio continua no service.
=======================================================================================
"""

from datetime import date, datetime, time
from typing import Any, Literal, Optional

from dateutil.relativedelta import relativedelta
from fastapi.encoders import jsonable_encoder
from mcp.server.mcpserver.exceptions import ToolError

from app.core.timezone import now_local
from app.mcp.context import ESCOPO_ESCRITA, apenas_informados, exigir, usuario_e_db
from app.mcp.resolvers import resolver_categoria
from app.mcp.tools import registrar
from app.schemas.caixa import AjusteCaixaCreate, AjusteCaixaUpdate
from app.schemas.financas import CategoriaCreate, CategoriaUpdate, TransacaoCreate, TransacaoUpdate
from app.services.financas import financas_service
from app.services.panorama import panorama_service

Tipo = Literal["receita", "despesa"]
Pagamento = Literal["pix", "credito", "debito", "transferencia"]


def parse_mes(mes: Optional[str]) -> datetime:
    """'AAAA-MM' -> primeiro dia do mês (None = mês atual)."""
    if not mes:
        return datetime.combine(now_local().date().replace(day=1), time())
    try:
        return datetime.strptime(mes, "%Y-%m")
    except ValueError:
        raise ToolError(f"Mês inválido: '{mes}'. Use o formato AAAA-MM, ex.: 2026-10.")


def _quando(dia: Optional[date]) -> Optional[datetime]:
    return datetime.combine(dia, time()) if dia else None


def _transacao(t) -> dict[str, Any]:
    return {
        "id": t.id,
        "descricao": t.descricao,
        "valor": t.valor,
        "data": t.data.date().isoformat(),
        "categoria": t.categoria.nome if t.categoria else None,
        "tipo": t.categoria.tipo if t.categoria else None,
        "status": t.status,
        "tipo_pagamento": t.tipo_pagamento,
        "tipo_recorrencia": t.tipo_recorrencia,
        "parcela": f"{t.parcela_atual}/{t.total_parcelas}" if t.total_parcelas else None,
    }


def _categoria(c) -> dict[str, Any]:
    return {"id": c.id, "nome": c.nome, "tipo": c.tipo, "meta_limite": c.meta_limite, "icone": c.icone, "cor": c.cor}


def _ajuste(a) -> dict[str, Any]:
    return {"id": a.id, "tipo": a.tipo, "valor": a.valor,
            "data": a.data.date().isoformat() if a.data else None, "observacao": a.observacao}


# --- Leitura ---

def resumo_financeiro(mes: Optional[str] = None) -> dict[str, Any]:
    """Resumo de um mês ('AAAA-MM', padrão = atual): receitas e despesas efetivadas, balanço,
    caixa total, quanto falta pagar/receber (pendentes), orçamento por categoria e previsão."""
    with usuario_e_db() as (db, user):
        inicio = parse_mes(mes)
        dados = panorama_service.get_dashboard_data(db, user.id, start_date=inicio,
                                                    end_date=inicio + relativedelta(months=1))
        kpis = jsonable_encoder(dados["kpis"])
        pendentes = financas_service.listar_transacoes(db, user.id, mes=inicio.strftime("%Y-%m"),
                                                       status="Pendente", limite=1000)
        return {
            "mes": inicio.strftime("%Y-%m"),
            "receita": kpis["receita_mes"],
            "despesa": kpis["despesa_mes"],
            "balanco": kpis["balanco_mes"],
            "caixa": kpis["caixa"],
            "a_pagar": round(sum(t.valor for t in pendentes if t.categoria.tipo == "despesa"), 2),
            "a_receber": round(sum(t.valor for t in pendentes if t.categoria.tipo == "receita"), 2),
            "orcamento": jsonable_encoder(dados.get("orcamento", [])),
            "previsao": jsonable_encoder(dados.get("forecast")),
        }


def listar_transacoes(
    mes: Optional[str] = None,
    categoria: Optional[str] = None,
    tipo: Optional[Tipo] = None,
    status: Optional[Literal["Pendente", "Efetivada"]] = None,
    busca: Optional[str] = None,
    limite: int = 50,
) -> dict[str, Any]:
    """Lista transações, mais recentes primeiro. Filtros: mes ('AAAA-MM'), categoria (nome ou id),
    tipo (receita/despesa), status, busca (trecho da descrição). limite máx. 200."""
    with usuario_e_db() as (db, user):
        categoria_id = resolver_categoria(db, user.id, categoria, tipo).id if categoria else None
        transacoes = financas_service.listar_transacoes(
            db, user.id, mes=parse_mes(mes).strftime("%Y-%m") if mes else None, categoria_id=categoria_id,
            tipo=tipo, status=status, busca=busca, limite=min(limite, 200),
        )
        return {"itens": [_transacao(t) for t in transacoes]}


def listar_categorias(tipo: Optional[Tipo] = None) -> dict[str, Any]:
    """Categorias de receita/despesa com o limite mensal (meta_limite) de cada uma."""
    with usuario_e_db() as (db, user):
        return {"itens": [_categoria(c) for c in financas_service.listar_categorias(db, user.id, tipo)]}


# --- Escrita ---

def salvar_transacao(
    id: Optional[int] = None,
    descricao: Optional[str] = None,
    valor: Optional[float] = None,
    data: Optional[date] = None,
    categoria: Optional[str] = None,
    tipo: Optional[Tipo] = None,
    status: Optional[Literal["Pendente", "Efetivada"]] = None,
    tipo_pagamento: Optional[Pagamento] = None,
    tipo_recorrencia: Literal["pontual", "parcelada", "recorrente"] = "pontual",
    total_parcelas: Optional[int] = None,
    frequencia: Optional[Literal["semanal", "mensal", "anual"]] = None,
    aplicar_valor_em: Literal["apenas", "futuras"] = "apenas",
) -> dict[str, Any]:
    """Cria (sem id) ou edita (com id; só os campos enviados) uma transação.
    categoria: nome ou id; tipo (receita/despesa) desempata nomes iguais.
    Criar exige descricao, valor e categoria; data padrão = hoje. Pontual nasce Efetivada.
    Parcelada: valor = total e exige total_parcelas. Recorrente exige frequencia.
    Em séries, aplicar_valor_em="futuras" leva a mudança de valor às próximas ocorrências."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        categoria_id = resolver_categoria(db, user.id, categoria, tipo).id if categoria else None
        if id is None:
            if not (descricao and valor is not None and categoria_id):
                raise ToolError("Para criar, informe descricao, valor e categoria.")
            if tipo_recorrencia == "parcelada" and not total_parcelas:
                raise ToolError("Transação parcelada exige total_parcelas.")
            if tipo_recorrencia == "recorrente" and not frequencia:
                raise ToolError("Transação recorrente exige frequencia.")
            dados = TransacaoCreate(**apenas_informados(
                descricao=descricao, valor=valor, data=_quando(data or now_local().date()),
                categoria_id=categoria_id, status=status, tipo_pagamento=tipo_pagamento,
                tipo_recorrencia=tipo_recorrencia, total_parcelas=total_parcelas, frequencia=frequencia,
            ))
            transacao = financas_service.criar_transacao(db, dados, user.id)
        else:
            dados = TransacaoUpdate(**apenas_informados(
                descricao=descricao, valor=valor, data=_quando(data), categoria_id=categoria_id,
                status=status, tipo_pagamento=tipo_pagamento,
            ), escopo_valor=aplicar_valor_em)
            transacao = exigir(financas_service.atualizar_transacao(db, id, dados, user.id),
                               f"Transação {id} não encontrada.")
        db.refresh(transacao)
        return _transacao(transacao)


def marcar_pagamento(id: int, pago: bool = True) -> dict[str, Any]:
    """Marca a transação como paga/recebida (Efetivada) ou pendente. Pode repetir sem efeito colateral."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        transacao = exigir(
            financas_service.definir_status_transacao(db, id, "Efetivada" if pago else "Pendente", user.id),
            f"Transação {id} não encontrada.",
        )
        return _transacao(transacao)


def encerrar_recorrencia(id: int) -> dict[str, Any]:
    """Encerra uma série recorrente/parcelada: apaga as ocorrências pendentes e preserva o histórico."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        resultado = financas_service.encerrar_recorrencia(db, id, user.id)
        if "error" in resultado:
            raise ToolError(resultado["error"])
        return resultado


def excluir_transacao(id: int) -> dict[str, Any]:
    """Exclui uma transação. Em série (recorrente/parcelada) sem nada efetivado, exclui a série toda;
    com algo efetivado, recusa — use encerrar_recorrencia."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        exigir(financas_service.excluir_transacao(db, id, user.id), f"Transação {id} não encontrada.")
        return {"ok": True}


def salvar_categoria(
    id: Optional[int] = None,
    nome: Optional[str] = None,
    tipo: Optional[Tipo] = None,
    meta_limite: Optional[float] = None,
    icone: Optional[str] = None,
    cor: Optional[str] = None,
) -> dict[str, Any]:
    """Cria (sem id; exige nome e tipo) ou edita (com id) uma categoria. meta_limite = orçamento mensal;
    icone = classe Font Awesome (ex.: 'fa-solid fa-cart-shopping'); cor = hex."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        campos = apenas_informados(nome=nome, tipo=tipo, meta_limite=meta_limite, icone=icone, cor=cor)
        if id is None:
            if not (nome and tipo):
                raise ToolError("Para criar, informe nome e tipo.")
            categoria = financas_service.criar_categoria(db, CategoriaCreate(**campos), user.id)
        else:
            categoria = exigir(financas_service.atualizar_categoria(db, id, CategoriaUpdate(**campos), user.id),
                               f"Categoria {id} não encontrada.")
        return _categoria(categoria)


def excluir_categoria(categoria: str) -> dict[str, Any]:
    """Exclui uma categoria (nome ou id). As transações dela vão para 'Indefinida'."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        alvo = resolver_categoria(db, user.id, categoria)
        financas_service.excluir_categoria(db, alvo.id, user.id)
        return {"ok": True}


def salvar_ajuste_caixa(
    id: Optional[int] = None,
    tipo: Optional[Literal["entrada", "saida"]] = None,
    valor: Optional[float] = None,
    data: Optional[date] = None,
    observacao: Optional[str] = None,
) -> dict[str, Any]:
    """Cria (sem id; exige valor; tipo padrão entrada) ou edita um ajuste de caixa: dinheiro fora das
    transações do mês (saldo inicial, correções). Não conta como receita/despesa."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        campos = apenas_informados(tipo=tipo, valor=valor, data=_quando(data), observacao=observacao)
        if id is None:
            if valor is None:
                raise ToolError("Para criar, informe o valor.")
            ajuste = financas_service.criar_ajuste(db, AjusteCaixaCreate(**campos), user.id)
        else:
            ajuste = exigir(financas_service.atualizar_ajuste(db, id, AjusteCaixaUpdate(**campos), user.id),
                            f"Ajuste {id} não encontrado.")
        return _ajuste(ajuste)


def excluir_ajuste_caixa(id: int) -> dict[str, Any]:
    """Exclui um ajuste de caixa."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        exigir(financas_service.deletar_ajuste(db, id, user.id), f"Ajuste {id} não encontrado.")
        return {"ok": True}


def register(mcp):
    registrar(
        mcp,
        leitura=(resumo_financeiro, listar_transacoes, listar_categorias),
        escrita=(salvar_transacao, marcar_pagamento, encerrar_recorrencia, salvar_categoria, salvar_ajuste_caixa),
        destrutivas=(excluir_transacao, excluir_categoria, excluir_ajuste_caixa),
    )
```

Em `app/mcp/server.py`: `from app.mcp.tools import financas, perfil` e `MODULOS = (perfil, financas)`.

- [ ] **Step 4: Rodar e ver passar**

Run: `venvbussola/Scripts/python.exe -m pytest tests/test_mcp_financas.py -q`
Expected: PASS (11 testes).

- [ ] **Step 5: Commit**

```bash
git add app/mcp/tools/financas.py app/mcp/server.py tests/test_mcp_financas.py
git commit -m "feat(mcp): tools de financas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Tools de Metas (cofrinhos)

**Files:**
- Create: `bussola_api/app/mcp/tools/metas.py`
- Modify: `bussola_api/app/mcp/server.py` (`MODULOS += metas`)
- Test: `bussola_api/tests/test_mcp_metas.py`

**Interfaces:**
- Consumes: `metas_service` (`criar_meta`, `listar_metas`, `atualizar_meta`, `deletar_meta`, `criar_movimentacao`, `atualizar_movimentacao`, `listar_movimentacoes`, `deletar_movimentacao`, `enriquecer_meta`, `calcular_resumo`), `financas_service.calcular_caixa`, `resolver_meta`, schemas `MetaCreate`, `MetaUpdate`, `MetaResponse`, `MovimentacaoCreate`, `MovimentacaoUpdate`, `MovimentacaoResponse`, `ResumoPatrimonio`.
- Produces (tools): `listar_metas(incluir_arquivadas)`, `detalhar_meta(meta)`, `salvar_meta(...)`, `arquivar_meta(meta)`, `movimentar_meta(meta, tipo, valor, data, observacao, id)`, `excluir_movimentacao(meta, movimentacao_id)`.

- [ ] **Step 1: Testes que falham** — `tests/test_mcp_metas.py`:

```python
import pytest
from mcp.server.mcpserver.exceptions import ToolError


def test_criar_aportar_e_detalhar(mcp_call):
    meta = mcp_call("salvar_meta", nome="Viagem", valor_alvo=1000)
    assert meta["saldo_atual"] == 0
    mcp_call("movimentar_meta", meta="viagem", tipo="aporte", valor=250)
    detalhe = mcp_call("detalhar_meta", meta=str(meta["id"]))
    assert detalhe["meta"]["saldo_atual"] == 250
    assert detalhe["meta"]["progresso_pct"] == 25.0
    assert len(detalhe["movimentacoes"]) == 1


def test_retirada_de_meta_trancada_e_bloqueada(mcp_call):
    mcp_call("salvar_meta", nome="Reserva", valor_alvo=1000, trancada=True)
    mcp_call("movimentar_meta", meta="Reserva", tipo="aporte", valor=100)
    with pytest.raises(ToolError, match="trancada"):
        mcp_call("movimentar_meta", meta="Reserva", tipo="retirada", valor=50)


def test_editar_movimentacao_e_excluir(mcp_call):
    mcp_call("salvar_meta", nome="Carro", valor_alvo=500)
    mov = mcp_call("movimentar_meta", meta="Carro", tipo="aporte", valor=100)
    mcp_call("movimentar_meta", meta="Carro", id=mov["id"], valor=150)
    assert mcp_call("detalhar_meta", meta="Carro")["meta"]["saldo_atual"] == 150
    assert mcp_call("excluir_movimentacao", meta="Carro", movimentacao_id=mov["id"]) == {"ok": True}


def test_listar_resumo_e_arquivar(mcp_call):
    mcp_call("salvar_meta", nome="Casa", valor_alvo=100000)
    lista = mcp_call("listar_metas")
    assert [m["nome"] for m in lista["metas"]] == ["Casa"]
    assert {"disponivel", "guardado", "total"} <= lista["resumo"].keys()
    assert mcp_call("arquivar_meta", meta="Casa") == {"ok": True, "arquivada": True}
    assert mcp_call("listar_metas")["metas"] == []
    assert len(mcp_call("listar_metas", incluir_arquivadas=True)["metas"]) == 1


def test_editar_meta_parcial_e_isolamento(mcp_call, outro_user):
    meta = mcp_call("salvar_meta", nome="Bike", valor_alvo=3000)
    assert mcp_call("salvar_meta", id=meta["id"], valor_alvo=3500)["nome"] == "Bike"
    with pytest.raises(ToolError, match="não encontrado"):
        mcp_call("detalhar_meta", usuario=outro_user, meta=str(meta["id"]))
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `venvbussola/Scripts/python.exe -m pytest tests/test_mcp_metas.py -q`
Expected: FAIL — `Unknown tool: salvar_meta`.

- [ ] **Step 3: Implementar** — `app/mcp/tools/metas.py`:

```python
"""
=======================================================================================
ARQUIVO: tools/metas.py (MCP - Metas / cofrinhos)
=======================================================================================

OBJETIVO:
    Metas de economia: criar/editar, aportar e retirar (transferências neutras do
    caixa), ver progresso e projeção, arquivar.
=======================================================================================
"""

from datetime import date, datetime, time
from typing import Any, Literal, Optional

from mcp.server.mcpserver.exceptions import ToolError

from app.mcp.context import ESCOPO_ESCRITA, apenas_informados, exigir, usuario_e_db
from app.mcp.resolvers import resolver, resolver_meta
from app.mcp.tools import registrar
from app.models.metas import Meta
from app.schemas.metas import (
    MetaCreate, MetaResponse, MetaUpdate, MovimentacaoCreate, MovimentacaoResponse,
    MovimentacaoUpdate, ResumoPatrimonio,
)
from app.services.financas import financas_service
from app.services.metas import metas_service


def _meta(db, meta) -> dict[str, Any]:
    return MetaResponse(**metas_service.enriquecer_meta(db, meta)).model_dump(mode="json")


def _mov(mov) -> dict[str, Any]:
    return MovimentacaoResponse.model_validate(mov).model_dump(mode="json")


def listar_metas(incluir_arquivadas: bool = False) -> dict[str, Any]:
    """Metas com saldo, progresso, aporte sugerido e data projetada, mais o resumo do patrimônio
    (caixa total, guardado nas metas, disponível)."""
    with usuario_e_db() as (db, user):
        metas = metas_service.listar_metas(db, user.id, include_arquivadas=incluir_arquivadas)
        resumo = metas_service.calcular_resumo(db, user.id, financas_service.calcular_caixa(db, user.id))
        return {"metas": [_meta(db, m) for m in metas],
                "resumo": ResumoPatrimonio(**resumo).model_dump(mode="json")}


def detalhar_meta(meta: str) -> dict[str, Any]:
    """Uma meta (nome ou id; inclui arquivadas) com todas as movimentações."""
    with usuario_e_db() as (db, user):
        alvo = resolver(db, Meta, user.id, meta, "Meta")
        return {"meta": _meta(db, alvo),
                "movimentacoes": [_mov(m) for m in metas_service.listar_movimentacoes(db, alvo.id, user.id)]}


def salvar_meta(
    id: Optional[int] = None,
    nome: Optional[str] = None,
    valor_alvo: Optional[float] = None,
    data_alvo: Optional[date] = None,
    trancada: Optional[bool] = None,
    aporte_mensal_valor: Optional[float] = None,
    aporte_mensal_dia: Optional[int] = None,
    icone: Optional[str] = None,
    cor: Optional[str] = None,
    status: Optional[Literal["ativa", "concluida", "arquivada"]] = None,
) -> dict[str, Any]:
    """Cria (sem id; exige nome e valor_alvo) ou edita (com id) uma meta. trancada = bloqueia retiradas
    até a data_alvo. aporte_mensal_valor/dia (1-28) agenda um aporte automático todo mês."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        campos = apenas_informados(nome=nome, valor_alvo=valor_alvo, data_alvo=data_alvo, trancada=trancada,
                                   aporte_mensal_valor=aporte_mensal_valor, aporte_mensal_dia=aporte_mensal_dia,
                                   icone=icone, cor=cor)
        if id is None:
            if not (nome and valor_alvo):
                raise ToolError("Para criar, informe nome e valor_alvo.")
            alvo = metas_service.criar_meta(db, MetaCreate(**campos), user.id)
        else:
            alvo = exigir(metas_service.atualizar_meta(db, id, MetaUpdate(**campos, **apenas_informados(status=status)),
                                                       user.id), f"Meta {id} não encontrada.")
        return _meta(db, alvo)


def arquivar_meta(meta: str) -> dict[str, Any]:
    """Arquiva uma meta (nome ou id). O histórico é preservado; ela some de listar_metas."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        alvo = resolver_meta(db, user.id, meta)
        metas_service.deletar_meta(db, alvo.id, user.id)
        return {"ok": True, "arquivada": True}


def movimentar_meta(
    meta: str,
    tipo: Optional[Literal["aporte", "retirada"]] = None,
    valor: Optional[float] = None,
    data: Optional[date] = None,
    observacao: Optional[str] = None,
    id: Optional[int] = None,
) -> dict[str, Any]:
    """Aporte ou retirada numa meta (nome ou id). Sem id cria (exige tipo e valor); com id edita a
    movimentação. Respeita meta trancada, saldo e limite do cofre."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        alvo = resolver_meta(db, user.id, meta)
        campos = apenas_informados(tipo=tipo, valor=valor, observacao=observacao,
                                   data=datetime.combine(data, time()) if data else None)
        if id is None:
            if not (tipo and valor):
                raise ToolError("Para criar, informe tipo e valor.")
            mov = metas_service.criar_movimentacao(db, alvo.id, MovimentacaoCreate(**campos), user.id)
        else:
            mov = exigir(metas_service.atualizar_movimentacao(db, alvo.id, id, MovimentacaoUpdate(**campos), user.id),
                         f"Movimentação {id} não encontrada.")
        return _mov(mov)


def excluir_movimentacao(meta: str, movimentacao_id: int) -> dict[str, Any]:
    """Exclui uma movimentação de uma meta (aporte automático já efetivado não pode ser excluído)."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        alvo = resolver_meta(db, user.id, meta)
        exigir(metas_service.deletar_movimentacao(db, alvo.id, movimentacao_id, user.id),
               f"Movimentação {movimentacao_id} não encontrada.")
        return {"ok": True}


def register(mcp):
    registrar(
        mcp,
        leitura=(listar_metas, detalhar_meta),
        escrita=(salvar_meta, movimentar_meta),
        destrutivas=(arquivar_meta, excluir_movimentacao),
    )
```

Em `app/mcp/server.py`: importar `metas` e acrescentar a `MODULOS`.

- [ ] **Step 4: Rodar e ver passar**

Run: `venvbussola/Scripts/python.exe -m pytest tests/test_mcp_metas.py -q`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add app/mcp/tools/metas.py app/mcp/server.py tests/test_mcp_metas.py
git commit -m "feat(mcp): tools de metas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Agenda (service + tools)

**Files:**
- Modify: `bussola_api/app/services/agenda.py`, `bussola_api/app/mcp/server.py`
- Create: `bussola_api/app/mcp/tools/agenda.py`
- Test: `bussola_api/tests/test_mcp_agenda.py`

**Interfaces:**
- Produces: `agenda_service.listar_periodo(db, user_id, de: datetime, ate: datetime) -> list[Compromisso]` (intervalo `[de, ate)`); tools `listar_compromissos(de, ate)`, `salvar_compromisso(...)`, `excluir_compromisso(id)`.

- [ ] **Step 1: Testes que falham** — `tests/test_mcp_agenda.py`:

```python
import pytest
from mcp.server.mcpserver.exceptions import ToolError


def test_criar_listar_por_periodo_e_status(mcp_call):
    c = mcp_call("salvar_compromisso", titulo="Dentista", data_hora="2026-10-02T14:30", local="Centro")
    mcp_call("salvar_compromisso", titulo="Fora", data_hora="2026-11-20T09:00")
    r = mcp_call("listar_compromissos", de="2026-10-01", ate="2026-10-31")
    assert [x["titulo"] for x in r["itens"]] == ["Dentista"]
    assert r["itens"][0]["data_hora"] == "2026-10-02T14:30"
    assert mcp_call("salvar_compromisso", id=c["id"], status="Realizado")["status"] == "Realizado"


def test_criar_ja_com_status_e_exigencias(mcp_call):
    c = mcp_call("salvar_compromisso", titulo="Reunião", data_hora="2026-10-03T10:00", status="Cancelado")
    assert c["status"] == "Cancelado"
    with pytest.raises(ToolError, match="titulo e data_hora"):
        mcp_call("salvar_compromisso", titulo="Sem data")


def test_editar_inexistente_e_excluir(mcp_call, outro_user):
    c = mcp_call("salvar_compromisso", titulo="Treino", data_hora="2026-10-04T07:00")
    with pytest.raises(ToolError, match="não encontrado"):
        mcp_call("salvar_compromisso", usuario=outro_user, id=c["id"], titulo="Hack")
    assert mcp_call("excluir_compromisso", id=c["id"]) == {"ok": True}
    with pytest.raises(ToolError, match="não encontrado"):
        mcp_call("excluir_compromisso", id=c["id"])
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `venvbussola/Scripts/python.exe -m pytest tests/test_mcp_agenda.py -q`
Expected: FAIL — `Unknown tool: salvar_compromisso`.

- [ ] **Step 3: Service** — adicionar à classe `AgendaService` em `app/services/agenda.py`:

```python
    def listar_periodo(self, db: Session, user_id: int, de: datetime, ate: datetime):
        """Compromissos com data_hora em [de, ate), em ordem cronológica."""
        return (
            db.query(Compromisso)
            .filter(Compromisso.user_id == user_id, Compromisso.data_hora >= de, Compromisso.data_hora < ate)
            .order_by(Compromisso.data_hora)
            .all()
        )
```

- [ ] **Step 4: Tools** — `app/mcp/tools/agenda.py`:

```python
"""
=======================================================================================
ARQUIVO: tools/agenda.py (MCP - Agenda)
=======================================================================================

OBJETIVO:
    Consultar compromissos por período, criar/editar (inclusive status) e excluir.
=======================================================================================
"""

from datetime import date, datetime, time, timedelta
from typing import Any, Literal, Optional

from mcp.server.mcpserver.exceptions import ToolError

from app.core.timezone import now_local
from app.mcp.context import ESCOPO_ESCRITA, apenas_informados, exigir, usuario_e_db
from app.mcp.tools import registrar
from app.schemas.agenda import CompromissoCreate, CompromissoUpdate
from app.services.agenda import agenda_service

Status = Literal["Pendente", "Realizado", "Cancelado"]


def _compromisso(c) -> dict[str, Any]:
    return {"id": c.id, "titulo": c.titulo, "data_hora": c.data_hora.strftime("%Y-%m-%dT%H:%M"),
            "local": c.local, "descricao": c.descricao, "status": c.status, "lembrete": c.lembrete}


def listar_compromissos(de: Optional[date] = None, ate: Optional[date] = None) -> dict[str, Any]:
    """Compromissos entre as datas de e ate (inclusivas). Padrão: hoje até 7 dias à frente.
    Status possíveis: Pendente, Realizado, Cancelado, Perdido."""
    with usuario_e_db() as (db, user):
        inicio = de or now_local().date()
        fim = ate or inicio + timedelta(days=7)
        compromissos = agenda_service.listar_periodo(
            db, user.id, datetime.combine(inicio, time()), datetime.combine(fim + timedelta(days=1), time())
        )
        return {"itens": [_compromisso(c) for c in compromissos]}


def salvar_compromisso(
    id: Optional[int] = None,
    titulo: Optional[str] = None,
    data_hora: Optional[datetime] = None,
    descricao: Optional[str] = None,
    local: Optional[str] = None,
    lembrete: Optional[bool] = None,
    status: Optional[Status] = None,
) -> dict[str, Any]:
    """Cria (sem id; exige titulo e data_hora 'AAAA-MM-DDTHH:MM') ou edita (com id; só o enviado)
    um compromisso. status: Pendente, Realizado ou Cancelado."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        campos = apenas_informados(titulo=titulo, data_hora=data_hora, descricao=descricao,
                                   local=local, lembrete=lembrete)
        if id is None:
            if not (titulo and data_hora):
                raise ToolError("Para criar, informe titulo e data_hora.")
            compromisso = agenda_service.create(db, CompromissoCreate(**campos), user.id)
            if status and status != "Pendente":
                compromisso = agenda_service.set_status(db, compromisso.id, status, user.id)
        else:
            compromisso = exigir(
                agenda_service.update(db, id, CompromissoUpdate(**campos, **apenas_informados(status=status)), user.id),
                f"Compromisso {id} não encontrado.",
            )
        return _compromisso(compromisso)


def excluir_compromisso(id: int) -> dict[str, Any]:
    """Exclui um compromisso."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        exigir(agenda_service.delete(db, id, user.id), f"Compromisso {id} não encontrado.")
        return {"ok": True}


def register(mcp):
    registrar(mcp, leitura=(listar_compromissos,), escrita=(salvar_compromisso,),
              destrutivas=(excluir_compromisso,))
```

Em `app/mcp/server.py`: importar `agenda` e acrescentar a `MODULOS`.

- [ ] **Step 5: Rodar e ver passar**

Run: `venvbussola/Scripts/python.exe -m pytest tests/test_mcp_agenda.py -q`
Expected: PASS (3 testes).

- [ ] **Step 6: Commit**

```bash
git add app/services/agenda.py app/mcp/tools/agenda.py app/mcp/server.py tests/test_mcp_agenda.py
git commit -m "feat(mcp): tools de agenda

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Registros — grupos, anotações e tarefas (service + tools)

**Files:**
- Modify: `bussola_api/app/services/registros.py`, `bussola_api/app/mcp/server.py`
- Create: `bussola_api/app/mcp/tools/registros.py`
- Test: `bussola_api/tests/test_mcp_registros.py`

**Interfaces:**
- Produces (em `RegistrosService`): `listar_anotacoes(db, user_id, grupo_id=None, busca=None, limite=50) -> list[Anotacao]`; `get_anotacao(db, nota_id, user_id) -> Anotacao | None`; `listar_tarefas(db, user_id, status=None, limite=50) -> list[Tarefa]`; `definir_subtarefa(db, sub_id, user_id, concluido: bool) -> Subtarefa | None`.
- Produces (tools): `listar_grupos`, `salvar_grupo(id, nome, cor)`, `excluir_grupo(grupo)`, `listar_anotacoes(grupo, busca, limite)`, `ler_anotacao(id)`, `salvar_anotacao(id, titulo, conteudo_markdown, grupo, fixado, links)`, `excluir_anotacao(id)`, `listar_tarefas(status, limite)`, `salvar_tarefa(...)`, `marcar_subtarefa(id, feita)`, `excluir_tarefa(id)`.

- [ ] **Step 1: Testes que falham** — `tests/test_mcp_registros.py`:

```python
import pytest
from mcp.server.mcpserver.exceptions import ToolError


def test_grupos(mcp_call):
    g = mcp_call("salvar_grupo", nome="Estudos", cor="#00ff00")
    with pytest.raises(ToolError, match="Já existe"):
        mcp_call("salvar_grupo", nome="Estudos")
    assert mcp_call("salvar_grupo", id=g["id"], cor="#0000ff")["nome"] == "Estudos"
    assert [x["nome"] for x in mcp_call("listar_grupos")["itens"]] == ["Estudos"]
    assert mcp_call("excluir_grupo", grupo="estudos") == {"ok": True}


def test_anotacao_markdown_vira_html_e_edicao_preserva(mcp_call):
    mcp_call("salvar_grupo", nome="Ideias")
    nota = mcp_call("salvar_anotacao", titulo="Plano", conteudo_markdown="# Meta\n\nTexto **forte**",
                    grupo="ideias", links=["https://exemplo.dev"])
    lida = mcp_call("ler_anotacao", id=nota["id"])
    assert "<strong>forte</strong>" in lida["conteudo"]

    mcp_call("salvar_anotacao", id=nota["id"], titulo="Plano v2")
    depois = mcp_call("ler_anotacao", id=nota["id"])
    assert depois["titulo"] == "Plano v2"
    assert depois["conteudo"] == lida["conteudo"]
    assert depois["grupo"]["nome"] == "Ideias"
    assert [l["url"] for l in depois["links"]] == ["https://exemplo.dev"]


def test_listar_anotacoes_busca_e_trecho(mcp_call):
    mcp_call("salvar_anotacao", titulo="Mercado", conteudo_markdown="comprar café")
    mcp_call("salvar_anotacao", titulo="Outra", conteudo_markdown="nada")
    r = mcp_call("listar_anotacoes", busca="café")
    assert [n["titulo"] for n in r["itens"]] == ["Mercado"]
    assert "comprar café" in r["itens"][0]["trecho"]
    assert "<" not in r["itens"][0]["trecho"]


def test_tarefa_com_subtarefas_e_marcar_idempotente(mcp_call):
    t = mcp_call("salvar_tarefa", titulo="Revisar contrato", prioridade="Alta", subtarefas=["Ler", "Assinar"])
    assert [s["titulo"] for s in t["subtarefas"]] == ["Ler", "Assinar"]
    sub_id = t["subtarefas"][0]["id"]
    mcp_call("marcar_subtarefa", id=sub_id, feita=True)
    mcp_call("marcar_subtarefa", id=sub_id, feita=True)
    tarefa = mcp_call("listar_tarefas", status="Pendente")["itens"][0]
    assert tarefa["subtarefas"][0]["concluido"] is True


def test_editar_status_adicionar_subtarefa_e_excluir(mcp_call, outro_user):
    t = mcp_call("salvar_tarefa", titulo="Deploy")
    r = mcp_call("salvar_tarefa", id=t["id"], status="Concluído", subtarefas=["Checar logs"])
    assert r["status"] == "Concluído" and r["data_conclusao"] is not None
    assert [s["titulo"] for s in r["subtarefas"]] == ["Checar logs"]
    assert mcp_call("listar_tarefas", status="Pendente")["itens"] == []
    with pytest.raises(ToolError, match="não encontrada"):
        mcp_call("excluir_tarefa", usuario=outro_user, id=t["id"])
    assert mcp_call("excluir_tarefa", id=t["id"]) == {"ok": True}
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `venvbussola/Scripts/python.exe -m pytest tests/test_mcp_registros.py -q`
Expected: FAIL — `Unknown tool: salvar_grupo`.

- [ ] **Step 3: Service** — adicionar à classe `RegistrosService` em `app/services/registros.py`:

```python
    # --- Consultas usadas pelo MCP ---

    def listar_anotacoes(self, db: Session, user_id: int, grupo_id: int = None, busca: str = None, limite: int = 50):
        query = db.query(Anotacao).filter(Anotacao.user_id == user_id)
        if grupo_id:
            query = query.filter(Anotacao.grupo_id == grupo_id)
        if busca:
            termo = f"%{busca}%"
            query = query.filter(Anotacao.titulo.ilike(termo) | Anotacao.conteudo.ilike(termo))
        return query.order_by(Anotacao.fixado.desc(), Anotacao.data_criacao.desc()).limit(limite).all()

    def get_anotacao(self, db: Session, nota_id: int, user_id: int):
        return db.query(Anotacao).filter(Anotacao.id == nota_id, Anotacao.user_id == user_id).first()

    def listar_tarefas(self, db: Session, user_id: int, status: str = None, limite: int = 50):
        query = db.query(Tarefa).filter(Tarefa.user_id == user_id)
        if status:
            query = query.filter(Tarefa.status == status)
        return query.order_by(Tarefa.status, Tarefa.ordem, Tarefa.id).limit(limite).all()

    def definir_subtarefa(self, db: Session, sub_id: int, user_id: int, concluido: bool):
        """Define (não alterna) a conclusão; reaproveita o toggle, que propaga aos filhos."""
        sub = (
            db.query(Subtarefa)
            .join(Tarefa, Subtarefa.tarefa_id == Tarefa.id)
            .filter(Subtarefa.id == sub_id, Tarefa.user_id == user_id)
            .first()
        )
        if not sub:
            return None
        if sub.concluido != concluido:
            return self.toggle_subtarefa(db, sub_id, user_id)
        return sub
```

- [ ] **Step 4: Tools** — `app/mcp/tools/registros.py`:

```python
"""
=======================================================================================
ARQUIVO: tools/registros.py (MCP - Registros: grupos, anotações e tarefas)
=======================================================================================

OBJETIVO:
    Notas (conteúdo recebido em Markdown e salvo no HTML do editor), grupos de
    notas e tarefas com subtarefas.
=======================================================================================
"""

import re
from datetime import datetime
from typing import Any, Literal, Optional

import markdown
from mcp.server.mcpserver.exceptions import ToolError

from app.mcp.context import ESCOPO_ESCRITA, apenas_informados, exigir, usuario_e_db
from app.mcp.resolvers import resolver_grupo
from app.mcp.tools import registrar
from app.schemas.registros import (
    AnotacaoCreate, AnotacaoResponse, AnotacaoUpdate, GrupoCreate, GrupoResponse, SubtarefaCreate,
    TarefaCreate, TarefaResponse, TarefaUpdate,
)
from app.services.registros import registros_service

StatusTarefa = Literal["Pendente", "Em andamento", "Bloqueado", "Concluído", "Cancelado"]
Prioridade = Literal["Crítica", "Alta", "Média", "Baixa"]


def _html(texto_markdown: str) -> str:
    return markdown.markdown(texto_markdown, extensions=["extra", "sane_lists"])


def _trecho(html: Optional[str], tamanho: int = 200) -> str:
    texto = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html or "")).strip()
    return texto[:tamanho]


def _tarefa(t) -> dict[str, Any]:
    return TarefaResponse.model_validate(t).model_dump(mode="json")


# --- Grupos ---

def listar_grupos() -> dict[str, Any]:
    """Grupos de anotações."""
    with usuario_e_db() as (db, user):
        return {"itens": [GrupoResponse.model_validate(g).model_dump() for g in registros_service.get_grupos(db, user.id)]}


def salvar_grupo(id: Optional[int] = None, nome: Optional[str] = None, cor: Optional[str] = None) -> dict[str, Any]:
    """Cria (sem id; exige nome) ou edita (com id) um grupo de anotações. cor = hex."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        if id is None:
            if not nome:
                raise ToolError("Para criar, informe o nome.")
            grupo = registros_service.create_grupo(db, GrupoCreate(**apenas_informados(nome=nome, cor=cor)), user.id)
        else:
            atual = resolver_grupo(db, user.id, id)
            grupo = registros_service.update_grupo(
                db, id, GrupoCreate(nome=nome or atual.nome, cor=cor or atual.cor), user.id
            )
        return GrupoResponse.model_validate(grupo).model_dump()


def excluir_grupo(grupo: str) -> dict[str, Any]:
    """Exclui um grupo (nome ou id). As anotações ficam sem grupo, não são apagadas."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        registros_service.delete_grupo(db, resolver_grupo(db, user.id, grupo).id, user.id)
        return {"ok": True}


# --- Anotações ---

def listar_anotacoes(grupo: Optional[str] = None, busca: Optional[str] = None, limite: int = 50) -> dict[str, Any]:
    """Anotações (fixadas primeiro, depois as mais novas) com um trecho do texto.
    Filtros: grupo (nome ou id) e busca (no título ou conteúdo). Use ler_anotacao para o texto inteiro."""
    with usuario_e_db() as (db, user):
        grupo_id = resolver_grupo(db, user.id, grupo).id if grupo else None
        notas = registros_service.listar_anotacoes(db, user.id, grupo_id, busca, min(limite, 200))
        return {"itens": [{
            "id": n.id, "titulo": n.titulo, "fixado": n.fixado, "grupo": n.grupo.nome if n.grupo else None,
            "data_criacao": n.data_criacao.date().isoformat(), "trecho": _trecho(n.conteudo),
        } for n in notas]}


def ler_anotacao(id: int) -> dict[str, Any]:
    """Anotação completa: título, conteúdo (HTML do editor), grupo, links."""
    with usuario_e_db() as (db, user):
        nota = exigir(registros_service.get_anotacao(db, id, user.id), f"Anotação {id} não encontrada.")
        return AnotacaoResponse.model_validate(nota).model_dump(mode="json")


def salvar_anotacao(
    id: Optional[int] = None,
    titulo: Optional[str] = None,
    conteudo_markdown: Optional[str] = None,
    grupo: Optional[str] = None,
    fixado: Optional[bool] = None,
    links: Optional[list[str]] = None,
) -> dict[str, Any]:
    """Cria (sem id) ou edita (com id; o que não for enviado é mantido) uma anotação.
    conteudo_markdown é escrito em Markdown e convertido para o editor. grupo: nome ou id."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        grupo_id = resolver_grupo(db, user.id, grupo).id if grupo else None
        conteudo = _html(conteudo_markdown) if conteudo_markdown is not None else None
        if id is None:
            nota = registros_service.create_anotacao(db, AnotacaoCreate(**apenas_informados(
                titulo=titulo, conteudo=conteudo, grupo_id=grupo_id, fixado=fixado, links=links,
            )), user.id)
        else:
            atual = exigir(registros_service.get_anotacao(db, id, user.id), f"Anotação {id} não encontrada.")
            # update_anotacao sobrescreve TODOS os campos: mescla com o que já existe.
            nota = registros_service.update_anotacao(db, id, AnotacaoUpdate(
                titulo=titulo if titulo is not None else atual.titulo,
                conteudo=conteudo if conteudo is not None else atual.conteudo,
                fixado=fixado if fixado is not None else atual.fixado,
                grupo_id=grupo_id if grupo else atual.grupo_id,
                links=links if links is not None else [link.url for link in atual.links],
            ), user.id)
        return AnotacaoResponse.model_validate(nota).model_dump(mode="json")


def excluir_anotacao(id: int) -> dict[str, Any]:
    """Exclui uma anotação."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        exigir(registros_service.delete_anotacao(db, id, user.id), f"Anotação {id} não encontrada.")
        return {"ok": True}


# --- Tarefas ---

def listar_tarefas(status: Optional[StatusTarefa] = None, limite: int = 50) -> dict[str, Any]:
    """Tarefas com subtarefas. status: Pendente, Em andamento, Bloqueado, Concluído, Cancelado."""
    with usuario_e_db() as (db, user):
        return {"itens": [_tarefa(t) for t in registros_service.listar_tarefas(db, user.id, status, min(limite, 200))]}


def salvar_tarefa(
    id: Optional[int] = None,
    titulo: Optional[str] = None,
    descricao: Optional[str] = None,
    status: Optional[StatusTarefa] = None,
    prioridade: Optional[Prioridade] = None,
    prazo: Optional[datetime] = None,
    fixado: Optional[bool] = None,
    subtarefas: Optional[list[str]] = None,
) -> dict[str, Any]:
    """Cria (sem id; exige titulo) ou edita (com id; só o enviado) uma tarefa.
    subtarefas = títulos a ADICIONAR (na criação e na edição; as existentes são mantidas)."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        campos = apenas_informados(titulo=titulo, descricao=descricao, status=status,
                                   prioridade=prioridade, prazo=prazo, fixado=fixado)
        if id is None:
            if not titulo:
                raise ToolError("Para criar, informe o titulo.")
            tarefa = registros_service.create_tarefa(db, TarefaCreate(
                **campos, subtarefas=[SubtarefaCreate(titulo=s) for s in subtarefas or []]
            ), user.id)
        else:
            tarefa = exigir(registros_service.update_tarefa(db, id, TarefaUpdate(**campos), user.id),
                            f"Tarefa {id} não encontrada.")
            for sub in subtarefas or []:
                registros_service.add_subtarefa(db, id, sub, user.id)
        db.refresh(tarefa)
        return _tarefa(tarefa)


def marcar_subtarefa(id: int, feita: bool = True) -> dict[str, Any]:
    """Marca uma subtarefa (e as filhas dela) como feita ou não. Pode repetir sem efeito colateral."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        sub = exigir(registros_service.definir_subtarefa(db, id, user.id, feita), f"Subtarefa {id} não encontrada.")
        return {"id": sub.id, "titulo": sub.titulo, "concluido": sub.concluido}


def excluir_tarefa(id: int) -> dict[str, Any]:
    """Exclui uma tarefa e suas subtarefas."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        exigir(registros_service.delete_tarefa(db, id, user.id), f"Tarefa {id} não encontrada.")
        return {"ok": True}


def register(mcp):
    registrar(
        mcp,
        leitura=(listar_grupos, listar_anotacoes, ler_anotacao, listar_tarefas),
        escrita=(salvar_grupo, salvar_anotacao, salvar_tarefa, marcar_subtarefa),
        destrutivas=(excluir_grupo, excluir_anotacao, excluir_tarefa),
    )
```

Em `app/mcp/server.py`: importar `registros` e acrescentar a `MODULOS`.

- [ ] **Step 5: Rodar e ver passar**

Run: `venvbussola/Scripts/python.exe -m pytest tests/test_mcp_registros.py tests/test_registros_board.py -q`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/services/registros.py app/mcp/tools/registros.py app/mcp/server.py tests/test_mcp_registros.py
git commit -m "feat(mcp): tools de grupos, anotacoes e tarefas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Hábitos (service + tools)

**Files:**
- Modify: `bussola_api/app/services/registros.py`, `bussola_api/app/mcp/server.py`
- Create: `bussola_api/app/mcp/tools/habitos.py`
- Test: `bussola_api/tests/test_mcp_habitos.py`

**Interfaces:**
- Produces: `registros_service.definir_checkin(db, habito_id, user_id, data_checkin: date, concluido: bool) -> HabitoRegistro | None`; tools `listar_habitos`, `historico_habito(habito, dias)`, `salvar_habito(...)`, `checkin_habito(habito, data, feito)`, `excluir_habito(habito)`.

- [ ] **Step 1: Testes que falham** — `tests/test_mcp_habitos.py`:

```python
import pytest
from mcp.server.mcpserver.exceptions import ToolError


def test_checkin_idempotente_streak_e_historico(mcp_call):
    mcp_call("salvar_habito", titulo="Ler", horario="07:00")
    assert mcp_call("checkin_habito", habito="ler")["feito"] is True
    assert mcp_call("checkin_habito", habito="ler")["feito"] is True
    habito = mcp_call("listar_habitos")["itens"][0]
    assert habito["registro_hoje"]["concluido"] is True and habito["streak"] == 1
    assert len(mcp_call("historico_habito", habito="Ler", dias=7)["itens"]) == 1
    assert mcp_call("checkin_habito", habito="ler", feito=False)["feito"] is False
    assert mcp_call("listar_habitos")["itens"][0]["streak"] == 0


def test_editar_pausar_e_excluir(mcp_call, outro_user):
    h = mcp_call("salvar_habito", titulo="Meditar", horario="06:30", frequencia=["seg", "qua", "sex"])
    assert mcp_call("salvar_habito", id=h["id"], status="pausado")["status"] == "pausado"
    with pytest.raises(ToolError, match="não foi encontrado"):
        mcp_call("excluir_habito", usuario=outro_user, habito="Meditar")
    assert mcp_call("excluir_habito", habito="Meditar") == {"ok": True}


def test_criar_exige_titulo_e_horario(mcp_call):
    with pytest.raises(ToolError, match="titulo e horario"):
        mcp_call("salvar_habito", titulo="Correr")
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `venvbussola/Scripts/python.exe -m pytest tests/test_mcp_habitos.py -q`
Expected: FAIL — `Unknown tool: salvar_habito`.

- [ ] **Step 3: Service** — adicionar à classe `RegistrosService`:

```python
    def definir_checkin(self, db: Session, habito_id: int, user_id: int, data_checkin: date, concluido: bool):
        """Define (não alterna) o check-in do dia; reaproveita toggle_checkin."""
        registro = (
            db.query(HabitoRegistro)
            .join(Habito, HabitoRegistro.habito_id == Habito.id)
            .filter(HabitoRegistro.habito_id == habito_id, Habito.user_id == user_id,
                    HabitoRegistro.data == data_checkin)
            .first()
        )
        if (registro.concluido if registro else False) == concluido:
            return registro
        return self.toggle_checkin(db, habito_id, user_id, data_checkin)
```

- [ ] **Step 4: Tools** — `app/mcp/tools/habitos.py`:

```python
"""
=======================================================================================
ARQUIVO: tools/habitos.py (MCP - Hábitos)
=======================================================================================

OBJETIVO:
    Hábitos diários: listar com o check-in de hoje e a sequência (streak), marcar
    check-in (idempotente), histórico e CRUD.
=======================================================================================
"""

from datetime import date
from typing import Any, Literal, Optional

from mcp.server.mcpserver.exceptions import ToolError

from app.mcp.context import ESCOPO_ESCRITA, apenas_informados, exigir, usuario_e_db
from app.mcp.resolvers import resolver_habito
from app.mcp.tools import registrar
from app.schemas.registros import HabitoCreate, HabitoRegistroResponse, HabitoResponse, HabitoUpdate
from app.services.registros import registros_service

DiaSemana = Literal["seg", "ter", "qua", "qui", "sex", "sab", "dom"]


def _habito(h) -> dict[str, Any]:
    return HabitoResponse.model_validate(h).model_dump(mode="json")


def listar_habitos() -> dict[str, Any]:
    """Hábitos ativos e pausados com o check-in de hoje (registro_hoje) e a sequência atual (streak)."""
    with usuario_e_db() as (db, user):
        return {"itens": [_habito(h) for h in registros_service.get_habitos(db, user.id)]}


def historico_habito(habito: str, dias: int = 30) -> dict[str, Any]:
    """Check-ins de um hábito (nome ou id) nos últimos `dias` (1-365)."""
    with usuario_e_db() as (db, user):
        alvo = resolver_habito(db, user.id, habito)
        registros = registros_service.get_historico_habito(db, alvo.id, user.id, max(1, min(dias, 365)))
        return {"habito": alvo.titulo,
                "itens": [HabitoRegistroResponse.model_validate(r).model_dump(mode="json") for r in registros]}


def salvar_habito(
    id: Optional[int] = None,
    titulo: Optional[str] = None,
    horario: Optional[str] = None,
    frequencia: Optional[list[DiaSemana]] = None,
    duracao_min: Optional[int] = None,
    descricao: Optional[str] = None,
    cor: Optional[str] = None,
    status: Optional[Literal["ativo", "pausado", "arquivado"]] = None,
) -> dict[str, Any]:
    """Cria (sem id; exige titulo e horario 'HH:MM') ou edita (com id) um hábito.
    frequencia = dias da semana (padrão: todos)."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        campos = apenas_informados(titulo=titulo, horario=horario, frequencia=frequencia,
                                   duracao_min=duracao_min, descricao=descricao, cor=cor)
        if id is None:
            if not (titulo and horario):
                raise ToolError("Para criar, informe titulo e horario.")
            habito = registros_service.create_habito(db, HabitoCreate(**campos), user.id)
        else:
            habito = exigir(
                registros_service.update_habito(db, id, HabitoUpdate(**campos, **apenas_informados(status=status)), user.id),
                f"Hábito {id} não encontrado.",
            )
        return _habito(habito)


def checkin_habito(habito: str, data: Optional[date] = None, feito: bool = True) -> dict[str, Any]:
    """Marca (feito=True) ou desmarca o check-in de um hábito (nome ou id) num dia (padrão hoje).
    Pode repetir sem efeito colateral."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        alvo = resolver_habito(db, user.id, habito)
        dia = data or date.today()
        registros_service.definir_checkin(db, alvo.id, user.id, dia, feito)
        return {"habito": alvo.titulo, "data": dia.isoformat(), "feito": feito}


def excluir_habito(habito: str) -> dict[str, Any]:
    """Exclui um hábito (nome ou id) e seu histórico. Para só parar, use salvar_habito com status."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        registros_service.delete_habito(db, resolver_habito(db, user.id, habito).id, user.id)
        return {"ok": True}


def register(mcp):
    registrar(mcp, leitura=(listar_habitos, historico_habito), escrita=(salvar_habito, checkin_habito),
              destrutivas=(excluir_habito,))
```

Em `app/mcp/server.py`: importar `habitos` e acrescentar a `MODULOS`.

- [ ] **Step 5: Rodar e ver passar**

Run: `venvbussola/Scripts/python.exe -m pytest tests/test_mcp_habitos.py -q`
Expected: PASS (3 testes).

- [ ] **Step 6: Commit**

```bash
git add app/services/registros.py app/mcp/tools/habitos.py app/mcp/server.py tests/test_mcp_habitos.py
git commit -m "feat(mcp): tools de habitos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Tools do Ritmo (saúde)

**Files:**
- Create: `bussola_api/app/mcp/tools/ritmo.py`
- Modify: `bussola_api/app/mcp/server.py`
- Test: `bussola_api/tests/test_mcp_ritmo.py`

**Interfaces:**
- Consumes: `RitmoService` (métodos estáticos, ordem `(db, user_id, ...)`): `get_latest_bio`, `get_volume_semanal`, `create_bio`, `get_planos`, `create_plano_completo`, `update_plano_completo`, `toggle_plano_ativo`, `delete_plano`, `get_dietas`, `create_dieta_completa`, `update_dieta_completa`, `toggle_dieta_ativa`, `delete_dieta`, `search_taco_foods`; schemas de `app.schemas.ritmo`.
- Produces (tools): `ultimo_bio`, `registrar_bio(...)`, `listar_treinos`, `salvar_treino(nome, dias, id, ativo)`, `excluir_treino(id)`, `listar_dietas`, `salvar_dieta(nome, refeicoes, id, ativo)`, `excluir_dieta(id)`, `buscar_alimento(q)`.

- [ ] **Step 1: Testes que falham** — `tests/test_mcp_ritmo.py`:

```python
import pytest
from mcp.server.mcpserver.exceptions import ToolError

DIAS = [{"nome": "Treino A", "ordem": 1, "exercicios": [
    {"nome_exercicio": "Supino", "grupo_muscular": "Peito", "series": 4, "repeticoes_min": 8, "repeticoes_max": 12},
]}]
REFEICOES = [{"nome": "Café", "ordem": 1, "alimentos": [
    {"nome": "Ovo", "quantidade": 100, "unidade": "g", "calorias": 155, "proteina": 13, "carbo": 1, "gordura": 11},
]}]


def test_bio(mcp_call):
    assert mcp_call("ultimo_bio") == {"bio": None, "volume_semanal": {}}
    bio = mcp_call("registrar_bio", peso=80, altura=180, idade=30, genero="M",
                   nivel_atividade="moderado", objetivo="ganho_massa")
    assert bio["tmb"] > 0
    assert mcp_call("ultimo_bio")["bio"]["peso"] == 80


def test_treino_criar_ativar_editar_excluir(mcp_call):
    plano = mcp_call("salvar_treino", nome="ABC", dias=DIAS, ativo=True)
    assert plano["ativo"] is True and plano["dias"][0]["exercicios"][0]["nome_exercicio"] == "Supino"
    assert mcp_call("ultimo_bio")["volume_semanal"] == {}  # sem bio, volume não é calculado
    dias = plano["dias"]
    dias[0]["nome"] = "Treino A (peito)"
    editado = mcp_call("salvar_treino", id=plano["id"], nome="ABC", dias=dias)
    assert editado["dias"][0]["nome"] == "Treino A (peito)"
    assert len(mcp_call("listar_treinos")["itens"]) == 1
    assert mcp_call("excluir_treino", id=plano["id"]) == {"ok": True}
    with pytest.raises(ToolError, match="não encontrado"):
        mcp_call("excluir_treino", id=plano["id"])


def test_dieta_e_alimentos(mcp_call):
    dieta = mcp_call("salvar_dieta", nome="Cutting", refeicoes=REFEICOES, ativo=True)
    assert dieta["calorias_calculadas"] == 155 and dieta["ativo"] is True
    assert len(mcp_call("listar_dietas")["itens"]) == 1
    alimentos = mcp_call("buscar_alimento", q="arroz")["itens"]
    assert alimentos and {"nome", "calorias_100g"} <= alimentos[0].keys()
    assert mcp_call("excluir_dieta", id=dieta["id"]) == {"ok": True}
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `venvbussola/Scripts/python.exe -m pytest tests/test_mcp_ritmo.py -q`
Expected: FAIL — `Unknown tool: ultimo_bio`.

- [ ] **Step 3: Implementar** — `app/mcp/tools/ritmo.py`:

```python
"""
=======================================================================================
ARQUIVO: tools/ritmo.py (MCP - Ritmo / saúde)
=======================================================================================

OBJETIVO:
    Biometria (com metas calculadas de calorias/macros), planos de treino, dietas e
    busca na tabela TACO de alimentos.
=======================================================================================
"""

from typing import Any, Literal, Optional

from fastapi.encoders import jsonable_encoder

from app.mcp.context import ESCOPO_ESCRITA, exigir, usuario_e_db
from app.mcp.tools import registrar
from app.schemas.ritmo import (
    BioCreate, BioResponse, DiaTreinoCreate, DietaConfigCreate, DietaConfigResponse, PlanoTreinoCreate,
    PlanoTreinoResponse, RefeicaoCreate,
)
from app.services.ritmo import RitmoService


def _plano(p) -> dict[str, Any]:
    return PlanoTreinoResponse.model_validate(p).model_dump(mode="json")


def _dieta(d) -> dict[str, Any]:
    return DietaConfigResponse.model_validate(d).model_dump(mode="json")


def ultimo_bio() -> dict[str, Any]:
    """Última biometria (peso, altura, TMB, gasto calórico, metas de macros e água) e o volume
    semanal de séries por grupo muscular do treino ativo."""
    with usuario_e_db() as (db, user):
        bio = RitmoService.get_latest_bio(db, user.id)
        if not bio:
            return {"bio": None, "volume_semanal": {}}
        return {"bio": BioResponse.model_validate(bio).model_dump(mode="json"),
                "volume_semanal": jsonable_encoder(RitmoService.get_volume_semanal(db, user.id))}


def registrar_bio(
    peso: float,
    altura: float,
    idade: int,
    genero: Literal["M", "F"],
    nivel_atividade: Literal["sedentario", "leve", "moderado", "alto", "atleta"],
    objetivo: Literal["perda_peso", "manutencao", "ganho_massa"],
    bf_estimado: Optional[float] = None,
) -> dict[str, Any]:
    """Registra uma nova biometria (peso em kg, altura em cm). TMB, gasto e metas de macros são calculados."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        bio = RitmoService.create_bio(db, user.id, BioCreate(
            peso=peso, altura=altura, idade=idade, genero=genero, nivel_atividade=nivel_atividade,
            objetivo=objetivo, bf_estimado=bf_estimado,
        ))
        return BioResponse.model_validate(bio).model_dump(mode="json")


def listar_treinos() -> dict[str, Any]:
    """Planos de treino com dias e exercícios (ids incluídos — reenvie-os para editar)."""
    with usuario_e_db() as (db, user):
        return {"itens": [_plano(p) for p in RitmoService.get_planos(db, user.id)]}


def salvar_treino(nome: str, dias: list[DiaTreinoCreate], id: Optional[int] = None, ativo: bool = False) -> dict[str, Any]:
    """Cria (sem id) ou substitui (com id) um plano de treino COMPLETO. Para editar, pegue o plano em
    listar_treinos e reenvie com os ids de dias/exercícios; item sem id é criado, item omitido é removido.
    ativo=True torna este o único plano ativo."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        dados = PlanoTreinoCreate(nome=nome, ativo=ativo, dias=dias)
        if id is None:
            plano = RitmoService.create_plano_completo(db, user.id, dados)
        else:
            plano = exigir(RitmoService.update_plano_completo(db, user.id, id, dados), f"Plano {id} não encontrado.")
        if ativo:
            plano = RitmoService.toggle_plano_ativo(db, user.id, plano.id)
        return _plano(plano)


def excluir_treino(id: int) -> dict[str, Any]:
    """Exclui um plano de treino."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        exigir(RitmoService.delete_plano(db, user.id, id), f"Plano {id} não encontrado.")
        return {"ok": True}


def listar_dietas() -> dict[str, Any]:
    """Dietas com refeições e alimentos (ids incluídos — reenvie-os para editar)."""
    with usuario_e_db() as (db, user):
        return {"itens": [_dieta(d) for d in RitmoService.get_dietas(db, user.id)]}


def salvar_dieta(nome: str, refeicoes: list[RefeicaoCreate], id: Optional[int] = None, ativo: bool = False) -> dict[str, Any]:
    """Cria (sem id) ou substitui (com id) uma dieta COMPLETA. Cada alimento leva os macros já calculados
    para a quantidade (use buscar_alimento para os valores por 100g). Edição funciona como em salvar_treino.
    ativo=True torna esta a única dieta ativa."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        dados = DietaConfigCreate(nome=nome, ativo=ativo, refeicoes=refeicoes)
        if id is None:
            dieta = RitmoService.create_dieta_completa(db, user.id, dados)
        else:
            dieta = exigir(RitmoService.update_dieta_completa(db, user.id, id, dados), f"Dieta {id} não encontrada.")
        if ativo:
            dieta = RitmoService.toggle_dieta_ativa(db, user.id, dieta.id)
        return _dieta(dieta)


def excluir_dieta(id: int) -> dict[str, Any]:
    """Exclui uma dieta."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        exigir(RitmoService.delete_dieta(db, user.id, id), f"Dieta {id} não encontrada.")
        return {"ok": True}


def buscar_alimento(q: str) -> dict[str, Any]:
    """Busca alimentos na tabela TACO (até 20). Valores por 100g: calorias, proteína, carbo, gordura."""
    with usuario_e_db():
        return {"itens": RitmoService.search_taco_foods(q) if len(q.strip()) >= 2 else []}


def register(mcp):
    registrar(
        mcp,
        leitura=(ultimo_bio, listar_treinos, listar_dietas, buscar_alimento),
        escrita=(registrar_bio, salvar_treino, salvar_dieta),
        destrutivas=(excluir_treino, excluir_dieta),
    )
```

Em `app/mcp/server.py`: importar `ritmo` e acrescentar a `MODULOS`.

- [ ] **Step 4: Rodar e ver passar**

Run: `venvbussola/Scripts/python.exe -m pytest tests/test_mcp_ritmo.py -q`
Expected: PASS (3 testes). Se `test_treino_...` falhar por `ativo` ou `volume_semanal`, leia `RitmoService.toggle_plano_ativo`/`get_volume_semanal` e ajuste a ASSERÇÃO ao comportamento real do service (não o service).

- [ ] **Step 5: Commit**

```bash
git add app/mcp/tools/ritmo.py app/mcp/server.py tests/test_mcp_ritmo.py
git commit -m "feat(mcp): tools do ritmo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Tools de Panorama e Cofre

**Files:**
- Create: `bussola_api/app/mcp/tools/panorama.py`, `bussola_api/app/mcp/tools/cofre.py`
- Modify: `bussola_api/app/mcp/server.py`
- Test: `bussola_api/tests/test_mcp_panorama_cofre.py`

**Interfaces:**
- Consumes: `panorama_service.get_dashboard_data(db, user_id, start_date, end_date)` e `get_category_history(db, category_id, user_id)`; `cofre_service.get_all(db, user_id)`; `resolver_categoria`.
- Produces (tools): `panorama_geral(de, ate)`, `historico_categoria(categoria)`, `listar_segredos()`.

- [ ] **Step 1: Testes que falham** — `tests/test_mcp_panorama_cofre.py`:

```python
from datetime import date

from app.models.cofre import Segredo
from app.models.financas import Categoria


def test_panorama_geral_padrao_mes_atual(mcp_call):
    r = mcp_call("panorama_geral")
    assert {"kpis", "comparativo", "insights", "cofrinhos"} <= r.keys()
    assert r["periodo"]["de"] == date.today().replace(day=1).isoformat()


def test_historico_categoria(mcp_call, db, user):
    db.add(Categoria(nome="Mercado", tipo="despesa", user_id=user.id))
    db.commit()
    r = mcp_call("historico_categoria", categoria="mercado")
    assert len(r["labels"]) == 6 and len(r["data"]) == 6


def test_listar_segredos_nunca_expoe_valor(mcp_call, db, user, outro_user):
    db.add(Segredo(titulo="Banco", servico="Itaú", notas="conta PJ",
                   valor_criptografado="gAAAAA-cifrado-secreto", user_id=user.id))
    db.commit()
    itens = mcp_call("listar_segredos")["itens"]
    assert len(itens) == 1
    assert set(itens[0]) == {"id", "titulo", "servico", "notas", "data_expiracao"}
    assert "gAAAAA" not in str(itens)
    assert mcp_call("listar_segredos", usuario=outro_user)["itens"] == []
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `venvbussola/Scripts/python.exe -m pytest tests/test_mcp_panorama_cofre.py -q`
Expected: FAIL — `Unknown tool: panorama_geral`.

- [ ] **Step 3: Implementar** — `app/mcp/tools/panorama.py`:

```python
"""
=======================================================================================
ARQUIVO: tools/panorama.py (MCP - Panorama)
=======================================================================================

OBJETIVO:
    Visão consolidada de um período (KPIs de todos os módulos, comparativo com o
    período anterior, orçamento, cofrinhos, ritmo e insights) e histórico de categoria.
=======================================================================================
"""

from datetime import date, datetime, time, timedelta
from typing import Any, Optional

from dateutil.relativedelta import relativedelta
from fastapi.encoders import jsonable_encoder

from app.core.timezone import now_local
from app.mcp.context import usuario_e_db
from app.mcp.resolvers import resolver_categoria
from app.mcp.tools import registrar
from app.services.panorama import panorama_service

CHAVES = ("kpis", "forecast", "comparativo", "orcamento", "cofrinhos", "ritmo", "insights", "gastos_por_categoria")


def panorama_geral(de: Optional[date] = None, ate: Optional[date] = None) -> dict[str, Any]:
    """Panorama de um período (de/ate inclusivos; padrão = mês atual): receitas, despesas, caixa,
    compromissos, tarefas, chaves do cofre, previsão do mês, comparativo com o período anterior,
    orçamento por categoria, cofrinhos, ritmo e insights automáticos."""
    with usuario_e_db() as (db, user):
        inicio = de or now_local().date().replace(day=1)
        fim = (ate + timedelta(days=1)) if ate else inicio + relativedelta(months=1)
        dados = panorama_service.get_dashboard_data(
            db, user.id, start_date=datetime.combine(inicio, time()), end_date=datetime.combine(fim, time())
        )
        return {
            "periodo": {"de": inicio.isoformat(), "ate": (fim - timedelta(days=1)).isoformat()},
            **jsonable_encoder({chave: dados.get(chave) for chave in CHAVES}),
        }


def historico_categoria(categoria: str) -> dict[str, Any]:
    """Total mensal de uma categoria (nome ou id) nos últimos 6 meses."""
    with usuario_e_db() as (db, user):
        alvo = resolver_categoria(db, user.id, categoria)
        return {"categoria": alvo.nome,
                **jsonable_encoder(panorama_service.get_category_history(db, alvo.id, user.id))}


def register(mcp):
    registrar(mcp, leitura=(panorama_geral, historico_categoria))
```

`app/mcp/tools/cofre.py`:
```python
"""
=======================================================================================
ARQUIVO: tools/cofre.py (MCP - Cofre de senhas)
=======================================================================================

OBJETIVO:
    SÓ metadados dos segredos. Por design, nenhuma tool revela, cria ou edita valores:
    a senha passaria pela conversa e ficaria no histórico do chat.
=======================================================================================
"""

from typing import Any

from app.mcp.context import usuario_e_db
from app.mcp.tools import registrar
from app.services.cofre import cofre_service


def listar_segredos() -> dict[str, Any]:
    """Segredos do cofre: título, serviço, notas e data de expiração. NUNCA o valor da senha —
    para vê-la o usuário precisa abrir o Bússola."""
    with usuario_e_db() as (db, user):
        return {"itens": [{
            "id": s.id,
            "titulo": s.titulo,
            "servico": s.servico,
            "notas": s.notas,
            "data_expiracao": s.data_expiracao.isoformat() if s.data_expiracao else None,
        } for s in cofre_service.get_all(db, user.id)]}


def register(mcp):
    registrar(mcp, leitura=(listar_segredos,))
```

Em `app/mcp/server.py`: importar `panorama` e `cofre` e acrescentar a `MODULOS`. Estado final:
```python
from app.mcp.tools import agenda, cofre, financas, habitos, metas, panorama, perfil, registros, ritmo

MODULOS = (perfil, panorama, financas, metas, agenda, registros, habitos, ritmo, cofre)
```

- [ ] **Step 4: Rodar e ver passar + suíte inteira**

Run: `venvbussola/Scripts/python.exe -m pytest -q`
Expected: PASS em tudo.

- [ ] **Step 5: Conferir o catálogo final**

Run: `venvbussola/Scripts/python.exe -c "import anyio; from app.mcp.server import mcp; ts = anyio.run(mcp.list_tools); print(len(ts)); print(sorted(t.name for t in ts))"`
Expected: 49 tools, nenhuma com nome em inglês.

- [ ] **Step 6: Commit**

```bash
git add app/mcp/tools/panorama.py app/mcp/tools/cofre.py app/mcp/server.py tests/test_mcp_panorama_cofre.py
git commit -m "feat(mcp): tools de panorama e cofre (so metadados)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: nginx e documentação

**Files:**
- Modify: `bussola_web/nginx.conf`, `CLAUDE.md`
- Create: `docs/MCP.md`

- [ ] **Step 1: nginx** — em `bussola_web/nginx.conf`, adicionar dentro do `server { }`, depois do bloco `location /api/v1/ai/`:

```nginx
    # MCP (Claude) — streaming: sem buffer e timeout longo
    location = /mcp {
        resolver 127.0.0.11 valid=30s ipv6=off;
        set $backend http://bussola_backend:8000;
        proxy_pass $backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Request-ID $request_id;
        proxy_http_version 1.1;
        proxy_buffering off;
        proxy_cache off;

        proxy_connect_timeout 10s;
        proxy_read_timeout 300s;
        proxy_send_timeout 60s;
    }

    # Descoberta OAuth do MCP (RFC 8414 / RFC 9728)
    location /.well-known/oauth- {
        resolver 127.0.0.11 valid=30s ipv6=off;
        set $backend http://bussola_backend:8000;
        proxy_pass $backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Request-ID $request_id;
    }

    # Authorization Server OAuth do MCP (authorize, token, register)
    location /oauth/ {
        resolver 127.0.0.11 valid=30s ipv6=off;
        set $backend http://bussola_backend:8000;
        proxy_pass $backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Request-ID $request_id;
    }
```

- [ ] **Step 2: Validar a sintaxe**

Run (na raiz do repo): `docker run --rm -v "$PWD/bussola_web/nginx.conf:/etc/nginx/conf.d/default.conf:ro" --add-host bussola_backend:127.0.0.1 nginx:alpine nginx -t`
Expected: `syntax is ok` / `test is successful`. (Sem Docker local: pule e anote no commit; o build do container no Coolify valida.)

- [ ] **Step 3: `docs/MCP.md`**:

```markdown
# MCP — Bussola como servidor para o Claude

O backend expõe um servidor MCP remoto em `https://bussola.marocos.dev/mcp`
(Streamable HTTP, stateless). Código em `bussola_api/app/mcp/`; spec em
`docs/superpowers/specs/2026-10-01-mcp-server-design.md`.

## Conectar

- **claude.ai / app:** Configurações → Conectores → Adicionar conector personalizado →
  URL `https://bussola.marocos.dev/mcp`. O Claude faz o OAuth: você loga no Bussola e
  autoriza em `/conexoes/autorizar` (ler, ou ler e escrever).
- **Claude Code:** no Bussola, Configurações da Conta → Conexões MCP → Novo token. Depois:
  `claude mcp add --transport http bussola https://bussola.marocos.dev/mcp --header "Authorization: Bearer <token>"`

Revogue qualquer conexão na mesma tela.

## Arquitetura

- `server.py` — `MCPServer` (SDK `mcp` 2.x) ligado ao FastAPI por duas rotas; serve `/mcp` e
  `/.well-known/oauth-protected-resource/mcp`.
- `auth.py` — verifica o Bearer contra `mcp_token` (só hash SHA-256 no banco).
- `context.py` — `usuario_e_db(escopo)`: usuário do token, checagem de escopo, tradução de
  erros de service em `ToolError`.
- `resolvers.py` — "nome ou id" para categoria, meta, grupo e hábito.
- `tools/<modulo>.py` — uma função por tool; regra de negócio fica nos services.
- OAuth: `app/api/v1/endpoints/oauth.py` (`/.well-known/oauth-authorization-server`,
  `/oauth/register|authorize|token`, `/api/v1/oauth/consent`) e `app/services/mcp_auth.py`.

## Adicionar um módulo

Crie `app/mcp/tools/<modulo>.py` com funções que retornam `dict[str, Any]` e um
`register(mcp)` usando `registrar(mcp, leitura=..., escrita=..., destrutivas=...)`;
acrescente o módulo a `MODULOS` em `server.py`. Teste com a fixture `mcp_call`.

## Produção

- Env do backend: `PUBLIC_BASE_URL=https://bussola.marocos.dev`.
- Smoke test: `curl https://bussola.marocos.dev/.well-known/oauth-authorization-server` e
  `curl -i -X POST https://bussola.marocos.dev/mcp` (espera 401 com `WWW-Authenticate`).
- O Cofre nunca expõe valores via MCP, por design.
```

- [ ] **Step 4: `CLAUDE.md`** — na tabela "Modules & Route Prefixes", adicionar a linha:
```
| MCP | `/mcp`, `/oauth`, `/api/v1/mcp-tokens` | Servidor MCP para o Claude (OAuth 2.1 + PAT); tools em `app/mcp/tools/`. Ver `docs/MCP.md` |
```
E na lista de "Docs": `- \`docs/MCP.md\` — servidor MCP, conexão no claude.ai/Claude Code, como adicionar módulos`.

- [ ] **Step 5: Commit**

```bash
git add bussola_web/nginx.conf docs/MCP.md CLAUDE.md
git commit -m "feat(mcp): rotas no nginx e documentacao

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Frontend — tela de consentimento OAuth

**Files:**
- Modify: `bussola_web/src/services/api.ts`, `bussola_web/src/routes/index.jsx`, `bussola_web/src/pages/Login/index.jsx`
- Create: `bussola_web/src/pages/Auth/AutorizarConexao.jsx`, `bussola_web/src/pages/Auth/AutorizarConexao.css`

**Interfaces:**
- Consumes: `GET /api/v1/oauth/clientes/{client_id}`, `POST /api/v1/oauth/consent` (Task 2).
- Produces (em `api.ts`): `getOAuthCliente(clientId)`, `enviarConsentimentoOAuth(dados)`, `listarConexoesMcp()`, `criarTokenMcp(dados)`, `revogarTokenMcp(id)`, `revogarClienteMcp(clientId)`; componente `RequireAuth` em `routes/index.jsx`; rota `/conexoes/autorizar`.

- [ ] **Step 1: Wrappers** — em `src/services/api.ts`, imediatamente antes de `export default api;`:

```ts
// ==========================================================
// MÓDULO MCP (CONEXÕES COM O CLAUDE)
// ==========================================================

export const getOAuthCliente = async (clientId: string) => {
    const response = await api.get(`/oauth/clientes/${encodeURIComponent(clientId)}`);
    return response.data;
};

export const enviarConsentimentoOAuth = async (dados: any) => {
    const response = await api.post('/oauth/consent', dados);
    return response.data;
};

export const listarConexoesMcp = async () => {
    const response = await api.get('/mcp-tokens');
    return response.data;
};

export const criarTokenMcp = async (dados: any) => {
    const response = await api.post('/mcp-tokens', dados);
    return response.data;
};

export const revogarTokenMcp = async (id: number) => {
    const response = await api.delete(`/mcp-tokens/pat/${id}`);
    return response.data;
};

export const revogarClienteMcp = async (clientId: string) => {
    const response = await api.delete(`/mcp-tokens/cliente/${encodeURIComponent(clientId)}`);
    return response.data;
};
```

- [ ] **Step 2: `RequireAuth` + rota** — em `src/routes/index.jsx`, substituir `function PrivateRoute(...) { ... }` por:

```jsx
function RequireAuth({ children }) {
    const { authenticated, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return <div className="loading-screen">Carregando Usuário...</div>;
    }

    if (!authenticated) {
        const next = encodeURIComponent(location.pathname + location.search);
        return <Navigate to={`/login?next=${next}`} />;
    }

    return children;
}

function PrivateRoute({ children }) {
    return (
        <RequireAuth>
            <div className="app-layout">
                <Navbar />
                <div className="app-content">
                    {children}
                </div>
            </div>
        </RequireAuth>
    );
}
```
Importar a página junto das outras de `Auth`:
```jsx
import { AutorizarConexao } from '../pages/Auth/AutorizarConexao';
```
E, nas rotas públicas, logo após `/discord/link`:
```jsx
              <Route path="/conexoes/autorizar" element={<RequireAuth><AutorizarConexao /></RequireAuth>} />
```

- [ ] **Step 3: Decode único do `next` no Login** — em `src/pages/Login/index.jsx`, trocar:
```jsx
    const nextUrl = searchParams.get('next') ? decodeURIComponent(searchParams.get('next')) : '/home';
```
por:
```jsx
    // searchParams.get já decodifica; decodificar de novo corromperia a query do
    // fluxo OAuth (redirect_uri, state) que volta por aqui.
    const nextUrl = searchParams.get('next') || '/home';
```

- [ ] **Step 4: Página** — `src/pages/Auth/AutorizarConexao.jsx`:

```jsx
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { enviarConsentimentoOAuth, getOAuthCliente } from '../../services/api';
import './AutorizarConexao.css';

export function AutorizarConexao() {
    const [searchParams] = useSearchParams();
    const { user } = useAuth();
    const clientId = searchParams.get('client_id') || '';

    const [cliente, setCliente] = useState(null);
    const [erro, setErro] = useState('');
    const [podeEscrever, setPodeEscrever] = useState(true);
    const [enviando, setEnviando] = useState(false);

    useEffect(() => {
        let ativo = true;
        getOAuthCliente(clientId)
            .then((dados) => { if (ativo) setCliente(dados); })
            .catch(() => { if (ativo) setErro('Aplicativo desconhecido. Recomece a conexão pelo Claude.'); });
        return () => { ativo = false; };
    }, [clientId]);

    const responder = async (aprovado) => {
        setEnviando(true);
        try {
            const { redirect_url } = await enviarConsentimentoOAuth({
                client_id: clientId,
                redirect_uri: searchParams.get('redirect_uri'),
                code_challenge: searchParams.get('code_challenge'),
                code_challenge_method: searchParams.get('code_challenge_method'),
                state: searchParams.get('state'),
                escopos: podeEscrever ? ['bussola:read', 'bussola:write'] : ['bussola:read'],
                aprovado,
            });
            window.location.href = redirect_url;
        } catch (e) {
            setErro(e.response?.data?.detail || 'Não foi possível concluir a autorização.');
            setEnviando(false);
        }
    };

    return (
        <div className="autorizar-page">
            <div className="autorizar-card">
                <h2>Autorizar acesso</h2>
                {erro && <p className="autorizar-erro">{erro}</p>}
                {!erro && !cliente && <p>Carregando...</p>}
                {!erro && cliente && (
                    <>
                        <p>
                            <strong>{cliente.client_name}</strong> quer acessar o seu Bússola
                            {user?.email ? ` (${user.email})` : ''}.
                        </p>
                        <label className="autorizar-opcao">
                            <input type="checkbox" checked readOnly disabled /> Ler seus dados
                        </label>
                        <label className="autorizar-opcao">
                            <input
                                type="checkbox"
                                checked={podeEscrever}
                                onChange={(e) => setPodeEscrever(e.target.checked)}
                            />{' '}
                            Criar, editar e excluir registros
                        </label>
                        <p className="autorizar-dica">Senhas do Cofre nunca são compartilhadas.</p>
                        <div className="autorizar-acoes">
                            <button type="button" className="autorizar-btn" disabled={enviando} onClick={() => responder(false)}>
                                Negar
                            </button>
                            <button type="button" className="autorizar-btn primario" disabled={enviando} onClick={() => responder(true)}>
                                Autorizar
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
```

`src/pages/Auth/AutorizarConexao.css`:
```css
.autorizar-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
}

.autorizar-card {
    width: 100%;
    max-width: 420px;
    padding: 28px;
    border-radius: 16px;
    background: var(--cor-fundo-card);
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.autorizar-opcao {
    display: flex;
    align-items: center;
    gap: 8px;
}

.autorizar-dica {
    font-size: 0.85rem;
    opacity: 0.7;
}

.autorizar-erro {
    color: #ef4444;
}

.autorizar-acoes {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 8px;
}

.autorizar-btn {
    padding: 10px 18px;
    border-radius: 10px;
    border: 1px solid currentColor;
    background: transparent;
    color: inherit;
    cursor: pointer;
}

.autorizar-btn.primario {
    background: var(--cor-azul-primario);
    border-color: var(--cor-azul-primario);
    color: #fff;
}

.autorizar-btn:disabled {
    opacity: 0.6;
    cursor: wait;
}
```

- [ ] **Step 5: Build e lint**

Run (em `bussola_web/`): `npm run build`
Expected: build OK.
Run: `npx eslint src/routes/index.jsx src/pages/Login/index.jsx src/pages/Auth/AutorizarConexao.jsx`
Expected: nenhum erro novo nesses arquivos (compare com `git stash; npx eslint <mesmos arquivos>; git stash pop` se `Login` já tinha erros).

- [ ] **Step 6: Commit**

```bash
git add src/services/api.ts src/routes/index.jsx src/pages/Login/index.jsx src/pages/Auth/AutorizarConexao.jsx src/pages/Auth/AutorizarConexao.css
git commit -m "feat(mcp): tela de consentimento OAuth no SPA

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Frontend — seção "Conexões MCP" nas configurações

**Files:**
- Create: `bussola_web/src/components/UserDrawer/ConexoesMcp.jsx`, `bussola_web/src/components/UserDrawer/ConexoesMcp.css`
- Modify: `bussola_web/src/components/UserDrawer/index.jsx`

**Interfaces:**
- Consumes: `listarConexoesMcp`, `criarTokenMcp`, `revogarTokenMcp`, `revogarClienteMcp` (Task 14); `BaseModal`, `useToast`, `useConfirm`.

- [ ] **Step 1: Componente** — `src/components/UserDrawer/ConexoesMcp.jsx`:

```jsx
import { useEffect, useState } from 'react';
import { BaseModal } from '../BaseModal';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmDialogContext';
import { criarTokenMcp, listarConexoesMcp, revogarClienteMcp, revogarTokenMcp } from '../../services/api';
import './ConexoesMcp.css';

const MCP_URL = `${window.location.origin}/mcp`;

function formatarData(iso) {
    return iso ? new Date(iso).toLocaleDateString('pt-BR') : 'nunca';
}

export function ConexoesMcp() {
    const { addToast } = useToast();
    const confirm = useConfirm();

    const [conexoes, setConexoes] = useState([]);
    const [erroCarga, setErroCarga] = useState(false);
    const [versao, setVersao] = useState(0);
    const [modalAberto, setModalAberto] = useState(false);
    const [nome, setNome] = useState('Claude Code');
    const [podeEscrever, setPodeEscrever] = useState(true);
    const [tokenGerado, setTokenGerado] = useState('');

    useEffect(() => {
        let ativo = true;
        listarConexoesMcp()
            .then((dados) => { if (ativo) { setConexoes(dados); setErroCarga(false); } })
            .catch(() => { if (ativo) setErroCarga(true); });
        return () => { ativo = false; };
    }, [versao]);

    const recarregar = () => setVersao((v) => v + 1);

    const gerar = async () => {
        try {
            const dados = await criarTokenMcp({
                nome,
                escopos: podeEscrever ? ['bussola:read', 'bussola:write'] : ['bussola:read'],
                validade_dias: 90,
            });
            setTokenGerado(dados.token);
            recarregar();
        } catch {
            addToast({ type: 'error', title: 'Erro', description: 'Não foi possível gerar o token.' });
        }
    };

    const revogar = async (conexao) => {
        const ok = await confirm({
            title: 'Revogar conexão?',
            description: `${conexao.nome} perderá o acesso ao Bússola imediatamente.`,
            confirmLabel: 'Revogar',
            variant: 'danger',
        });
        if (!ok) return;
        try {
            if (conexao.tipo === 'pat') await revogarTokenMcp(conexao.id);
            else await revogarClienteMcp(conexao.client_id);
            addToast({ type: 'success', title: 'Conexão revogada' });
            recarregar();
        } catch {
            addToast({ type: 'error', title: 'Erro', description: 'Não foi possível revogar.' });
        }
    };

    const copiar = async (texto) => {
        try {
            await navigator.clipboard.writeText(texto);
            addToast({ type: 'success', title: 'Copiado!' });
        } catch {
            addToast({ type: 'error', title: 'Erro', description: 'Copie manualmente.' });
        }
    };

    const fecharModal = () => {
        setModalAberto(false);
        setTokenGerado('');
    };

    const comando = `claude mcp add --transport http bussola ${MCP_URL} --header "Authorization: Bearer ${tokenGerado}"`;

    return (
        <>
            <div className="form-section-title">Conexões MCP (Claude)</div>
            <p className="mcp-dica">
                No claude.ai, adicione um conector personalizado com a URL <code>{MCP_URL}</code>.
                Para o Claude Code, gere um token.
            </p>

            {erroCarga && <p className="mcp-dica">Não foi possível carregar as conexões.</p>}
            <ul className="mcp-lista">
                {conexoes.map((c) => (
                    <li key={c.tipo === 'pat' ? `pat-${c.id}` : `oauth-${c.client_id}`} className="mcp-item">
                        <div className="mcp-item-info">
                            <strong>{c.nome}</strong>
                            <span className="mcp-meta">
                                {c.tipo === 'pat' ? 'Token pessoal' : 'OAuth'} ·{' '}
                                {c.escopos.includes('bussola:write') ? 'leitura e escrita' : 'só leitura'} ·{' '}
                                último uso: {formatarData(c.ultimo_uso)}
                            </span>
                        </div>
                        <button type="button" className="btn-action-icon btn-delete" title="Revogar" onClick={() => revogar(c)}>
                            <i className="fa-solid fa-trash" />
                        </button>
                    </li>
                ))}
                {!erroCarga && conexoes.length === 0 && <li className="mcp-meta">Nenhuma conexão ativa.</li>}
            </ul>
            <button type="button" className="mcp-btn" onClick={() => setModalAberto(true)}>
                Novo token
            </button>

            {modalAberto && (
                <BaseModal onClose={fecharModal} className="modal">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h3>Novo token MCP</h3>
                        </div>
                        <div className="modal-body">
                            {tokenGerado ? (
                                <>
                                    <p>Copie agora — este token não será exibido de novo.</p>
                                    <code className="mcp-token">{tokenGerado}</code>
                                    <p>Comando para o Claude Code:</p>
                                    <code className="mcp-token">{comando}</code>
                                </>
                            ) : (
                                <>
                                    <div className="form-group">
                                        <label htmlFor="mcp-nome">Nome</label>
                                        <input id="mcp-nome" className="form-input" value={nome} maxLength={100}
                                            onChange={(e) => setNome(e.target.value)} />
                                    </div>
                                    <label className="mcp-opcao">
                                        <input type="checkbox" checked={podeEscrever}
                                            onChange={(e) => setPodeEscrever(e.target.checked)} />{' '}
                                        Permitir criar, editar e excluir
                                    </label>
                                    <p className="mcp-meta">Válido por 90 dias.</p>
                                </>
                            )}
                        </div>
                        <div className="modal-footer">
                            {tokenGerado ? (
                                <>
                                    <button type="button" className="mcp-btn" onClick={() => copiar(comando)}>Copiar comando</button>
                                    <button type="button" className="mcp-btn" onClick={() => copiar(tokenGerado)}>Copiar token</button>
                                    <button type="button" className="mcp-btn primario" onClick={fecharModal}>Concluir</button>
                                </>
                            ) : (
                                <>
                                    <button type="button" className="mcp-btn" onClick={fecharModal}>Cancelar</button>
                                    <button type="button" className="mcp-btn primario" disabled={!nome.trim()} onClick={gerar}>Gerar</button>
                                </>
                            )}
                        </div>
                    </div>
                </BaseModal>
            )}
        </>
    );
}
```

`src/components/UserDrawer/ConexoesMcp.css`:
```css
.mcp-dica {
    font-size: 0.85rem;
    opacity: 0.75;
    margin: 4px 0 8px;
}

.mcp-lista {
    list-style: none;
    padding: 0;
    margin: 0 0 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.mcp-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 10px;
    border-radius: 10px;
    background: var(--cor-fundo-card);
}

.mcp-item-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
}

.mcp-meta {
    font-size: 0.8rem;
    opacity: 0.7;
}

.mcp-opcao {
    display: flex;
    align-items: center;
    gap: 8px;
}

.mcp-token {
    display: block;
    padding: 8px;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.25);
    word-break: break-all;
    font-size: 0.8rem;
    margin-bottom: 8px;
}

.mcp-btn {
    padding: 8px 14px;
    border-radius: 10px;
    border: 1px solid currentColor;
    background: transparent;
    color: inherit;
    cursor: pointer;
}

.mcp-btn.primario {
    background: var(--cor-azul-primario);
    border-color: var(--cor-azul-primario);
    color: #fff;
}

.mcp-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}
```

- [ ] **Step 2: Renderizar no drawer** — em `src/components/UserDrawer/index.jsx`:
  - importar: `import { ConexoesMcp } from './ConexoesMcp';`
  - dentro do container `drawer-form`, como último filho (depois da seção "Segurança e Acesso"), adicionar:
```jsx
                    {isOpen && <ConexoesMcp />}
```
  (`isOpen &&` evita chamar `/mcp-tokens` em toda página só porque a Navbar renderiza o drawer fechado.)

- [ ] **Step 3: Build e lint**

Run (em `bussola_web/`): `npm run build`
Expected: build OK.
Run: `npx eslint src/components/UserDrawer/ConexoesMcp.jsx src/components/UserDrawer/index.jsx`
Expected: nenhum erro novo.

- [ ] **Step 4: Verificação manual (dev)**

Subir backend (`uvicorn app.main:app --reload` em `bussola_api/`) e frontend (`npm run dev`), logar, abrir Configurações da Conta → "Conexões MCP" → Novo token → Gerar; conferir que o token aparece uma vez, que a conexão entra na lista e que Revogar a remove. Com o token: `curl -i -X POST http://127.0.0.1:8000/mcp -H "Authorization: Bearer <token>" -H "Accept: application/json, text/event-stream" -H "Content-Type: application/json" -H "MCP-Protocol-Version: 2025-11-25" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'` → 200 com as 49 tools.

- [ ] **Step 5: Commit**

```bash
git add src/components/UserDrawer/ConexoesMcp.jsx src/components/UserDrawer/ConexoesMcp.css src/components/UserDrawer/index.jsx
git commit -m "feat(mcp): secao Conexoes MCP nas configuracoes da conta

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Verificação final e entrega

- [ ] **Step 1: Suíte do backend**

Run (em `bussola_api/`): `venvbussola/Scripts/python.exe -m pytest -q`
Expected: tudo PASS.

- [ ] **Step 2: Build do frontend**

Run (em `bussola_web/`): `npm run build`
Expected: OK.

- [ ] **Step 3: Revisar o diff do branch** contra a spec (`git diff main...feat/mcp-server --stat`) e conferir: 49 tools; Cofre sem valor; nenhuma regra de negócio em `app/mcp/tools/`; nenhum segredo commitado.

- [ ] **Step 4: Entregar ao usuário** (não fazer push): resumir o que foi feito e lembrar dos passos de produção — setar `PUBLIC_BASE_URL=https://bussola.marocos.dev` no Coolify ANTES do merge na `main` (que dispara o deploy), depois rodar os dois `curl` de smoke test do `docs/MCP.md` e conectar no claude.ai.
