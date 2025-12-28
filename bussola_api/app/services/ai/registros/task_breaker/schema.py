from pydantic import BaseModel
from typing import List
from app.services.ai.registros.context import TaskItemContext

class TaskBreakerContext(BaseModel):
    """
    Contexto focado na SEMÂNTICA e CLAREZA.
    O agente analisa se o título é acionável ou vago.
    """
    data_atual: str
    
    # Tarefas candidatas (Geralmente sem subtarefas e com títulos curtos ou vagos)
    tarefas_analise: List[TaskItemContext]