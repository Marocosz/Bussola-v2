"""
=======================================================================================
ARQUIVO: schema.py (StrategyArchitect)
=======================================================================================

OBJETIVO:
    Definir o contrato de dados para a análise estratégica de metas financeiras.
    
    Diferente de outros agentes que olham transações atômicas, este schema foca em
    Séries Temporais e Comparação "Meta vs Realizado" (Target vs Actual).

    Ele suporta tanto Despesas (onde a meta é um TETO) quanto Receitas (onde a meta 
    é um ALVO).
"""

from typing import List, Optional, Literal
from pydantic import BaseModel, Field

# Enumeração de Diagnósticos para garantir determinismo
DiagnosticoTipo = Literal[
    # Cenários de Despesa (Limites)
    "TETO_DE_VIDRO",       # Gasta sempre mais que a meta (Meta irrealista baixa)
    "CAPITAL_ZUMBI",       # Meta alta, gasto zero ou baixo (Dinheiro travado mentalmente)
    "ALINHAMENTO_PERFEITO", # Gasto segue a meta (Sucesso)
    
    # Cenários de Receita (Alvos)
    "POTENCIAL_SUBESTIMADO", # Ganha mais que a meta (Meta muito fácil)
    "EXPECTATIVA_IRREAL",    # Ganha menos que a meta (Meta inatingível)
    "ALTA_PERFORMANCE",      # Atinge a meta consistentemente (Sucesso)
    
    # Estados Especiais
    "DADOS_INSUFICIENTES",   # Histórico muito curto
    "CALIBRAGEM_GERAL_OK"    # Todas as categorias estão saudáveis
]

class ItemAnaliseEstrategica(BaseModel):
    """
    Representa uma única categoria (Receita ou Despesa) submetida à auditoria de política.
    """
    categoria: str
    tipo_fluxo: Literal["receita", "despesa"]
    
    # Dados Quantitativos (A Verdade Numérica)
    meta_configurada: float
    media_realizada_90d: float
    
    # Indicadores Calculados (Python)
    desvio_percentual: float  # ex: +25.5% (Acima da meta) ou -10.0% (Abaixo)
    
    # O Veredito Matemático (Determinado pelo Python antes do LLM)
    diagnostico: DiagnosticoTipo
    
    # Sugestão Matemática (Ponto de partida para a IA)
    sugestao_ajuste_valor: Optional[float] = None

class StrategyContext(BaseModel):
    """
    Contexto Mestre para o Arquiteto de Estratégia.
    Agrega todas as análises de categorias e metadados do período.
    """
    periodo_analise: str # ex: "Média dos últimos 90 dias"
    
    # Lista de itens que apresentaram desvios relevantes ou sucessos notáveis.
    # Itens irrelevantes (desvio < 5%) podem ser filtrados antes para economizar tokens.
    itens_analisados: List[ItemAnaliseEstrategica] = Field(default_factory=list)
    
    # Flag para indicar se o sistema tem maturidade de dados suficiente
    possui_historico_suficiente: bool = True