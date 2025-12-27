import logging
import json
from typing import List

from app.services.ai.base.llm_factory import llm_client
from app.services.ai.base.post_processor import PostProcessor
from app.services.ai.base.cache import ai_cache
from app.services.ai.base.base_schema import AtomicSuggestion

from app.services.ai.ritmo.nutri.meal_detective.schema import MealDetectiveContext
from app.services.ai.ritmo.nutri.meal_detective.prompts import SYSTEM_PROMPT, USER_PROMPT_TEMPLATE

logger = logging.getLogger(__name__)

class MealDetectiveAgent:
    """
    Agente Especialista: Análise de Composição de Refeições (Crononutrição).
    """
    DOMAIN = "nutri"
    AGENT_NAME = "meal_detective"

    @classmethod
    async def run(cls, context: MealDetectiveContext) -> List[AtomicSuggestion]:
        # 1. Serialização para Dict (Cache e Prompt)
        # O model_dump do Pydantic v2 já trata listas recursivamente
        context_dict = context.model_dump()

        # 2. Check Cache
        cached = await ai_cache.get(cls.DOMAIN, cls.AGENT_NAME, context_dict)
        if cached:
            return cached

        # 3. Preparar Prompt
        # Convertemos a lista de refeições para uma string JSON formatada para o LLM ler fácil
        refeicoes_str = json.dumps(context_dict['refeicoes'], indent=2, ensure_ascii=False)
        
        user_prompt = USER_PROMPT_TEMPLATE.format(
            objetivo_usuario=context.objetivo_usuario,
            refeicoes_json=refeicoes_str
        )

        try:
            # 4. LLM Call
            raw_response = await llm_client.call_model(
                system_prompt=SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.3 # Um pouco mais criativo que o auditor, mas ainda controlado
            )

            # 5. Validação e Limpeza
            suggestions = PostProcessor.process_response(
                raw_data=raw_response,
                domain=cls.DOMAIN,
                agent_source=cls.AGENT_NAME
            )

            # 6. Cache
            if suggestions:
                await ai_cache.set(cls.DOMAIN, cls.AGENT_NAME, context_dict, suggestions)

            return suggestions

        except Exception as e:
            logger.error(f"Erro no {cls.AGENT_NAME}: {e}")
            return []