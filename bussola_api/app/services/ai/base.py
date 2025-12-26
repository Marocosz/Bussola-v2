from abc import ABC, abstractmethod
from typing import Any, Dict, Literal
from pydantic import BaseModel, Field

# --- SCHEMA DE RESPOSTA PADRÃO ---
class AgentOutput(BaseModel):
    """Modelo padrão que todo agente deve retornar."""
    # Urgencia agora é semântica: 1-3 (Informativo/Elogio), 4-7 (Sugestão), 8-10 (Crítico)
    urgencia: int = Field(description="Nível de prioridade de 1 a 10")
    
    status: Literal["ok", "atencao", "critico", "otimo"] = Field(
        description="Estado atual do contexto analisado"
    )
    
    insight: str = Field(description="A análise técnica ou insight gerado")
    acao: str = Field(description="A próxima ação prática sugerida para o usuário")

# --- INTERFACES ---
class BaseAgent(ABC):
    @abstractmethod
    async def analyze(self, data: Any) -> AgentOutput:
        pass

class BaseOrchestrator(ABC):
    @abstractmethod
    async def run(self, user_id: int) -> Dict[str, Any]:
        pass