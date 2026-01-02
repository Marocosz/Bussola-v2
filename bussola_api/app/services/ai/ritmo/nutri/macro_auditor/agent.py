"""
=======================================================================================
ARQUIVO: agent.py (Agente MacroAuditor)
=======================================================================================

OBJETIVO:
    Implementar o "Auditor de Macros".
    Este agente atua no domínio de NUTRIÇÃO com foco puramente MATEMÁTICO e QUANTITATIVO.
    
    Sua missão é comparar o planejado (Meta de Calorias/Macros) com o executado (Dieta)
    e identificar discrepâncias numéricas, sem julgar a qualidade dos alimentos.

CAMADA:
    Services / AI / Ritmo / Nutri (Backend).
    É invocado pelo `NutriOrchestrator` durante a análise da dieta.

RESPONSABILIDADES:
    1. Validação Numérica: Verificar se a soma dos macros bate com as calorias totais.
    2. Análise de Desvio: Calcular quão longe o usuário está da meta (ex: déficit calórico agressivo demais).
    3. Segurança: Garantir que a dieta não viole limites fisiológicos básicos (ex: gordura muito baixa).

INTEGRAÇÕES:
    - LLMFactory: Para interpretar os dados numéricos e gerar alertas textuais.
    - AgentCache: Para evitar reprocessar cálculos idênticos.
    - MacroAuditorContext: Dados agregados da dieta.
"""

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
        """
        Executa a análise quantitativa da dieta.
        """
        # 1. Preparação de Dados
        # Converte o objeto Pydantic para dict para gerar o hash de cache e preencher o prompt.
        context_dict = context.model_dump()

        # 2. Verificação de Cache (Otimização de Custo)
        # Se os macros e metas não mudaram, retornamos a resposta anterior imediatamente.
        cached_response = await ai_cache.get(cls.DOMAIN, cls.AGENT_NAME, context_dict)
        if cached_response:
            return cached_response

        # 3. Montagem do Prompt
        # Injeta os valores (calorias, proteinas, etc) no template de texto.
        user_prompt = USER_PROMPT_TEMPLATE.format(**context_dict)

        try:
            # 4. Chamada à LLM
            # Temperature 0.2: Crucial para este agente.
            # Como lidamos com matemática e regras rígidas (ex: 1g gordura = 9kcal),
            # precisamos de baixa criatividade para evitar alucinações numéricas.
            raw_response = await llm_client.call_model(
                system_prompt=SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.2 
            )

            # 5. Pós-Processamento e Sanitização
            # Garante que a resposta venha no formato AtomicSuggestion e descarta lixo.
            suggestions = PostProcessor.process_response(
                raw_data=raw_response,
                domain=cls.DOMAIN,
                agent_source=cls.AGENT_NAME
            )

            # 6. Atualização de Cache
            if suggestions:
                await ai_cache.set(cls.DOMAIN, cls.AGENT_NAME, context_dict, suggestions)

            return suggestions

        except Exception as e:
            logger.error(f"Falha na execução do {cls.AGENT_NAME}: {e}")
            # Estratégia de Falha (Graceful Degradation):
            # Se este agente falhar, retornamos vazio para não quebrar o painel inteiro do usuário.
            return []