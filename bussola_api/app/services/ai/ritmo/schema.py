from typing import List, Optional
from pydantic import BaseModel
from app.services.ai.base.base_schema import AtomicSuggestion

class RitmoAnalysisResponse(BaseModel):
    """
    Container final da resposta da IA.
    Atualmente é um wrapper simples, mas permite adicionar metadados globais
    (ex: 'analysis_timestamp', 'tokens_used') no futuro sem quebrar o front.
    """
    suggestions: List[AtomicSuggestion]
    generated_at: Optional[str] = None