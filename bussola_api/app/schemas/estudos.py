"""Schemas (DTOs) do módulo Estudos (REST e MCP). O contrato dos blocos está em estudos_blocos.py."""

from datetime import datetime
from typing import Any, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, StrictInt


class TemaResponse(BaseModel):
    id: int
    nome: str
    cor: Optional[str] = None
    icone: Optional[str] = None
    descricao: Optional[str] = None
    total_materiais: int = 0


class MaterialResumo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    titulo: str
    subtitulo: Optional[str] = None
    tipo: str
    nivel: str
    tags: list[str] = []
    tema_id: Optional[int] = None
    tema_nome: Optional[str] = None
    tema_cor: Optional[str] = None
    estudado: bool = False
    estudado_em: Optional[datetime] = None
    criado_em: Optional[datetime] = None
    atualizado_em: Optional[datetime] = None


class MaterialResponse(MaterialResumo):
    blocos: list[dict[str, Any]] = []
    fontes: list[dict[str, Any]] = []


class RespostaCreate(BaseModel):
    bloco_id: str = Field(min_length=1, max_length=24)
    resposta: Union[StrictInt, str, None] = None   # índice (quiz) ou texto (questão aberta)
    acertou: Optional[bool] = None                 # só para questão aberta; ignorado em quiz


class RespondidoResponse(BaseModel):
    """Última resposta de cada bloco respondível do material (progresso na leitura)."""
    bloco_id: str
    acertou: bool
    respondido_em: Optional[str] = None


class RespostaResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    material_id: int
    bloco_id: str
    resposta: Union[int, str, None] = None
    acertou: bool
    respondido_em: Optional[datetime] = None


class EstudadoUpdate(BaseModel):
    estudado: bool
