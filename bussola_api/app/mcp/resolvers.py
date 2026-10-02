"""Resolve "nome ou id" -> registro do usuário, sem diferenciar maiúsculas/acentos."""

import unicodedata

from mcp.server.mcpserver.exceptions import ToolError

from app.models.financas import Categoria
from app.models.metas import Meta
from app.models.registros import GrupoAnotacao, Habito


def normalizar(texto: str) -> str:
    sem_acento = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    return sem_acento.casefold().strip()


def resolver(db, model, user_id: int, valor, rotulo: str, campo: str = "nome", filtros=()):
    query = db.query(model).filter(model.user_id == user_id, *filtros)
    texto = str(valor).strip()
    if texto.isdigit():
        reg = query.filter(model.id == int(texto)).first()
        if not reg:
            raise ToolError(f"{rotulo} com id {texto} não encontrado(a).")
        return reg

    alvo = normalizar(texto)
    candidatos = query.all()
    exatos = [c for c in candidatos if normalizar(getattr(c, campo) or "") == alvo]
    if len(exatos) == 1:
        return exatos[0]
    parciais = exatos or [c for c in candidatos if alvo in normalizar(getattr(c, campo) or "")]
    if len(parciais) == 1:
        return parciais[0]

    def descrever(c):
        tipo = getattr(c, "tipo", None)
        return f"{getattr(c, campo)} ({tipo})" if tipo else str(getattr(c, campo))

    opcoes = ", ".join(sorted(descrever(c) for c in (parciais or candidatos))) or "nenhum cadastrado"
    motivo = "é ambíguo" if parciais else "não foi encontrado"
    raise ToolError(f"{rotulo} '{texto}' {motivo}. Opções: {opcoes}")


def resolver_categoria(db, user_id: int, valor, tipo: str | None = None):
    filtros = (Categoria.tipo == tipo,) if tipo else ()
    return resolver(db, Categoria, user_id, valor, "Categoria", filtros=filtros)


def resolver_meta(db, user_id: int, valor):
    return resolver(db, Meta, user_id, valor, "Meta", filtros=(Meta.status != "arquivada",))


def resolver_grupo(db, user_id: int, valor):
    return resolver(db, GrupoAnotacao, user_id, valor, "Grupo")


def resolver_habito(db, user_id: int, valor):
    return resolver(db, Habito, user_id, valor, "Hábito", campo="titulo")
