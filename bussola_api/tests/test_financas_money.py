"""
Testes de precisão monetária (MoneyCents): o banco guarda CENTAVOS inteiros,
o Python/serviço trabalha em REAIS. Rede de segurança para a migração Float→centavos.
"""
from datetime import datetime
from sqlalchemy import text

from app.models.financas import Categoria, Transacao
from app.services.financas import financas_service


def _mes_atual():
    # naive, meio do mês corrente (casa com o datetime.now() do get_dashboard_data)
    return datetime.now().replace(day=15, hour=12, minute=0, second=0, microsecond=0)


def test_valor_armazenado_em_centavos(db, user):
    cat = Categoria(nome="Mercado", tipo="despesa", user_id=user.id)
    db.add(cat); db.commit(); db.refresh(cat)

    t = Transacao(descricao="Compra", valor=10.10, data=_mes_atual(),
                  categoria_id=cat.id, user_id=user.id, status="Efetivada")
    db.add(t); db.commit(); db.refresh(t)

    # Python enxerga reais...
    assert t.valor == 10.10
    # ...mas o banco guarda centavos inteiros (exato).
    raw = db.execute(text("SELECT valor FROM transacao WHERE id = :i"), {"i": t.id}).scalar()
    assert raw == 1010


def test_soma_de_centavos_e_exata(db, user):
    """0.10 + 0.20 = 0.30 exato (o clássico erro de float não deve aparecer)."""
    cat = Categoria(nome="Miudezas", tipo="despesa", user_id=user.id)
    db.add(cat); db.commit(); db.refresh(cat)
    for v in (0.10, 0.20):
        db.add(Transacao(descricao="x", valor=v, data=_mes_atual(),
                         categoria_id=cat.id, user_id=user.id, status="Efetivada"))
    db.commit()
    total = db.execute(text("SELECT SUM(valor) FROM transacao WHERE categoria_id = :c"),
                       {"c": cat.id}).scalar()
    assert total == 30  # 10 + 20 centavos, inteiro exato


def test_dashboard_totais_e_media_em_reais(db, user):
    cat = Categoria(nome="Contas", tipo="despesa", user_id=user.id)
    db.add(cat); db.commit(); db.refresh(cat)
    for v in (10.00, 20.00):
        db.add(Transacao(descricao="x", valor=v, data=_mes_atual(),
                         categoria_id=cat.id, user_id=user.id, status="Efetivada"))
    db.commit()

    dash = financas_service.get_dashboard_data(db, user.id)
    alvo = next(c for c in dash["categorias_despesa"] if c.id == cat.id)
    assert round(alvo.total_gasto, 2) == 30.00    # func.sum → reais
    assert round(alvo.media_valor, 2) == 15.00     # func.avg → /100 → reais
