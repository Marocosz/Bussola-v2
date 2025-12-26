"""
=======================================================================================
ARQUIVO: ritmo.py (Endpoints de Saúde e Performance)
=======================================================================================

OBJETIVO:
    Controlador responsável pelo módulo "Ritmo" (Saúde).
    Gerencia três pilares principais:
    1. Biometria (Peso, Altura, Cálculos Metabólicos).
    2. Treinos (Gestão de Planos, Dias e Exercícios).
    3. Nutrição (Gestão de Dietas, Refeições e Busca de Alimentos).

PARTE DO SISTEMA:
    Backend / API Layer / Endpoints

RESPONSABILIDADES:
    1. Receber requisições HTTP e validar autenticação.
    2. Delegar regras de negócio complexas (como cálculos de TMB ou updates aninhados)
       para o `RitmoService`.
    3. Retornar dados formatados para o frontend (incluindo agregações como volume semanal).

COMUNICAÇÃO:
    - Chama: app.services.ritmo.RitmoService.
    - Recebe: app.schemas.ritmo (Contratos de dados).
    - Depende: app.api.deps (Sessão e Usuário).

=======================================================================================
"""

from typing import List, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session

from app import schemas, models
from app.api import deps
from app.services.ritmo import RitmoService
from app.schemas import ritmo as ritmo_schema

router = APIRouter()

# ==========================================================
# 1. BIO DADOS (Corpo & Metas)
# ==========================================================

