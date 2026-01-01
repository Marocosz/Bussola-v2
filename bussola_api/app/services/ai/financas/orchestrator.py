import asyncio
import logging
import json
from typing import List, Dict, Any

# Imports dos Agentes Financeiros
from app.services.ai.financas.spending_detective.agent import SpendingDetectiveAgent
from app.services.ai.financas.cash_flow_oracle.agent import CashFlowOracleAgent
from app.services.ai.financas.provisions_architect.agent import ProvisionsArchitectAgent
from app.services.ai.financas.budget_sentinel.agent import BudgetSentinelAgent

# Contexto e Schema Base
from app.services.ai.financas.context import FinancasContext
from app.services.ai.base.base_schema import AtomicSuggestion

logger = logging.getLogger(__name__)

class FinancasOrchestrator:
    """
    CFO Digital (Chief Financial Officer).
    Coordena a análise de Passado, Presente e Futuro Financeiro.
    """
    
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
            SpendingDetectiveAgent.run(context),   # Passado (Auditoria)
            BudgetSentinelAgent.run(context),      # Presente (Execução Tática)
            CashFlowOracleAgent.run(context),      # Futuro Curto (Liquidez)
            ProvisionsArchitectAgent.run(context), # Futuro Longo (Estratégia)
            return_exceptions=True
        )

        # 3. Consolidação e Limpeza
        raw_suggestions: List[AtomicSuggestion] = []
        
        agents_map = ["SpendingDetective", "BudgetSentinel", "CashFlowOracle", "ProvisionsArchitect"]

        for i, result in enumerate(results):
            agent_name = agents_map[i]
            
            if isinstance(result, Exception):
                print(f"❌ [ERRO] {agent_name}: {result}")
                logger.error(f"[FinancasOrchestrator] Erro no agente {agent_name}: {result}")
                continue
                
            if result:
                raw_suggestions.extend(result)
                
                # --- LOG DETALHADO NO TERMINAL ---
                if len(result) > 0:
                    print(f"\n{'='*20} 🏦 {agent_name.upper()} ({len(result)}) {'='*20}")
                    for suggestion in result:
                        print(json.dumps(suggestion.model_dump(), indent=2, ensure_ascii=False))
                    print(f"{'='*60}\n")
                else:
                    print(f"⚪ {agent_name}: Tudo nos conformes.")

        # 4. Pós-Processamento e Priorização (CFO Logic)
        final_suggestions = []
        seen_keys = set()
        
        # Ordem de prioridade na tela: 
        # 1. Perigo Imediato (Oracle - Cheque Especial)
        # 2. Desvio de Execução (Sentinel - Gastando muito rápido)
        # 3. Anomalia Passada (Detective - Roubo/Erro)
        # 4. Estratégia (Architect - Planejamento)
        
        # Mapeamento de severidade para sort
        severity_order = {"high": 0, "medium": 1, "low": 2, "none": 3}

        for suggestion in raw_suggestions:
            # Deduplicação
            key = f"{suggestion.title}-{suggestion.action.target}"
            if key in seen_keys:
                continue
            
            # Regra de Conflito: Se o Oracle diz "Vai faltar dinheiro" (Danger), 
            # não precisamos que o Architect diga "Invista seu dinheiro" (Opportunity).
            # (Poderíamos implementar essa lógica complexa aqui, mas por hora vamos manter simples)
            
            seen_keys.add(key)
            final_suggestions.append(suggestion)

        # Ordenação Final
        final_suggestions.sort(key=lambda x: severity_order.get(x.severity, 99))

        print(f"[FinancasOrchestrator] ✅ Análise Financeira Concluída. Insights: {len(final_suggestions)}\n")
        
        return final_suggestions