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
