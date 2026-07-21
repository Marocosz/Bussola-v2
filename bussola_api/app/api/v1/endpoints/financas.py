"""
=======================================================================================
ARQUIVO: financas.py (Endpoints de Gestão Financeira)
=======================================================================================

OBJETIVO:
    Controlador para o módulo financeiro. Gerencia transações (Receitas/Despesas) e 
    suas Categorias.

PARTE DO SISTEMA:
    Backend / API Layer / Endpoints

RESPONSABILIDADES:
    1. CRUD de Transações: Criação, edição, exclusão e toggle de status (Pendente/Efetivada).
    2. CRUD de Categorias: Validação de nomes reservados e unicidade por usuário.
    3. Integridade Referencial: Movimentação automática de transações para "Indefinida"
       ao excluir uma categoria.
    4. Exclusão em Lote: Deletar grupos inteiros de transações recorrentes/parceladas.

COMUNICAÇÃO:
    - Chama: app.services.financas.financas_service
    - Depende: app.api.deps (Session e User)

=======================================================================================
"""

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
from app.schemas.caixa import AjusteCaixaCreate, AjusteCaixaUpdate, AjusteCaixaResponse
from app.services.financas import financas_service

router = APIRouter()

# --------------------------------------------------------------------------------------
# DASHBOARD
# --------------------------------------------------------------------------------------

