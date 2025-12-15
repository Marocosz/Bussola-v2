from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import List, Any, Optional
from app.api import deps
from app.schemas.registros import (
    RegistrosDashboardResponse, 
    AnotacaoCreate, AnotacaoResponse, AnotacaoUpdate,
    TarefaCreate, TarefaResponse, TarefaUpdate, # Importado TarefaUpdate
    GrupoCreate, GrupoResponse 
)
from app.services.registros import registros_service

router = APIRouter()

# ==========================================================
# DASHBOARD
# ==========================================================
@router.get("/", response_model=RegistrosDashboardResponse)
def get_dashboard(db: Session = Depends(deps.get_db)):
    return registros_service.get_dashboard_data(db)

# ==========================================================
# GRUPOS (Adicionados Update e Delete)
# ==========================================================
@router.post("/grupos", response_model=GrupoResponse)
def create_grupo(dados: GrupoCreate, db: Session = Depends(deps.get_db)):
    return registros_service.create_grupo(db, dados)

@router.put("/grupos/{id}", response_model=GrupoResponse)
def update_grupo(id: int, dados: GrupoCreate, db: Session = Depends(deps.get_db)):
    grupo = registros_service.update_grupo(db, id, dados)
    if not grupo:
        raise HTTPException(status_code=404, detail="Grupo não encontrado")
    return grupo

@router.delete("/grupos/{id}")
def delete_grupo(id: int, db: Session = Depends(deps.get_db)):
    success = registros_service.delete_grupo(db, id)
    if not success:
        raise HTTPException(status_code=404, detail="Grupo não encontrado")
    return {"message": "Grupo excluído com sucesso"}

# ==========================================================
# ANOTAÇÕES
# ==========================================================
@router.post("/anotacoes", response_model=AnotacaoResponse)
def create_anotacao(dados: AnotacaoCreate, db: Session = Depends(deps.get_db)):
    return registros_service.create_anotacao(db, dados)

@router.put("/anotacoes/{id}", response_model=AnotacaoResponse)
def update_anotacao(id: int, dados: AnotacaoUpdate, db: Session = Depends(deps.get_db)):
    reg = registros_service.update_anotacao(db, id, dados)
    if not reg: 
        raise HTTPException(status_code=404, detail="Anotação não encontrada")
    return reg

@router.delete("/anotacoes/{id}")
def delete_anotacao(id: int, db: Session = Depends(deps.get_db)):
    success = registros_service.delete_anotacao(db, id)
    if not success: 
        raise HTTPException(status_code=404, detail="Anotação não encontrada")
    return {"status": "success"}

@router.patch("/anotacoes/{id}/toggle-fixar", response_model=AnotacaoResponse)
def toggle_fixar_anotacao(id: int, db: Session = Depends(deps.get_db)):
    reg = registros_service.toggle_fixar(db, id)
    if not reg:
        raise HTTPException(status_code=404, detail="Anotação não encontrada")
    return reg

# ==========================================================
# TAREFAS
# ==========================================================
@router.post("/tarefas", response_model=TarefaResponse)
def create_tarefa(dados: TarefaCreate, db: Session = Depends(deps.get_db)):
    return registros_service.create_tarefa(db, dados)

# [NOVO] Endpoint para Editar Tarefa Completa
@router.put("/tarefas/{id}", response_model=TarefaResponse)
def update_tarefa(id: int, dados: TarefaUpdate, db: Session = Depends(deps.get_db)):
    reg = registros_service.update_tarefa(db, id, dados)
    if not reg:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada")
    return reg

@router.patch("/tarefas/{id}/status")
def update_tarefa_status(id: int, status: str = Body(..., embed=True), db: Session = Depends(deps.get_db)):
    reg = registros_service.update_status_tarefa(db, id, status)
    if not reg: 
        raise HTTPException(status_code=404, detail="Tarefa não encontrada")
    return {"status": "success", "novo_status": reg.status}

@router.delete("/tarefas/{id}")
def delete_tarefa(id: int, db: Session = Depends(deps.get_db)):
    success = registros_service.delete_tarefa(db, id)
    if not success: 
        raise HTTPException(status_code=404, detail="Tarefa não encontrada")
    return {"status": "success"}

# ==========================================================
# SUBTAREFAS
# ==========================================================
@router.post("/tarefas/{id}/subtarefas")
def add_subtarefa(
    id: int, 
    titulo: str = Body(..., embed=True), 
    parent_id: Optional[int] = Body(None, embed=True), # Novo param opcional
    db: Session = Depends(deps.get_db)
):
    return registros_service.add_subtarefa(db, id, titulo, parent_id)

@router.patch("/subtarefas/{id}/toggle")
def toggle_subtarefa(id: int, db: Session = Depends(deps.get_db)):
    sub = registros_service.toggle_subtarefa(db, id)
    if not sub:
        raise HTTPException(status_code=404, detail="Subtarefa não encontrada")
    return {"status": "success", "concluido": sub.concluido}