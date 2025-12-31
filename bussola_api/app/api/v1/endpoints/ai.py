"""
=======================================================================================
ARQUIVO: ai.py (Endpoints de Inteligência Artificial)
=======================================================================================
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Any, List, Dict
from datetime import datetime, timedelta, time
import locale

# Imports Existentes
from app.api import deps
# [NOVO] Import da Autoridade de Tempo para padronização
from app.core.timezone import to_local, now_local, now_utc 

from app.services.ritmo import RitmoService
from app.services.ai.ritmo.orchestrator import RitmoOrchestrator
from app.services.ai.ritmo.schema import RitmoAnalysisResponse

# Imports Registros
from app.services.ai.registros.orchestrator import RegistrosOrchestrator
from app.services.ai.registros.context import RegistrosContext, TaskItemContext
from app.models.registros import Tarefa

# Imports Roteiro (Agenda AI) e Modelos
from app.services.ai.roteiro.orchestrator import RoteiroOrchestrator
from app.models.agenda import Compromisso 

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
    # 1. Coletar TAREFAS
    db_tasks = db.query(Tarefa).filter(Tarefa.user_id == current_user.id).all()
    
    # [FIX] Data atual baseada no fuso correto (Brasil)
    now = now_local()
    
    tasks_context_list = []
    for t in db_tasks:
        tasks_context_list.append(TaskItemContext(
            id=t.id,
            titulo=t.titulo,
            descricao=t.descricao, 
            prioridade=getattr(t, 'prioridade', 'media'),
            status='concluida' if t.status == 'Concluído' else 'pendente',
            data_vencimento=t.prazo.strftime("%Y-%m-%d") if t.prazo else None,
            created_at=t.data_criacao.strftime("%Y-%m-%d") if t.data_criacao else now.strftime("%Y-%m-%d"),
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

@router.get("/roteiro/insight", response_model=RitmoAnalysisResponse)
async def get_roteiro_ai_insight(
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
) -> Any:
    """
    Gera insights sobre AGENDA e ROTINA (Roteiro).
    Aciona: Conflict Guardian, Travel Marshal, Density Auditor, Recovery Agent.
    """
    # 1. Definições Temporais (Escopo de 30 dias)
    # [FIX] Usamos UTC para calcular a janela de busca no banco (assumindo banco UTC)
    utc_now = now_utc()
    
    # Define o início do dia de hoje (base UTC)
    start_db = utc_now.replace(hour=0, minute=0, second=0, microsecond=0)
    # Define o fim daqui a 30 dias
    end_db = start_db + timedelta(days=30)

    # 2. Buscar Compromissos no Banco
    compromissos_db = db.query(Compromisso).filter(
        Compromisso.user_id == current_user.id,
        Compromisso.data_hora >= start_db,
        Compromisso.data_hora <= end_db
    ).all()
    
    # 3. Mapeamento para Formato Padrão do Agente (Dict)
    agenda_itens: List[Dict[str, Any]] = []
    
    for comp in compromissos_db:
        # [CRÍTICO] Conversão centralizada via Autoridade de Tempo (app.core.timezone)
        # Converte o dado do banco (UTC/Naive) para Hora Local (Brasil)
        # Isso garante que 14:00 UTC vire 11:00 BRT (ou vice-versa), evitando "madrugadas"
        start_local = to_local(comp.data_hora)
        
        # Como o modelo Compromisso não tem hora de fim, vamos assumir 1 hora de duração
        end_local = start_local + timedelta(hours=1)

        agenda_itens.append({
            "id": comp.id,
            "title": comp.titulo,
            # Formatando para ISO 8601 usando o horário LOCAL corrigido
            "start_time": start_local.isoformat(),
            "end_time": end_local.isoformat(),
            "location": comp.local if comp.local else "Não especificado",
            "description": comp.descricao,
            "status": comp.status, 
            "category": "geral", 
            "priority": "media"
        })

    # 4. Dados de contexto para a IA (Também em Local Time)
    local_now = now_local()

    # 5. Executa o Orquestrador
    suggestions = await RoteiroOrchestrator.analyze_schedule(
        data_atual=local_now.strftime("%Y-%m-%d"),
        dia_semana=local_now.strftime("%A").capitalize(),
        data_inicio=local_now.strftime("%Y-%m-%d"),
        data_fim=(local_now + timedelta(days=30)).strftime("%Y-%m-%d"),
        agenda_itens=agenda_itens,
        preferences={} 
    )
    
    # 6. Retorna
    return RitmoAnalysisResponse(suggestions=suggestions)