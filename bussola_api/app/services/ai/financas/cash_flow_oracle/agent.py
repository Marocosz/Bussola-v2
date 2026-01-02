"""
=======================================================================================
ARQUIVO: agent.py (Agente CashFlowOracle)
=======================================================================================

OBJETIVO:
    Implementar o "Oráculo de Fluxo de Caixa".
    Este agente é responsável pela análise PREDITIVA de curto prazo (30 dias).
    Ele responde à pergunta: "Vou ter dinheiro para pagar as contas nas próximas semanas?"

CAMADA:
    Services / AI / Financas (Backend).
    É invocado pelo `FinancasOrchestrator` para compor a visão de futuro.

RESPONSABILIDADES:
    1. Simulação Matemática: Calcular o saldo dia a dia (Running Balance) antes de chamar a IA.
    2. Detecção de Quebra de Caixa: Identificar o momento exato onde o saldo fica negativo.
    3. Análise de Liquidez: Alertar sobre excesso de caixa parado ou falta iminente.
    4. Preparação de Contexto: Resumir centenas de transações futuras em eventos-chave para a LLM.

INTEGRAÇÕES:
    - LLMFactory: Para interpretar o cenário matemático e gerar conselhos.
    - AgentCache: Para evitar recalcular projeções se os dados não mudaram.
    - FinancasContext: Fonte de dados (Saldo Atual e Contas a Pagar/Receber).
"""

import logging
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any

from app.services.ai.base.llm_factory import llm_client
from app.services.ai.base.post_processor import PostProcessor
from app.services.ai.base.cache import ai_cache
from app.services.ai.base.base_schema import AtomicSuggestion

# Contextos e Schemas do Domínio Financeiro
from app.services.ai.financas.context import FinancasContext
from app.services.ai.financas.cash_flow_oracle.schema import CashFlowContext, PontoCritico
from app.services.ai.financas.cash_flow_oracle.prompts import SYSTEM_PROMPT, USER_PROMPT_TEMPLATE

logger = logging.getLogger(__name__)

class CashFlowOracleAgent:
    """
    Agente Especialista: Projeção de Fluxo de Caixa e Liquidez.
    
    Lógica Principal:
    Diferente de outros agentes que analisam padrões, este agente é determinístico na
    fase de cálculo (Matemática pura) e consultivo na fase de geração (IA).
    """
    DOMAIN = "financas"
    AGENT_NAME = "cash_flow_oracle"

    @classmethod
    async def run(cls, global_context: FinancasContext) -> List[AtomicSuggestion]:
        """
        Executa a projeção de caixa.
        
        Args:
            global_context: Contém saldo atual e lista de contas a pagar/receber futuras.
            
        Returns:
            Lista de sugestões (Alertas de saldo negativo, sugestões de investimento, etc).
        """
        
        # ----------------------------------------------------------------------
        # 1. PRÉ-PROCESSAMENTO MATEMÁTICO (Simulação Determinística)
        # ----------------------------------------------------------------------
        # Por que fazemos isso aqui e não na LLM?
        # LLMs são ruins de aritmética sequencial. Calcular o saldo dia a dia
        # via Python garante 100% de precisão no "Ponto de Quebra".
        simulation_result = cls._simulate_cash_flow(
            saldo_inicial=global_context.saldo_atual,
            transacoes_futuras=global_context.contas_a_pagar_receber
        )
        
        # ----------------------------------------------------------------------
        # 2. MONTAGEM DO CONTEXTO DE IA
        # ----------------------------------------------------------------------
        # O contexto resume a simulação para reduzir o consumo de tokens.
        # Em vez de enviar todas as transações, enviamos: "Vai faltar R$ X no dia Y".
        agent_context = CashFlowContext(
            saldo_inicial=global_context.saldo_atual,
            data_inicio=global_context.data_atual,
            data_fim=global_context.data_fim_projecao, # Janela de análise (ex: 30 dias)
            ponto_minimo=simulation_result['ponto_minimo'],
            saldo_final=simulation_result['saldo_final'],
            eventos_futuros=simulation_result['eventos_relevantes'], # Apenas os mais impactantes
            dias_no_vermelho=simulation_result['dias_vermelho']
        )
        
        context_dict = agent_context.model_dump()

        # ----------------------------------------------------------------------
        # 3. CACHE CHECK
        # ----------------------------------------------------------------------
        # Se os dados de entrada (saldo e contas) não mudaram, retornamos a análise anterior.
        cached_response = await ai_cache.get(cls.DOMAIN, cls.AGENT_NAME, context_dict)
        if cached_response:
            return cached_response

        # 4. Formatação do Prompt
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
            # Temperatura baixa (0.1) é crucial aqui. Não queremos "criatividade"
            # sobre números, queremos análise de risco precisa.
            raw_response = await llm_client.call_model(
                system_prompt=SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.1 
            )

            # 6. Post-Processing (Validação e Limpeza)
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
        Engine de Simulação Financeira (Simplificada).
        Percorre a linha do tempo futura para encontrar o saldo projetado em cada evento.
        
        Lógica:
        1. Ordena transações por data.
        2. Aplica transação ao saldo corrente.
        3. Registra se houve quebra de mínimo histórico ou saldo negativo.
        """
        # Regra de Negócio: A ordem cronológica é obrigatória para calcular
        # o saldo corrente (running balance) corretamente.
        sorted_tx = sorted(transacoes_futuras, key=lambda x: x.get('data', ''))
        
        saldo_corrente = saldo_inicial
        
        # Rastreamento de Piores Cenários
        min_saldo = saldo_inicial
        min_date = "Hoje"
        min_trigger = None
        
        dias_vermelho = 0
        eventos_relevantes = [] 
        
        for tx in sorted_tx:
            valor = float(tx.get('valor', 0))
            tipo = tx.get('tipo', 'despesa') 
            
            # Atualiza Saldo Corrente
            if tipo == 'receita':
                saldo_corrente += valor
            else:
                saldo_corrente -= valor
            
            # Detecção de Ponto Crítico (Menor saldo do período)
            if saldo_corrente < min_saldo:
                min_saldo = saldo_corrente
                min_date = tx.get('data')
                min_trigger = tx.get('descricao')
            
            # Detecção de Risco (Overdraft)
            if saldo_corrente < 0:
                dias_vermelho += 1
                
            # Seleção de Eventos para o Prompt
            # Limitamos a 15 eventos para não estourar a janela de contexto da LLM,
            # mantendo os dados sequenciais para a IA entender a evolução.
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
        """
        Formata a lista de eventos em texto legível para o Prompt do Sistema.
        Inclui o 'Saldo Previsto' para que a IA veja a tendência de queda/subida.
        """
        lines = []
        for item in items:
            sinal = "-" if item['tipo'] == 'despesa' else "+"
            lines.append(
                f"- [{item['data']}] {item['descricao']}: {sinal}R$ {item['valor']} "
                f"(Saldo Previsto: R$ {item['saldo_pos_evento']})"
            )
        return "\n".join(lines)