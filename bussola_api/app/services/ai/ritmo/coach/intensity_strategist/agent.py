"""
=======================================================================================
ARQUIVO: agent.py (Agente IntensityStrategist)
=======================================================================================

OBJETIVO:
    Implementar o "Estrategista de Intensidade".
    Este agente atua no domínio de COACH (Treino) e foca na qualidade do esforço.
    
    Sua missão é garantir que o usuário não esteja treinando "fofo" (sub-dosagem) nem 
    se matando (overtraining). Ele analisa cargas, RPE (Percepção de Esforço) e fadiga.

CAMADA:
    Services / AI / Ritmo / Coach (Backend).
    Invocado pelo `RitmoOrchestrator` quando há dados de treino disponíveis.

RESPONSABILIDADES:
    1. Análise de Carga: Verificar se a intensidade está alinhada ao objetivo (Hipertrofia vs Força).
    2. Gestão de Fadiga: Identificar sinais de cansaço excessivo e sugerir deload.
    3. Progressão de Carga: Sugerir aumentos de peso quando o treino fica fácil.

INTEGRAÇÕES:
    - LLMFactory: Para interpretar a subjetividade do esforço (RPE).
    - AgentCache: Cache de respostas para inputs idênticos.
    - IntensityStrategistContext: Dados de treino recentes.
"""

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
    """
    Agente Especialista: Estratégia de Intensidade e Carga.
    """
    DOMAIN = "coach"
    AGENT_NAME = "intensity_strategist"

    @classmethod
    async def run(cls, context: IntensityStrategistContext) -> List[AtomicSuggestion]:
        """
        Executa a análise de intensidade do treino.
        """
        context_dict = context.model_dump()
        
        # 1. Verificação de Cache
        cached = await ai_cache.get(cls.DOMAIN, cls.AGENT_NAME, context_dict)
        if cached: return cached

        # 2. Preparação do Prompt
        # O template espera chaves como 'carga_atual', 'rpe_medio', 'objetivo'
        user_prompt = USER_PROMPT_TEMPLATE.format(**context_dict)

        try:
            # 3. Chamada à LLM
            # Temperature 0.5: Intensidade é uma arte e ciência. Um pouco mais de criatividade
            # ajuda a gerar feedbacks motivacionais ("Vá com tudo!" ou "Segure a onda").
            raw_response = await llm_client.call_model(SYSTEM_PROMPT, user_prompt, temperature=0.5)
            
            # 4. Pós-processamento e Validação
            suggestions = PostProcessor.process_response(raw_response, cls.DOMAIN, cls.AGENT_NAME)
            
            # 5. Salvar Cache se sucesso
            if suggestions: 
                await ai_cache.set(cls.DOMAIN, cls.AGENT_NAME, context_dict, suggestions)
            
            return suggestions
            
        except Exception as e:
            logger.error(f"Erro no {cls.AGENT_NAME}: {e}")
            return []