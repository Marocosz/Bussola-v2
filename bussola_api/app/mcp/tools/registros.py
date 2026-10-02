"""
=======================================================================================
ARQUIVO: tools/registros.py (MCP - Registros: grupos, anotações e tarefas)
=======================================================================================

OBJETIVO:
    Notas (conteúdo recebido em Markdown e salvo no HTML do editor), grupos de
    notas e tarefas com subtarefas.
=======================================================================================
"""

import re
from datetime import datetime
from typing import Any, Literal, Optional

import markdown
from mcp.server.mcpserver.exceptions import ToolError

from app.mcp.context import ESCOPO_ESCRITA, apenas_informados, exigir, usuario_e_db
from app.mcp.resolvers import resolver_grupo
from app.mcp.tools import registrar
from app.schemas.registros import (
    AnotacaoCreate, AnotacaoResponse, AnotacaoUpdate, GrupoCreate, GrupoResponse, SubtarefaCreate,
    TarefaCreate, TarefaResponse, TarefaUpdate,
)
from app.services.registros import registros_service

StatusTarefa = Literal["Pendente", "Em andamento", "Bloqueado", "Concluído", "Cancelado"]
Prioridade = Literal["Crítica", "Alta", "Média", "Baixa"]


def _html(texto_markdown: str) -> str:
    return markdown.markdown(texto_markdown, extensions=["extra", "sane_lists"])


def _trecho(html: Optional[str], tamanho: int = 200) -> str:
    texto = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html or "")).strip()
    return texto[:tamanho]


def _tarefa(t) -> dict[str, Any]:
    return TarefaResponse.model_validate(t).model_dump(mode="json")


# --- Grupos ---

def listar_grupos() -> dict[str, Any]:
    """Grupos de anotações."""
    with usuario_e_db() as (db, user):
        return {"itens": [GrupoResponse.model_validate(g).model_dump() for g in registros_service.get_grupos(db, user.id)]}


def salvar_grupo(id: Optional[int] = None, nome: Optional[str] = None, cor: Optional[str] = None) -> dict[str, Any]:
    """Cria (sem id; exige nome) ou edita (com id) um grupo de anotações. cor = hex."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        if id is None:
            if not nome:
                raise ToolError("Para criar, informe o nome.")
            grupo = registros_service.create_grupo(db, GrupoCreate(**apenas_informados(nome=nome, cor=cor)), user.id)
        else:
            atual = resolver_grupo(db, user.id, id)
            grupo = registros_service.update_grupo(
                db, id, GrupoCreate(nome=nome or atual.nome, cor=cor or atual.cor), user.id
            )
        return GrupoResponse.model_validate(grupo).model_dump()


def excluir_grupo(grupo: str) -> dict[str, Any]:
    """Exclui um grupo (nome ou id). As anotações ficam sem grupo, não são apagadas."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        registros_service.delete_grupo(db, resolver_grupo(db, user.id, grupo).id, user.id)
        return {"ok": True}


# --- Anotações ---

def listar_anotacoes(grupo: Optional[str] = None, busca: Optional[str] = None, limite: int = 50) -> dict[str, Any]:
    """Anotações (fixadas primeiro, depois as mais novas) com um trecho do texto.
    Filtros: grupo (nome ou id) e busca (no título ou conteúdo). Use ler_anotacao para o texto inteiro."""
    with usuario_e_db() as (db, user):
        grupo_id = resolver_grupo(db, user.id, grupo).id if grupo else None
        notas = registros_service.listar_anotacoes(db, user.id, grupo_id, busca, min(limite, 200))
        return {"itens": [{
            "id": n.id, "titulo": n.titulo, "fixado": n.fixado, "grupo": n.grupo.nome if n.grupo else None,
            "data_criacao": n.data_criacao.date().isoformat(), "trecho": _trecho(n.conteudo),
        } for n in notas]}


def ler_anotacao(id: int) -> dict[str, Any]:
    """Anotação completa: título, conteúdo (HTML do editor), grupo, links."""
    with usuario_e_db() as (db, user):
        nota = exigir(registros_service.get_anotacao(db, id, user.id), f"Anotação {id} não encontrada.")
        return AnotacaoResponse.model_validate(nota).model_dump(mode="json")


