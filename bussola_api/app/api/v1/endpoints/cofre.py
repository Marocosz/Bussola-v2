from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.api import deps
from app.schemas.cofre import SegredoResponse, SegredoCreate, SegredoUpdate, SegredoValueResponse
from app.services.cofre import cofre_service

router = APIRouter()

@router.get("/", response_model=List[SegredoResponse])
def listar_segredos(db: Session = Depends(deps.get_db), current_user = Depends(deps.get_current_user)):
    # [FIX] Passando user_id
    return cofre_service.get_all(db, current_user.id)

@router.post("/", response_model=SegredoResponse)
def criar_segredo(dados: SegredoCreate, db: Session = Depends(deps.get_db), current_user = Depends(deps.get_current_user)):
    # [FIX] Passando user_id
    return cofre_service.create(db, dados, current_user.id)

@router.put("/{id}", response_model=SegredoResponse)
def atualizar_segredo(id: int, dados: SegredoUpdate, db: Session = Depends(deps.get_db), current_user = Depends(deps.get_current_user)):
    # [FIX] Passando user_id
    segredo = cofre_service.update(db, id, dados, current_user.id)
    if not segredo: raise HTTPException(404, "Segredo não encontrado")
    return segredo

@router.delete("/{id}")
def excluir_segredo(id: int, db: Session = Depends(deps.get_db), current_user = Depends(deps.get_current_user)):
    # [FIX] Passando user_id
    success = cofre_service.delete(db, id, current_user.id)
    if not success: raise HTTPException(404, "Segredo não encontrado")
    return {"status": "success"}

@router.get("/{id}/valor", response_model=SegredoValueResponse)
def obter_valor_segredo(id: int, db: Session = Depends(deps.get_db), current_user = Depends(deps.get_current_user)):
    # [FIX] Passando user_id
    valor = cofre_service.get_decrypted_value(db, id, current_user.id)
    if valor is None: raise HTTPException(404, "Segredo não encontrado")
    return {"valor": valor}