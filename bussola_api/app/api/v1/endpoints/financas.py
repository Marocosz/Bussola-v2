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
from app.services.financas import financas_service, ICONES_DISPONIVEIS

router = APIRouter()

@router.get("/", response_model=FinancasDashboardResponse)
def get_financas_dashboard(
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    # 1. Manutenção e Garantia de Categorias do Sistema
    financas_service.gerar_transacoes_futuras(db)
    
    # Cria "Indefinida (Despesa)" e "Indefinida (Receita)"
    financas_service.get_or_create_indefinida(db, "despesa")
    financas_service.get_or_create_indefinida(db, "receita")

    # 2. Datas
    today = datetime.now()
    start_of_month = today.replace(day=1, hour=0, minute=0, second=0)
    next_month = start_of_month + relativedelta(months=1)

    # 3. Categorias com Totais
    
    # --- DESPESAS ---
    cats_despesa = db.query(Categoria).filter(Categoria.tipo == 'despesa').all()
    for cat in cats_despesa:
        total_mes = db.query(func.sum(Transacao.valor)).filter(
            Transacao.categoria_id == cat.id,
            Transacao.data >= start_of_month,
            Transacao.data < next_month,
            Transacao.status == 'Efetivada'
        ).scalar()
        cat.total_gasto = total_mes or 0.0

        stats = db.query(
            func.sum(Transacao.valor),   
            func.avg(Transacao.valor),   
            func.count(Transacao.id)     
        ).filter(
            Transacao.categoria_id == cat.id,
            Transacao.status == 'Efetivada'
        ).first()

        cat.total_historico = stats[0] or 0.0
        cat.media_valor = stats[1] or 0.0
        cat.qtd_transacoes = stats[2] or 0

    # --- RECEITAS ---
    cats_receita = db.query(Categoria).filter(Categoria.tipo == 'receita').all()
    for cat in cats_receita:
        total_mes = db.query(func.sum(Transacao.valor)).filter(
            Transacao.categoria_id == cat.id,
            Transacao.data >= start_of_month,
            Transacao.data < next_month,
            Transacao.status == 'Efetivada'
        ).scalar()
        cat.total_ganho = total_mes or 0.0

        stats = db.query(
            func.sum(Transacao.valor),
            func.avg(Transacao.valor),
            func.count(Transacao.id)
        ).filter(
            Transacao.categoria_id == cat.id,
            Transacao.status == 'Efetivada'
        ).first()

        cat.total_historico = stats[0] or 0.0
        cat.media_valor = stats[1] or 0.0
        cat.qtd_transacoes = stats[2] or 0

    # 4. Transações Agrupadas
    transacoes = db.query(Transacao).order_by(desc(Transacao.data)).all()
    
    pontuais_map = defaultdict(list)
    recorrentes_map = defaultdict(list)

    meses_traducao = {
        1: "Janeiro", 2: "Fevereiro", 3: "Março", 4: "Abril", 5: "Maio", 6: "Junho",
        7: "Julho", 8: "Agosto", 9: "Setembro", 10: "Outubro", 11: "Novembro", 12: "Dezembro"
    }

    for t in transacoes:
        mes_key = f"{meses_traducao[t.data.month]}/{t.data.year}"
        if t.tipo_recorrencia == 'pontual':
            pontuais_map[mes_key].append(t)
        else:
            recorrentes_map[mes_key].append(t)

    return {
        "categorias_despesa": cats_despesa,
        "categorias_receita": cats_receita,
        "transacoes_pontuais": pontuais_map,
        "transacoes_recorrentes": recorrentes_map,
        "icones_disponiveis": ICONES_DISPONIVEIS,
        "cores_disponiveis": financas_service.gerar_paleta_cores()
    }

# --- CRUD TRANSAÇÕES ---
@router.post("/transacoes", response_model=TransacaoResponse)
def create_transacao(
    transacao_in: TransacaoCreate,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    return financas_service.criar_transacao(db, transacao_in)

@router.put("/transacoes/{id}", response_model=TransacaoResponse)
def update_transacao(
    id: int,
    transacao_in: TransacaoUpdate,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    transacao = financas_service.atualizar_transacao(db, id, transacao_in)
    if not transacao:
        raise HTTPException(status_code=404, detail="Transação não encontrada")
    return transacao

@router.put("/transacoes/{id}/toggle-status")
def toggle_status(
    id: int, 
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    transacao = db.query(Transacao).get(id)
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
    transacao = db.query(Transacao).get(id)
    if not transacao:
        raise HTTPException(status_code=404, detail="Transação não encontrada")
    
    if transacao.id_grupo_recorrencia and transacao.tipo_recorrencia in ['recorrente', 'parcelada']:
        db.query(Transacao).filter(Transacao.id_grupo_recorrencia == transacao.id_grupo_recorrencia).delete()
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
    # Proteção: Impede criar algo contendo "Indefinida"
    if "indefinida" in cat_in.nome.strip().lower():
        raise HTTPException(status_code=400, detail="O nome 'Indefinida' é reservado pelo sistema.")

    # Verifica duplicidade
    exists = db.query(Categoria).filter(
        func.lower(Categoria.nome) == cat_in.nome.lower(),
        Categoria.tipo == cat_in.tipo
    ).first()
    
    if exists:
        raise HTTPException(status_code=400, detail=f"Já existe uma categoria '{cat_in.nome}' do tipo {cat_in.tipo}.")
    
    nova_cat = Categoria(**cat_in.model_dump())
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
    cat = db.query(Categoria).get(id)
    if not cat:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    
    # BLOQUEIO DE EDIÇÃO: Verifica se o nome contém "Indefinida"
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
    cat = db.query(Categoria).get(id)
    if not cat:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    
    # BLOQUEIO DE EXCLUSÃO
    if "indefinida" in cat.nome.lower():
        raise HTTPException(status_code=403, detail="A categoria padrão do sistema não pode ser excluída.")

    # Verifica se há transações vinculadas
    transacoes = db.query(Transacao).filter(Transacao.categoria_id == id).all()
    
    if transacoes:
        # Busca/cria "Indefinida (Despesa)" ou "Indefinida (Receita)"
        cat_destino = financas_service.get_or_create_indefinida(db, cat.tipo)
        
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