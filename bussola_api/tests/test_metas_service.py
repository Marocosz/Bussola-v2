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


from datetime import date, timedelta


def test_aporte_sugerido_divide_faltante_por_meses(db, user):
    alvo_data = date.today() + timedelta(days=300)  # ~10 meses
    m = metas_service.criar_meta(
        db, MetaCreate(nome="V", valor_alvo=10000.0, data_alvo=alvo_data), user.id
    )
    metas_service.criar_movimentacao(db, m.id, MovimentacaoCreate(tipo="aporte", valor=1.0), user.id)
    dados = metas_service.enriquecer_meta(db, m)
    assert dados["meses_restantes"] >= 9
    # faltante 10000 / ~10 meses ≈ 1000/mês (tolerância ampla)
    assert 800 <= dados["aporte_sugerido"] <= 1200


def test_progresso_pct(db, user):
    m = metas_service.criar_meta(db, MetaCreate(nome="V", valor_alvo=200.0), user.id)
    metas_service.criar_movimentacao(db, m.id, MovimentacaoCreate(tipo="aporte", valor=50.0), user.id)
    assert metas_service.enriquecer_meta(db, m)["progresso_pct"] == 25.0


def test_total_guardado_soma_metas_ativas(db, user):
    a = metas_service.criar_meta(db, MetaCreate(nome="A", valor_alvo=1000.0), user.id)
    b = metas_service.criar_meta(db, MetaCreate(nome="B", valor_alvo=1000.0), user.id)
    metas_service.criar_movimentacao(db, a.id, MovimentacaoCreate(tipo="aporte", valor=300.0), user.id)
    metas_service.criar_movimentacao(db, b.id, MovimentacaoCreate(tipo="aporte", valor=150.0), user.id)
    assert metas_service.total_guardado(db, user.id) == 450.0


def test_resumo_respeita_invariante(db, user):
    a = metas_service.criar_meta(db, MetaCreate(nome="A", valor_alvo=1000.0), user.id)
    metas_service.criar_movimentacao(db, a.id, MovimentacaoCreate(tipo="aporte", valor=300.0), user.id)
    resumo = metas_service.calcular_resumo(db, user.id, saldo_bruto=2000.0)
    assert resumo["guardado"] == 300.0
    assert resumo["total"] == 2000.0
    assert resumo["disponivel"] == 1700.0
    assert resumo["disponivel"] + resumo["guardado"] == resumo["total"]


def test_gerar_aporte_agendado_e_idempotente(db, user):
    m = metas_service.criar_meta(
        db,
        MetaCreate(nome="V", valor_alvo=10000.0, aporte_mensal_valor=500.0, aporte_mensal_dia=5),
        user.id,
    )
    metas_service.gerar_aportes_agendados(db, user.id)
    metas_service.gerar_aportes_agendados(db, user.id)  # 2ª vez não duplica
    movs = metas_service.listar_movimentacoes(db, m.id, user.id)
    pendentes = [x for x in movs if x.status == "Pendente" and x.origem == "agendado"]
    assert len(pendentes) == 1
    assert pendentes[0].valor == 500.0
    # ainda pendente: saldo intocado
    assert metas_service._get_meta(db, m.id, user.id).saldo_atual == 0.0


def test_confirmar_aporte_pendente_aplica_no_saldo(db, user):
    m = metas_service.criar_meta(
        db,
        MetaCreate(nome="V", valor_alvo=10000.0, aporte_mensal_valor=500.0, aporte_mensal_dia=5),
        user.id,
    )
    metas_service.gerar_aportes_agendados(db, user.id)
    mov = [x for x in metas_service.listar_movimentacoes(db, m.id, user.id) if x.status == "Pendente"][0]
    metas_service.toggle_status_movimentacao(db, m.id, mov.id, user.id)
    assert metas_service._get_meta(db, m.id, user.id).saldo_atual == 500.0


def test_gerar_nao_duplica_apos_confirmar(db, user):
    m = metas_service.criar_meta(
        db,
        MetaCreate(nome="V", valor_alvo=10000.0, aporte_mensal_valor=500.0, aporte_mensal_dia=5),
        user.id,
    )
    metas_service.gerar_aportes_agendados(db, user.id)
    mov = [x for x in metas_service.listar_movimentacoes(db, m.id, user.id) if x.status == "Pendente"][0]
    metas_service.toggle_status_movimentacao(db, m.id, mov.id, user.id)  # confirma
    metas_service.gerar_aportes_agendados(db, user.id)  # não deve criar 2º aporte do mês
    agendados = [x for x in metas_service.listar_movimentacoes(db, m.id, user.id) if x.origem == "agendado"]
    assert len(agendados) == 1
    assert metas_service._get_meta(db, m.id, user.id).saldo_atual == 500.0
