"""
=======================================================================================
ARQUIVO: agent.py (Agente TechniqueMaster)
=======================================================================================

OBJETIVO:
    Implementar o "Mestre da Técnica".
    Este agente foca na execução e biomecânica dos exercícios.
    
    Ele oferece dicas de postura, correções de movimento e cues (dicas verbais) 
    para exercícios complexos (Agachamento, Terra, Supino).

CAMADA:
    Services / AI / Ritmo / Coach (Backend).

RESPONSABILIDADES:
    1. Análise de Exercícios: Identificar exercícios compostos que exigem técnica apurada.
    2. Prevenção de Lesão: Alertar sobre erros comuns baseados no feedback do usuário.
    3. Otimização de Movimento: Dicas para melhorar a conexão mente-músculo.

INTEGRAÇÕES:
    - LLMFactory: Base de conhecimento biomecânico.
    - TechniqueMasterContext: Lista de exercícios realizados.
"""

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
    """
    Agente Especialista: Biomecânica e Execução de Exercícios.
    """
    DOMAIN = "coach"
    AGENT_NAME = "technique_master"

    @classmethod
    async def run(cls, context: TechniqueMasterContext) -> List[AtomicSuggestion]:
        """
        Gera dicas técnicas para os exercícios listados.
        """
        context_dict = context.model_dump()
        
        # 1. Verificação de Cache
        cached = await ai_cache.get(cls.DOMAIN, cls.AGENT_NAME, context_dict)
        if cached: return cached

        # 2. Formatação JSON para o Prompt
        # Serializamos a lista de exercícios para que a LLM entenda a estrutura
        exercises_str = json.dumps(context_dict['exercicios_chave'], indent=2, ensure_ascii=False)
        user_prompt = USER_PROMPT_TEMPLATE.format(exercicios_json=exercises_str)

        try:
            # 3. Chamada à LLM
            # Temperature 0.3: Técnica exige precisão. Não queremos alucinações sobre biomecânica.
            raw_response = await llm_client.call_model(SYSTEM_PROMPT, user_prompt, temperature=0.3)
            
            # 4. Pós-processamento
            suggestions = PostProcessor.process_response(raw_response, cls.DOMAIN, cls.AGENT_NAME)

            # 5. Cache
            if suggestions:
                await ai_cache.set(cls.DOMAIN, cls.AGENT_NAME, context_dict, suggestions)

            return suggestions
            
        except Exception as e:
            logger.error(f"Erro no {cls.AGENT_NAME}: {e}")
            return []