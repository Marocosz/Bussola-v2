from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import List
from app.api import deps
from app.schemas.registros import (
    RegistrosDashboardResponse, 
    AnotacaoCreate, AnotacaoResponse, AnotacaoUpdate,
    TarefaCreate, TarefaResponse, GrupoCreate, GrupoResponse
)
from app.services.registros import registros_service

router = APIRouter()

# --- DASHBOARD ---
@router.get("/", response_model=RegistrosDashboardResponse)
def get_dashboard(db: Session = Depends(deps.get_db)):
    return registros_service.get_dashboard(db)

# --- GRUPOS ---
@router.post("/grupos", response_model=GrupoResponse)
def create_grupo(dados: GrupoCreate, db: Session = Depends(deps.get_db)):
    return registros_service.create_grupo(db, dados)

# --- ANOTAÇÕES ---
@router.post("/anotacoes", response_model=AnotacaoResponse)
def create_anotacao(dados: AnotacaoCreate, db: Session = Depends(deps.get_db)):
    return registros_service.create_anotacao(db, dados)

@router.put("/anotacoes/{id}", response_model=AnotacaoResponse)
def update_anotacao(id: int, dados: AnotacaoUpdate, db: Session = Depends(deps.get_db)):
    reg = registros_service.update_anotacao(db, id, dados)
    if not reg: raise HTTPException(404, "Anotação não encontrada")
    return reg

@router.delete("/anotacoes/{id}")
def delete_anotacao(id: int, db: Session = Depends(deps.get_db)):
    success = registros_service.delete_anotacao(db, id)
    if not success: raise HTTPException(404, "Anotação não encontrada")
    return {"status": "success"}

@router.patch("/anotacoes/{id}/toggle-fixar")
def toggle_fixar_anotacao(id: int, db: Session = Depends(deps.get_db)):
    registros_service.toggle_fixar(db, id) # Usei a função genérica que você já tinha ou adapte
    return {"status": "success"}

# --- TAREFAS ---
@router.post("/tarefas", response_model=TarefaResponse)
def create_tarefa(dados: TarefaCreate, db: Session = Depends(deps.get_db)):
    return registros_service.create_tarefa(db, dados)

@router.patch("/tarefas/{id}/status")
def update_tarefa_status(id: int, status: str = Body(..., embed=True), db: Session = Depends(deps.get_db)):
    reg = registros_service.update_tarefa_status(db, id, status)
    if not reg: raise HTTPException(404, "Tarefa não encontrada")
    return {"status": "success", "novo_status": reg.status}

@router.delete("/tarefas/{id}")
def delete_tarefa(id: int, db: Session = Depends(deps.get_db)):
    success = registros_service.delete_tarefa(db, id)
    if not success: raise HTTPException(404, "Tarefa não encontrada")
    return {"status": "success"}

@router.post("/tarefas/{id}/subtarefas")
def add_subtarefa(id: int, titulo: str = Body(..., embed=True), db: Session = Depends(deps.get_db)):
    return registros_service.add_subtarefa(db, id, titulo)

@router.patch("/subtarefas/{id}/toggle")
def toggle_subtarefa(id: int, db: Session = Depends(deps.get_db)):
    registros_service.toggle_subtarefa(db, id)
    return {"status": "success"}