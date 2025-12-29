"""
=======================================================================================
ARQUIVO: financas.py (Schemas - Gestão Financeira)
=======================================================================================

OBJETIVO:
    Definir DTOs para Categorias, Transações e Dashboards Financeiros.
    Inclui validações de Enums para tipos e status.

PARTE DO SISTEMA:
    Backend / API Layer.
=======================================================================================
"""

from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from enum import Enum

# --------------------------------------------------------------------------------------
# ENUMS (Domínios de Valores)
# --------------------------------------------------------------------------------------
class TipoCategoria(str, Enum):
    RECEITA = 'receita'
    DESPESA = 'despesa'

class TipoRecorrencia(str, Enum):
    PONTUAL = 'pontual'
    PARCELADA = 'parcelada'
    RECORRENTE = 'recorrente'

class StatusTransacao(str, Enum):
    PENDENTE = 'Pendente'
    EFETIVADA = 'Efetivada'

class Frequencia(str, Enum):
    SEMANAL = 'semanal'
    MENSAL = 'mensal'
    ANUAL = 'anual'

# --------------------------------------------------------------------------------------
# CATEGORIAS
# --------------------------------------------------------------------------------------
class CategoriaBase(BaseModel):
    nome: str
    tipo: TipoCategoria
    meta_limite: float = 0.0
    icone: Optional[str] = "fa-solid fa-question"
    cor: Optional[str] = "#ffffff"

class CategoriaCreate(CategoriaBase):
    pass

class CategoriaUpdate(BaseModel):
    nome: Optional[str] = None
    tipo: Optional[TipoCategoria] = None
    meta_limite: Optional[float] = None
    icone: Optional[str] = None
    cor: Optional[str] = None

class CategoriaResponse(CategoriaBase):
    id: int
    
    # Métricas calculadas on-the-fly para exibição rápida no card
    total_gasto: Optional[float] = 0.0 
    total_ganho: Optional[float] = 0.0 

    # Métricas históricas (drill-down)
    total_historico: Optional[float] = 0.0
    media_valor: Optional[float] = 0.0
    qtd_transacoes: Optional[int] = 0

    class Config:
        from_attributes = True

# --------------------------------------------------------------------------------------
# TRANSAÇÕES
# --------------------------------------------------------------------------------------
class TransacaoBase(BaseModel):
    descricao: str
    valor: float
    data: datetime
    categoria_id: int
    tipo_recorrencia: TipoRecorrencia = TipoRecorrencia.PONTUAL
    status: StatusTransacao = StatusTransacao.PENDENTE
    
    # Campos para lógica de parcelamento/recorrência
    parcela_atual: Optional[int] = None
    total_parcelas: Optional[int] = None
    valor_total_parcelamento: Optional[float] = None # Campo para exibir o valor cheio no front
    frequencia: Optional[Frequencia] = None
    
    # Flag para indicar se a série foi encerrada manualmente pelo usuário
    recorrencia_encerrada: Optional[bool] = False

class TransacaoCreate(TransacaoBase):
    pass

class TransacaoUpdate(BaseModel):
    descricao: Optional[str] = None
    valor: Optional[float] = None
    data: Optional[datetime] = None
    categoria_id: Optional[int] = None
    status: Optional[StatusTransacao] = None
    recorrencia_encerrada: Optional[bool] = None

class TransacaoResponse(TransacaoBase):
    id: int
    categoria: Optional[CategoriaResponse] = None # Objeto aninhado para evitar queries extras no front
    id_grupo_recorrencia: Optional[str] = None

    class Config:
        from_attributes = True

# --------------------------------------------------------------------------------------
# DASHBOARD FINANCEIRO
# --------------------------------------------------------------------------------------
class FinancasDashboardResponse(BaseModel):
    """Agrega todos os dados necessários para renderizar a tela inicial de finanças."""
    categorias_despesa: List[CategoriaResponse]
    categorias_receita: List[CategoriaResponse]
    
    # Transações agrupadas por mês
    transacoes_pontuais: dict[str, List[TransacaoResponse]] 
    transacoes_recorrentes: dict[str, List[TransacaoResponse]]
    
    # Metadados de UI
    icones_disponiveis: List[str]
    cores_disponiveis: List[str]