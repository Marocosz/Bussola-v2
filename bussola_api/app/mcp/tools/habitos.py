"""
=======================================================================================
ARQUIVO: tools/habitos.py (MCP - Hábitos)
=======================================================================================

OBJETIVO:
    Hábitos diários: listar com o check-in de hoje e a sequência (streak), marcar
    check-in (idempotente), histórico e CRUD.
=======================================================================================
"""

from datetime import date
from typing import Any, Literal, Optional

from mcp.server.mcpserver.exceptions import ToolError

from app.mcp.context import ESCOPO_ESCRITA, apenas_informados, exigir, usuario_e_db
from app.mcp.resolvers import resolver_habito
from app.mcp.tools import registrar
from app.schemas.registros import HabitoCreate, HabitoRegistroResponse, HabitoResponse, HabitoUpdate
from app.services.registros import registros_service

DiaSemana = Literal["seg", "ter", "qua", "qui", "sex", "sab", "dom"]


def _habito(h) -> dict[str, Any]:
    return HabitoResponse.model_validate(h).model_dump(mode="json")


def listar_habitos() -> dict[str, Any]:
    """Hábitos ativos e pausados com o check-in de hoje (registro_hoje) e a sequência atual (streak)."""
    with usuario_e_db() as (db, user):
        return {"itens": [_habito(h) for h in registros_service.get_habitos(db, user.id)]}


def historico_habito(habito: str, dias: int = 30) -> dict[str, Any]:
    """Check-ins de um hábito (nome ou id) nos últimos `dias` (1-365)."""
    with usuario_e_db() as (db, user):
        alvo = resolver_habito(db, user.id, habito)
        registros = registros_service.get_historico_habito(db, alvo.id, user.id, max(1, min(dias, 365)))
        return {"habito": alvo.titulo,
                "itens": [HabitoRegistroResponse.model_validate(r).model_dump(mode="json") for r in registros]}


def salvar_habito(
    id: Optional[int] = None,
    titulo: Optional[str] = None,
    horario: Optional[str] = None,
    frequencia: Optional[list[DiaSemana]] = None,
    duracao_min: Optional[int] = None,
    descricao: Optional[str] = None,
    cor: Optional[str] = None,
    status: Optional[Literal["ativo", "pausado", "arquivado"]] = None,
) -> dict[str, Any]:
    """Cria (sem id; exige titulo e horario 'HH:MM') ou edita (com id) um hábito.
    frequencia = dias da semana (padrão: todos)."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        campos = apenas_informados(titulo=titulo, horario=horario, frequencia=frequencia,
                                   duracao_min=duracao_min, descricao=descricao, cor=cor)
        if id is None:
            if not (titulo and horario):
                raise ToolError("Para criar, informe titulo e horario.")
            habito = registros_service.create_habito(db, HabitoCreate(**campos), user.id)
        else:
            habito = exigir(
                registros_service.update_habito(db, id, HabitoUpdate(**campos, **apenas_informados(status=status)), user.id),
                f"Hábito {id} não encontrado.",
            )
        return _habito(habito)


def checkin_habito(habito: str, data: Optional[date] = None, feito: bool = True) -> dict[str, Any]:
    """Marca (feito=True) ou desmarca o check-in de um hábito (nome ou id) num dia (padrão hoje).
    Pode repetir sem efeito colateral."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        alvo = resolver_habito(db, user.id, habito)
        dia = data or date.today()
        registros_service.definir_checkin(db, alvo.id, user.id, dia, feito)
        return {"habito": alvo.titulo, "data": dia.isoformat(), "feito": feito}


def excluir_habito(habito: str) -> dict[str, Any]:
    """Exclui um hábito (nome ou id) e seu histórico. Para só parar, use salvar_habito com status."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        registros_service.delete_habito(db, resolver_habito(db, user.id, habito).id, user.id)
        return {"ok": True}


def register(mcp):
    registrar(mcp, leitura=(listar_habitos, historico_habito), escrita=(salvar_habito, checkin_habito),
              destrutivas=(excluir_habito,))
