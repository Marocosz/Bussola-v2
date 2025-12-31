from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class ConflictGuardianContext(BaseModel):
    """
    Contexto para auditoria de conflitos em um período (Mês/Semana).
    """
    data_inicio: str # ex: '2023-10-01'
    data_fim: str    # ex: '2023-10-31'
    
    # Lista contendo TODOS os eventos do período
    eventos_periodo: List[Dict[str, Any]] = Field(default_factory=list)