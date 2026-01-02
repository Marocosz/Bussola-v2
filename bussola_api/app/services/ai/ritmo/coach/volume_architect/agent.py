"""
=======================================================================================
ARQUIVO: agent.py (Agente VolumeArchitect)
=======================================================================================

OBJETIVO:
    Implementar o "Arquiteto de Volume".
    Este agente analisa a quantidade total de trabalho (Séries x Repetições).
    
    Sua função é equilibrar o volume semanal para garantir estímulo suficiente para 
    hipertrofia/força sem exceder a capacidade de recuperação (MRV - Maximum Recoverable Volume).

CAMADA:
    Services / AI / Ritmo / Coach (Backend).

RESPONSABILIDADES:
    1. Contagem de Séries: Verificar se o volume por grupo muscular está adequado (ex: 10-20 séries/semana).
    2. Periodização: Sugerir aumentos ou reduções de volume conforme o ciclo de treino.
    3. Balanceamento: Evitar negligência de grupos musculares (ex: muito peito, pouca costa).

INTEGRAÇÕES:
    - LLMFactory: Conhecimento sobre diretrizes de volume (Renaissance Periodization, etc).
    - VolumeArchitectContext: Dados agregados de volume semanal.
"""

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
    """
    Agente Especialista: Gestão de Volume Semanal (Séries por Grupo Muscular).
    """
    DOMAIN = "coach"
    AGENT_NAME = "volume_architect"

    @classmethod
    async def run(cls, context: VolumeArchitectContext) -> List[AtomicSuggestion]:
        """
        Analisa o volume de treino e sugere ajustes.
        """
        context_dict = context.model_dump()
        
        # 1. Verificação de Cache
        cached = await ai_cache.get(cls.DOMAIN, cls.AGENT_NAME, context_dict)
        if cached: return cached

        # 2. Formatação do Prompt
        # Serializa o dicionário de volume (ex: {"peito": 12, "costas": 10}) para JSON string
        user_prompt = USER_PROMPT_TEMPLATE.format(
            nivel_usuario=context.nivel_usuario,
            objetivo=context.objetivo,
            volume_semanal=json.dumps(context.volume_semanal, indent=2, ensure_ascii=False)
        )

        try:
            # 3. Chamada à LLM
            # Temperature 0.2: Volume é matemática e fisiologia. Baixa criatividade é preferível
            # para evitar sugestões de volume absurdas (ex: 50 séries de agachamento).
            raw_response = await llm_client.call_model(SYSTEM_PROMPT, user_prompt, temperature=0.2)
            
            # 4. Pós-processamento
            suggestions = PostProcessor.process_response(
                raw_data=raw_response,
                domain=cls.DOMAIN,
                agent_source=cls.AGENT_NAME
            )

            # 5. Cache
            if suggestions:
                await ai_cache.set(cls.DOMAIN, cls.AGENT_NAME, context_dict, suggestions)

            return suggestions
            
        except Exception as e:
            logger.error(f"Erro no {cls.AGENT_NAME}: {e}")
            return []