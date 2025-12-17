from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import schemas, models
from app.api import deps
from app.services.ritmo import RitmoService
from app.schemas import ritmo as ritmo_schema
from app.models import RitmoPlanoTreino

router = APIRouter()

# ==========================================================
# 1. BIO DADOS (Corpo & Metas)
# ==========================================================

@staticmethod
def get_volume_semanal(db: Session, user_id: int):
    """
    Calcula a soma de séries por grupo muscular do plano ATIVO.
    """
    plano = db.query(RitmoPlanoTreino).filter(
        RitmoPlanoTreino.user_id == user_id, 
        RitmoPlanoTreino.ativo == True
    ).first()

    if not plano:
        return {}

    volume = {}
    for dia in plano.dias:
        for ex in dia.exercicios:
            grupo = ex.grupo_muscular or "Outros"
            # Soma as séries do exercício ao grupo correspondente
            volume[grupo] = volume.get(grupo, 0) + (ex.series or 0)
        
    return volume

@router.post("/bio", response_model=ritmo_schema.BioResponse)
def create_bio(
    *,
    db: Session = Depends(deps.get_db),
    bio_in: ritmo_schema.BioCreate,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Registra novos dados corporais.
    Realiza automaticamente o cálculo de TMB, GET e Macros.
    """
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
    """Lista todos os planos de treino criados pelo usuário."""
    planos = RitmoService.get_planos(db, current_user.id)
    return planos

@router.get("/treinos/ativo", response_model=ritmo_schema.PlanoTreinoResponse)
def get_plano_ativo(
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """Retorna o plano de treino atualmente ativo (com dias e exercícios)."""
    plano = RitmoService.get_plano_ativo(db, current_user.id)
    if not plano:
        raise HTTPException(status_code=404, detail="Nenhum plano de treino ativo.")
    return plano

@router.post("/treinos", response_model=ritmo_schema.PlanoTreinoResponse)
def create_plano_treino(
    *,
    db: Session = Depends(deps.get_db),
    plano_in: ritmo_schema.PlanoTreinoCreate,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Cria um plano completo (Header -> Dias -> Exercícios).
    Se 'ativo' for True, desativa os planos anteriores.
    """
    plano = RitmoService.create_plano_completo(db, current_user.id, plano_in)
    return plano

@router.patch("/treinos/{plano_id}/ativar", response_model=ritmo_schema.PlanoTreinoResponse)
def activate_plano(
    plano_id: int,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """Define este plano como o ativo e desativa os outros."""
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
    """Exclui um plano e todos os seus dias/exercícios."""
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
    """Lista todas as dietas criadas."""
    dietas = RitmoService.get_dietas(db, current_user.id)
    return dietas

@router.get("/nutricao/ativo", response_model=ritmo_schema.DietaConfigResponse)
def get_dieta_ativa(
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """Retorna a dieta atualmente ativa (com refeições e alimentos)."""
    dieta = RitmoService.get_dieta_ativa(db, current_user.id)
    if not dieta:
        raise HTTPException(status_code=404, detail="Nenhuma dieta ativa.")
    return dieta

@router.post("/nutricao", response_model=ritmo_schema.DietaConfigResponse)
def create_dieta(
    *,
    db: Session = Depends(deps.get_db),
    dieta_in: ritmo_schema.DietaConfigCreate,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Cria uma dieta completa (Header -> Refeições -> Alimentos).
    Calcula automaticamente o total calórico.
    """
    dieta = RitmoService.create_dieta_completa(db, current_user.id, dieta_in)
    return dieta

@router.patch("/nutricao/{dieta_id}/ativar", response_model=ritmo_schema.DietaConfigResponse)
def activate_dieta(
    dieta_id: int,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """Define esta dieta como a ativa e desativa as outras."""
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
    """Exclui uma dieta e todas as suas refeições."""
    success = RitmoService.delete_dieta(db, current_user.id, dieta_id)
    if not success:
        raise HTTPException(status_code=404, detail="Dieta não encontrada.")
    return {"msg": "Dieta excluída com sucesso"}