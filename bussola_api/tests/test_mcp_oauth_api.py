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
