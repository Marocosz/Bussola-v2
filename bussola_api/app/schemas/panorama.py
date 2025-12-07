from pydantic import BaseModel
from typing import List, Optional, Any
from app.schemas.financas import CategoriaResponse # Reaproveitamos o schema de categoria

class KpiData(BaseModel):
    receita_mes: float
    despesa_mes: float
    balanco_mes: float
    compromissos_realizados: int
    compromissos_pendentes: int
    compromissos_perdidos: int
    chaves_ativas: int
    chaves_expiradas: int
    proximo_compromisso: Optional[dict] = None 

class ChartData(BaseModel):
    labels: List[str]
    data: List[float]
    colors: Optional[List[str]] = None

class PanoramaResponse(BaseModel):
    kpis: KpiData
    gastos_por_categoria: ChartData
    evolucao_mensal_receita: List[float]
    evolucao_mensal_despesa: List[float]
    evolucao_labels: List[str]
    gasto_semanal: ChartData
    categorias_para_filtro: List[CategoriaResponse]