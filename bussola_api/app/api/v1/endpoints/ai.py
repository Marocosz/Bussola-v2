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

# NOVOS IMPORTS AGENDA
from app.services.agenda import AgendaService # <-- Certifique-se que existe ou importe Repository
from app.services.ai.agenda.orchestrator import AgendaOrchestrator
from app.services.ai.agenda.context import AgendaContext, TaskItemContext

router = APIRouter()

# Tenta configurar locale para PT-BR para dia da semana
try:
    locale.setlocale(locale.LC_TIME, 'pt_BR.UTF-8')
except:
    pass

@router.get("/ritmo/insight", response_model=RitmoAnalysisResponse)
async def get_ritmo_ai_insight(
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
) -> Any:
    # ... (Mantenha o código do ritmo intacto aqui)
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


# --- NOVO ENDPOINT: AGENDA ---
@router.get("/agenda/insight", response_model=RitmoAnalysisResponse)
async def get_agenda_ai_insight(
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
) -> Any:
    """
    Gera insights de produtividade (Agenda Intelligence).
    Aciona: Time Strategist, Flow Architect, Priority Alchemist, Task Breaker.
    """
    
    # 1. Coletar Tarefas do Banco
    # Precisamos de todas as tarefas (pendentes e concluídas recentes)
    # Supondo que AgendaService tenha um método que retorna objetos SQLAlchemy ou Pydantic
    db_tasks = AgendaService.get_all_compromissos(db, current_user.id) 
    
    # 2. Montar Contexto (Adapter Pattern)
    # Transformamos o objeto do banco no Schema Context que a IA entende
    now = datetime.now()
    
    tasks_context_list = []
    for t in db_tasks:
        # Conversão segura de dados
        # Assumindo que seu model tem esses campos. Adapte conforme seu banco.
        tasks_context_list.append(TaskItemContext(
            id=t.id,
            titulo=t.titulo,
            descricao=t.descricao,
            prioridade=getattr(t, 'prioridade', 'media'), # Fallback se não tiver campo
            status=t.status, # 'pendente', 'concluida'
            data_vencimento=t.data.strftime("%Y-%m-%d") if t.data else None,
            created_at=t.created_at.strftime("%Y-%m-%d") if hasattr(t, 'created_at') else now.strftime("%Y-%m-%d"),
            has_subtasks=False # Se tiver lógica de subtarefas, adicione aqui
        ))

    agenda_context = AgendaContext(
        user_id=current_user.id,
        data_atual=now.strftime("%Y-%m-%d"),
        hora_atual=now.strftime("%H:%M"),
        dia_semana=now.strftime("%A").capitalize(), # 'Segunda-feira'
        tarefas=tasks_context_list
    )

    # 3. Execução da IA
    suggestions = await AgendaOrchestrator.analyze(agenda_context)
    
    # Reutilizamos o RitmoAnalysisResponse pois a estrutura é idêntica (lista de sugestões)
    return RitmoAnalysisResponse(suggestions=suggestions)