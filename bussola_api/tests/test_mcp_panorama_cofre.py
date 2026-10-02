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
