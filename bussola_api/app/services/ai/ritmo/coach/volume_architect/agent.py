import logging
import json
from typing import List

from app.services.ai.base.llm_factory import llm_client
from app.services.ai.base.post_processor import PostProcessor
from app.services.ai.base.cache import ai_cache
from app.services.ai.base.base_schema import AtomicSuggestion

from app.services.ai.ritmo.coach.volume_architect.schema import VolumeArchitectContext
from app.services.ai.ritmo.coach.volume_architect.prompts import SYSTEM_PROMPT, USER_PROMPT_TEMPLATE

logger = logging.getLogger(__name__)

class VolumeArchitectAgent:
    DOMAIN = "coach"
    AGENT_NAME = "volume_architect"

    @classmethod
    async def run(cls, context: VolumeArchitectContext) -> List[AtomicSuggestion]:
        context_dict = context.model_dump()
        
        cached = await ai_cache.get(cls.DOMAIN, cls.AGENT_NAME, context_dict)
        if cached: return cached

        # Formata o dict de volume para string legível no prompt
        user_prompt = USER_PROMPT_TEMPLATE.format(
            nivel_usuario=context.nivel_usuario,
            objetivo=context.objetivo,
            volume_semanal=json.dumps(context.volume_semanal, indent=2, ensure_ascii=False)
        )

        try:
            raw_response = await llm_client.call_model(SYSTEM_PROMPT, user_prompt, temperature=0.2)
            
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