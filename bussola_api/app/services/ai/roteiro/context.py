from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class RoteiroContext(BaseModel):
    """
    Contexto Mestre do domínio 'Roteiro'.
    Este objeto agrega todos os dados necessários para os agentes:
    - ConflictGuardian
    - DensityAuditor
    - RecoveryAgent
    - TravelMarshal
    """
    # Metadados Temporais
    data_atual: str # Data de referência "Hoje" (ISO Format YYYY-MM-DD)
    dia_semana: str # Ex: "Segunda-feira"
    
    # Escopo da Análise (Pode ser dia, semana ou mês)
    data_inicio: str 
    data_fim: str

    # Dados Principais
    # Deve conter chaves padronizadas: 'id', 'title', 'start_time', 'end_time', 'location', 'status', 'priority'
    agenda_itens: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Lista completa de eventos e tarefas do período."
    )

    # Preferências do Usuário (Opcional, para personalização futura)
    user_preferences: Optional[Dict[str, Any]] = Field(
        default_factory=dict,
        description="Configs como 'horário de almoço', 'tempo de deslocamento padrão', etc."
    )