"""
=======================================================================================
ARQUIVO: tools/ritmo.py (MCP - Ritmo / saúde)
=======================================================================================

OBJETIVO:
    Biometria (com metas calculadas de calorias/macros), planos de treino, dietas e
    busca na tabela TACO de alimentos.
=======================================================================================
"""

from typing import Any, Literal, Optional

from fastapi.encoders import jsonable_encoder

from app.mcp.context import ESCOPO_ESCRITA, exigir, usuario_e_db
from app.mcp.tools import registrar
from app.schemas.ritmo import (
    BioCreate, BioResponse, DiaTreinoCreate, DietaConfigCreate, DietaConfigResponse, PlanoTreinoCreate,
    PlanoTreinoResponse, RefeicaoCreate,
)
from app.services.ritmo import RitmoService


def _plano(p) -> dict[str, Any]:
    return PlanoTreinoResponse.model_validate(p).model_dump(mode="json")


def _dieta(d) -> dict[str, Any]:
    return DietaConfigResponse.model_validate(d).model_dump(mode="json")


def ultimo_bio() -> dict[str, Any]:
    """Última biometria (peso, altura, TMB, gasto calórico, metas de macros e água) e o volume
    semanal de séries por grupo muscular do treino ativo."""
    with usuario_e_db() as (db, user):
        bio = RitmoService.get_latest_bio(db, user.id)
        if not bio:
            return {"bio": None, "volume_semanal": {}}
        return {"bio": BioResponse.model_validate(bio).model_dump(mode="json"),
                "volume_semanal": jsonable_encoder(RitmoService.get_volume_semanal(db, user.id))}


def registrar_bio(
    peso: float,
    altura: float,
    idade: int,
    genero: Literal["M", "F"],
    nivel_atividade: Literal["sedentario", "leve", "moderado", "alto", "atleta"],
    objetivo: Literal["perda_peso", "manutencao", "ganho_massa"],
    bf_estimado: Optional[float] = None,
) -> dict[str, Any]:
    """Registra uma nova biometria (peso em kg, altura em cm). TMB, gasto e metas de macros são calculados."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        bio = RitmoService.create_bio(db, user.id, BioCreate(
            peso=peso, altura=altura, idade=idade, genero=genero, nivel_atividade=nivel_atividade,
            objetivo=objetivo, bf_estimado=bf_estimado,
        ))
        return BioResponse.model_validate(bio).model_dump(mode="json")


def listar_treinos() -> dict[str, Any]:
    """Planos de treino com dias e exercícios (ids incluídos — reenvie-os para editar)."""
    with usuario_e_db() as (db, user):
        return {"itens": [_plano(p) for p in RitmoService.get_planos(db, user.id)]}


def salvar_treino(nome: str, dias: list[DiaTreinoCreate], id: Optional[int] = None, ativo: Optional[bool] = None) -> dict[str, Any]:
    """Cria (sem id) ou substitui (com id) um plano de treino COMPLETO. Para editar, pegue o plano em
    listar_treinos e reenvie com os ids de dias/exercícios; item sem id é criado, item omitido é removido.
    ativo=True torna este o único ativo; omitido na edição mantém o estado atual."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        atual = ativo
        if id is not None and ativo is None:
            existente = exigir(next((p for p in RitmoService.get_planos(db, user.id) if p.id == id), None),
                               f"Plano {id} não encontrado.")
            atual = existente.ativo
        dados = PlanoTreinoCreate(nome=nome, ativo=bool(atual), dias=dias)
        if id is None:
            plano = RitmoService.create_plano_completo(db, user.id, dados)
        else:
            plano = exigir(RitmoService.update_plano_completo(db, user.id, id, dados), f"Plano {id} não encontrado.")
        if ativo is True:
            plano = RitmoService.toggle_plano_ativo(db, user.id, plano.id)
        return _plano(plano)


def excluir_treino(id: int) -> dict[str, Any]:
    """Exclui um plano de treino."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        exigir(RitmoService.delete_plano(db, user.id, id), f"Plano {id} não encontrado.")
        return {"ok": True}


def listar_dietas() -> dict[str, Any]:
    """Dietas com refeições e alimentos (ids incluídos — reenvie-os para editar)."""
    with usuario_e_db() as (db, user):
        return {"itens": [_dieta(d) for d in RitmoService.get_dietas(db, user.id)]}


def salvar_dieta(nome: str, refeicoes: list[RefeicaoCreate], id: Optional[int] = None, ativo: Optional[bool] = None) -> dict[str, Any]:
    """Cria (sem id) ou substitui (com id) uma dieta COMPLETA. Cada alimento leva os macros já calculados
    para a quantidade (use buscar_alimento para os valores por 100g). Edição funciona como em salvar_treino.
    ativo=True torna esta a única ativa; omitido na edição mantém o estado atual."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        atual = ativo
        if id is not None and ativo is None:
            existente = exigir(next((d for d in RitmoService.get_dietas(db, user.id) if d.id == id), None),
                               f"Dieta {id} não encontrada.")
            atual = existente.ativo
        dados = DietaConfigCreate(nome=nome, ativo=bool(atual), refeicoes=refeicoes)
        if id is None:
            dieta = RitmoService.create_dieta_completa(db, user.id, dados)
        else:
            dieta = exigir(RitmoService.update_dieta_completa(db, user.id, id, dados), f"Dieta {id} não encontrada.")
        if ativo is True:
            dieta = RitmoService.toggle_dieta_ativa(db, user.id, dieta.id)
        return _dieta(dieta)


def excluir_dieta(id: int) -> dict[str, Any]:
    """Exclui uma dieta."""
    with usuario_e_db(ESCOPO_ESCRITA) as (db, user):
        exigir(RitmoService.delete_dieta(db, user.id, id), f"Dieta {id} não encontrada.")
        return {"ok": True}


def buscar_alimento(q: str) -> dict[str, Any]:
    """Busca alimentos na tabela TACO (até 20). Valores por 100g: calorias, proteína, carbo, gordura."""
    with usuario_e_db():
        return {"itens": RitmoService.search_taco_foods(q) if len(q.strip()) >= 2 else []}


def register(mcp):
    registrar(
        mcp,
        leitura=(ultimo_bio, listar_treinos, listar_dietas, buscar_alimento),
        escrita=(registrar_bio, salvar_treino, salvar_dieta),
        destrutivas=(excluir_treino, excluir_dieta),
    )
