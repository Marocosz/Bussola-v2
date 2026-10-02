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
