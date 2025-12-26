from typing import Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api import deps
from app.services.ai.ritmo.orchestrator import RitmoOrchestrator

router = APIRouter()

@router.get("/ritmo/insight", response_model=Dict[str, Any])
async def get_ritmo_ai_insight(
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
) -> Any:
    """
    Gera um insight estratégico sobre o Ritmo (Bio, Treino, Dieta).
    Utiliza 3 agentes especialistas e um orquestrador para síntese.
    """
    orchestrator = RitmoOrchestrator(db)
    
    # O método .run() já encapsula toda a complexidade (Coleta -> Análise -> Síntese)
    insight = await orchestrator.run(current_user.id)
    
    return insight