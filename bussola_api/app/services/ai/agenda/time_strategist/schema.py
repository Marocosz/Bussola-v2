from pydantic import BaseModel
from typing import List
from app.services.ai.agenda.context import TaskItemContext

class TimeStrategistContext(BaseModel):
    """
    Contexto focado no CURTO PRAZO (Hoje/Ontem/Amanhã).
    O agente não precisa ver tarefas do mês que vem.
    """
    data_atual: str
    hora_atual: str  # Fundamental para a regra das 18h
    dia_semana: str
    
    # Listas já filtradas pelo Python antes de ir pra IA (Economia de Tokens)
    tarefas_atrasadas: List[TaskItemContext]
    tarefas_hoje: List[TaskItemContext]