from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api import deps
from app.schemas.agenda import AgendaDashboardResponse, CompromissoCreate, CompromissoUpdate, CompromissoResponse
from app.services.agenda import agenda_service

router = APIRouter()

# Rota: GET /api/v1/agenda/
@router.get("/", response_model=AgendaDashboardResponse)
def get_agenda(db: Session = Depends(deps.get_db), current_user = Depends(deps.get_current_user)):
    # [FIX] Passando user_id
    return agenda_service.get_dashboard(db, current_user.id)

# Rota: POST /api/v1/agenda/
@router.post("/", response_model=CompromissoResponse)
def create_compromisso(dados: CompromissoCreate, db: Session = Depends(deps.get_db), current_user = Depends(deps.get_current_user)):
    # [FIX] Passando user_id
    return agenda_service.create(db, dados, current_user.id)

# Rota: PUT /api/v1/agenda/{id}
@router.put("/{id}", response_model=CompromissoResponse)
def update_compromisso(id: int, dados: CompromissoUpdate, db: Session = Depends(deps.get_db), current_user = Depends(deps.get_current_user)):
    # [FIX] Passando user_id
    return agenda_service.update(db, id, dados, current_user.id)

# Rota: PATCH /api/v1/agenda/{id}/toggle-status
@router.patch("/{id}/toggle-status")
def toggle_status(id: int, db: Session = Depends(deps.get_db), current_user = Depends(deps.get_current_user)):
    # [FIX] Passando user_id
    agenda_service.toggle_status(db, id, current_user.id)
    return {"status": "success"}

# Rota: DELETE /api/v1/agenda/{id}
@router.delete("/{id}")
def delete_compromisso(id: int, db: Session = Depends(deps.get_db), current_user = Depends(deps.get_current_user)):
    # [FIX] Passando user_id
    agenda_service.delete(db, id, current_user.id)
    return {"status": "success"}