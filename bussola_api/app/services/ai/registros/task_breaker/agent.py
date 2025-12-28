import logging
from typing import List
import re

from app.services.ai.base.llm_factory import llm_client
from app.services.ai.base.post_processor import PostProcessor
from app.services.ai.base.cache import ai_cache
from app.services.ai.base.base_schema import AtomicSuggestion

from app.services.ai.registros.context import RegistrosContext
from app.services.ai.registros.task_breaker.schema import TaskBreakerContext
from app.services.ai.registros.task_breaker.prompts import SYSTEM_PROMPT, USER_PROMPT_TEMPLATE

logger = logging.getLogger(__name__)

class TaskBreakerAgent:
    """
    Agente Especialista: Clareza, Semântica e Quebra de Tarefas.
    """
    DOMAIN = "registros"
    AGENT_NAME = "task_breaker"

    # Lista básica de verbos para filtro heurístico
    COMMON_VERBS = [
        "fazer", "criar", "ligar", "mandar", "enviar", "pagar", "agendar", 
        "escrever", "ler", "estudar", "comprar", "limpar", "arrumar", "corrigir",
        "verificar", "analisar", "buscar"
    ]

    @classmethod
    async def run(cls, global_context: RegistrosContext) -> List[AtomicSuggestion]:
        # 1. Filtros Python (Heurísticas de Clareza)
        candidatas = []
        
        for task in global_context.tarefas:
            if task.status == 'concluida': continue
            
            # Se já tem subtarefas (assumindo que o model tem esse campo), o usuário já quebrou.
            if hasattr(task, 'has_subtasks') and task.has_subtasks: 
                continue

            # Heurística 1: Títulos muito curtos (ex: "Banco", "TCC") são suspeitos
            # Garante que titulo é string
            titulo = str(task.titulo) if task.titulo else ""
            words = titulo.split()
            is_short = len(words) <= 2
            
            # Heurística 2: Falta de Verbos (Check simples)
            first_word_lower = words[0].lower() if words else ""
            has_verb = any(v in first_word_lower for v in cls.COMMON_VERBS)
            
            # Se for curto E não parecer começar com verbo comum, manda para análise
            if is_short and not has_verb:
                candidatas.append(task)
                
            # Heurística 3: Palavras "Monstro" (Projeto, Viagem, Reforma)
            elif any(w in titulo.lower() for w in ["projeto", "viagem", "reforma", "mudança", "construção"]):
                candidatas.append(task)

        if not candidatas:
            return []

        # 2. Contexto
        agent_context = TaskBreakerContext(
            data_atual=global_context.data_atual,
            tarefas_analise=candidatas
        )
        context_dict = agent_context.model_dump()

        # 3. Cache
        cached_response = await ai_cache.get(cls.DOMAIN, cls.AGENT_NAME, context_dict)
        if cached_response:
            return cached_response

        # 4. Formatter (CORRIGIDO: Acesso via atributo .titulo)
        def format_tasks(tasks):
            return "\n".join([f"- {t.titulo}" for t in tasks])

        user_prompt = USER_PROMPT_TEMPLATE.format(
            tarefas_json=format_tasks(candidatas)
        )

        try:
            # 5. LLM Call
            raw_response = await llm_client.call_model(
                system_prompt=SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.4 # Um pouco criativo para sugerir nomes
            )

            # 6. Post-Processing
            suggestions = PostProcessor.process_response(
                raw_data=raw_response,
                domain=cls.DOMAIN,
                agent_source=cls.AGENT_NAME
            )

            if suggestions:
                await ai_cache.set(cls.DOMAIN, cls.AGENT_NAME, context_dict, suggestions)

            return suggestions

        except Exception as e:
            logger.error(f"Falha no {cls.AGENT_NAME}: {e}")
            return []