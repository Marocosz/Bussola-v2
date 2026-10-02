"""
=======================================================================================
ARQUIVO: tools/estudos.py (MCP - Estudos)
=======================================================================================

OBJETIVO:
    Biblioteca de materiais de estudo em blocos tipados. O Claude consulta o contrato
    (catalogo_de_blocos), grava materiais pesquisados, edita blocos e lê o histórico de
    quizzes; o site exibe. Regras e validação ficam no service/schemas.
=======================================================================================
"""

from typing import Any, Literal, Optional

from mcp.server.mcpserver.exceptions import ToolError

from app.core.config import settings
from app.mcp.context import ESCOPO_ESCRITA, apenas_informados, exigir, usuario_e_db
from app.mcp.resolvers import resolver
from app.mcp.tools import registrar
from app.models.estudos import EstudoMaterial, EstudoTema
from app.schemas.estudos import MaterialResponse, MaterialResumo, TemaResponse
from app.schemas.estudos_blocos import catalogo
from app.services.estudos import estudos_service

TipoMaterial = Literal["aula", "resumo", "comparativo", "exercicios"]
Nivel = Literal["iniciante", "intermediario", "avancado"]


def _url(material_id: int) -> str:
    return f"{settings.FRONTEND_URL.rstrip('/')}/estudos/{material_id}"


def _resolver_material(db, user_id: int, material) -> EstudoMaterial:
    return resolver(db, EstudoMaterial, user_id, material, "Material", campo="titulo")


def _resolver_tema(db, user_id: int, tema) -> EstudoTema:
    return resolver(db, EstudoTema, user_id, tema, "Tema")


def _tema_id(db, user_id: int, tema: str) -> Optional[int]:
    """'' = sem tema; id = tema existente; nome = existente (sem acento/caixa) ou criado na hora."""
    texto = tema.strip()
    if not texto:
        return None
    if texto.isdigit():
        return _resolver_tema(db, user_id, texto).id
    return estudos_service.obter_ou_criar_tema(db, user_id, texto).id


def _resumo(material) -> dict[str, Any]:
    dados = MaterialResumo.model_validate(material).model_dump(mode="json")
    dados["url"] = _url(material.id)
    return dados


def _gravado(material) -> dict[str, Any]:
    return {
        **_resumo(material),
        "blocos": [{"id": b["id"], "tipo": b["tipo"]} for b in material.blocos],
        "total_fontes": len(material.fontes or []),
    }


# --- leitura ---

def catalogo_de_blocos() -> dict[str, Any]:
    """Contrato do formato dos materiais de Estudos: cada tipo de bloco com campos, obrigatórios,
    limites e um exemplo válido; mínimos por tipo de material; formatação inline e citações [n];
    versao_formato. Consulte antes de montar blocos para salvar_material/editar_blocos."""
    with usuario_e_db():
        return catalogo()


def listar_temas_estudo() -> dict[str, Any]:
    """Temas de estudo com a contagem de materiais de cada um."""
    with usuario_e_db() as (db, user):
        return {"itens": [TemaResponse(**t).model_dump() for t in estudos_service.listar_temas(db, user.id)]}


def listar_materiais(
    tema: Optional[str] = None,
    tipo: Optional[TipoMaterial] = None,
    tag: Optional[str] = None,
    estudado: Optional[bool] = None,
    busca: Optional[str] = None,
    limite: int = 50,
) -> dict[str, Any]:
    """Lista enxuta de materiais (id, titulo, tipo, tema, tags, nivel, estudado, atualizado_em, url),
    mais recentes primeiro. Filtros: tema (nome ou id), tipo, tag, estudado e busca (no título e
    nas tags, sem diferenciar acentos). Use ler_material para os blocos."""
    with usuario_e_db() as (db, user):
        tema_id = _resolver_tema(db, user.id, tema).id if tema else None
        itens = estudos_service.listar_materiais(db, user.id, tema_id=tema_id, tipo=tipo, tag=tag,
                                                 estudado=estudado, busca=busca, limite=max(1, min(limite, 200)))
        return {"itens": [_resumo(m) for m in itens]}


def ler_material(id: int) -> dict[str, Any]:
    """Material completo: cabeçalho, blocos (com ids — use-os em editar_blocos), fontes
    (a citação [n] é a posição n), estudado e a url no site."""
    with usuario_e_db() as (db, user):
        material = exigir(estudos_service.get_material(db, id, user.id), f"Material {id} não encontrado.")
        dados = MaterialResponse.model_validate(material).model_dump(mode="json")
        dados["url"] = _url(material.id)
        return dados


def listar_respostas_quiz(material: Optional[str] = None, so_erros: bool = False, limite: int = 50) -> dict[str, Any]:
    """Histórico de respostas de quiz/questão aberta (mais recentes primeiro): material, bloco,
    pergunta, resposta, acertou, data. material = título ou id; so_erros = só as erradas.
    bloco_existe=false indica que o bloco foi removido/alterado depois da resposta."""
    with usuario_e_db() as (db, user):
        material_id = _resolver_material(db, user.id, material).id if material else None
        return {"itens": estudos_service.listar_respostas(db, user.id, material_id=material_id,
                                                          so_erros=so_erros, limite=max(1, min(limite, 500)))}


