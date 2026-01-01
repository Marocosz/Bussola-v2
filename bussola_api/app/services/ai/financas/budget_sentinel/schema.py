from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class AnaliseCategoria(BaseModel):
    categoria: str
    limite_mensal: float
    gasto_atual: float
    
    # Métricas de Execução (Calculadas no Python)
    percentual_consumido: float # Ex: 80.5%
    status_burn_rate: str # "Crítico", "Alerta", "Seguro", "Economia"
    saldo_restante: float
    diaria_disponivel: float # Quanto pode gastar por dia até o fim do mês

class BudgetSentinelContext(BaseModel):
    """
    Contexto para monitoramento tático de orçamento (Burn Rate).
    Compara o % do mês decorrido com o % do orçamento consumido.
    """
    dia_atual: int
    dias_no_mes: int
    percentual_mes_decorrido: float # Ex: Dia 15/30 = 50.0%
    
    # Análise detalhada por categoria monitorada
    analise_orcamentos: List[AnaliseCategoria] = Field(default_factory=list)