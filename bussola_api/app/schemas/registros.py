from pydantic import BaseModel
from typing import List, Optional
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
    grupo_id: Optional[int] = None # ID do grupo

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
    grupo: Optional[GrupoResponse] = None # Retorna objeto grupo completo

    class Config:
        from_attributes = True

# --- Schemas de Tarefa e Subtarefa ---

class SubtarefaBase(BaseModel):
    titulo: str
    concluido: bool = False

class SubtarefaCreate(SubtarefaBase):
    pass

class SubtarefaUpdate(BaseModel):
    titulo: Optional[str] = None
    concluido: Optional[bool] = None

class SubtarefaResponse(SubtarefaBase):
    id: int
    class Config:
        from_attributes = True

class TarefaBase(BaseModel):
    titulo: str
    descricao: Optional[str] = None
    status: str = "Pendente"
    fixado: bool = False
    prioridade: str = "Média"       # Novo campo (Crítica, Alta, Média, Baixa)
    prazo: Optional[datetime] = None # Novo campo

class TarefaCreate(TarefaBase):
    subtarefas: Optional[List[SubtarefaCreate]] = []

class TarefaUpdate(BaseModel):
    titulo: Optional[str] = None
    descricao: Optional[str] = None
    status: Optional[str] = None
    fixado: Optional[bool] = None
    prioridade: Optional[str] = None # Novo campo
    prazo: Optional[datetime] = None # Novo campo
    # Subtarefas geralmente são atualizadas por endpoints específicos, 
    # mas podem vir aqui se for substituir tudo.

class TarefaResponse(TarefaBase):
    id: int
    data_criacao: datetime
    data_conclusao: Optional[datetime] = None
    subtarefas: List[SubtarefaResponse] = []

    class Config:
        from_attributes = True

# --- Dashboard ---
class RegistrosDashboardResponse(BaseModel):
    # Anotações
    anotacoes_fixadas: List[AnotacaoResponse]
    anotacoes_por_mes: dict[str, List[AnotacaoResponse]]
    
    # Tarefas
    tarefas_pendentes: List[TarefaResponse] # Inclui "Em andamento"
    tarefas_concluidas: List[TarefaResponse]
    
    # Grupos (para filtros no front)
    grupos_disponiveis: List[GrupoResponse]