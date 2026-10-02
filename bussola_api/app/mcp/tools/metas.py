"""
=======================================================================================
ARQUIVO: tools/metas.py (MCP - Metas / cofrinhos)
=======================================================================================

OBJETIVO:
    Metas de economia: criar/editar, aportar e retirar (transferências neutras do
    caixa), ver progresso e projeção, arquivar.
=======================================================================================
"""

from datetime import date, datetime, time
from typing import Any, Literal, Optional

from mcp.server.mcpserver.exceptions import ToolError

from app.mcp.context import ESCOPO_ESCRITA, apenas_informados, exigir, usuario_e_db
from app.mcp.resolvers import resolver, resolver_meta
from app.mcp.tools import registrar
from app.models.metas import Meta
from app.schemas.metas import (
    MetaCreate, MetaResponse, MetaUpdate, MovimentacaoCreate, MovimentacaoResponse,
    MovimentacaoUpdate, ResumoPatrimonio,
)
from app.services.financas import financas_service
from app.services.metas import metas_service


def _meta(db, meta) -> dict[str, Any]:
    return MetaResponse(**metas_service.enriquecer_meta(db, meta)).model_dump(mode="json")


def _mov(mov) -> dict[str, Any]:
    return MovimentacaoResponse.model_validate(mov).model_dump(mode="json")


def listar_metas(incluir_arquivadas: bool = False) -> dict[str, Any]:
    """Metas com saldo, progresso, aporte sugerido e data projetada, mais o resumo do patrimônio
    (caixa total, guardado nas metas, disponível)."""
    with usuario_e_db() as (db, user):
        metas = metas_service.listar_metas(db, user.id, include_arquivadas=incluir_arquivadas)
        resumo = metas_service.calcular_resumo(db, user.id, financas_service.calcular_caixa(db, user.id))
        return {"metas": [_meta(db, m) for m in metas],
                "resumo": ResumoPatrimonio(**resumo).model_dump(mode="json")}


def detalhar_meta(meta: str) -> dict[str, Any]:
    """Uma meta (nome ou id; inclui arquivadas) com todas as movimentações."""
    with usuario_e_db() as (db, user):
        alvo = resolver(db, Meta, user.id, meta, "Meta")
        return {"meta": _meta(db, alvo),
                "movimentacoes": [_mov(m) for m in metas_service.listar_movimentacoes(db, alvo.id, user.id)]}


def salvar_meta(
    id: Optional[int] = None,
    nome: Optional[str] = None,
    valor_alvo: Optional[float] = None,
    data_alvo: Optional[date] = None,
    trancada: Optional[bool] = None,
    aporte_mensal_valor: Optional[float] = None,
    aporte_mensal_dia: Optional[int] = None,
    icone: Optional[str] = None,
    cor: Optional[str] = None,
    status: Optional[Literal["ativa", "concluida", "arquivada"]] = None,
) -> dict[str, Any]:
    """Cria (sem id; exige nome e valor_alvo) ou edita (com id) uma meta. trancada = bloqueia retiradas
    até a data_alvo. aporte_mensal_valor/dia (1-28) agenda um aporte automático todo mês."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        campos = apenas_informados(nome=nome, valor_alvo=valor_alvo, data_alvo=data_alvo, trancada=trancada,
                                   aporte_mensal_valor=aporte_mensal_valor, aporte_mensal_dia=aporte_mensal_dia,
                                   icone=icone, cor=cor)
        if id is None:
            if not (nome and valor_alvo):
                raise ToolError("Para criar, informe nome e valor_alvo.")
            alvo = metas_service.criar_meta(db, MetaCreate(**campos), user.id)
        else:
            alvo = exigir(metas_service.atualizar_meta(db, id, MetaUpdate(**campos, **apenas_informados(status=status)),
                                                       user.id), f"Meta {id} não encontrada.")
        return _meta(db, alvo)


def arquivar_meta(meta: str) -> dict[str, Any]:
    """Arquiva uma meta (nome ou id). O histórico é preservado; ela some de listar_metas."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        alvo = resolver_meta(db, user.id, meta)
        metas_service.deletar_meta(db, alvo.id, user.id)
        return {"ok": True, "arquivada": True}


def movimentar_meta(
    meta: str,
    tipo: Optional[Literal["aporte", "retirada"]] = None,
    valor: Optional[float] = None,
    data: Optional[date] = None,
    observacao: Optional[str] = None,
    id: Optional[int] = None,
) -> dict[str, Any]:
    """Aporte ou retirada numa meta (nome ou id). Sem id cria (exige tipo e valor); com id edita a
    movimentação. Respeita meta trancada, saldo e limite do cofre."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        alvo = resolver_meta(db, user.id, meta)
        campos = apenas_informados(tipo=tipo, valor=valor, observacao=observacao,
                                   data=datetime.combine(data, time()) if data else None)
        if id is None:
            if not (tipo and valor):
                raise ToolError("Para criar, informe tipo e valor.")
            mov = metas_service.criar_movimentacao(db, alvo.id, MovimentacaoCreate(**campos), user.id)
        else:
            mov = exigir(metas_service.atualizar_movimentacao(db, alvo.id, id, MovimentacaoUpdate(**campos), user.id),
                         f"Movimentação {id} não encontrada.")
        return _mov(mov)


def excluir_movimentacao(meta: str, movimentacao_id: int) -> dict[str, Any]:
    """Exclui uma movimentação de uma meta (aporte automático já efetivado não pode ser excluído)."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        alvo = resolver_meta(db, user.id, meta)
        exigir(metas_service.deletar_movimentacao(db, alvo.id, movimentacao_id, user.id),
               f"Movimentação {movimentacao_id} não encontrada.")
        return {"ok": True}


def register(mcp):
    registrar(
        mcp,
        leitura=(listar_metas, detalhar_meta),
        escrita=(salvar_meta, movimentar_meta),
        destrutivas=(arquivar_meta, excluir_movimentacao),
    )
