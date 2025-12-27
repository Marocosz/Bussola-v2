import logging
from typing import List

from app.services.ai.base.llm_factory import llm_client
from app.services.ai.base.post_processor import PostProcessor
from app.services.ai.base.cache import ai_cache
from app.services.ai.base.base_schema import AtomicSuggestion

from app.services.ai.ritmo.coach.intensity_strategist.schema import IntensityStrategistContext
from app.services.ai.ritmo.coach.intensity_strategist.prompts import SYSTEM_PROMPT, USER_PROMPT_TEMPLATE

logger = logging.getLogger(__name__)

class IntensityStrategistAgent:
    DOMAIN = "coach"
    AGENT_NAME = "intensity_strategist"

    @classmethod
    async def run(cls, context: IntensityStrategistContext) -> List[AtomicSuggestion]:
        context_dict = context.model_dump()
        cached = await ai_cache.get(cls.DOMAIN, cls.AGENT_NAME, context_dict)
        if cached: return cached

        user_prompt = USER_PROMPT_TEMPLATE.format(**context_dict)

        try:
            raw_response = await llm_client.call_model(SYSTEM_PROMPT, user_prompt, temperature=0.5)
            suggestions = PostProcessor.process_response(raw_response, cls.DOMAIN, cls.AGENT_NAME)
            if suggestions: await ai_cache.set(cls.DOMAIN, cls.AGENT_NAME, context_dict, suggestions)
            return suggestions
        except Exception as e:
            logger.error(f"Erro no {cls.AGENT_NAME}: {e}")
            return []