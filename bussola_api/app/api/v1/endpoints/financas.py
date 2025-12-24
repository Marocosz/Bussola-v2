from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import Any
from datetime import datetime
from dateutil.relativedelta import relativedelta
from collections import defaultdict

from app.api import deps
from app.models.financas import Transacao, Categoria 
from app.schemas.financas import (
    CategoriaCreate, CategoriaUpdate, CategoriaResponse, 
    TransacaoCreate, TransacaoUpdate, TransacaoResponse, 
    FinancasDashboardResponse
)
from app.services.financas import financas_service

router = APIRouter()

@router.get("/", response_model=FinancasDashboardResponse)
def get_financas_dashboard(
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    """
    Retorna todos os dados consolidados para o Dashboard Financeiro.
    """
    # [FIX] Passando user_id para o service que contem toda a logica
    return financas_service.get_dashboard_data(db, current_user.id)

# --- CRUD TRANSAÇÕES ---
@router.post("/transacoes", response_model=TransacaoResponse)
def create_transacao(
    transacao_in: TransacaoCreate,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    # [FIX] Passando user_id
    return financas_service.criar_transacao(db, transacao_in, current_user.id)

@router.put("/transacoes/{id}", response_model=TransacaoResponse)
def update_transacao(
    id: int,
    transacao_in: TransacaoUpdate,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    # [FIX] Passando user_id
    transacao = financas_service.atualizar_transacao(db, id, transacao_in, current_user.id)
    if not transacao:
        raise HTTPException(status_code=404, detail="Transação não encontrada")
    return transacao

@router.put("/transacoes/{id}/toggle-status")
def toggle_status(
    id: int, 
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    # [FIX] Validação user_id
    transacao = db.query(Transacao).filter(Transacao.id == id, Transacao.user_id == current_user.id).first()
    if not transacao:
        raise HTTPException(status_code=404, detail="Transação não encontrada")
    
    transacao.status = 'Efetivada' if transacao.status == 'Pendente' else 'Pendente'
    db.commit()
    return {"status": "success", "new_status": transacao.status}

@router.delete("/transacoes/{id}")
def delete_transacao(
    id: int, 
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    # [FIX] Validação user_id
    transacao = db.query(Transacao).filter(Transacao.id == id, Transacao.user_id == current_user.id).first()
    if not transacao:
        raise HTTPException(status_code=404, detail="Transação não encontrada")
    
    if transacao.id_grupo_recorrencia and transacao.tipo_recorrencia in ['recorrente', 'parcelada']:
        # [FIX] Filtro user_id
        db.query(Transacao).filter(
            Transacao.id_grupo_recorrencia == transacao.id_grupo_recorrencia,
            Transacao.user_id == current_user.id
        ).delete()
    else:
        db.delete(transacao)
    
    db.commit()
    return {"status": "success"}

# --- CRUD CATEGORIAS ---
@router.post("/categorias", response_model=CategoriaResponse)
def create_categoria(
    cat_in: CategoriaCreate, 
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    if "indefinida" in cat_in.nome.strip().lower():
        raise HTTPException(status_code=400, detail="O nome 'Indefinida' é reservado pelo sistema.")

    # [FIX] Verifica duplicidade considerando user_id
    exists = db.query(Categoria).filter(
        func.lower(Categoria.nome) == cat_in.nome.lower(),
        Categoria.tipo == cat_in.tipo,
        Categoria.user_id == current_user.id
    ).first()
    
    if exists:
        raise HTTPException(status_code=400, detail=f"Já existe uma categoria '{cat_in.nome}' do tipo {cat_in.tipo}.")
    
    # [FIX] Cria com user_id
    nova_cat = Categoria(**cat_in.model_dump(), user_id=current_user.id)
    db.add(nova_cat)
    db.commit()
    db.refresh(nova_cat)
    return nova_cat

@router.put("/categorias/{id}", response_model=CategoriaResponse)
def update_categoria(
    id: int,
    cat_in: CategoriaUpdate,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    # [FIX] Filtro user_id
    cat = db.query(Categoria).filter(Categoria.id == id, Categoria.user_id == current_user.id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    
    if "indefinida" in cat.nome.lower():
        raise HTTPException(status_code=403, detail="A categoria padrão do sistema não pode ser editada.")

    update_data = cat_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(cat, key, value)

    db.commit()
    db.refresh(cat)
    return cat

@router.delete("/categorias/{id}")
def delete_categoria(
    id: int, 
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    # [FIX] Filtro user_id
    cat = db.query(Categoria).filter(Categoria.id == id, Categoria.user_id == current_user.id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    
    if "indefinida" in cat.nome.lower():
        raise HTTPException(status_code=403, detail="A categoria padrão do sistema não pode ser excluída.")

    transacoes = db.query(Transacao).filter(Transacao.categoria_id == id).all()
    
    if transacoes:
        # [FIX] Passando user_id
        cat_destino = financas_service.get_or_create_indefinida(db, cat.tipo, current_user.id)
        
        for t in transacoes:
            t.categoria_id = cat_destino.id
        
        db.commit()

    try:
        db.delete(cat)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Erro ao excluir categoria.")
        
    return {"status": "success", "message": "Categoria excluída e transações movidas."}