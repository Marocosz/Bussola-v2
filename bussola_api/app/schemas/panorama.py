"""
=======================================================================================
ARQUIVO: panorama.py (Schemas - Relatórios e KPIs)
=======================================================================================

OBJETIVO:
    Definir a estrutura de dados para o módulo "Panorama" (BI/Analytics).
    Agrega métricas de todos os módulos do sistema em uma visão unificada.

PARTE DO SISTEMA:
    Backend / API Layer / Analytics.
=======================================================================================
"""

from pydantic import BaseModel
from typing import List, Optional, Any
from datetime import datetime
from app.schemas.financas import CategoriaResponse 

# --------------------------------------------------------------------------------------
# KPIS (Key Performance Indicators)
# --------------------------------------------------------------------------------------
class TarefasPendentesDetalhe(BaseModel):
    critica: int
    alta: int
    media: int
    baixa: int

class KpiData(BaseModel):
    """Snapshot consolidado do estado atual do usuário."""
    # Finanças
    receita_mes: float
    despesa_mes: float
    balanco_mes: float
    caixa: float = 0.0  # patrimônio acumulado (saldo inicial + receitas − despesas efetivadas)

    # Agenda
    compromissos_realizados: int
    compromissos_pendentes: int
    compromissos_perdidos: int
    proximo_compromisso: Optional[dict] = None 
    
    # Produtividade
    total_anotacoes: int
    tarefas_pendentes: TarefasPendentesDetalhe
    tarefas_concluidas: int
    
    # Segurança
    chaves_ativas: int
    chaves_expiradas: int

# --------------------------------------------------------------------------------------
# GRÁFICOS (ChartJS Support)
# --------------------------------------------------------------------------------------
class ChartData(BaseModel):
    labels: List[str]
    data: List[float]
    colors: Optional[List[str]] = None


class ForecastData(BaseModel):
    """Projeção de fim de período — só quando hoje está dentro do intervalo."""
    elapsed_days: int
    total_days: int
    realizado: float
    projetado: float
    conhecido_pendente: float
    status: str  # 'safe' | 'danger'


class ComparativoData(BaseModel):
    receita: float
    despesa: float
    balanco: float


class OrcamentoItem(BaseModel):
    nome: str
    cor: Optional[str] = None
    icone: Optional[str] = None
    gasto: float
    limite: float
    pct: Optional[float] = None  # None quando a categoria não tem limite


class CofreMetaItem(BaseModel):
    id: int
    nome: str
    cor: Optional[str] = None
    icone: Optional[str] = None
    saldo_atual: float
    valor_alvo: float
    progresso_pct: float = 0.0
    data_projetada: Optional[Any] = None


class CofrinhosResumo(BaseModel):
    total_guardado: float = 0.0
    qtd: int = 0
    metas: List[CofreMetaItem] = []


class RitmoResumo(BaseModel):
    peso_atual: Optional[float] = None
    peso_delta: Optional[float] = None
    objetivo: Optional[str] = None
    plano_ativo: Optional[str] = None
    dieta_calorias: Optional[float] = None

# --------------------------------------------------------------------------------------
# ITENS DE DETALHE (Tabelas e Listas)
# --------------------------------------------------------------------------------------
class ProvisaoItem(BaseModel):
    """Item financeiro previsto (Contas a Pagar/Receber)."""
    id: int
    descricao: str
    valor: float
    data_vencimento: datetime
    categoria_nome: str
    categoria_cor: str
    tipo_recorrencia: str 
    status: str

class RoteiroItem(BaseModel):
    """Item de agenda simplificado para timeline."""
    id: int
    titulo: str
    data_inicio: datetime
    data_fim: datetime
    tipo: str 
    cor: str
    status: str

class RegistroItem(BaseModel):
    """Item unificado de Notas e Tarefas."""
    id: int
    titulo: str
    tipo: str # 'Anotacao' ou 'Tarefa'
    grupo_ou_prioridade: str 
    data_criacao: datetime
    status: Optional[str] = None 

# --------------------------------------------------------------------------------------
# RESPOSTA PRINCIPAL
# --------------------------------------------------------------------------------------
class PanoramaResponse(BaseModel):
    kpis: KpiData
    forecast: Optional[ForecastData] = None
    comparativo: Optional[ComparativoData] = None
    orcamento: List[OrcamentoItem] = []
    cofrinhos: CofrinhosResumo = CofrinhosResumo()
    ritmo: Optional[RitmoResumo] = None

    # Gráficos
    gastos_por_categoria: ChartData
    receitas_por_categoria: ChartData = ChartData(labels=[], data=[], colors=[])
    evolucao_mensal_receita: List[float]
    evolucao_mensal_despesa: List[float]
    evolucao_caixa_real: List[float] = []
    evolucao_labels: List[str]
    gasto_semanal: ChartData
    categorias_para_filtro: List[CategoriaResponse]
    
    # Listas Detalhadas
    provisoes: List[ProvisaoItem] = []
    roteiro: List[RoteiroItem] = []
    registros: List[RegistroItem] = []