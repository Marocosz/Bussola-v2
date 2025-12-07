from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api import deps
from app.schemas.registros import RegistrosDashboardResponse, AnotacaoCreate, AnotacaoResponse, AnotacaoUpdate
from app.services.registros import registros_service

router = APIRouter()

@router.get("/", response_model=RegistrosDashboardResponse)
def get_registros(db: Session = Depends(deps.get_db)):
    return registros_service.get_dashboard(db)

@router.post("/", response_model=AnotacaoResponse)
def create_registro(dados: AnotacaoCreate, db: Session = Depends(deps.get_db)):
    return registros_service.create(db, dados)

@router.put("/{id}", response_model=AnotacaoResponse)
def update_registro(id: int, dados: AnotacaoUpdate, db: Session = Depends(deps.get_db)):
    reg = registros_service.update(db, id, dados)
    if not reg: raise HTTPException(404, "Registro não encontrado")
    return reg

@router.delete("/{id}")
def delete_registro(id: int, db: Session = Depends(deps.get_db)):
    success = registros_service.delete(db, id)
    if not success: raise HTTPException(404, "Registro não encontrado")
    return {"status": "success"}

@router.patch("/{id}/toggle-fixar")
def toggle_fixar(id: int, db: Session = Depends(deps.get_db)):
    registros_service.toggle_fixar(db, id)
    return {"status": "success"}

@router.patch("/{id}/toggle-tarefa")
def toggle_tarefa(id: int, db: Session = Depends(deps.get_db)):
    registros_service.toggle_tarefa(db, id)
    return {"status": "success"}