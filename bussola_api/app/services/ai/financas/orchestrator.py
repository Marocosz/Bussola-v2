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
    Coordena a análise de Passado, Presente e Futuro Financeiro.
    Aplica filtros de prioridade para evitar sobrecarga cognitiva no usuário.
    """
    
    # Limite máximo de cards para exibir na UI
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
        """
        
        # 1. Montagem do Contexto Global
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

        # 2. Execução Paralela dos 4 Especialistas
        results = await asyncio.gather(
            SpendingDetectiveAgent.run(context),   # Passado (Anomalias)
            BudgetSentinelAgent.run(context),      # Presente (Pacing/Execução)
            CashFlowOracleAgent.run(context),      # Futuro Curto (Liquidez)
            StrategyArchitectAgent.run(context),   # Futuro Longo (Estratégia)
            return_exceptions=True
        )

        # 3. Consolidação Bruta
        all_suggestions: List[AtomicSuggestion] = []
        agents_map = ["SpendingDetective", "BudgetSentinel", "CashFlowOracle", "StrategyArchitect"]

        for i, result in enumerate(results):
            agent_name = agents_map[i]
            
            if isinstance(result, Exception):
                print(f"❌ [ERRO] {agent_name}: {result}")
                logger.error(f"[FinancasOrchestrator] Erro no agente {agent_name}: {result}")
                continue
                
            if result:
                all_suggestions.extend(result)
                # Log para debug (mostra tudo no terminal, mas filtra para o usuário)
                if len(result) > 0:
                    print(f"   -> {agent_name} gerou {len(result)} insights.")

        # 4. LÓGICA DE PRIORIZAÇÃO E CORTE (CFO Logic)
        
        # A. Deduplicação (Evitar insights repetidos sobre o mesmo alvo)
        unique_suggestions = []
        seen_keys = set()
        for s in all_suggestions:
            key = f"{s.agent_source}-{s.action.target}" # ex: spending_detective-Alimentação
            if key not in seen_keys:
                seen_keys.add(key)
                unique_suggestions.append(s)

        # B. Pesos de Severidade (Menor número = Maior prioridade)
        severity_weight = {
            "critical": 0,
            "high": 1, 
            "medium": 2, 
            "low": 3, 
            "none": 4
        }
        
        # C. Pesos de Agente (Quem tem preferência em caso de empate de severidade)
        # 1. Oracle (Risco de quebrar é o mais importante)
        # 2. Sentinel (Para de gastar AGORA)
        # 3. Detective (Olha o que você fez)
        # 4. Strategy (Planejamento futuro pode esperar)
        agent_weight = {
            "cash_flow_oracle": 0,
            "budget_sentinel": 1,
            "spending_detective": 2,
            "strategy_architect": 3
        }

        # D. Ordenação Multi-nível
        unique_suggestions.sort(key=lambda x: (
            severity_weight.get(x.severity, 99), # 1º Critério: Gravidade
            agent_weight.get(x.agent_source, 99) # 2º Critério: Urgência do Agente
        ))

        # E. Corte Final (Top N)
        final_suggestions = unique_suggestions[:FinancasOrchestrator.MAX_INSIGHTS_DISPLAY]

        # Log do resultado final
        print(f"\n[FinancasOrchestrator] ✂️ Filtro Aplicado: De {len(all_suggestions)} para {len(final_suggestions)} insights.")
        print(f"[FinancasOrchestrator] ✅ Análise Concluída.\n")
        
        return final_suggestions