from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class FinancasContext(BaseModel):
    """
    Contexto Mestre do domínio 'Finanças'.
    Agrega Passado (Médias), Presente (Transações do Mês) e Futuro (Provisões).
    """
    # --- Dados Temporais e Caixa ---
    data_atual: str # YYYY-MM-DD
    periodo_analise_label: str # ex: "Janeiro 2026"
    data_fim_projecao: str # ex: Data daqui a 30 dias
    saldo_atual: float
    
    # --- O AGORA (Execução do Mês) ---
    # Usado pelo BudgetSentinel (Burn Rate) e SpendingDetective (Análise Específica)
    transacoes_periodo: List[Dict[str, Any]] = Field(default_factory=list)
    
    # --- O PASSADO (Baseline / 90 dias) ---
    # Lista de dicts: {'categoria': 'Alimentação', 'valor_media': 450.00}
    # Calculado previamente com base nos últimos 3 meses
    historico_medias: List[Dict[str, Any]] = Field(default_factory=list)
    
    # --- O FUTURO CURTO (Fluxo de Caixa) ---
    # Contas a pagar e receber confirmadas nos próximos dias
    contas_a_pagar_receber: List[Dict[str, Any]] = Field(default_factory=list)
    
    # --- O FUTURO LONGO & METAS ---
    # Limites definidos pelo usuário (ex: Lazer = 500)
    metas_orcamentarias: List[Dict[str, Any]] = Field(default_factory=list)
    
    # Objetivos de poupança (ex: Viagem, IPVA)
    metas_provisoes: List[Dict[str, Any]] = Field(default_factory=list)
    
    # --- Indicadores Gerais ---
    media_sobra_mensal: float = 0.0 # Capacidade de poupança histórica