import logging
import json
from typing import List

from app.services.ai.base.llm_factory import llm_client
from app.services.ai.base.post_processor import PostProcessor
from app.services.ai.base.cache import ai_cache
from app.services.ai.base.base_schema import AtomicSuggestion

from app.services.ai.ritmo.coach.technique_master.schema import TechniqueMasterContext
from app.services.ai.ritmo.coach.technique_master.prompts import SYSTEM_PROMPT, USER_PROMPT_TEMPLATE

logger = logging.getLogger(__name__)

class TechniqueMasterAgent:
    DOMAIN = "coach"
    AGENT_NAME = "technique_master"

    @classmethod
    async def run(cls, context: TechniqueMasterContext) -> List[AtomicSuggestion]:
        context_dict = context.model_dump()
        
        cached = await ai_cache.get(cls.DOMAIN, cls.AGENT_NAME, context_dict)
        if cached: return cached

        exercises_str = json.dumps(context_dict['exercicios_chave'], indent=2, ensure_ascii=False)
        user_prompt = USER_PROMPT_TEMPLATE.format(exercicios_json=exercises_str)

        try:
            raw_response = await llm_client.call_model(SYSTEM_PROMPT, user_prompt, temperature=0.3)
            
            suggestions = PostProcessor.process_response(raw_response, cls.DOMAIN, cls.AGENT_NAME)

            if suggestions:
                await ai_cache.set(cls.DOMAIN, cls.AGENT_NAME, context_dict, suggestions)

            return suggestions
        except Exception as e:
            logger.error(f"Erro no {cls.AGENT_NAME}: {e}")
            return []