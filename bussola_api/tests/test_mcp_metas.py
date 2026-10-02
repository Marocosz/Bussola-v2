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
