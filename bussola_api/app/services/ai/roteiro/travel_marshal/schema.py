from typing import List, Dict, Any
from pydantic import BaseModel, Field

class TravelMarshalContext(BaseModel):
    """
    Contexto para auditoria de viagens e deslocamentos.
    Foca em mudanças de localização (A -> B) e requisitos de logística (Malas/Docs).
    """
    data_inicio: str
    data_fim: str
    
    # Lista filtrada focada em eventos com localizações definidas ou palavras-chave de viagem
    eventos_com_deslocamento: List[Dict[str, Any]] = Field(default_factory=list)