from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.api import deps
from app.schemas.panorama import PanoramaResponse, ProvisaoItem, RoteiroItem, RegistroItem
from app.services.panorama import panorama_service

router = APIRouter()

@router.get("/", response_model=PanoramaResponse)
def get_panorama(
    period: str = "Mensal", # <--- Parâmetro adicionado
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    """
    Retorna KPIs consolidados, gráficos e dados gerais do Dashboard.
    Aceita 'period': 'Mensal' | 'Trimestral' | 'Semestral'
    """
    return panorama_service.get_dashboard_data(db, period=period)

# --- ENDPOINTS PARA OS MODAIS (Lazy Loading) ---

@router.get("/provisoes", response_model=List[ProvisaoItem])
def get_provisoes(
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    """ Retorna lista de transações futuras/pendentes para o modal Provisões """
    return panorama_service.get_provisoes_data(db)

@router.get("/roteiro", response_model=List[RoteiroItem])
def get_roteiro(
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    """ Retorna lista de compromissos futuros para o modal Roteiro """
    return panorama_service.get_roteiro_data(db)

@router.get("/registros", response_model=List[RegistroItem])
def get_registros_resumo(
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    """ Retorna resumo de tarefas e anotações para o modal Registros """
    return panorama_service.get_registros_resumo_data(db)


# --- HISTÓRICO (Mantido) ---
@router.get("/history/{category_id}")
def get_category_history_data(
    category_id: int,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    return panorama_service.get_category_history(db, category_id)