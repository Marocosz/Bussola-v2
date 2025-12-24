from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api import deps
from app.services.ai.ritmo.orchestrator import RitmoOrchestrator

router = APIRouter()

@router.get("/ritmo/insight")
async def get_ritmo_ai_insight(
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    orchestrator = RitmoOrchestrator(db)
    
    # Processamento Assíncrono
    insight = await orchestrator.run(current_user.id)
    
    return insight