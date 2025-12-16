from pydantic import BaseModel
from typing import List, Optional, Any
from datetime import datetime
from app.schemas.financas import CategoriaResponse 

# --- SUB-SCHEMAS PARA OS KPIS ---
class TarefasPendentesDetalhe(BaseModel):
    critica: int
    alta: int
    media: int
    baixa: int

class KpiData(BaseModel):
    # Finanças
    receita_mes: float
    despesa_mes: float
    balanco_mes: float
    
    # Agenda
    compromissos_realizados: int
    compromissos_pendentes: int
    compromissos_perdidos: int
    proximo_compromisso: Optional[dict] = None 
    
    # Registros (Anotações e Tarefas)
    total_anotacoes: int
    tarefas_pendentes: TarefasPendentesDetalhe
    tarefas_concluidas: int
    
    # Cofre
    chaves_ativas: int
    chaves_expiradas: int

class ChartData(BaseModel):
    labels: List[str]
    data: List[float]
    colors: Optional[List[str]] = None

# --- SCHEMAS PARA OS MODAIS (TABELAS) ---

class ProvisaoItem(BaseModel):
    id: int
    descricao: str
    valor: float
    data_vencimento: datetime
    categoria_nome: str
    categoria_cor: str
    tipo_recorrencia: str  # 'Pontual', 'Recorrente', 'Parcelada'
    status: str

class RoteiroItem(BaseModel):
    id: int
    titulo: str
    data_inicio: datetime
    data_fim: datetime
    tipo: str # Ex: 'Reunião', 'Consulta', etc.
    cor: str
    status: str # 'Pendente', 'Realizado', etc.

class RegistroItem(BaseModel):
    id: int
    titulo: str
    tipo: str # 'Anotacao' ou 'Tarefa'
    grupo_ou_prioridade: str # Nome do grupo (nota) ou Prioridade (tarefa)
    data_criacao: datetime
    status: Optional[str] = None # Para tarefas: Pendente/Concluido

# --- RESPOSTA PRINCIPAL ---
class PanoramaResponse(BaseModel):
    kpis: KpiData
    gastos_por_categoria: ChartData
    evolucao_mensal_receita: List[float]
    evolucao_mensal_despesa: List[float]
    evolucao_labels: List[str]
    gasto_semanal: ChartData
    categorias_para_filtro: List[CategoriaResponse]