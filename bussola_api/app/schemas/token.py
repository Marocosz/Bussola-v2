"""
=======================================================================================
ARQUIVO: token.py (Schemas - Autenticação JWT)
=======================================================================================

OBJETIVO:
    Definir a estrutura do Token de Acesso retornado no login e do Payload decodificado.
=======================================================================================
"""

from typing import Optional
from pydantic import BaseModel

class Token(BaseModel):
    """Resposta padrão de Login OAuth2."""
    access_token: str
    token_type: str
    refresh_token: str 

class TokenPayload(BaseModel):
    """Dados contidos dentro do token (Claims)."""
    sub: Optional[str] = None # Subject (ID do usuário)
    type: Optional[str] = None # 'access' ou 'refresh'