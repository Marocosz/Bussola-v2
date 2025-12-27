"""
=======================================================================================
ARQUIVO: ai.py (Endpoints de Inteligência Artificial)
=======================================================================================

OBJETIVO:
    Expor as funcionalidades de análise inteligente para o Frontend.
    Atua como a ponte entre os dados do usuário e o 'Conselho de Agentes'.

RESPONSABILIDADES:
    1. Coletar os dados mais recentes do usuário (Bio, Dieta, Treino) via Services.
    2. Invocar o Orquestrador de IA de forma assíncrona.
    3. Retornar sugestões estruturadas e atômicas (AtomicSuggestion).

COMUNICAÇÃO:
    - Chama: app.services.ritmo.RitmoService (Para buscar dados do SQL).
    - Chama: app.services.ai.ritmo.orchestrator.RitmoOrchestrator (Para analisar).
    - Retorna: app.services.ai.ritmo.schema.RitmoAnalysisResponse.

=======================================================================================
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Any

from app.api import deps
from app.services.ritmo import RitmoService
from app.services.ai.ritmo.orchestrator import RitmoOrchestrator
from app.services.ai.ritmo.schema import RitmoAnalysisResponse

router = APIRouter()

@router.get("/ritmo/insight", response_model=RitmoAnalysisResponse)
async def get_ritmo_ai_insight(
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
) -> Any:
    """
    Gera insights estratégicos sobre o Ritmo (Bio, Treino e Dieta).
    
    Fluxo:
    1. Busca o 'Snapshot' atual do usuário (Bio, Dieta Ativa, Treino Ativo).
    2. Envia para o RitmoOrchestrator.
    3. O Orquestrador aciona Nutri e Coach em paralelo (Multi-Agent System).
    4. Retorna uma lista consolidada de sugestões atômicas.
    """
    
    # 1. Coleta de Dados (Data Gathering)
    # O Endpoint prepara o terreno para a IA não precisar acessar o banco diretamente.
    bio = RitmoService.get_latest_bio(db, current_user.id)
    
    if not bio:
        # Se o usuário não tem nem bio configurada, não há o que analisar.
        # Retorna lista vazia sem erro (o front lida com estado vazio).
        return RitmoAnalysisResponse(suggestions=[])

    # Busca configurações ativas (podem ser None se o usuário ainda não criou)
    dieta_ativa = RitmoService.get_dieta_ativa(db, current_user.id)
    plano_treino_ativo = RitmoService.get_plano_ativo(db, current_user.id)

    # 2. Execução da IA (Intelligence Layer)
    # Chamamos o método estático do orquestrador passando os objetos de domínio.
    response = await RitmoOrchestrator.analyze_profile(
        bio=bio,
        dieta=dieta_ativa,
        plano_treino=plano_treino_ativo
    )
    
    return response