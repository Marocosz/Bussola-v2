"""
=======================================================================================
ARQUIVO: orchestrator.py (Orquestrador Financeiro / CFO Digital)
=======================================================================================

OBJETIVO:
    Atuar como o coordenador central (Hub) da inteligência financeira.
    Este módulo não realiza análises diretas; ele gerencia a execução dos agentes especialistas,
    consolida seus resultados e aplica a lógica de priorização para entregar apenas
    os insights mais relevantes ao usuário.

CAMADA:
    Services / AI / Financas (Backend).
    Recebe dados do Controller (`ai.py`) e distribui para os Agentes.

RESPONSABILIDADES:
    1. Preparação de Contexto: Unificar dados brutos em um objeto `FinancasContext`.
    2. Concorrência: Executar múltiplos agentes (LLMs) em paralelo para reduzir latência.
    3. Resiliência: Garantir que a falha de um agente não derrube toda a análise.
    4. Curadoria (CFO Logic): Filtrar, desduplicar e priorizar os insights baseados em gravidade e urgência.

COMUNICAÇÃO:
    - Recebe de: `app.api.v1.endpoints.ai.py`
    - Comanda: `SpendingDetective`, `BudgetSentinel`, `CashFlowOracle`, `StrategyArchitect`
    - Retorna: Lista de `AtomicSuggestion` para o Frontend.
"""

import asyncio
import logging
import json
from typing import List, Dict, Any

# Imports dos Agentes Financeiros
from app.services.ai.financas.spending_detective.agent import SpendingDetectiveAgent
from app.services.ai.financas.cash_flow_oracle.agent import CashFlowOracleAgent
from app.services.ai.financas.strategy_architect.agent import StrategyArchitectAgent
from app.services.ai.financas.budget_sentinel.agent import BudgetSentinelAgent

# Contexto e Schema Base
from app.services.ai.financas.context import FinancasContext
from app.services.ai.base.base_schema import AtomicSuggestion

logger = logging.getLogger(__name__)

