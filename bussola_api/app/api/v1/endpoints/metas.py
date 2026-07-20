"""Endpoints do módulo Metas & Cofrinhos (prefixo /financas/metas)."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api import deps
from app.schemas.metas import (
    MetaCreate, MetaUpdate, MetaResponse,
    MovimentacaoCreate, MovimentacaoResponse,
    MetasDashboardResponse, ResumoPatrimonio,
)
from app.services.metas import metas_service
from app.services.financas import financas_service, ICONES_DISPONIVEIS, CORES_DISPONIVEIS

router = APIRouter()


def _saldo_bruto(db: Session, user_id: int) -> float:
    """Saldo bruto de Finanças: receitas − despesas efetivadas do mês (igual ao header atual)."""
    dash = financas_service.get_dashboard_data(db, user_id)
    receita = sum(float(getattr(c, "total_ganho", 0) or 0) for c in dash["categorias_receita"])
    despesa = sum(float(getattr(c, "total_gasto", 0) or 0) for c in dash["categorias_despesa"])
    return receita - despesa


@router.get("", response_model=MetasDashboardResponse)
@router.get("/", response_model=MetasDashboardResponse)
def get_metas_dashboard(db: Session = Depends(deps.get_db), current_user=Depends(deps.get_current_user)):
    metas_service.gerar_aportes_agendados(db, current_user.id)
    metas = metas_service.listar_metas(db, current_user.id)
    metas_out = [MetaResponse(**metas_service.enriquecer_meta(db, m)) for m in metas]
    resumo = metas_service.calcular_resumo(db, current_user.id, _saldo_bruto(db, current_user.id))
    return MetasDashboardResponse(
        metas=metas_out,
        resumo=ResumoPatrimonio(**resumo),
        icones_disponiveis=ICONES_DISPONIVEIS,
        cores_disponiveis=CORES_DISPONIVEIS,
    )


@router.post("", response_model=MetaResponse)
@router.post("/", response_model=MetaResponse)
def create_meta(meta_in: MetaCreate, db: Session = Depends(deps.get_db), current_user=Depends(deps.get_current_user)):
    m = metas_service.criar_meta(db, meta_in, current_user.id)
    return MetaResponse(**metas_service.enriquecer_meta(db, m))


@router.put("/{meta_id}", response_model=MetaResponse)
def update_meta(meta_id: int, meta_in: MetaUpdate, db: Session = Depends(deps.get_db), current_user=Depends(deps.get_current_user)):
    m = metas_service.atualizar_meta(db, meta_id, meta_in, current_user.id)
    if not m:
        raise HTTPException(status_code=404, detail="Meta não encontrada")
    return MetaResponse(**metas_service.enriquecer_meta(db, m))


@router.delete("/{meta_id}")
def delete_meta(meta_id: int, db: Session = Depends(deps.get_db), current_user=Depends(deps.get_current_user)):
    if not metas_service.deletar_meta(db, meta_id, current_user.id):
        raise HTTPException(status_code=404, detail="Meta não encontrada")
    return {"ok": True}


@router.post("/{meta_id}/movimentacoes", response_model=MovimentacaoResponse)
def create_movimentacao(meta_id: int, mov_in: MovimentacaoCreate, db: Session = Depends(deps.get_db), current_user=Depends(deps.get_current_user)):
    try:
        return metas_service.criar_movimentacao(db, meta_id, mov_in, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{meta_id}/movimentacoes", response_model=list[MovimentacaoResponse])
def list_movimentacoes(meta_id: int, db: Session = Depends(deps.get_db), current_user=Depends(deps.get_current_user)):
    return metas_service.listar_movimentacoes(db, meta_id, current_user.id)


@router.put("/{meta_id}/movimentacoes/{mov_id}/toggle-status", response_model=MovimentacaoResponse)
def toggle_movimentacao(meta_id: int, mov_id: int, db: Session = Depends(deps.get_db), current_user=Depends(deps.get_current_user)):
    mov = metas_service.toggle_status_movimentacao(db, meta_id, mov_id, current_user.id)
    if not mov:
        raise HTTPException(status_code=404, detail="Movimentação não encontrada")
    return mov


@router.delete("/{meta_id}/movimentacoes/{mov_id}")
def delete_movimentacao(meta_id: int, mov_id: int, db: Session = Depends(deps.get_db), current_user=Depends(deps.get_current_user)):
    if not metas_service.deletar_movimentacao(db, meta_id, mov_id, current_user.id):
        raise HTTPException(status_code=404, detail="Movimentação não encontrada")
    return {"ok": True}
