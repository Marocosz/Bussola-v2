from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class CategoriaAnalise(BaseModel):
    categoria: str
    total_atual: float
    media_historica: float
    variacao_percentual: float # Ex: +150% (Python calcula, IA analisa)

class SpendingDetectiveContext(BaseModel):
    """
    Contexto focado em auditoria forense de gastos.
    Cruza o comportamento atual com a baseline histórica.
    """
    mes_analise: str # Ex: "Janeiro 2026"
    
    # Resumo consolidado por categoria (A IA vai focar aqui)
    analise_categorias: List[CategoriaAnalise] = Field(default_factory=list)
    
    # Detalhe das transações do mês (Para a IA citar exemplos: "Foi o Uber do dia 15")
    transacoes_detalhadas: List[Dict[str, Any]] = Field(default_factory=list)
    
    # Assinaturas recorrentes detectadas (Netflix, Spotify, etc)
    assinaturas_identificadas: List[Dict[str, Any]] = Field(default_factory=list)