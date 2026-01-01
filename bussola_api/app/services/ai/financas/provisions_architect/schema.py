from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class ProvisaoItem(BaseModel):
    nome: str
    data_alvo: str
    valor_total: float
    valor_acumulado: float
    
    # Cálculos Matemáticos (Feitos no Python)
    progresso_percentual: float # ex: 45.5%
    meses_restantes: int
    aporte_mensal_ideal: float # Quanto deveria guardar por mês
    status_matematico: str # "Atrasado", "Em dia", "Concluído"

class ProvisionsContext(BaseModel):
    """
    Contexto para planejamento de metas de longo prazo e despesas anuais (Sinking Funds).
    Foca na suavização de fluxo de caixa.
    """
    data_atual: str
    
    # Lista de metas/provisões analisadas matematicamente
    analise_provisoes: List[ProvisaoItem] = Field(default_factory=list)
    
    # Capacidade de Poupança (Opcional: Quanto sobra em média por mês)
    # Ajuda a IA a dizer se a meta é realista ou impossível.
    capacidade_poupanca_media: float = 0.0