"""
=======================================================================================
ARQUIVO: registros.py (Schemas - Produtividade: Notas e Tarefas)
=======================================================================================

OBJETIVO:
    Definir DTOs para Notas Rápidas (Keep-style) e Gestão de Tarefas (ToDo).
    Gerencia a complexidade de recursividade em subtarefas.

PARTE DO SISTEMA:
    Backend / API Layer.
=======================================================================================
"""

from pydantic import BaseModel, field_validator
from typing import List, Optional, ForwardRef, Any
from datetime import datetime

# --------------------------------------------------------------------------------------
# GRUPOS (Organização de Notas)
# --------------------------------------------------------------------------------------
class GrupoBase(BaseModel):
    nome: str
    cor: Optional[str] = "#FFFFFF"

class GrupoCreate(GrupoBase):
    pass

class GrupoResponse(GrupoBase):
    id: int
    class Config:
        from_attributes = True

# --------------------------------------------------------------------------------------
# LINKS E ANOTAÇÕES
# --------------------------------------------------------------------------------------
class LinkResponse(BaseModel):
    id: int
    url: str
    class Config:
        from_attributes = True

class AnotacaoBase(BaseModel):
    titulo: Optional[str] = None
    conteudo: Optional[str] = None
    fixado: bool = False
    grupo_id: Optional[int] = None 

class AnotacaoCreate(AnotacaoBase):
    links: Optional[List[str]] = []

class AnotacaoUpdate(BaseModel):
    titulo: Optional[str] = None
    conteudo: Optional[str] = None
    fixado: Optional[bool] = None
    grupo_id: Optional[int] = None
    links: Optional[List[str]] = None

class AnotacaoResponse(AnotacaoBase):
    id: int
    data_criacao: datetime
    links: List[LinkResponse] = []
    grupo: Optional[GrupoResponse] = None 

    class Config:
        from_attributes = True

# --------------------------------------------------------------------------------------
# TAREFAS E SUBTAREFAS (Recursividade)
# --------------------------------------------------------------------------------------

# Definição de referências futuras para permitir auto-referência (Subtarefa dentro de Subtarefa)
SubtarefaCreate = ForwardRef('SubtarefaCreate')
SubtarefaUpdate = ForwardRef('SubtarefaUpdate')
SubtarefaResponse = ForwardRef('SubtarefaResponse')

# --- SUBTAREFAS ---

class SubtarefaBase(BaseModel):
    titulo: str
    concluido: bool = False

class SubtarefaCreate(SubtarefaBase):
    """Criação recursiva: uma subtarefa pode nascer já com filhas."""
    subtarefas: List[SubtarefaCreate] = [] 

class SubtarefaUpdate(SubtarefaBase):
    """Atualização recursiva."""
    id: Optional[int] = None # ID opcional: se presente atualiza, se ausente cria.
    subtarefas: List[SubtarefaUpdate] = []

class SubtarefaResponse(SubtarefaBase):
    id: int
    parent_id: Optional[int] = None
    subtarefas: List[SubtarefaResponse] = []

    class Config:
        from_attributes = True

# Reconstrução dos modelos após definição para resolver ForwardRefs
SubtarefaCreate.model_rebuild()
SubtarefaUpdate.model_rebuild()
SubtarefaResponse.model_rebuild()

# --- TAREFAS (Raiz) ---

class TarefaBase(BaseModel):
    titulo: str
    descricao: Optional[str] = None
    status: str = "Pendente"
    fixado: bool = False
    prioridade: str = "Média"
    prazo: Optional[datetime] = None

class TarefaCreate(TarefaBase):
    subtarefas: Optional[List[SubtarefaCreate]] = []

class TarefaUpdate(BaseModel):
    titulo: Optional[str] = None
    descricao: Optional[str] = None
    status: Optional[str] = None
    fixado: Optional[bool] = None
    prioridade: Optional[str] = None
    prazo: Optional[datetime] = None
    subtarefas: Optional[List[SubtarefaUpdate]] = None

class TarefaResponse(TarefaBase):
    id: int
    data_criacao: datetime
    data_conclusao: Optional[datetime] = None
    subtarefas: List[SubtarefaResponse] = []

    @field_validator('subtarefas', mode='before')
    def filter_root_subtarefas(cls, v: Any):
        """
        Regra de Exibição: Garante que apenas subtarefas diretas (nível 1) sejam listadas
        na raiz, evitando duplicação visual de itens aninhados.
        """
        if isinstance(v, list):
            return [sub for sub in v if getattr(sub, 'parent_id', None) is None]
        return v

    class Config:
        from_attributes = True

# --------------------------------------------------------------------------------------
# DASHBOARD REGISTROS
# --------------------------------------------------------------------------------------
class RegistrosDashboardResponse(BaseModel):
    anotacoes_fixadas: List[AnotacaoResponse]
    anotacoes_por_mes: dict[str, List[AnotacaoResponse]]
    tarefas_pendentes: List[TarefaResponse]
    tarefas_concluidas: List[TarefaResponse]
    grupos_disponiveis: List[GrupoResponse]