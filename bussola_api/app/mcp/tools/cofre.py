"""
=======================================================================================
ARQUIVO: tools/cofre.py (MCP - Cofre de senhas)
=======================================================================================

OBJETIVO:
    SÓ metadados dos segredos. Por design, nenhuma tool revela, cria ou edita valores:
    a senha passaria pela conversa e ficaria no histórico do chat.
=======================================================================================
"""

from typing import Any

from app.mcp.context import usuario_e_db
from app.mcp.tools import registrar
from app.services.cofre import cofre_service


def listar_segredos() -> dict[str, Any]:
    """Segredos do cofre: título, serviço, notas e data de expiração. NUNCA o valor da senha —
    para vê-la o usuário precisa abrir o Bússola."""
    with usuario_e_db() as (db, user):
        return {"itens": [{
            "id": s.id,
            "titulo": s.titulo,
            "servico": s.servico,
            "notas": s.notas,
            "data_expiracao": s.data_expiracao.isoformat() if s.data_expiracao else None,
        } for s in cofre_service.get_all(db, user.id)]}


def register(mcp):
    registrar(mcp, leitura=(listar_segredos,))
