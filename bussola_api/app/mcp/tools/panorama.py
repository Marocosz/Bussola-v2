"""
=======================================================================================
ARQUIVO: tools/panorama.py (MCP - Panorama)
=======================================================================================

OBJETIVO:
    Visão consolidada de um período (KPIs de todos os módulos, comparativo com o
    período anterior, orçamento, cofrinhos, ritmo e insights) e histórico de categoria.
=======================================================================================
"""

from datetime import date, datetime, time, timedelta
from typing import Any, Optional

from dateutil.relativedelta import relativedelta
from fastapi.encoders import jsonable_encoder

from app.core.timezone import now_local
from app.mcp.context import usuario_e_db
from app.mcp.resolvers import resolver_categoria
from app.mcp.tools import registrar
from app.services.panorama import panorama_service

CHAVES = ("kpis", "forecast", "comparativo", "orcamento", "cofrinhos", "ritmo", "insights", "gastos_por_categoria")


def panorama_geral(de: Optional[date] = None, ate: Optional[date] = None) -> dict[str, Any]:
    """Panorama de um período (de/ate inclusivos; padrão = mês atual): receitas, despesas, caixa,
    compromissos, tarefas, chaves do cofre, previsão do mês, comparativo com o período anterior,
    orçamento por categoria, cofrinhos, ritmo e insights automáticos."""
    with usuario_e_db() as (db, user):
        inicio = de or now_local().date().replace(day=1)
        fim = (ate + timedelta(days=1)) if ate else inicio + relativedelta(months=1)
        dados = panorama_service.get_dashboard_data(
            db, user.id, start_date=datetime.combine(inicio, time()), end_date=datetime.combine(fim, time())
        )
        return {
            "periodo": {"de": inicio.isoformat(), "ate": (fim - timedelta(days=1)).isoformat()},
            **jsonable_encoder({chave: dados.get(chave) for chave in CHAVES}),
        }


def historico_categoria(categoria: str) -> dict[str, Any]:
    """Total mensal de uma categoria (nome ou id) nos últimos 6 meses."""
    with usuario_e_db() as (db, user):
        alvo = resolver_categoria(db, user.id, categoria)
        return {"categoria": alvo.nome,
                **jsonable_encoder(panorama_service.get_category_history(db, alvo.id, user.id))}


def register(mcp):
    registrar(mcp, leitura=(panorama_geral, historico_categoria))
