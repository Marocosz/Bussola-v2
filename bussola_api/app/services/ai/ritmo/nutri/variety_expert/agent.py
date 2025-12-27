import logging
import json
from typing import List

from app.services.ai.base.llm_factory import llm_client
from app.services.ai.base.post_processor import PostProcessor
from app.services.ai.base.cache import ai_cache
from app.services.ai.base.base_schema import AtomicSuggestion

from app.services.ai.ritmo.nutri.variety_expert.schema import VarietyExpertContext
from app.services.ai.ritmo.nutri.variety_expert.prompts import SYSTEM_PROMPT, USER_PROMPT_TEMPLATE

logger = logging.getLogger(__name__)

class VarietyExpertAgent:
    """
    Agente Especialista: Sugestões de Variedade e Substituições.
    """
    DOMAIN = "nutri"
    AGENT_NAME = "variety_expert"

    @classmethod
    async def run(cls, context: VarietyExpertContext) -> List[AtomicSuggestion]:
        context_dict = context.model_dump()

        # Cache check
        cached = await ai_cache.get(cls.DOMAIN, cls.AGENT_NAME, context_dict)
        if cached:
            return cached

        # Serializa lista de alimentos para string bonita
        foods_str = json.dumps(context_dict['alimentos_dieta'], indent=2, ensure_ascii=False)
        
        user_prompt = USER_PROMPT_TEMPLATE.format(foods_json=foods_str)

        try:
            # Temperatura maior (0.5) para permitir mais criatividade nas sugestões
            raw_response = await llm_client.call_model(
                system_prompt=SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.5 
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
            logger.error(f"Erro no {cls.AGENT_NAME}: {e}")
            return []