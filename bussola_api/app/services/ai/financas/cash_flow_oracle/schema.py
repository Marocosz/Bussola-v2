from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class PontoCritico(BaseModel):
    data: str
    saldo_projetado: float
    evento_gatilho: Optional[str] = None # O que causou a queda (ex: "Aluguel")

class CashFlowContext(BaseModel):
    """
    Contexto focado em liquidez e projeção de caixa.
    O Python pré-calcula a curva de saldo para garantir precisão matemática.
    """
    saldo_inicial: float
    data_inicio: str
    data_fim: str
    
    # O Ponto mais baixo do período (Low Water Mark)
    # Se for negativo, é insolvência. Se for muito baixo, é risco.
    ponto_minimo: PontoCritico 
    
    # O saldo no final do período
    saldo_final: float
    
    # Lista cronológica de eventos futuros relevantes (Contas a pagar/receber)
    eventos_futuros: List[Dict[str, Any]] = Field(default_factory=list)
    
    # Resumo da projeção (Ex: "Saldo fica negativo por 3 dias")
    dias_no_vermelho: int = 0