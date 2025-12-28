import logging
import json
from typing import List

from app.services.ai.base.llm_factory import llm_client
from app.services.ai.base.post_processor import PostProcessor
from app.services.ai.base.cache import ai_cache
from app.services.ai.base.base_schema import AtomicSuggestion

from app.services.ai.registros.context import RegistrosContext
from app.services.ai.registros.flow_architect.schema import FlowArchitectContext
from app.services.ai.registros.flow_architect.prompts import SYSTEM_PROMPT, USER_PROMPT_TEMPLATE

logger = logging.getLogger(__name__)

class FlowArchitectAgent:
    """
    Agente Especialista: Visão de Longo Prazo e Fluxo.
    """
    DOMAIN = "registros" # Novo domínio! Lembre de adicionar ícone no Front se precisar
    AGENT_NAME = "flow_architect"

    @classmethod
    async def run(cls, global_context: RegistrosContext) -> List[AtomicSuggestion]:
        # 1. Filtragem Inteligente (Context Mapping)
        # O Flow Architect não precisa saber a "Hora Atual" exata (regra das 18h), 
        # ele só precisa das datas e das tarefas.
        agent_context = FlowArchitectContext(
            data_atual=global_context.data_atual,
            dia_semana=global_context.dia_semana,
            tarefas_futuras=global_context.tarefas
        )
        
        context_dict = agent_context.model_dump()
        
        # Otimização: Se não tem tarefas futuras, não gasta token
        if not context_dict["tarefas_futuras"]:
            return []

        # 2. Cache Check
        cached_response = await ai_cache.get(cls.DOMAIN, cls.AGENT_NAME, context_dict)
        if cached_response:
            return cached_response

        # 3. Preparação do Prompt (Conversão de Objetos para JSON String legível)
        # Simplificamos a lista para a LLM ler apenas o necessário (Titulo e Data)
        simplified_tasks = [
            f"- [{t['data_vencimento'] or 'Sem Data'}] {t['titulo']} (Prioridade: {t['prioridade']})"
            for t in context_dict["tarefas_futuras"]
        ]
        tasks_str = "\n".join(simplified_tasks) if simplified_tasks else "Nenhuma tarefa futura registrada."

        user_prompt = USER_PROMPT_TEMPLATE.format(
            data_atual=context_dict["data_atual"],
            dia_semana=context_dict["dia_semana"],
            tarefas_json=tasks_str
        )

        try:
            # 4. LLM Call
            raw_response = await llm_client.call_model(
                system_prompt=SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.4 # Um pouco mais criativo para sugestões de bem-estar
            )

            # 5. Post-Processing
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
            logger.error(f"Falha no {cls.AGENT_NAME}: {e}")
            return []