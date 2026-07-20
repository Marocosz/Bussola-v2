"""Schemas (DTOs) de Ajustes de Caixa / Saldo inicial."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum


class TipoAjuste(str, Enum):
    ENTRADA = "entrada"
    SAIDA = "saida"


class AjusteCaixaBase(BaseModel):
    tipo: TipoAjuste = TipoAjuste.ENTRADA
    valor: float = Field(gt=0)
    data: Optional[datetime] = None
    observacao: Optional[str] = None


class AjusteCaixaCreate(AjusteCaixaBase):
    pass


class AjusteCaixaUpdate(BaseModel):
    tipo: Optional[TipoAjuste] = None
    valor: Optional[float] = Field(default=None, gt=0)
    data: Optional[datetime] = None
    observacao: Optional[str] = None


class AjusteCaixaResponse(AjusteCaixaBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
