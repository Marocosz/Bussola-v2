from abc import ABC, abstractmethod
from typing import Any, Dict
from pydantic import BaseModel, Field

# --- SCHEMA DE RESPOSTA PADRÃO ---
class AgentOutput(BaseModel):
    """Modelo padrão que todo agente deve retornar."""
    urgencia: int = Field(description="Nível de urgência de 1 a 10")
    insight: str = Field(description="A análise ou insight gerado")
    acao: str = Field(description="A ação sugerida para o usuário")

# --- INTERFACES ---
class BaseAgent(ABC):
    @abstractmethod
    async def analyze(self, data: Any) -> AgentOutput:
        pass

class BaseOrchestrator(ABC):
    @abstractmethod
    async def run(self, user_id: int) -> Dict[str, Any]:
        pass