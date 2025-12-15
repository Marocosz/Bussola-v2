from pydantic import BaseModel, field_validator
from typing import List, Optional, ForwardRef, Any
from datetime import datetime

# --- Schemas de Grupo ---
class GrupoBase(BaseModel):
    nome: str
    cor: Optional[str] = "#FFFFFF"

class GrupoCreate(GrupoBase):
    pass

class GrupoResponse(GrupoBase):
    id: int
    class Config:
        from_attributes = True

# --- Schemas de Link ---
class LinkResponse(BaseModel):
    id: int
    url: str
    class Config:
        from_attributes = True

# --- Schemas de Anotação ---
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

# --- Schemas de Tarefa e Subtarefa (RECURSIVO & FILTRADO) ---

SubtarefaResponse = ForwardRef('SubtarefaResponse')

class SubtarefaBase(BaseModel):
    titulo: str
    concluido: bool = False

class SubtarefaCreate(SubtarefaBase):
    parent_id: Optional[int] = None

class SubtarefaUpdate(BaseModel):
    titulo: Optional[str] = None
    concluido: Optional[bool] = None

class SubtarefaResponse(SubtarefaBase):
    id: int
    parent_id: Optional[int] = None
    subtarefas: List[SubtarefaResponse] = []

    class Config:
        from_attributes = True

SubtarefaResponse.model_rebuild()

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

class TarefaResponse(TarefaBase):
    id: int
    data_criacao: datetime
    data_conclusao: Optional[datetime] = None
    subtarefas: List[SubtarefaResponse] = []

    # --- CORREÇÃO DO BUG DE DUPLICAÇÃO ---
    @field_validator('subtarefas', mode='before')
    def filter_root_subtarefas(cls, v: Any):
        # Se v for uma lista de objetos ORM (SQLAlchemy), filtramos aqui
        # Retorna apenas as subtarefas que NÃO têm pai (parent_id é None)
        # As que têm pai já estarão aninhadas dentro dos objetos pai
        if isinstance(v, list):
            return [sub for sub in v if getattr(sub, 'parent_id', None) is None]
        return v

    class Config:
        from_attributes = True

# --- Dashboard ---
class RegistrosDashboardResponse(BaseModel):
    anotacoes_fixadas: List[AnotacaoResponse]
    anotacoes_por_mes: dict[str, List[AnotacaoResponse]]
    tarefas_pendentes: List[TarefaResponse]
    tarefas_concluidas: List[TarefaResponse]
    grupos_disponiveis: List[GrupoResponse]