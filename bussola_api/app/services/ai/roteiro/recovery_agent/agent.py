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
    DOMAIN = "roteiro"
    AGENT_NAME = "recovery_agent"

    @classmethod
    async def run(cls, global_context: RoteiroContext) -> List[AtomicSuggestion]:
        # 1. Filtra pendências (data < hoje)
        pendencias = [
            t for t in global_context.agenda_itens 
            if t.get('status') != 'concluido' 
            and t.get('start_time', '') < global_context.data_atual
        ]
        
        # 2. Filtra futuro (data >= hoje)
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
        
        if not context_dict["tarefas_atrasadas"]:
            return []

        cached_response = await ai_cache.get(cls.DOMAIN, cls.AGENT_NAME, context_dict)
        if cached_response:
            return cached_response

        # Passamos a data atual para o formatador calcular o "delta" (dias de atraso)
        backlog_str = cls._format_backlog(context_dict["tarefas_atrasadas"], context_dict["data_atual"])
        agenda_str = cls._format_future_slots(context_dict["agenda_futura"])

        user_prompt = USER_PROMPT_TEMPLATE.format(
            data_atual=context_dict["data_atual"],
            backlog_json=backlog_str,
            agenda_futura_json=agenda_str
        )

        try:
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

            if suggestions:
                await ai_cache.set(cls.DOMAIN, cls.AGENT_NAME, context_dict, suggestions)

            return suggestions

        except Exception as e:
            logger.error(f"Falha no {cls.AGENT_NAME}: {e}")
            return []

    @staticmethod
    def _format_backlog(items: List[Dict[str, Any]], data_ref_str: str) -> str:
        """
        Formata pendências calculando a 'idade' do atraso para ajudar a IA 
        a decidir se é esquecimento de registro ou atraso real.
        """
        sanitized = []
        try:
            # Tenta converter string ISO ou YYYY-MM-DD para objeto date
            # Adapte o formato conforme seu DB real
            data_ref = datetime.fromisoformat(data_ref_str.split('T')[0] if 'T' in data_ref_str else data_ref_str).date()
        except:
            data_ref = None

        for item in items:
            start_str = item.get('start_time', '')
            dias_atraso = "Desconhecido"
            
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
        # Mesma lógica anterior, apenas listando ocupação futura
        sanitized = []
        sorted_items = sorted(items, key=lambda x: x.get('start_time', ''))
        for item in sorted_items[:30]: 
            sanitized.append(f"- {item.get('start_time')} até {item.get('end_time')}: {item.get('title')}")
        return "\n".join(sanitized) if sanitized else "Agenda livre."