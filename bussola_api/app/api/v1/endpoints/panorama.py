from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api import deps
from app.schemas.panorama import PanoramaResponse
from app.services.panorama import panorama_service

router = APIRouter()

@router.get("/", response_model=PanoramaResponse)
def get_panorama(
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    return panorama_service.get_dashboard_data(db)

# --- NOVO ENDPOINT ---
@router.get("/history/{category_id}")
def get_category_history_data(
    category_id: int,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    return panorama_service.get_category_history(db, category_id)