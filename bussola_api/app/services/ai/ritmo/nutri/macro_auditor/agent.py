import logging
from typing import List

from app.services.ai.base.llm_factory import llm_client
from app.services.ai.base.post_processor import PostProcessor
from app.services.ai.base.cache import ai_cache
from app.services.ai.base.base_schema import AtomicSuggestion

from app.services.ai.ritmo.nutri.macro_auditor.schema import MacroAuditorContext
from app.services.ai.ritmo.nutri.macro_auditor.prompts import SYSTEM_PROMPT, USER_PROMPT_TEMPLATE

logger = logging.getLogger(__name__)

class MacroAuditorAgent:
    """
    Agente Especialista: Auditoria Matemática da Dieta.
    """
    DOMAIN = "nutri"
    AGENT_NAME = "macro_auditor"

    @classmethod
    async def run(cls, context: MacroAuditorContext) -> List[AtomicSuggestion]:
        # 1. Converter Contexto Pydantic para Dict (para hash e prompt)
        context_dict = context.model_dump()

        # 2. Verificar Cache (Economia Inteligente)
        cached_response = await ai_cache.get(cls.DOMAIN, cls.AGENT_NAME, context_dict)
        if cached_response:
            return cached_response

        # 3. Montar Prompt
        user_prompt = USER_PROMPT_TEMPLATE.format(**context_dict)

        try:
            # 4. Chamar LLM (Com Retry Automático da Factory)
            # O llm_client já retorna um Dict ou List (parseado do JSON)
            raw_response = await llm_client.call_model(
                system_prompt=SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.2 # Baixa temperatura para análise matemática precisa
            )

            # 5. Pós-Processamento (Validação, IDs, Atomicidade)
            suggestions = PostProcessor.process_response(
                raw_data=raw_response,
                domain=cls.DOMAIN,
                agent_source=cls.AGENT_NAME
            )

            # 6. Salvar no Cache (se houver sugestões válidas)
            if suggestions:
                await ai_cache.set(cls.DOMAIN, cls.AGENT_NAME, context_dict, suggestions)

            return suggestions

        except Exception as e:
            logger.error(f"Falha na execução do {cls.AGENT_NAME}: {e}")
            # Degradação Graciosa: Retorna lista vazia para não quebrar o dashboard
            return []