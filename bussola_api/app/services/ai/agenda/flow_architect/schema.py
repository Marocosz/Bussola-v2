from pydantic import BaseModel
from typing import List
from app.services.ai.agenda.context import TaskItemContext

class FlowArchitectContext(BaseModel):
    """
    Recorte do contexto necessário para análise de fluxo e longo prazo.
    """
    data_atual: str
    dia_semana: str
    
    # Lista completa para ele poder ver os "buracos"
    tarefas_futuras: List[TaskItemContext]