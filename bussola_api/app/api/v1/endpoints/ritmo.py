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
    """Retorna dados bio e volume semanal usando jsonable_encoder para evitar erros de serialização."""
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
    bio = RitmoService.create_bio(db, current_user.id, bio_in)
    return bio


# ==========================================================
# 2. TREINO (Planos)
# ==========================================================

@router.get("/treinos", response_model=List[ritmo_schema.PlanoTreinoResponse])
def read_planos_treino(
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    planos = RitmoService.get_planos(db, current_user.id)
    return planos

@router.get("/treinos/ativo", response_model=Optional[ritmo_schema.PlanoTreinoResponse])
def get_plano_ativo(
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    plano = RitmoService.get_plano_ativo(db, current_user.id)
    return plano

@router.post("/treinos", response_model=ritmo_schema.PlanoTreinoResponse)
def create_plano_treino(
    *,
    db: Session = Depends(deps.get_db),
    plano_in: ritmo_schema.PlanoTreinoCreate,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    plano = RitmoService.create_plano_completo(db, current_user.id, plano_in)
    return plano

@router.patch("/treinos/{plano_id}/ativar", response_model=ritmo_schema.PlanoTreinoResponse)
def activate_plano(
    plano_id: int,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
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
# 3. NUTRIÇÃO (Dietas)
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
    dieta = RitmoService.get_dieta_ativa(db, current_user.id)
    return dieta

@router.post("/nutricao", response_model=ritmo_schema.DietaConfigResponse)
def create_dieta(
    *,
    db: Session = Depends(deps.get_db),
    dieta_in: ritmo_schema.DietaConfigCreate,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
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