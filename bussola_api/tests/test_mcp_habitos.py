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
