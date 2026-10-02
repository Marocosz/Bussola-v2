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


def test_pkce_errado_queima_o_codigo(db, user):
    cliente = mcp_auth_service.registrar_cliente(db, "Claude", [REDIRECT])
    verifier, challenge = _pkce()
    codigo = mcp_auth_service.criar_codigo(db, cliente.client_id, user.id, REDIRECT, challenge, ["bussola:read"])
    with pytest.raises(OAuthErro):
        mcp_auth_service.trocar_codigo(db, cliente.client_id, codigo, REDIRECT, "errado-" + "y" * 40)
    with pytest.raises(OAuthErro) as erro:
        mcp_auth_service.trocar_codigo(db, cliente.client_id, codigo, REDIRECT, verifier)
    assert erro.value.codigo == "invalid_grant"


def test_replay_de_refresh_revoga_a_sessao(db, user):
    cliente, par1 = _par(db, user)
    par2 = mcp_auth_service.renovar(db, cliente.client_id, par1["refresh_token"])
    with pytest.raises(OAuthErro) as erro:
        mcp_auth_service.renovar(db, cliente.client_id, par1["refresh_token"])
    assert erro.value.codigo == "invalid_grant"
    assert mcp_auth_service.verificar(db, par2["access_token"]) is None
    with pytest.raises(OAuthErro):
        mcp_auth_service.renovar(db, cliente.client_id, par2["refresh_token"])
