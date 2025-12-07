from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date
from enum import Enum

# --- Enums para padronizar opções ---
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

# --- CATEGORIAS ---
class CategoriaBase(BaseModel):
    nome: str
    tipo: TipoCategoria
    meta_limite: float = 0.0
    icone: Optional[str] = "fa-solid fa-question"
    cor: Optional[str] = "#ffffff"

class CategoriaCreate(CategoriaBase):
    pass

class CategoriaResponse(CategoriaBase):
    id: int
    total_gasto: Optional[float] = 0.0 # Campo calculado para o dashboard
    total_ganho: Optional[float] = 0.0 # Campo calculado para o dashboard

    class Config:
        from_attributes = True

# --- TRANSAÇÕES ---
class TransacaoBase(BaseModel):
    descricao: str
    valor: float
    data: datetime
    categoria_id: int
    tipo_recorrencia: TipoRecorrencia = TipoRecorrencia.PONTUAL
    status: StatusTransacao = StatusTransacao.PENDENTE
    
    # Opcionais dependendo do tipo
    parcela_atual: Optional[int] = None
    total_parcelas: Optional[int] = None
    frequencia: Optional[Frequencia] = None

class TransacaoCreate(TransacaoBase):
    pass

class TransacaoResponse(TransacaoBase):
    id: int
    categoria: Optional[CategoriaResponse] = None # Nested object
    id_grupo_recorrencia: Optional[str] = None

    class Config:
        from_attributes = True

# --- DASHBOARD (Resposta completa da rota /financas) ---
class FinancasDashboardResponse(BaseModel):
    categorias_despesa: List[CategoriaResponse]
    categorias_receita: List[CategoriaResponse]
    transacoes_pontuais: dict[str, List[TransacaoResponse]] # Agrupado por mês "Janeiro/2025": [transacoes]
    transacoes_recorrentes: dict[str, List[TransacaoResponse]]
    icones_disponiveis: List[str]
    cores_disponiveis: List[str]