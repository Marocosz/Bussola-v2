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
