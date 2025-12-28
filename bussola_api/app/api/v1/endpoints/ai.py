"""
=======================================================================================
ARQUIVO: ai.py (Endpoints de Inteligência Artificial)
=======================================================================================
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Any
from datetime import datetime
import locale

# Imports Existentes
from app.api import deps
from app.services.ritmo import RitmoService
from app.services.ai.ritmo.orchestrator import RitmoOrchestrator
from app.services.ai.ritmo.schema import RitmoAnalysisResponse

# Imports Agenda/Registros
from app.services.ai.registros.orchestrator import RegistrosOrchestrator
from app.services.ai.registros.context import RegistrosContext, TaskItemContext

# [CORREÇÃO] Importamos o Model Tarefa diretamente para fazer a query aqui
# Caso seu model esteja em outro lugar (ex: app.models.registros), ajuste aqui.
from app.models import Tarefa 

router = APIRouter()

try:
    locale.setlocale(locale.LC_TIME, 'pt_BR.UTF-8')
except:
    pass

@router.get("/ritmo/insight", response_model=RitmoAnalysisResponse)
async def get_ritmo_ai_insight(
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
) -> Any:
    bio = RitmoService.get_latest_bio(db, current_user.id)
    if not bio:
        return RitmoAnalysisResponse(suggestions=[])
    dieta_ativa = RitmoService.get_dieta_ativa(db, current_user.id)
    plano_treino_ativo = RitmoService.get_plano_ativo(db, current_user.id)
    response = await RitmoOrchestrator.analyze_profile(
        bio=bio,
        dieta=dieta_ativa,
        plano_treino=plano_treino_ativo
    )
    return response


@router.get("/registros/insight", response_model=RitmoAnalysisResponse)
async def get_registros_ai_insight(
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
) -> Any:
    """
    Gera insights sobre TAREFAS (Registros).
    Aciona: Time Strategist, Flow Architect, Priority Alchemist, Task Breaker.
    """
    
    # 1. Coletar TAREFAS (Query Direta)
    # [CORREÇÃO] Substituímos a chamada ao Service inexistente por uma query direta
    db_tasks = db.query(Tarefa).filter(Tarefa.user_id == current_user.id).all()
    
    now = datetime.now()
    
    tasks_context_list = []
    for t in db_tasks:
        # Mapeamento do Model de Tarefa para o Contexto da IA
        tasks_context_list.append(TaskItemContext(
            id=t.id,
            titulo=t.titulo,
            descricao=t.descricao, 
            prioridade=getattr(t, 'prioridade', 'media'),
            status='concluida' if t.status == 'Concluído' else 'pendente',
            # Tratamento seguro de datas
            data_vencimento=t.prazo.strftime("%Y-%m-%d") if t.prazo else None,
            created_at=t.data_criacao.strftime("%Y-%m-%d") if t.data_criacao else now.strftime("%Y-%m-%d"),
            # Verifica subtarefas se o relacionamento existir
            has_subtasks=len(t.subtarefas) > 0 if getattr(t, 'subtarefas', None) else False
        ))

    # 2. Montar Contexto
    registros_context = RegistrosContext(
        user_id=current_user.id,
        data_atual=now.strftime("%Y-%m-%d"),
        hora_atual=now.strftime("%H:%M"),
        dia_semana=now.strftime("%A").capitalize(),
        tarefas=tasks_context_list
    )

    # 3. Execução
    suggestions = await RegistrosOrchestrator.analyze(registros_context)
    
    return RitmoAnalysisResponse(suggestions=suggestions)