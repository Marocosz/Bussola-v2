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
