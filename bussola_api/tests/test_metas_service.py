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


from app.services.metas import metas_service
from app.schemas.metas import MetaCreate, MetaUpdate


def test_criar_e_listar_meta(db, user):
    metas_service.criar_meta(db, MetaCreate(nome="Carro", valor_alvo=50000.0), user.id)
    metas = metas_service.listar_metas(db, user.id)
    assert len(metas) == 1
    assert metas[0].nome == "Carro"
    assert metas[0].saldo_atual == 0.0


def test_listar_isola_por_usuario(db, user):
    metas_service.criar_meta(db, MetaCreate(nome="Minha", valor_alvo=100.0), user.id)
    assert metas_service.listar_metas(db, user_id=99999) == []


def test_recompute_saldo_soma_aportes_menos_retiradas(db, user):
    m = metas_service.criar_meta(db, MetaCreate(nome="Viagem", valor_alvo=1000.0), user.id)
    db.add(MovimentacaoMeta(meta_id=m.id, user_id=user.id, tipo="aporte", valor=300.0))
    db.add(MovimentacaoMeta(meta_id=m.id, user_id=user.id, tipo="retirada", valor=100.0))
    db.add(MovimentacaoMeta(meta_id=m.id, user_id=user.id, tipo="aporte", valor=50.0,
                            status="Pendente"))  # pendente NÃO conta
    db.commit()
    metas_service._recompute_saldo(db, m)
    assert m.saldo_atual == 200.0


def test_atualizar_meta(db, user):
    m = metas_service.criar_meta(db, MetaCreate(nome="X", valor_alvo=1.0), user.id)
    out = metas_service.atualizar_meta(db, m.id, MetaUpdate(nome="Y", valor_alvo=2.0), user.id)
    assert out.nome == "Y" and out.valor_alvo == 2.0


def test_deletar_meta(db, user):
    m = metas_service.criar_meta(db, MetaCreate(nome="X", valor_alvo=1.0), user.id)
    assert metas_service.deletar_meta(db, m.id, user.id) is True
    assert metas_service.listar_metas(db, user.id) == []


import pytest
from app.schemas.metas import MovimentacaoCreate


def test_aporte_incrementa_saldo(db, user):
    m = metas_service.criar_meta(db, MetaCreate(nome="V", valor_alvo=1000.0), user.id)
    metas_service.criar_movimentacao(
        db, m.id, MovimentacaoCreate(tipo="aporte", valor=250.0), user.id
    )
    assert metas_service._get_meta(db, m.id, user.id).saldo_atual == 250.0


def test_aporte_que_bate_alvo_conclui(db, user):
    m = metas_service.criar_meta(db, MetaCreate(nome="V", valor_alvo=100.0), user.id)
    metas_service.criar_movimentacao(
        db, m.id, MovimentacaoCreate(tipo="aporte", valor=100.0), user.id
    )
    out = metas_service._get_meta(db, m.id, user.id)
    assert out.status == "concluida" and out.concluida_em is not None


def test_retirada_alem_do_saldo_falha(db, user):
    m = metas_service.criar_meta(db, MetaCreate(nome="V", valor_alvo=1000.0), user.id)
    metas_service.criar_movimentacao(db, m.id, MovimentacaoCreate(tipo="aporte", valor=50.0), user.id)
    with pytest.raises(ValueError, match="saldo"):
        metas_service.criar_movimentacao(
            db, m.id, MovimentacaoCreate(tipo="retirada", valor=80.0), user.id
        )


def test_retirada_em_meta_trancada_falha(db, user):
    m = metas_service.criar_meta(
        db, MetaCreate(nome="V", valor_alvo=1000.0, trancada=True), user.id
    )
    metas_service.criar_movimentacao(db, m.id, MovimentacaoCreate(tipo="aporte", valor=200.0), user.id)
    with pytest.raises(ValueError, match="trancada"):
        metas_service.criar_movimentacao(
            db, m.id, MovimentacaoCreate(tipo="retirada", valor=100.0), user.id
        )


def test_deletar_movimentacao_recalcula_saldo(db, user):
    m = metas_service.criar_meta(db, MetaCreate(nome="V", valor_alvo=1000.0), user.id)
    mov = metas_service.criar_movimentacao(db, m.id, MovimentacaoCreate(tipo="aporte", valor=200.0), user.id)
    metas_service.deletar_movimentacao(db, m.id, mov.id, user.id)
    assert metas_service._get_meta(db, m.id, user.id).saldo_atual == 0.0
