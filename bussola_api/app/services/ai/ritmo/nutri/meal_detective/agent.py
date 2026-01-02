"""
=======================================================================================
ARQUIVO: agent.py (Agente MealDetective)
=======================================================================================

OBJETIVO:
    Implementar o "Detetive de Refeições".
    Este agente foca na QUALIDADE e no TIMING (Crononutrição).
    
    Diferente do Auditor (que olha totais do dia), este olha para CADA REFEIÇÃO individualmente.
    Responde perguntas como: "Essa refeição tem proteína suficiente?" ou "Falta fibra no almoço?".

CAMADA:
    Services / AI / Ritmo / Nutri (Backend).

RESPONSABILIDADES:
    1. Análise de Composição: Verificar equilíbrio de macronutrientes por prato.
    2. Timing: Analisar pré e pós-treino (se houver dados de horário).
    3. Qualidade Nutricional: Alertar sobre refeições pobres em nutrientes ou excesso de processados.

INTEGRAÇÕES:
    - LLMFactory: Conhecimento nutricional geral.
    - MealDetectiveContext: Lista detalhada de refeições e alimentos.
"""

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
        """
        Analisa a estrutura das refeições individuais.
        """
        # 1. Serialização
        # O model_dump recursive garante que listas de alimentos dentro de refeições sejam convertidas.
        context_dict = context.model_dump()

        # 2. Cache Check
        cached = await ai_cache.get(cls.DOMAIN, cls.AGENT_NAME, context_dict)
        if cached:
            return cached

        # 3. Formatação para Prompt
        # Serializamos a lista de refeições para JSON String.
        # Isso facilita para a LLM entender a hierarquia Refeição -> Alimentos -> Macros.
        refeicoes_str = json.dumps(context_dict['refeicoes'], indent=2, ensure_ascii=False)
        
        user_prompt = USER_PROMPT_TEMPLATE.format(
            objetivo_usuario=context.objetivo_usuario,
            refeicoes_json=refeicoes_str
        )

        try:
            # 4. Chamada à LLM
            # Temperature 0.3: Um pouco mais "solto" que o auditor matemático,
            # permitindo inferências sobre qualidade alimentar, mas ainda focado em análise técnica.
            raw_response = await llm_client.call_model(
                system_prompt=SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.3 
            )

            # 5. Validação
            suggestions = PostProcessor.process_response(
                raw_data=raw_response,
                domain=cls.DOMAIN,
                agent_source=cls.AGENT_NAME
            )

            # 6. Cache Save
            if suggestions:
                await ai_cache.set(cls.DOMAIN, cls.AGENT_NAME, context_dict, suggestions)

            return suggestions

        except Exception as e:
            logger.error(f"Erro no {cls.AGENT_NAME}: {e}")
            return []