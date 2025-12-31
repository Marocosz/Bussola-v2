import logging
import json
from typing import List, Dict, Any

from app.services.ai.base.llm_factory import llm_client
from app.services.ai.base.post_processor import PostProcessor
from app.services.ai.base.cache import ai_cache
from app.services.ai.base.base_schema import AtomicSuggestion

from app.services.ai.roteiro.context import RoteiroContext
from app.services.ai.roteiro.travel_marshal.schema import TravelMarshalContext
from app.services.ai.roteiro.travel_marshal.prompts import SYSTEM_PROMPT, USER_PROMPT_TEMPLATE

logger = logging.getLogger(__name__)

class TravelMarshalAgent:
    DOMAIN = "roteiro"
    AGENT_NAME = "travel_marshal"

    @classmethod
    async def run(cls, global_context: RoteiroContext) -> List[AtomicSuggestion]:
        # 1. Filtro: Só nos interessa eventos com 'location' definido ou keywords de viagem
        keywords = ['voo', 'flight', 'embarque', 'aeroporto', 'viagem', 'check-in', 'hotel', 'estrada', 'rodoviaria']
        
        eventos_relevantes = []
        for item in global_context.agenda_itens:
            loc = item.get('location', '').lower()
            title = item.get('title', '').lower()
            
            # Se tem local definido (que não seja online) OU tem palavra chave
            if (loc and 'online' not in loc and 'zoom' not in loc) or any(k in title for k in keywords):
                eventos_relevantes.append(item)

        agent_context = TravelMarshalContext(
            data_inicio=global_context.data_inicio,
            data_fim=global_context.data_fim,
            eventos_com_deslocamento=eventos_relevantes
        )
        
        context_dict = agent_context.model_dump()
        
        if not context_dict["eventos_com_deslocamento"]:
            return []

        cached_response = await ai_cache.get(cls.DOMAIN, cls.AGENT_NAME, context_dict)
        if cached_response:
            return cached_response

        agenda_str = cls._format_travel_schedule(context_dict["eventos_com_deslocamento"])

        user_prompt = USER_PROMPT_TEMPLATE.format(
            data_inicio=context_dict["data_inicio"],
            data_fim=context_dict["data_fim"],
            agenda_json=agenda_str
        )

        try:
            raw_response = await llm_client.call_model(
                system_prompt=SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.1 # Baixa temperatura para cálculos precisos
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
    def _format_travel_schedule(items: List[Dict[str, Any]]) -> str:
        """
        Formata focando explicitamente em ORIGEM (implícita) e DESTINO.
        """
        sanitized = []
        sorted_items = sorted(items, key=lambda x: x.get('start_time', ''))
        
        for item in sorted_items:
            # Tenta destacar o local para o LLM
            loc = item.get('location', 'Local N/A')
            sanitized.append(
                f"- [{item.get('start_time')}] {item.get('title')} "
                f"| DESTINO: {loc} "
                f"| Detalhes: {item.get('description', '')[:50]}"
            )
        
        return "\n".join(sanitized)