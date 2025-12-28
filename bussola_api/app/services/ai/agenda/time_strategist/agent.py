import logging
from datetime import datetime
from typing import List

from app.services.ai.base.llm_factory import llm_client
from app.services.ai.base.post_processor import PostProcessor
from app.services.ai.base.cache import ai_cache
from app.services.ai.base.base_schema import AtomicSuggestion

from app.services.ai.agenda.context import AgendaContext
from app.services.ai.agenda.time_strategist.schema import TimeStrategistContext
from app.services.ai.agenda.time_strategist.prompts import SYSTEM_PROMPT, USER_PROMPT_TEMPLATE

logger = logging.getLogger(__name__)

class TimeStrategistAgent:
    """
    Agente Especialista: Curto Prazo, Prazos e Viabilidade Imediata.
    """
    DOMAIN = "agenda"
    AGENT_NAME = "time_strategist"

    @classmethod
    async def run(cls, global_context: AgendaContext) -> List[AtomicSuggestion]:
        # 1. Lógica de Filtragem (Python-side filtering)
        # Não gastamos tokens enviando tarefas do mês que vem para este agente.
        
        atrasadas = []
        hoje = []
        
        today_str = global_context.data_atual # YYYY-MM-DD
        
        for task in global_context.tarefas:
            if task.status == 'concluida':
                continue
                
            # Se não tem data, ignoramos neste agente (TaskBreaker cuida disso)
            if not task.data_vencimento:
                continue
                
            if task.data_vencimento < today_str:
                atrasadas.append(task)
            elif task.data_vencimento == today_str:
                hoje.append(task)

        # Se não tem nada atrasado nem para hoje, o 'Policial' não tem trabalho.
        if not atrasadas and not hoje:
            return []

        # 2. Monta Contexto Específico
        agent_context = TimeStrategistContext(
            data_atual=global_context.data_atual,
            hora_atual=global_context.hora_atual,
            dia_semana=global_context.dia_semana,
            tarefas_atrasadas=atrasadas,
            tarefas_hoje=hoje
        )
        
        context_dict = agent_context.model_dump()

        # 3. Cache Check
        cached_response = await ai_cache.get(cls.DOMAIN, cls.AGENT_NAME, context_dict)
        if cached_response:
            return cached_response

        # 4. Formatação de Strings para o Prompt
        def format_list(tasks):
            if not tasks: return "Nenhuma."
            return "\n".join([f"- {t['titulo']} (Prioridade: {t['prioridade']})" for t in tasks])

        user_prompt = USER_PROMPT_TEMPLATE.format(
            hora_atual=context_dict["hora_atual"],
            atrasadas_json=format_list(context_dict["tarefas_atrasadas"]),
            hoje_json=format_list(context_dict["tarefas_hoje"])
        )

        try:
            # 5. LLM Call
            # Temperatura baixa (0.2) pois ele deve ser rigoroso com regras
            raw_response = await llm_client.call_model(
                system_prompt=SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.2 
            )

            # 6. Post-Processing
            suggestions = PostProcessor.process_response(
                raw_data=raw_response,
                domain=cls.DOMAIN,
                agent_source=cls.AGENT_NAME
            )

            # 7. Cache Save
            if suggestions:
                await ai_cache.set(cls.DOMAIN, cls.AGENT_NAME, context_dict, suggestions)

            return suggestions

        except Exception as e:
            logger.error(f"Falha no {cls.AGENT_NAME}: {e}")
            return []