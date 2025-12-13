from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import Any, List
from datetime import datetime
from dateutil.relativedelta import relativedelta
from collections import defaultdict

from app.api import deps
from app.models.financas import Transacao, Categoria 
from app.schemas.financas import (
    CategoriaCreate, CategoriaResponse, 
    TransacaoCreate, TransacaoResponse, 
    FinancasDashboardResponse
)
from app.services.financas import financas_service, ICONES_DISPONIVEIS

router = APIRouter()

@router.get("/", response_model=FinancasDashboardResponse)
def get_financas_dashboard(
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
) -> Any:
    """
    Retorna todos os dados necessários para montar a tela de Finanças.
    """
    # 1. Manutenção: Gera transações futuras pendentes
    financas_service.gerar_transacoes_futuras(db)

    # 2. Datas
    today = datetime.now()
    start_of_month = today.replace(day=1, hour=0, minute=0, second=0)
    next_month = start_of_month + relativedelta(months=1)

    # 3. Categorias com Totais (Mês Atual + Histórico para Expandir)
    
    # --- DESPESAS ---
    cats_despesa = db.query(Categoria).filter(Categoria.tipo == 'despesa').all()
    for cat in cats_despesa:
        # A. Total do Mês Atual (Apenas efetivadas para consistência financeira)
        total_mes = db.query(func.sum(Transacao.valor)).filter(
            Transacao.categoria_id == cat.id,
            Transacao.data >= start_of_month,
            Transacao.data < next_month,
            Transacao.status == 'Efetivada'
        ).scalar()
        cat.total_gasto = total_mes or 0.0

        # B. Estatísticas Históricas (Para o Card Expandido)
        stats = db.query(
            func.sum(Transacao.valor),   # [0] Total Histórico
            func.avg(Transacao.valor),   # [1] Média por transação
            func.count(Transacao.id)     # [2] Quantidade de transações
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
        # A. Total do Mês Atual
        total_mes = db.query(func.sum(Transacao.valor)).filter(
            Transacao.categoria_id == cat.id,
            Transacao.data >= start_of_month,
            Transacao.data < next_month,
            Transacao.status == 'Efetivada'
        ).scalar()
        cat.total_ganho = total_mes or 0.0

        # B. Estatísticas Históricas
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

    # 4. Transações Agrupadas por Mês
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
    
    # Lógica de exclusão de grupo
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
    # Verifica duplicidade
    exists = db.query(Categoria).filter(func.lower(Categoria.nome) == cat_in.nome.lower()).first()
    if exists:
        raise HTTPException(status_code=400, detail="Categoria já existe")
    
    nova_cat = Categoria(**cat_in.model_dump())
    db.add(nova_cat)
    db.commit()
    db.refresh(nova_cat)
    return nova_cat

@router.delete("/categorias/{id}")
def delete_categoria(
    id: int, 
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    cat = db.query(Categoria).get(id)
    if not cat:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    try:
        db.delete(cat)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Não é possível excluir categoria com transações vinculadas.")
    return {"status": "success"}