"""
=======================================================================================
ARQUIVO: agent.py (Agente VarietyExpert)
=======================================================================================

OBJETIVO:
    Implementar o "Especialista em Variedade".
    Este agente foca na ADERÊNCIA e EXPERIÊNCIA do usuário.
    
    Sua missão é evitar a monotonia alimentar, sugerindo trocas inteligentes e 
    novos sabores, mantendo os macros alinhados.

CAMADA:
    Services / AI / Ritmo / Nutri (Backend).

RESPONSABILIDADES:
    1. Combate à Monotonia: Identificar repetição excessiva de alimentos (ex: frango todo dia).
    2. Sugestão de Substituições: Propor alimentos equivalentes nutricionalmente.
    3. Análise de Micronutrientes: (Indireta) Variedade de cores geralmente indica variedade de vitaminas.

INTEGRAÇÕES:
    - LLMFactory: Base de conhecimento culinário e nutricional.
    - VarietyExpertContext: Lista de alimentos da dieta.
"""

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

        # 1. Cache Check
        cached = await ai_cache.get(cls.DOMAIN, cls.AGENT_NAME, context_dict)
        if cached:
            return cached

        # 2. Formatação para Prompt
        # Enviamos apenas a lista de alimentos para a LLM analisar a diversidade.
        foods_str = json.dumps(context_dict['alimentos_dieta'], indent=2, ensure_ascii=False)
        
        user_prompt = USER_PROMPT_TEMPLATE.format(foods_json=foods_str)

        try:
            # 3. Chamada à LLM
            # Temperature 0.5: Maior criatividade permitida.
            # Queremos que a IA sugira combinações interessantes e alternativas culinárias,
            # fugindo do óbvio "troque arroz por batata".
            raw_response = await llm_client.call_model(
                system_prompt=SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.5 
            )

            # 4. Pós-Processamento
            suggestions = PostProcessor.process_response(
                raw_data=raw_response,
                domain=cls.DOMAIN,
                agent_source=cls.AGENT_NAME
            )

            # 5. Cache Save
            if suggestions:
                await ai_cache.set(cls.DOMAIN, cls.AGENT_NAME, context_dict, suggestions)

            return suggestions

        except Exception as e:
            logger.error(f"Erro no {cls.AGENT_NAME}: {e}")
            return []