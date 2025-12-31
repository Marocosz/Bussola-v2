from typing import List, Dict, Any
from pydantic import BaseModel, Field

class DensityAuditorContext(BaseModel):
    """
    Contexto para auditoria de densidade e carga de trabalho.
    Analisa o volume, distribuição e pausas dentro de um período.
    """
    data_inicio: str
    data_fim: str
    
    # Lista de eventos para análise de carga horária e fragmentação
    eventos_periodo: List[Dict[str, Any]] = Field(default_factory=list)