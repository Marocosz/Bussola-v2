from pydantic import BaseModel
from typing import List
from app.services.ai.registros.context import TaskItemContext

class PriorityAlchemistContext(BaseModel):
    """
    Contexto focado em IMPORTÂNCIA e VELHICE das tarefas.
    Não importa a hora do dia, importa há quanto tempo a tarefa existe.
    """
    data_atual: str
    
    # Tarefas 'velhas' (ex: criadas há +15 dias e ainda pendentes)
    tarefas_estagnadas: List[TaskItemContext]
    
    # Tarefas marcadas como 'Alta Prioridade' (para verificar inflação de prioridade)
    tarefas_alta_prioridade: List[TaskItemContext]