class FinancasOrchestrator:
    """
    CFO Digital (Chief Financial Officer).
    
    Responsável pela 'Curadoria de Informação'.
    Em vez de jogar 20 alertas na tela do usuário, este orquestrador seleciona
    os top-N insights mais críticos para evitar sobrecarga cognitiva.
    """
    
    # Limite máximo de cards (AtomicSuggestions) retornados ao frontend.
    # Regra de UX: Evitar rolagem infinita e focar na atenção do usuário.
    MAX_INSIGHTS_DISPLAY = 6 
    
    @staticmethod
    async def analyze_finances(
        data_atual: str,
        periodo_label: str,
        data_fim_projecao: str,
        saldo_atual: float,
        transacoes_mes: List[Dict[str, Any]],
        historico_medias: List[Dict[str, Any]],
        transacoes_futuras: List[Dict[str, Any]],
        metas_orcamento: List[Dict[str, Any]],
        metas_provisoes: List[Dict[str, Any]],
        media_sobra: float = 0.0
    ) -> List[AtomicSuggestion]:
        """
        Ponto de entrada principal para a inteligência financeira.
        
        Args:
            Todos os dados brutos necessários para análise (Saldo, Histórico, Metas, Transações).
            
        Returns:
            Uma lista curada e priorizada de sugestões prontas para exibição.
        """
        
        # ----------------------------------------------------------------------
        # 1. MONTAGEM DO CONTEXTO GLOBAL
        # ----------------------------------------------------------------------
        # Centraliza os dados em um objeto tipado (Pydantic) imutável durante a execução.
        # Todos os agentes leem deste mesmo objeto.
        context = FinancasContext(
            data_atual=data_atual,
            periodo_analise_label=periodo_label,
            data_fim_projecao=data_fim_projecao,
            saldo_atual=saldo_atual,
            transacoes_periodo=transacoes_mes,
            historico_medias=historico_medias,
            contas_a_pagar_receber=transacoes_futuras,
            metas_orcamentarias=metas_orcamento,
            metas_provisoes=metas_provisoes,
            media_sobra_mensal=media_sobra
        )
        
        print(f"\n[FinancasOrchestrator] 💰 Iniciando CFO Digital. Saldo: {saldo_atual} | Transações Mês: {len(transacoes_mes)}")

        # ----------------------------------------------------------------------
        # 2. EXECUÇÃO PARALELA (Asyncio)
        # ----------------------------------------------------------------------
        # Dispara os 4 agentes simultaneamente. Como cada agente faz chamadas de rede (LLM/Cache),
        # a execução sequencial seria lenta.
        # 'return_exceptions=True' garante que se um agente falhar, os outros continuam (Failover parcial).
        results = await asyncio.gather(
            SpendingDetectiveAgent.run(context),   # Passado (Anomalias)
            BudgetSentinelAgent.run(context),      # Presente (Pacing/Execução)
            CashFlowOracleAgent.run(context),      # Futuro Curto (Liquidez)
            StrategyArchitectAgent.run(context),   # Futuro Longo (Estratégia)
            return_exceptions=True
        )

        # ----------------------------------------------------------------------
        # 3. CONSOLIDAÇÃO E TRATAMENTO DE ERROS
        # ----------------------------------------------------------------------
        all_suggestions: List[AtomicSuggestion] = []
        agents_map = ["SpendingDetective", "BudgetSentinel", "CashFlowOracle", "StrategyArchitect"]

        for i, result in enumerate(results):
            agent_name = agents_map[i]
            
            # Tratamento de exceção por agente individual
            if isinstance(result, Exception):
                print(f"❌ [ERRO] {agent_name}: {result}")
                logger.error(f"[FinancasOrchestrator] Erro no agente {agent_name}: {result}")
                continue
                
            if result:
                all_suggestions.extend(result)
                # Log informativo para debug de volume de geração
                if len(result) > 0:
                    print(f"   -> {agent_name} gerou {len(result)} insights.")

        # ----------------------------------------------------------------------
        # 4. LÓGICA DE PRIORIZAÇÃO E CORTE (CFO Logic)
        # ----------------------------------------------------------------------
        # Aqui reside a inteligência de orquestração. Transformamos uma lista bruta
        # em um feed útil para o usuário.
        
        # A. Deduplicação
        # Evita que dois agentes falem sobre a mesma coisa (ex: Detective e Sentinel alertando sobre 'Mercado').
        unique_suggestions = []
        seen_keys = set()
        for s in all_suggestions:
            # Chave composta para unicidade: Fonte + Alvo da Ação
            key = f"{s.agent_source}-{s.action.target}"
            if key not in seen_keys:
                seen_keys.add(key)
                unique_suggestions.append(s)

        # B. Tabela de Pesos por Severidade (Regra de Negócio)
        # Critical aparece antes de High, que aparece antes de Medium.
        severity_weight = {
            "critical": 0,
            "high": 1, 
            "medium": 2, 
            "low": 3, 
            "none": 4
        }
        
        # C. Tabela de Pesos por Agente (Regra de Negócio)
        # Define a hierarquia de importância em caso de empate na severidade.
        # 1. Oracle: Risco de quebra de caixa é soberano.
        # 2. Sentinel: Parar sangria atual é urgente.
        # 3. Detective: Analisar erros passados.
        # 4. Strategy: Planejamento futuro pode esperar se a casa estiver pegando fogo.
        agent_weight = {
            "cash_flow_oracle": 0,
            "budget_sentinel": 1,
            "spending_detective": 2,
            "strategy_architect": 3
        }

        # D. Ordenação Multi-nível
        # Ordena a lista baseada nos dois critérios acima.
        unique_suggestions.sort(key=lambda x: (
            severity_weight.get(x.severity, 99), # 1º Critério: Gravidade
            agent_weight.get(x.agent_source, 99) # 2º Critério: Urgência do Agente
        ))

        # E. Corte Final (Truncation)
        # Limita o número de cards para respeitar a regra de UX.
        final_suggestions = unique_suggestions[:FinancasOrchestrator.MAX_INSIGHTS_DISPLAY]

        # Log final de auditoria
        print(f"\n[FinancasOrchestrator] ✂️ Filtro Aplicado: De {len(all_suggestions)} para {len(final_suggestions)} insights.")
        print(f"[FinancasOrchestrator] ✅ Análise Concluída.\n")
        
        return final_suggestions