from typing import List, Dict, Any
from pydantic import BaseModel, Field

class RecoveryAgentContext(BaseModel):
    data_atual: str 
    tarefas_atrasadas: List[Dict[str, Any]] = Field(default_factory=list)
    agenda_futura: List[Dict[str, Any]] = Field(default_factory=list)