def salvar_anotacao(
    id: Optional[int] = None,
    titulo: Optional[str] = None,
    conteudo_markdown: Optional[str] = None,
    grupo: Optional[str] = None,
    fixado: Optional[bool] = None,
    links: Optional[list[str]] = None,
) -> dict[str, Any]:
    """Cria (sem id) ou edita (com id; o que não for enviado é mantido) uma anotação.
    conteudo_markdown é escrito em Markdown e convertido para o editor. grupo: nome ou id."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        grupo_id = resolver_grupo(db, user.id, grupo).id if grupo else None
        conteudo = _html(conteudo_markdown) if conteudo_markdown is not None else None
        if id is None:
            nota = registros_service.create_anotacao(db, AnotacaoCreate(**apenas_informados(
                titulo=titulo, conteudo=conteudo, grupo_id=grupo_id, fixado=fixado, links=links,
            )), user.id)
        else:
            atual = exigir(registros_service.get_anotacao(db, id, user.id), f"Anotação {id} não encontrada.")
            # update_anotacao sobrescreve TODOS os campos: mescla com o que já existe.
            nota = registros_service.update_anotacao(db, id, AnotacaoUpdate(
                titulo=titulo if titulo is not None else atual.titulo,
                conteudo=conteudo if conteudo is not None else atual.conteudo,
                fixado=fixado if fixado is not None else atual.fixado,
                grupo_id=grupo_id if grupo else atual.grupo_id,
                links=links if links is not None else [link.url for link in atual.links],
            ), user.id)
        return AnotacaoResponse.model_validate(nota).model_dump(mode="json")


def excluir_anotacao(id: int) -> dict[str, Any]:
    """Exclui uma anotação."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        exigir(registros_service.delete_anotacao(db, id, user.id), f"Anotação {id} não encontrada.")
        return {"ok": True}


# --- Tarefas ---

def listar_tarefas(status: Optional[StatusTarefa] = None, limite: int = 50) -> dict[str, Any]:
    """Tarefas com subtarefas. status: Pendente, Em andamento, Bloqueado, Concluído, Cancelado."""
    with usuario_e_db() as (db, user):
        return {"itens": [_tarefa(t) for t in registros_service.listar_tarefas(db, user.id, status, min(limite, 200))]}


def salvar_tarefa(
    id: Optional[int] = None,
    titulo: Optional[str] = None,
    descricao: Optional[str] = None,
    status: Optional[StatusTarefa] = None,
    prioridade: Optional[Prioridade] = None,
    prazo: Optional[datetime] = None,
    fixado: Optional[bool] = None,
    subtarefas: Optional[list[str]] = None,
) -> dict[str, Any]:
    """Cria (sem id; exige titulo) ou edita (com id; só o enviado) uma tarefa.
    subtarefas = títulos a ADICIONAR (na criação e na edição; as existentes são mantidas)."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        campos = apenas_informados(titulo=titulo, descricao=descricao, status=status,
                                   prioridade=prioridade, prazo=prazo, fixado=fixado)
        if id is None:
            if not titulo:
                raise ToolError("Para criar, informe o titulo.")
            tarefa = registros_service.create_tarefa(db, TarefaCreate(
                **campos, subtarefas=[SubtarefaCreate(titulo=s) for s in subtarefas or []]
            ), user.id)
        else:
            tarefa = exigir(registros_service.update_tarefa(db, id, TarefaUpdate(**campos), user.id),
                            f"Tarefa {id} não encontrada.")
            for sub in subtarefas or []:
                registros_service.add_subtarefa(db, id, sub, user.id)
        db.refresh(tarefa)
        return _tarefa(tarefa)


def marcar_subtarefa(id: int, feita: bool = True) -> dict[str, Any]:
    """Marca uma subtarefa (e as filhas dela) como feita ou não. Pode repetir sem efeito colateral."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        sub = exigir(registros_service.definir_subtarefa(db, id, user.id, feita), f"Subtarefa {id} não encontrada.")
        return {"id": sub.id, "titulo": sub.titulo, "concluido": sub.concluido}


def excluir_tarefa(id: int) -> dict[str, Any]:
    """Exclui uma tarefa e suas subtarefas."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        exigir(registros_service.delete_tarefa(db, id, user.id), f"Tarefa {id} não encontrada.")
        return {"ok": True}


def register(mcp):
    registrar(
        mcp,
        leitura=(listar_grupos, listar_anotacoes, ler_anotacao, listar_tarefas),
        escrita=(salvar_grupo, salvar_anotacao, salvar_tarefa, marcar_subtarefa),
        destrutivas=(excluir_grupo, excluir_anotacao, excluir_tarefa),
    )
