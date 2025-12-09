from pydantic import BaseModel
from typing import Optional
from datetime import date

class SegredoBase(BaseModel):
    titulo: str
    servico: Optional[str] = None
    notas: Optional[str] = None
    data_expiracao: Optional[date] = None

class SegredoCreate(SegredoBase):
    valor: str # Recebe a senha em texto plano (HTTPS protege isso no trânsito)

class SegredoUpdate(BaseModel):
    titulo: Optional[str] = None
    servico: Optional[str] = None
    notas: Optional[str] = None
    data_expiracao: Optional[date] = None
    # Não permitimos alterar o valor na edição simples, apenas metadados por segurança/UX

class SegredoResponse(SegredoBase):
    id: int
    data_criacao: date
    # IMPORTANTE: Não retornamos o 'valor' aqui por segurança. 
    # O valor só é retornado no endpoint específico de "copiar".

    class Config:
        from_attributes = True

class SegredoValueResponse(BaseModel):
    valor: str