# --- escrita ---

def salvar_tema(
    id: Optional[int] = None,
    nome: Optional[str] = None,
    cor: Optional[str] = None,
    icone: Optional[str] = None,
    descricao: Optional[str] = None,
) -> dict[str, Any]:
    """Cria (sem id; exige nome) ou edita (com id; só o enviado muda) um tema de estudo.
    cor = hex #RRGGBB; icone = classe Font Awesome (ex.: fa-database)."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        tema = exigir(estudos_service.salvar_tema(db, user.id, tema_id=id, nome=nome, cor=cor, icone=icone,
                                                  descricao=descricao), f"Tema {id} não encontrado.")
        total = next((t["total_materiais"] for t in estudos_service.listar_temas(db, user.id) if t["id"] == tema.id), 0)
        return TemaResponse(id=tema.id, nome=tema.nome, cor=tema.cor, icone=tema.icone,
                            descricao=tema.descricao, total_materiais=total).model_dump()


def salvar_material(
    id: Optional[int] = None,
    tema: Optional[str] = None,
    tipo: Optional[TipoMaterial] = None,
    titulo: Optional[str] = None,
    subtitulo: Optional[str] = None,
    nivel: Optional[Nivel] = None,
    tags: Optional[list[str]] = None,
    blocos: Optional[list[dict[str, Any]]] = None,
    fontes: Optional[list[dict[str, Any]]] = None,
) -> dict[str, Any]:
    """Cria (sem id; exige tipo, titulo e blocos) ou edita (com id; só o enviado muda) um material.
    blocos enviado SUBSTITUI a lista inteira — mantenha o 'id' dos blocos que continuam (blocos sem
    id ganham um novo). Para mudanças pontuais prefira editar_blocos. fontes = [{titulo, url}],
    citadas no texto como [1], [2]... tema: nome ou id (nome novo cria o tema; "" deixa sem tema).
    Formato dos blocos: catalogo_de_blocos. Devolve id, url no site e os ids dos blocos."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        campos = apenas_informados(tipo=tipo, titulo=titulo, subtitulo=subtitulo, nivel=nivel, tags=tags,
                                   blocos=blocos, fontes=fontes)
        if tema is not None:
            campos["tema_id"] = _tema_id(db, user.id, tema)
        if id is None:
            if not (tipo and titulo and blocos):
                raise ToolError("Para criar, informe tipo, titulo e blocos.")
            material = estudos_service.criar_material(db, user.id, **campos)
        else:
            material = exigir(estudos_service.atualizar_material(db, id, user.id, **campos),
                              f"Material {id} não encontrado.")
        return _gravado(material)


def editar_blocos(material: str, operacoes: list[dict[str, Any]]) -> dict[str, Any]:
    """Edita blocos de um material (título ou id) com operações aplicadas em ordem:
    {"op": "inserir", "depois_de": "<id>" ou "antes_de": "<id>" (nenhum = no fim), "blocos": [...]};
    {"op": "substituir", "id": "<id>", "bloco": {...}} (o id é mantido);
    {"op": "remover", "id": "<id>"}.
    O material resultante é validado inteiro; se algo falhar, nada é gravado. Ids de blocos
    removidos nunca são reaproveitados."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        alvo = _resolver_material(db, user.id, material)
        atualizado = exigir(estudos_service.editar_blocos(db, alvo.id, user.id, operacoes),
                            f"Material {material} não encontrado.")
        return _gravado(atualizado)


def marcar_estudado(material: str, estudado: bool = True) -> dict[str, Any]:
    """Marca (ou desmarca, com estudado=false) um material (título ou id) como estudado.
    Pode repetir sem efeito colateral: a data da primeira marcação é mantida."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        alvo = _resolver_material(db, user.id, material)
        atualizado = estudos_service.marcar_estudado(db, alvo.id, user.id, estudado)
        return {
            "id": atualizado.id,
            "estudado": atualizado.estudado,
            "estudado_em": atualizado.estudado_em.isoformat() if atualizado.estudado_em else None,
        }


# --- destrutivas ---

def excluir_material(id: int) -> dict[str, Any]:
    """Exclui um material e todas as respostas de quiz dele."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        exigir(estudos_service.excluir_material(db, id, user.id), f"Material {id} não encontrado.")
        return {"ok": True}


def excluir_tema(tema: str) -> dict[str, Any]:
    """Exclui um tema (nome ou id) — só se estiver vazio; senão o erro informa quantos materiais ele tem."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        alvo = _resolver_tema(db, user.id, tema)
        estudos_service.excluir_tema(db, alvo.id, user.id)
        return {"ok": True}


def register(mcp):
    registrar(
        mcp,
        leitura=(catalogo_de_blocos, listar_temas_estudo, listar_materiais, ler_material, listar_respostas_quiz),
        escrita=(salvar_tema, salvar_material, editar_blocos, marcar_estudado),
        destrutivas=(excluir_material, excluir_tema),
    )
