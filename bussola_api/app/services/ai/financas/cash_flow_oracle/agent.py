import logging
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any

from app.services.ai.base.llm_factory import llm_client
from app.services.ai.base.post_processor import PostProcessor
from app.services.ai.base.cache import ai_cache
from app.services.ai.base.base_schema import AtomicSuggestion

# Contextos
from app.services.ai.financas.context import FinancasContext
from app.services.ai.financas.cash_flow_oracle.schema import CashFlowContext, PontoCritico
from app.services.ai.financas.cash_flow_oracle.prompts import SYSTEM_PROMPT, USER_PROMPT_TEMPLATE

logger = logging.getLogger(__name__)

class CashFlowOracleAgent:
    """
    Agente Especialista: Projeção de Fluxo de Caixa e Liquidez.
    Responsabilidade: Simular o saldo futuro dia a dia e detectar quebras de caixa.
    """
    DOMAIN = "financas"
    AGENT_NAME = "cash_flow_oracle"

    @classmethod
    async def run(cls, global_context: FinancasContext) -> List[AtomicSuggestion]:
        # 1. Pré-Processamento Matemático (Simulação de Monte Carlo Simplificada)
        # Vamos projetar o saldo dia a dia baseado nas transações futuras
        
        simulation_result = cls._simulate_cash_flow(
            saldo_inicial=global_context.saldo_atual,
            transacoes_futuras=global_context.contas_a_pagar_receber
        )
        
        # 2. Montagem do Contexto do Agente
        agent_context = CashFlowContext(
            saldo_inicial=global_context.saldo_atual,
            data_inicio=global_context.data_atual,
            data_fim=global_context.data_fim_projecao, # ex: Hoje + 30 dias
            ponto_minimo=simulation_result['ponto_minimo'],
            saldo_final=simulation_result['saldo_final'],
            eventos_futuros=simulation_result['eventos_relevantes'], # Top eventos que impactam
            dias_no_vermelho=simulation_result['dias_vermelho']
        )
        
        context_dict = agent_context.model_dump()

        # 3. Cache Check
        cached_response = await ai_cache.get(cls.DOMAIN, cls.AGENT_NAME, context_dict)
        if cached_response:
            return cached_response

        # 4. Preparação do Prompt
        eventos_str = cls._format_future_events(context_dict["eventos_futuros"])

        user_prompt = USER_PROMPT_TEMPLATE.format(
            saldo_inicial=context_dict["saldo_inicial"],
            minimo_valor=context_dict["ponto_minimo"]["saldo_projetado"],
            minimo_data=context_dict["ponto_minimo"]["data"],
            minimo_motivo=context_dict["ponto_minimo"]["evento_gatilho"] or "Acúmulo de gastos",
            dias_vermelho=context_dict["dias_no_vermelho"],
            saldo_final=context_dict["saldo_final"],
            eventos_json=eventos_str
        )

        try:
            # 5. LLM Call
            raw_response = await llm_client.call_model(
                system_prompt=SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.1 # Mínima criatividade. Finanças é exato.
            )

            # 6. Post-Processing
            suggestions = PostProcessor.process_response(
                raw_data=raw_response,
                domain=cls.DOMAIN, 
                agent_source=cls.AGENT_NAME
            )

            # 7. Cache Save
            if suggestions:
                await ai_cache.set(cls.DOMAIN, cls.AGENT_NAME, context_dict, suggestions)

            return suggestions

        except Exception as e:
            logger.error(f"Falha no {cls.AGENT_NAME}: {e}")
            return []

    @staticmethod
    def _simulate_cash_flow(saldo_inicial: float, transacoes_futuras: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Simula o comportamento do saldo no tempo.
        Retorna estatísticas críticas (Mínimo, Final, Dias Negativos).
        """
        # Ordena cronologicamente
        sorted_tx = sorted(transacoes_futuras, key=lambda x: x.get('data', ''))
        
        saldo_corrente = saldo_inicial
        min_saldo = saldo_inicial
        min_date = "Hoje"
        min_trigger = None
        
        dias_vermelho = 0
        eventos_relevantes = [] # Top 10 eventos para o prompt
        
        for tx in sorted_tx:
            valor = float(tx.get('valor', 0))
            tipo = tx.get('tipo', 'despesa') # despesa ou receita
            
            # Atualiza Saldo
            if tipo == 'receita':
                saldo_corrente += valor
            else:
                saldo_corrente -= valor
            
            # Check de Mínimo
            if saldo_corrente < min_saldo:
                min_saldo = saldo_corrente
                min_date = tx.get('data')
                min_trigger = tx.get('descricao')
            
            # Check de Vermelho
            if saldo_corrente < 0:
                dias_vermelho += 1
                
            # Adiciona à lista de eventos (limitada)
            if len(eventos_relevantes) < 15:
                eventos_relevantes.append({
                    "data": tx.get('data'),
                    "descricao": tx.get('descricao'),
                    "valor": valor,
                    "tipo": tipo,
                    "saldo_pos_evento": round(saldo_corrente, 2)
                })

        return {
            "ponto_minimo": {
                "data": min_date,
                "saldo_projetado": round(min_saldo, 2),
                "evento_gatilho": min_trigger
            },
            "saldo_final": round(saldo_corrente, 2),
            "dias_vermelho": dias_vermelho,
            "eventos_relevantes": eventos_relevantes
        }

    @staticmethod
    def _format_future_events(items: List[Dict[str, Any]]) -> str:
        lines = []
        for item in items:
            sinal = "-" if item['tipo'] == 'despesa' else "+"
            lines.append(
                f"- [{item['data']}] {item['descricao']}: {sinal}R$ {item['valor']} "
                f"(Saldo Previsto: R$ {item['saldo_pos_evento']})"
            )
        return "\n".join(lines)