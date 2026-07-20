"""
Panorama P0 (correção): forecast honesto, linha de Caixa real, receita/despesa
efetivadas (sincronizado com Finanças) e média por dia da semana.
"""
from datetime import datetime
from dateutil.relativedelta import relativedelta

from app.models.financas import Categoria, Transacao
from app.services.panorama import panorama_service
from app.services.financas import financas_service
from app.schemas.caixa import AjusteCaixaCreate


def _cat(db, user, nome, tipo):
    c = Categoria(nome=nome, tipo=tipo, user_id=user.id)
    db.add(c); db.commit(); db.refresh(c)
    return c


def _tx(db, user, cat, valor, data, status="Efetivada"):
    t = Transacao(descricao="x", valor=valor, data=data, categoria_id=cat.id,
                  tipo_recorrencia="pontual", status=status, user_id=user.id)
    db.add(t); db.commit(); db.refresh(t)
    return t


def _mes_atual_dia(d=15):
    return datetime.now().replace(day=d, hour=12, minute=0, second=0, microsecond=0)


def test_receita_despesa_apenas_efetivadas(db, user):
    rec = _cat(db, user, "Salário", "receita")
    desp = _cat(db, user, "Mercado", "despesa")
    _tx(db, user, rec, 1000.0, _mes_atual_dia(1))
    _tx(db, user, rec, 500.0, _mes_atual_dia(2), status="Pendente")  # não conta
    _tx(db, user, desp, 300.0, _mes_atual_dia(3))
    dash = panorama_service.get_dashboard_data(db, user.id)
    assert dash["kpis"]["receita_mes"] == 1000.0
    assert dash["kpis"]["despesa_mes"] == 300.0
    assert dash["kpis"]["balanco_mes"] == 700.0


def test_forecast_none_em_periodo_passado(db, user):
    desp = _cat(db, user, "Mercado", "despesa")
    ano_passado_ini = datetime.now().replace(month=1, day=1) - relativedelta(years=1)
    _tx(db, user, desp, 100.0, ano_passado_ini + relativedelta(months=1))
    dash = panorama_service.get_dashboard_data(
        db, user.id, start_date=ano_passado_ini, end_date=ano_passado_ini + relativedelta(years=1)
    )
    assert dash["forecast"] is None


def test_forecast_presente_tem_realizado(db, user):
    desp = _cat(db, user, "Mercado", "despesa")
    _tx(db, user, desp, 200.0, _mes_atual_dia(1))
    dash = panorama_service.get_dashboard_data(db, user.id)  # default = mês atual
    fc = dash["forecast"]
    assert fc is not None
    assert fc["realizado"] == 200.0
    assert fc["total_days"] >= fc["elapsed_days"] >= 1


def test_caixa_real_bate_calcular_caixa(db, user):
    rec = _cat(db, user, "Salário", "receita")
    desp = _cat(db, user, "Mercado", "despesa")
    _tx(db, user, rec, 1000.0, _mes_atual_dia(1))
    _tx(db, user, desp, 300.0, _mes_atual_dia(2))
    financas_service.criar_ajuste(db, AjusteCaixaCreate(tipo="entrada", valor=500.0), user.id)
    dash = panorama_service.get_dashboard_data(db, user.id)
    caixa = financas_service.calcular_caixa(db, user.id)
    assert caixa == 1200.0
    # O último ponto da linha (mês corrente) reflete o Caixa real acumulado.
    assert dash["evolucao_caixa_real"][-1] == 1200.0


def test_media_semanal_e_media_nao_soma(db, user):
    desp = _cat(db, user, "Mercado", "despesa")
    # duas despesas em dias diferentes do mês → média por dia da semana ≤ soma
    _tx(db, user, desp, 100.0, _mes_atual_dia(7))
    _tx(db, user, desp, 100.0, _mes_atual_dia(14))
    dash = panorama_service.get_dashboard_data(db, user.id)
    semanal = dash["gasto_semanal"]["data"]
    assert len(semanal) == 7
    # nenhum valor diário deve exceder 100 (é média, não soma acumulada)
    assert max(semanal) <= 100.0
