from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class LinkBase(BaseModel):
    url: str

class LinkCreate(LinkBase):
    pass

class LinkResponse(LinkBase):
    id: int
    class Config:
        from_attributes = True

class AnotacaoBase(BaseModel):
    titulo: str
    conteudo: Optional[str] = None
    tipo: str = 'Geral'
    is_tarefa: bool = False
    status_tarefa: str = 'Pendente'
    fixado: bool = False

class AnotacaoCreate(AnotacaoBase):
    links: Optional[List[str]] = [] # Lista de URLs strings

class AnotacaoUpdate(BaseModel):
    titulo: Optional[str] = None
    conteudo: Optional[str] = None
    tipo: Optional[str] = None
    is_tarefa: Optional[bool] = None
    links: Optional[List[str]] = None

class AnotacaoResponse(AnotacaoBase):
    id: int
    data_criacao: datetime
    links: List[LinkResponse] = []

    class Config:
        from_attributes = True

class RegistrosDashboardResponse(BaseModel):
    anotacoes_fixadas: List[AnotacaoResponse]
    anotacoes_por_mes: dict[str, List[AnotacaoResponse]] # {"Janeiro/2025": [...]}