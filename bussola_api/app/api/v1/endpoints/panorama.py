"""
=======================================================================================
ARQUIVO: panorama.py (Endpoints de Dashboard e BI)
=======================================================================================

OBJETIVO:
    Fornecer os endpoints para a visão geral do sistema (Dashboard/Panorama).
    Atua como o controlador que entrega KPIs consolidados, gráficos e dados detalhados
    para modais específicos (Drill-down).

PARTE DO SISTEMA:
    Backend / API Layer / Endpoints

RESPONSABILIDADES:
    1. Entregar o payload principal do dashboard com filtros temporais.
    2. Fornecer endpoints leves para carregamento sob demanda (Lazy Loading) de detalhes.
    3. Garantir que todas as consultas analíticas sejam filtradas pelo usuário autenticado.

COMUNICAÇÃO:
    - Chama: app.services.panorama (Lógica de Agregação e Cálculo).
    - Recebe: app.schemas.panorama (Contratos de Dados de BI).
    - Depende: app.api.deps (Autenticação).

=======================================================================================
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.api import deps
from app.schemas.panorama import PanoramaResponse, ProvisaoItem, RoteiroItem, RegistroItem
from app.services.panorama import panorama_service

router = APIRouter()

# --------------------------------------------------------------------------------------
# DASHBOARD PRINCIPAL
# --------------------------------------------------------------------------------------

@router.get("/", response_model=PanoramaResponse)
def get_panorama(
    start: Optional[str] = Query(None, description="Início do período (ISO: YYYY-MM-DD). Padrão: início do mês atual."),
    end: Optional[str] = Query(None, description="Fim EXCLUSIVO do período (ISO: YYYY-MM-DD). Padrão: início do próximo mês."),
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    """
    Retorna o payload mestre do Dashboard.

    Filtro temporal (estilo Provisões): intervalo livre [start, end) via presets
    (mês, últimos 3 meses, ano) ou personalizado. Sem parâmetros → mês atual.

    Segurança:
        O `current_user.id` é passado obrigatoriamente para garantir isolamento de dados.
    """
    def _parse(v):
        if not v:
            return None
        try:
            return datetime.fromisoformat(v)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Data inválida: {v}")

    return panorama_service.get_dashboard_data(
        db,
        current_user.id,
        start_date=_parse(start),
        end_date=_parse(end),
    )

# --------------------------------------------------------------------------------------
# ENDPOINTS PARA MODAIS (LAZY LOADING / DRILL-DOWN)
# --------------------------------------------------------------------------------------
# Estes endpoints existem para não sobrecarregar a chamada principal (get_panorama).
# Os dados detalhados (listas longas) são carregados apenas quando o usuário clica
# nos cards correspondentes ("Ver mais").

@router.get("/provisoes", response_model=List[ProvisaoItem])
def get_provisoes(
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    """
    Modal Financeiro: Retorna lista de transações futuras ou pendentes.
    Usado para previsão de caixa.
    """
    return panorama_service.get_provisoes_data(db, current_user.id)

@router.get("/roteiro", response_model=List[RoteiroItem])
def get_roteiro(
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    """
    Modal Agenda: Retorna a lista completa de compromissos (Timeline).
    Permite visualização de eventos passados e futuros sem paginação complexa.
    """
    return panorama_service.get_roteiro_data(db, current_user.id)

@router.get("/registros", response_model=List[RegistroItem])
def get_registros_resumo(
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    """
    Modal Produtividade: Retorna um mix de Tarefas pendentes e últimas Anotações.
    Foca no que requer atenção imediata do usuário.
    """
    return panorama_service.get_registros_resumo_data(db, current_user.id)


# --------------------------------------------------------------------------------------
# DADOS ANALÍTICOS ESPECÍFICOS
# --------------------------------------------------------------------------------------

@router.get("/history/{category_id}")
def get_category_history_data(
    category_id: int,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    """
    Retorna dados para minigráficos (Sparklines) de uma categoria específica.
    Usado ao clicar em uma fatia do gráfico de rosca ou na lista de categorias.
    """
    return panorama_service.get_category_history(db, category_id, current_user.id)