@router.get("/", response_model=FinancasDashboardResponse)
def get_financas_dashboard(
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    """
    Retorna o panorama completo das finanças.
    Inclui:
    - Totais de despesa/receita do mês.
    - Lista de transações pontuais e recorrentes agrupadas por mês.
    - Paleta de cores e ícones disponíveis para UI.
    """
    return financas_service.get_dashboard_data(db, current_user.id)

# --------------------------------------------------------------------------------------
# TRANSAÇÕES (CRUD)
# --------------------------------------------------------------------------------------

@router.post("/transacoes", response_model=TransacaoResponse)
def create_transacao(
    transacao_in: TransacaoCreate,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    """
    Cria uma nova transação.
    Se for 'parcelada' ou 'recorrente', o Service gerencia a criação de múltiplos registros.
    """
    return financas_service.criar_transacao(db, transacao_in, current_user.id)

@router.put("/transacoes/{id}", response_model=TransacaoResponse)
def update_transacao(
    id: int,
    transacao_in: TransacaoUpdate,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    # Atualização unitária. Para editar recorrências em lote, lógica adicional seria necessária.
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
    """Alterna rapidamente entre 'Pendente' e 'Efetivada'."""
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
    """
    Exclui uma transação, protegendo o histórico já efetivado.

    Regras (integridade contábil):
    - Pontual: excluída normalmente (lançamento manual avulso).
    - Recorrente/Parcelada (grupo):
        * Se QUALQUER ocorrência do grupo já foi 'Efetivada', a exclusão é
          BLOQUEADA (400). O histórico realizado não pode ser apagado — use
          "encerrar" (/encerrar-recorrencia) para cancelar apenas os pendentes.
        * Se NENHUMA foi efetivada (série nunca realizada), o grupo inteiro é
          removido (limpeza de algo criado por engano).
    """
    transacao = db.query(Transacao).filter(Transacao.id == id, Transacao.user_id == current_user.id).first()
    if not transacao:
        raise HTTPException(status_code=404, detail="Transação não encontrada")

    is_grupo = transacao.id_grupo_recorrencia and transacao.tipo_recorrencia in ['recorrente', 'parcelada']

    if is_grupo:
        tem_efetivada = db.query(Transacao).filter(
            Transacao.id_grupo_recorrencia == transacao.id_grupo_recorrencia,
            Transacao.user_id == current_user.id,
            Transacao.status == 'Efetivada',
        ).count() > 0
        if tem_efetivada:
            raise HTTPException(
                status_code=400,
                detail="Série com lançamentos efetivados não pode ser excluída. Encerre a recorrência para cancelar os pendentes.",
            )
        # Nenhuma efetivada → remove o grupo inteiro (nada a preservar).
        db.query(Transacao).filter(
            Transacao.id_grupo_recorrencia == transacao.id_grupo_recorrencia,
            Transacao.user_id == current_user.id,
        ).delete()
    else:
        db.delete(transacao)

    db.commit()
    return {"status": "success"}

@router.patch("/transacoes/{id}/encerrar-recorrencia")
def stop_recurrence(
    id: int,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    """
    [LÓGICA REFINADA - 2025]
    Encerra uma série financeira (Recorrente ou Parcelada).
    
    Comportamento:
    1. Itens PENDENTES (Futuro): São excluídos (limpa a agenda).
    2. Itens EFETIVADOS (Passado): São mantidos e marcados com `recorrencia_encerrada=True`.
       Isso permite visualizá-los no histórico como "Encerrados" sem gerar novas cobranças.
    """
    resultado = financas_service.encerrar_recorrencia(db, id, current_user.id)
    
    if "error" in resultado:
        raise HTTPException(status_code=resultado["code"], detail=resultado["error"])
    
    return resultado

# --------------------------------------------------------------------------------------
# CAIXA / AJUSTES (saldo inicial + dinheiro histórico — fora do mês)
# --------------------------------------------------------------------------------------

@router.get("/caixa/ajustes", response_model=list[AjusteCaixaResponse])
def list_ajustes_caixa(
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    return financas_service.listar_ajustes(db, current_user.id)


@router.post("/caixa/ajustes", response_model=AjusteCaixaResponse)
def create_ajuste_caixa(
    ajuste_in: AjusteCaixaCreate,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    return financas_service.criar_ajuste(db, ajuste_in, current_user.id)


@router.put("/caixa/ajustes/{id}", response_model=AjusteCaixaResponse)
def update_ajuste_caixa(
    id: int,
    ajuste_in: AjusteCaixaUpdate,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    ajuste = financas_service.atualizar_ajuste(db, id, ajuste_in, current_user.id)
    if not ajuste:
        raise HTTPException(status_code=404, detail="Ajuste não encontrado")
    return ajuste


@router.delete("/caixa/ajustes/{id}")
def delete_ajuste_caixa(
    id: int,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    if not financas_service.deletar_ajuste(db, id, current_user.id):
        raise HTTPException(status_code=404, detail="Ajuste não encontrado")
    return {"status": "success"}


# --------------------------------------------------------------------------------------
# CATEGORIAS (CRUD)
# --------------------------------------------------------------------------------------

@router.post("/categorias", response_model=CategoriaResponse)
def create_categoria(
    cat_in: CategoriaCreate, 
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    """
    Cria uma nova categoria personalizada.
    Bloqueia o nome reservado "Indefinida".
    """
    if "indefinida" in cat_in.nome.strip().lower():
        raise HTTPException(status_code=400, detail="O nome 'Indefinida' é reservado pelo sistema.")

    # Validação de duplicidade por usuário
    exists = db.query(Categoria).filter(
        func.lower(Categoria.nome) == cat_in.nome.lower(),
        Categoria.tipo == cat_in.tipo,
        Categoria.user_id == current_user.id
    ).first()
    
    if exists:
        raise HTTPException(status_code=400, detail=f"Já existe uma categoria '{cat_in.nome}' do tipo {cat_in.tipo}.")
    
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
    cat = db.query(Categoria).filter(Categoria.id == id, Categoria.user_id == current_user.id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    
    # Proteção de sistema: Categorias padrão não podem ser editadas pelo usuário
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
    """
    Exclui uma categoria.
    
    Regra de Migração (Safe Delete):
        Se existirem transações vinculadas a esta categoria, elas NÃO são apagadas.
        Elas são movidas automaticamente para a categoria de fallback "Indefinida"
        correspondente ao seu tipo (Receita ou Despesa).
    """
    cat = db.query(Categoria).filter(Categoria.id == id, Categoria.user_id == current_user.id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    
    if "indefinida" in cat.nome.lower():
        raise HTTPException(status_code=403, detail="A categoria padrão do sistema não pode ser excluída.")

    transacoes = db.query(Transacao).filter(Transacao.categoria_id == id).all()
    
    # Se houver órfãos, move para a categoria de sistema
    if transacoes:
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