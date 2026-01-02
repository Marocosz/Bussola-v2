"""
=======================================================================================
ARQUIVO: agent.py (Agente RecoveryAgent)
=======================================================================================

OBJETIVO:
    Implementar o "Agente de Recuperação" para o domínio de ROTEIRO (Agenda).
    Este agente atua como um gerenciador de crises de backlog.
    
    Sua missão é identificar compromissos ou tarefas que ficaram para trás (atrasados)
    e sugerir estratégias de reagendamento baseadas nos "espaços em branco" do futuro.

CAMADA:
    Services / AI / Roteiro (Backend).
    É invocado pelo `RoteiroOrchestrator` durante a análise de agenda.

RESPONSABILIDADES:
    1. Segregação Temporal: Separar o que é dívida técnica (atrasos) do que é capacidade produtiva (futuro).
    2. Análise de Atraso: Calcular a "idade" do atraso para diferenciar esquecimento de procrastinação.
    3. Reagendamento Inteligente: Propor novos horários viáveis para encaixar as pendências.
    4. Engenharia de Prompt: Contextualizar a IA com o backlog e a disponibilidade futura.

INTEGRAÇÕES:
    - LLMFactory: Para gerar o plano de recuperação.
    - AgentCache: Para evitar reprocessamento.
    - RoteiroContext: Fonte de dados (Lista de Compromissos).
"""

import logging
import json
from datetime import datetime
from typing import List, Dict, Any

from app.services.ai.base.llm_factory import llm_client
from app.services.ai.base.post_processor import PostProcessor
from app.services.ai.base.cache import ai_cache
from app.services.ai.base.base_schema import AtomicSuggestion

from app.services.ai.roteiro.context import RoteiroContext
from app.services.ai.roteiro.recovery_agent.schema import RecoveryAgentContext
from app.services.ai.roteiro.recovery_agent.prompts import SYSTEM_PROMPT, USER_PROMPT_TEMPLATE

logger = logging.getLogger(__name__)

