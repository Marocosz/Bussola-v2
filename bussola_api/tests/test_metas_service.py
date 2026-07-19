from datetime import date
from app.models.metas import Meta, MovimentacaoMeta


def test_meta_persiste_com_defaults(db, user):
    m = Meta(nome="Comprar carro", valor_alvo=50000.0, user_id=user.id)
    db.add(m)
    db.commit()
    db.refresh(m)
    assert m.id is not None
    assert m.saldo_atual == 0.0
    assert m.status == "ativa"
    assert m.trancada is False
    assert m.icone == "fa-solid fa-piggy-bank"


def test_movimentacao_relaciona_com_meta(db, user):
    m = Meta(nome="Viagem", valor_alvo=8000.0, user_id=user.id)
    db.add(m)
    db.commit()
    mov = MovimentacaoMeta(meta_id=m.id, user_id=user.id, tipo="aporte", valor=200.0)
    db.add(mov)
    db.commit()
    db.refresh(m)
    assert len(m.movimentacoes) == 1
    assert m.movimentacoes[0].status == "Efetivada"
    assert m.movimentacoes[0].origem == "manual"
