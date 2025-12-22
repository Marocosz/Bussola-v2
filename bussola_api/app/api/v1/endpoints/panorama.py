from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.api import deps
from app.schemas.panorama import PanoramaResponse, ProvisaoItem, RoteiroItem, RegistroItem
from app.services.panorama import panorama_service

router = APIRouter()

@router.get("/", response_model=PanoramaResponse)
def get_panorama(
    period: str = "Mensal",
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    """
    Retorna KPIs consolidados, gráficos e dados gerais do Dashboard.
    Aceita 'period': 'Mensal' | 'Trimestral' | 'Semestral'
    """
    # [FIX] Passando user_id
    return panorama_service.get_dashboard_data(db, current_user.id, period=period)

# --- ENDPOINTS PARA OS MODAIS (Lazy Loading) ---

@router.get("/provisoes", response_model=List[ProvisaoItem])
def get_provisoes(
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    """ Retorna lista de transações futuras/pendentes para o modal Provisões """
    # [FIX] Passando user_id
    return panorama_service.get_provisoes_data(db, current_user.id)

@router.get("/roteiro", response_model=List[RoteiroItem])
def get_roteiro(
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    """ Retorna lista de compromissos futuros para o modal Roteiro """
    # [FIX] Passando user_id
    return panorama_service.get_roteiro_data(db, current_user.id)

@router.get("/registros", response_model=List[RegistroItem])
def get_registros_resumo(
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    """ Retorna resumo de tarefas e anotações para o modal Registros """
    # [FIX] Passando user_id
    return panorama_service.get_registros_resumo_data(db, current_user.id)


# --- HISTÓRICO (Mantido) ---
@router.get("/history/{category_id}")
def get_category_history_data(
    category_id: int,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    # [FIX] Passando user_id
    return panorama_service.get_category_history(db, category_id, current_user.id)