class RecoveryAgent:
    """
    Agente Especialista: Gestão de Atrasos e Reagendamento.
    
    Lógica Principal:
    Não basta dizer "você está atrasado". O agente deve olhar para a agenda futura
    e dizer "Encaixe essa tarefa atrasada na terça-feira às 14h, que está livre".
    """
    DOMAIN = "roteiro"
    AGENT_NAME = "recovery_agent"

    @classmethod
    async def run(cls, global_context: RoteiroContext) -> List[AtomicSuggestion]:
        """
        Executa a análise de recuperação de agenda.

        Args:
            global_context: Contém a lista completa de itens da agenda.

        Returns:
            Lista de sugestões de reagendamento ou arquivamento de pendências.
        """
        
        # ----------------------------------------------------------------------
        # 1. SEGREGAÇÃO TEMPORAL (Passado vs Futuro)
        # ----------------------------------------------------------------------
        # O agente precisa de duas visões distintas:
        # A. O Problema (Pendências): Itens não concluídos com data anterior a hoje.
        # B. A Solução (Futuro): Itens a partir de hoje (para ver onde há espaço livre).
        
        pendencias = [
            t for t in global_context.agenda_itens 
            if t.get('status') != 'concluido' 
            and t.get('start_time', '') < global_context.data_atual
        ]
        
        futuro = [
            t for t in global_context.agenda_itens 
            if t.get('start_time', '') >= global_context.data_atual
        ]

        agent_context = RecoveryAgentContext(
            data_atual=global_context.data_atual,
            tarefas_atrasadas=pendencias,
            agenda_futura=futuro
        )
        
        context_dict = agent_context.model_dump()
        
        # Otimização: Se não há nada atrasado, o agente de recuperação é inútil.
        # Retorna vazio para economizar tokens e tempo de execução.
        if not context_dict["tarefas_atrasadas"]:
            return []

        # ----------------------------------------------------------------------
        # 2. VERIFICAÇÃO DE CACHE
        # ----------------------------------------------------------------------
        cached_response = await ai_cache.get(cls.DOMAIN, cls.AGENT_NAME, context_dict)
        if cached_response:
            return cached_response

        # ----------------------------------------------------------------------
        # 3. PREPARAÇÃO DO PROMPT
        # ----------------------------------------------------------------------
        # Formatamos o backlog calculando explicitamente os "dias de atraso".
        # Formatamos o futuro listando os slots ocupados (para a IA inferir os livres).
        backlog_str = cls._format_backlog(context_dict["tarefas_atrasadas"], context_dict["data_atual"])
        agenda_str = cls._format_future_slots(context_dict["agenda_futura"])

        user_prompt = USER_PROMPT_TEMPLATE.format(
            data_atual=context_dict["data_atual"],
            backlog_json=backlog_str,
            agenda_futura_json=agenda_str
        )

        try:
            # ------------------------------------------------------------------
            # 4. CHAMADA LLM E PÓS-PROCESSAMENTO
            # ------------------------------------------------------------------
            # Temperature 0.2:
            # O reagendamento requer lógica (encaixar horários), mas permite uma leve
            # flexibilidade para sugerir priorizações.
            raw_response = await llm_client.call_model(
                system_prompt=SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.2 
            )

            suggestions = PostProcessor.process_response(
                raw_data=raw_response,
                domain=cls.DOMAIN, 
                agent_source=cls.AGENT_NAME
            )

            # Salva no Redis se houver sucesso
            if suggestions:
                await ai_cache.set(cls.DOMAIN, cls.AGENT_NAME, context_dict, suggestions)

            return suggestions

        except Exception as e:
            logger.error(f"Falha no {cls.AGENT_NAME}: {e}")
            return []

    @staticmethod
    def _format_backlog(items: List[Dict[str, Any]], data_ref_str: str) -> str:
        """
        Formata as pendências calculando a 'idade' do atraso.
        
        OBJETIVO:
        Ajudar a IA a distinguir a gravidade:
        - Atraso de 1 dia: Provável esquecimento de dar "check".
        - Atraso de 30 dias: Procrastinação crônica ou tarefa zumbi.
        """
        sanitized = []
        try:
            # Parsing robusto da data de referência (Hoje)
            # Tenta ISO format ou YYYY-MM-DD simples
            data_ref = datetime.fromisoformat(data_ref_str.split('T')[0] if 'T' in data_ref_str else data_ref_str).date()
        except:
            data_ref = None

        for item in items:
            start_str = item.get('start_time', '')
            dias_atraso = "Desconhecido"
            
            # Cálculo do Delta (Dias de Atraso)
            if data_ref and start_str:
                try:
                    item_date = datetime.fromisoformat(start_str.split('T')[0] if 'T' in start_str else start_str[:10]).date()
                    delta = (data_ref - item_date).days
                    dias_atraso = f"{delta} dias"
                except:
                    pass

            sanitized.append(
                f"- [ATRASO: {dias_atraso}] Tarefa: {item.get('title')} "
                f"| Prioridade: {item.get('priority', 'normal')} "
                f"| Vencimento Original: {start_str}"
            )
        
        return "\n".join(sanitized) if sanitized else "Nenhuma pendência."

    @staticmethod
    def _format_future_slots(items: List[Dict[str, Any]]) -> str:
        """
        Lista a ocupação futura para que a IA possa encontrar "buracos" livres.
        Limita a 30 itens para não estourar o contexto da LLM, focando no futuro próximo.
        """
        sanitized = []
        # Ordenação cronológica é essencial para visualização da disponibilidade
        sorted_items = sorted(items, key=lambda x: x.get('start_time', ''))
        
        for item in sorted_items[:30]: 
            sanitized.append(f"- {item.get('start_time')} até {item.get('end_time')}: {item.get('title')}")
            
        return "\n".join(sanitized) if sanitized else "Agenda livre."