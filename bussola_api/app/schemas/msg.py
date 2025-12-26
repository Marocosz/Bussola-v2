"""
=======================================================================================
ARQUIVO: msg.py (Schema de Mensagem Genérica)
=======================================================================================

OBJETIVO:
    Padronizar respostas simples de sucesso ou status da API.
=======================================================================================
"""

from pydantic import BaseModel

class Msg(BaseModel):
    msg: str