@router.get("/bio/latest")
def read_latest_bio(
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Retorna um 'Snapshot' da saúde do usuário.
    
    Agregação de Dados:
        Combina o registro biométrico mais recente (Peso, BF, Metas) com
        o cálculo de volume semanal de treino (Séries por grupo muscular).
    
    Técnica:
        Usa `jsonable_encoder` para garantir a serialização correta de objetos
        mistos (SQLAlchemy Model + Dicionários Python) em uma resposta JSON única.
    """
    bio = RitmoService.get_latest_bio(db, current_user.id)
    if not bio:
        return {"bio": None, "volume_semanal": {}}
    
    volume = RitmoService.get_volume_semanal(db, current_user.id)
    
    return jsonable_encoder({
        "bio": bio,
        "volume_semanal": volume
    })

@router.post("/bio", response_model=ritmo_schema.BioResponse)
def create_bio(
    *,
    db: Session = Depends(deps.get_db),
    bio_in: ritmo_schema.BioCreate,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Registra uma nova medição biométrica.
    O Service calculará automaticamente TMB, GET e Macros baseados nestes dados.
    """
    bio = RitmoService.create_bio(db, current_user.id, bio_in)
    return bio


# ==========================================================
# 2. TREINO (Gestão de Planos)
# ==========================================================

@router.get("/treinos", response_model=List[ritmo_schema.PlanoTreinoResponse])
def read_planos_treino(
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """Lista todos os planos de treino criados pelo usuário."""
    planos = RitmoService.get_planos(db, current_user.id)
    return planos

@router.get("/treinos/ativo", response_model=Optional[ritmo_schema.PlanoTreinoResponse])
def get_plano_ativo(
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """Retorna apenas o plano marcado como 'Ativo' para exibição rápida no Dashboard."""
    plano = RitmoService.get_plano_ativo(db, current_user.id)
    return plano

@router.post("/treinos", response_model=ritmo_schema.PlanoTreinoResponse)
def create_plano_treino(
    *,
    db: Session = Depends(deps.get_db),
    plano_in: ritmo_schema.PlanoTreinoCreate,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Cria um plano de treino completo (Plano -> Dias -> Exercícios).
    Se o plano for criado como 'ativo', o service desativará os anteriores automaticamente.
    """
    plano = RitmoService.create_plano_completo(db, current_user.id, plano_in)
    return plano

@router.put("/treinos/{plano_id}", response_model=ritmo_schema.PlanoTreinoResponse)
def update_plano_treino(
    plano_id: int,
    *,
    db: Session = Depends(deps.get_db),
    plano_in: ritmo_schema.PlanoTreinoCreate,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Atualiza um plano de treino.
    Atenção: A atualização é estrutural (remove dias/exercícios antigos e recria novos).
    """
    plano = RitmoService.update_plano_completo(db, current_user.id, plano_id, plano_in)
    if not plano:
        raise HTTPException(status_code=404, detail="Plano não encontrado.")
    return plano

@router.patch("/treinos/{plano_id}/ativar", response_model=ritmo_schema.PlanoTreinoResponse)
def activate_plano(
    plano_id: int,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Define um plano como o principal.
    Regra de Negócio: Apenas um plano pode estar ativo por vez.
    """
    plano = RitmoService.toggle_plano_ativo(db, current_user.id, plano_id)
    if not plano:
        raise HTTPException(status_code=404, detail="Plano não encontrado.")
    return plano

@router.delete("/treinos/{plano_id}", response_model=dict)
def delete_plano(
    plano_id: int,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    success = RitmoService.delete_plano(db, current_user.id, plano_id)
    if not success:
        raise HTTPException(status_code=404, detail="Plano não encontrado.")
    return {"msg": "Plano excluído com sucesso"}


# ==========================================================
# 3. NUTRIÇÃO (Gestão de Dietas)
# ==========================================================

@router.get("/nutricao", response_model=List[ritmo_schema.DietaConfigResponse])
def read_dietas(
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    dietas = RitmoService.get_dietas(db, current_user.id)
    return dietas

@router.get("/nutricao/ativo", response_model=Optional[ritmo_schema.DietaConfigResponse])
def get_dieta_ativa(
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """Retorna a dieta vigente para cálculo de calorias no dia a dia."""
    dieta = RitmoService.get_dieta_ativa(db, current_user.id)
    return dieta

@router.post("/nutricao", response_model=ritmo_schema.DietaConfigResponse)
def create_dieta(
    *,
    db: Session = Depends(deps.get_db),
    dieta_in: ritmo_schema.DietaConfigCreate,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Cria uma dieta completa (Config -> Refeições -> Alimentos).
    O service calculará o somatório calórico total automaticamente.
    """
    dieta = RitmoService.create_dieta_completa(db, current_user.id, dieta_in)
    return dieta

@router.patch("/nutricao/{dieta_id}/ativar", response_model=ritmo_schema.DietaConfigResponse)
def activate_dieta(
    dieta_id: int,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    dieta = RitmoService.toggle_dieta_ativa(db, current_user.id, dieta_id)
    if not dieta:
        raise HTTPException(status_code=404, detail="Dieta não encontrada.")
    return dieta

@router.delete("/nutricao/{dieta_id}", response_model=dict)
def delete_dieta(
    dieta_id: int,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    success = RitmoService.delete_dieta(db, current_user.id, dieta_id)
    if not success:
        raise HTTPException(status_code=404, detail="Dieta não encontrada.")
    return {"msg": "Dieta excluída com sucesso"}

# --------------------------------------------------------------------------------------
# INTEGRAÇÃO LOCAL (TACO - Tabela Brasileira de Composição de Alimentos)
# --------------------------------------------------------------------------------------
@router.get("/local/foods")
def get_local_foods(q: str = ""):
    """
    Endpoint de busca de alimentos.
    
    Integração:
        Não acessa o banco de dados principal. Acessa um arquivo JSON local (taco.json)
        via Service para evitar latência e custos de banco para dados estáticos.
    """
    if len(q) < 2:
        return []
    return RitmoService.search_taco_foods(q)


@router.put("/nutricao/{dieta_id}", response_model=ritmo_schema.DietaConfigResponse)
def update_dieta(
    dieta_id: int,
    *,
    db: Session = Depends(deps.get_db),
    dieta_in: ritmo_schema.DietaConfigCreate, 
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Atualiza uma dieta existente.
    Mesma lógica do treino: remove estrutura antiga de refeições e recria a nova.
    """
    dieta = RitmoService.update_dieta_completa(db, current_user.id, dieta_id, dieta_in)
    if not dieta:
        raise HTTPException(status_code=404, detail="Dieta não encontrada.")
    return dieta