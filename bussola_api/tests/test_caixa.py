"""
Caixa acumulado (patrimônio) + ajustes de caixa:
- calcular_caixa soma ajustes(entrada−saída) + receitas − despesas efetivadas;
- pendentes/futuras não entram;
- disponível = caixa − guardado (invariante);
- CRUD de ajuste recompõe o caixa.
"""
from datetime import datetime

from app.models.financas import Categoria, Transacao
from app.services.financas import financas_service
from app.services.metas import metas_service
from app.schemas.caixa import AjusteCaixaCreate, AjusteCaixaUpdate
from app.schemas.metas import MetaCreate, MovimentacaoCreate


def _cat(db, user, nome, tipo):
    c = Categoria(nome=nome, tipo=tipo, user_id=user.id)
    db.add(c); db.commit(); db.refresh(c)
    return c


def _tx(db, user, cat, valor, status="Efetivada"):
    t = Transacao(descricao="x", valor=valor, data=datetime(2026, 1, 10),
                  categoria_id=cat.id, tipo_recorrencia="pontual",
                  status=status, user_id=user.id)
    db.add(t); db.commit(); db.refresh(t)
    return t


def test_caixa_vazio_e_zero(db, user):
    assert financas_service.calcular_caixa(db, user.id) == 0.0


def test_caixa_soma_receitas_menos_despesas_efetivadas(db, user):
    rec = _cat(db, user, "Salário", "receita")
    desp = _cat(db, user, "Mercado", "despesa")
    _tx(db, user, rec, 1000.0)
    _tx(db, user, desp, 300.0)
    _tx(db, user, desp, 50.0, status="Pendente")  # pendente NÃO conta
    assert financas_service.calcular_caixa(db, user.id) == 700.0


def test_caixa_inclui_ajustes(db, user):
    rec = _cat(db, user, "Salário", "receita")
    _tx(db, user, rec, 1000.0)
    financas_service.criar_ajuste(db, AjusteCaixaCreate(tipo="entrada", valor=5000.0), user.id)
    financas_service.criar_ajuste(db, AjusteCaixaCreate(tipo="saida", valor=200.0), user.id)
    # 5000 - 200 + 1000 = 5800
    assert financas_service.calcular_caixa(db, user.id) == 5800.0


def test_resumo_usa_caixa_e_invariante(db, user):
    financas_service.criar_ajuste(db, AjusteCaixaCreate(tipo="entrada", valor=5000.0), user.id)
    m = metas_service.criar_meta(db, MetaCreate(nome="Viagem", valor_alvo=10000.0), user.id)
    metas_service.criar_movimentacao(db, m.id, MovimentacaoCreate(tipo="aporte", valor=1500.0), user.id)

    caixa = financas_service.calcular_caixa(db, user.id)
    resumo = metas_service.calcular_resumo(db, user.id, caixa)
    assert resumo["total"] == 5000.0
    assert resumo["guardado"] == 1500.0
    assert resumo["disponivel"] == 3500.0
    assert resumo["disponivel"] + resumo["guardado"] == resumo["total"]


def test_crud_ajuste_recompoe_caixa(db, user):
    a = financas_service.criar_ajuste(db, AjusteCaixaCreate(tipo="entrada", valor=1000.0), user.id)
    assert financas_service.calcular_caixa(db, user.id) == 1000.0

    financas_service.atualizar_ajuste(db, a.id, AjusteCaixaUpdate(valor=1500.0), user.id)
    assert financas_service.calcular_caixa(db, user.id) == 1500.0

    assert financas_service.deletar_ajuste(db, a.id, user.id) is True
    assert financas_service.calcular_caixa(db, user.id) == 0.0


def test_ajuste_isola_por_usuario(db, user):
    financas_service.criar_ajuste(db, AjusteCaixaCreate(tipo="entrada", valor=1000.0), user.id)
    assert financas_service.calcular_caixa(db, user_id=99999) == 0.0
    assert financas_service.listar_ajustes(db, user_id=99999) == []


# ---- limite de aporte no cofre ----
import pytest


def test_aporte_alem_do_alvo_falha(db, user):
    m = metas_service.criar_meta(db, MetaCreate(nome="V", valor_alvo=1000.0), user.id)
    metas_service.criar_movimentacao(db, m.id, MovimentacaoCreate(tipo="aporte", valor=900.0), user.id)
    with pytest.raises(ValueError, match="limite"):
        metas_service.criar_movimentacao(db, m.id, MovimentacaoCreate(tipo="aporte", valor=200.0), user.id)


def test_aporte_agendado_capa_no_restante(db, user):
    m = metas_service.criar_meta(
        db, MetaCreate(nome="V", valor_alvo=1000.0, aporte_mensal_valor=500.0, aporte_mensal_dia=5), user.id
    )
    metas_service.criar_movimentacao(db, m.id, MovimentacaoCreate(tipo="aporte", valor=800.0), user.id)
    metas_service.gerar_aportes_agendados(db, user.id)
    pend = [x for x in metas_service.listar_movimentacoes(db, m.id, user.id)
            if x.status == "Pendente" and x.origem == "agendado"]
    assert len(pend) == 1
    assert pend[0].valor == 200.0  # capado no restante (1000 - 800), não 500
