"""
=======================================================================================
ARQUIVO: cofre.py (Schemas - Cofre de Senhas)
=======================================================================================

OBJETIVO:
    Definir DTOs para gestão segura de credenciais.
    Separa estritamente a leitura de metadados da leitura do valor sensível (senha).

PARTE DO SISTEMA:
    Backend / API Layer / Security.
=======================================================================================
"""

from pydantic import BaseModel
from typing import Optional
from datetime import date

class SegredoBase(BaseModel):
    titulo: str
    servico: Optional[str] = None
    notas: Optional[str] = None
    data_expiracao: Optional[date] = None

class SegredoCreate(SegredoBase):
    """
    Recebe a senha em texto plano via HTTPS.
    O backend deve criptografar antes de salvar.
    """
    valor: str 

class SegredoUpdate(BaseModel):
    """
    Atualização de metadados.
    Por segurança, não permite alterar o valor da senha nesta rota simples.
    """
    titulo: Optional[str] = None
    servico: Optional[str] = None
    notas: Optional[str] = None
    data_expiracao: Optional[date] = None
    valor: Optional[str]

class SegredoResponse(SegredoBase):
    """
    Lista segura de segredos.
    REGRA DE SEGURANÇA: NUNCA retorna o campo 'valor' (senha) nesta resposta.
    """
    id: int
    data_criacao: date
    class Config:
        from_attributes = True

class SegredoValueResponse(BaseModel):
    """
    Schema exclusivo para a rota de 'Copiar Senha / Revelar'.
    Retorna a senha descriptografada.
    """
    valor: str