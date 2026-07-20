"""Schemas (DTOs) do módulo Metas & Cofrinhos."""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date
from enum import Enum


class TipoMovimentacao(str, Enum):
    APORTE = "aporte"
    RETIRADA = "retirada"


class OrigemMovimentacao(str, Enum):
    MANUAL = "manual"
    AGENDADO = "agendado"


class StatusMeta(str, Enum):
    ATIVA = "ativa"
    CONCLUIDA = "concluida"
    ARQUIVADA = "arquivada"


class StatusMov(str, Enum):
    PENDENTE = "Pendente"
    EFETIVADA = "Efetivada"


# ---------- META ----------
class MetaBase(BaseModel):
    nome: str
    valor_alvo: float = Field(gt=0)
    data_alvo: Optional[date] = None
    icone: Optional[str] = "fa-solid fa-piggy-bank"
    cor: Optional[str] = "#4f46e5"
    imagem_url: Optional[str] = None
    trancada: bool = False
    aporte_mensal_valor: Optional[float] = None
    aporte_mensal_dia: Optional[int] = Field(default=None, ge=1, le=28)


class MetaCreate(MetaBase):
    pass


class MetaUpdate(BaseModel):
    nome: Optional[str] = None
    valor_alvo: Optional[float] = None
    data_alvo: Optional[date] = None
    icone: Optional[str] = None
    cor: Optional[str] = None
    imagem_url: Optional[str] = None
    trancada: Optional[bool] = None
    status: Optional[StatusMeta] = None
    aporte_mensal_valor: Optional[float] = None
    aporte_mensal_dia: Optional[int] = Field(default=None, ge=1, le=28)


class MetaResponse(MetaBase):
    id: int
    saldo_atual: float
    status: StatusMeta
    created_at: datetime
    concluida_em: Optional[datetime] = None

    # Campos calculados on-the-fly
    progresso_pct: float = 0.0
    aporte_sugerido: Optional[float] = None
    data_projetada: Optional[date] = None
    meses_restantes: Optional[int] = None

    class Config:
        from_attributes = True


# ---------- MOVIMENTAÇÃO ----------
class MovimentacaoCreate(BaseModel):
    tipo: TipoMovimentacao
    valor: float = Field(gt=0)
    data: Optional[datetime] = None
    observacao: Optional[str] = None


class MovimentacaoResponse(BaseModel):
    id: int
    meta_id: int
    tipo: TipoMovimentacao
    valor: float
    data: datetime
    status: StatusMov
    origem: OrigemMovimentacao
    observacao: Optional[str] = None

    class Config:
        from_attributes = True


# ---------- DASHBOARD ----------
class ResumoPatrimonio(BaseModel):
    disponivel: float
    guardado: float
    total: float


class MetasDashboardResponse(BaseModel):
    metas: List[MetaResponse]
    resumo: ResumoPatrimonio
    icones_disponiveis: List[str]
    cores_disponiveis: List[str]
