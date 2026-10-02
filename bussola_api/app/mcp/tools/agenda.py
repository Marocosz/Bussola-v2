"""
=======================================================================================
ARQUIVO: tools/agenda.py (MCP - Agenda)
=======================================================================================

OBJETIVO:
    Consultar compromissos por período, criar/editar (inclusive status) e excluir.
=======================================================================================
"""

from datetime import date, datetime, time, timedelta
from typing import Any, Literal, Optional

from mcp.server.mcpserver.exceptions import ToolError

from app.core.timezone import now_local
from app.mcp.context import ESCOPO_ESCRITA, apenas_informados, exigir, usuario_e_db
from app.mcp.tools import registrar
from app.schemas.agenda import CompromissoCreate, CompromissoUpdate
from app.services.agenda import agenda_service

Status = Literal["Pendente", "Realizado", "Cancelado"]


def _compromisso(c) -> dict[str, Any]:
    return {"id": c.id, "titulo": c.titulo, "data_hora": c.data_hora.strftime("%Y-%m-%dT%H:%M"),
            "local": c.local, "descricao": c.descricao, "status": c.status, "lembrete": c.lembrete}


def listar_compromissos(de: Optional[date] = None, ate: Optional[date] = None) -> dict[str, Any]:
    """Compromissos entre as datas de e ate (inclusivas). Padrão: hoje até 7 dias à frente.
    Status possíveis: Pendente, Realizado, Cancelado, Perdido."""
    with usuario_e_db() as (db, user):
        inicio = de or now_local().date()
        fim = ate or inicio + timedelta(days=7)
        compromissos = agenda_service.listar_periodo(
            db, user.id, datetime.combine(inicio, time()), datetime.combine(fim + timedelta(days=1), time())
        )
        return {"itens": [_compromisso(c) for c in compromissos]}


def salvar_compromisso(
    id: Optional[int] = None,
    titulo: Optional[str] = None,
    data_hora: Optional[datetime] = None,
    descricao: Optional[str] = None,
    local: Optional[str] = None,
    lembrete: Optional[bool] = None,
    status: Optional[Status] = None,
) -> dict[str, Any]:
    """Cria (sem id; exige titulo e data_hora 'AAAA-MM-DDTHH:MM') ou edita (com id; só o enviado)
    um compromisso. status: Pendente, Realizado ou Cancelado."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        campos = apenas_informados(titulo=titulo, data_hora=data_hora, descricao=descricao,
                                   local=local, lembrete=lembrete)
        if id is None:
            if not (titulo and data_hora):
                raise ToolError("Para criar, informe titulo e data_hora.")
            compromisso = agenda_service.create(db, CompromissoCreate(**campos), user.id)
            if status and status != "Pendente":
                compromisso = agenda_service.set_status(db, compromisso.id, status, user.id)
        else:
            compromisso = exigir(
                agenda_service.update(db, id, CompromissoUpdate(**campos, **apenas_informados(status=status)), user.id),
                f"Compromisso {id} não encontrado.",
            )
        return _compromisso(compromisso)


def excluir_compromisso(id: int) -> dict[str, Any]:
    """Exclui um compromisso."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        exigir(agenda_service.delete(db, id, user.id), f"Compromisso {id} não encontrado.")
        return {"ok": True}


def register(mcp):
    registrar(mcp, leitura=(listar_compromissos,), escrita=(salvar_compromisso,),
              destrutivas=(excluir_compromisso,))
