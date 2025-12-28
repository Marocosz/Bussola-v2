import logging
from datetime import datetime
from typing import List

from app.services.ai.base.llm_factory import llm_client
from app.services.ai.base.post_processor import PostProcessor
from app.services.ai.base.cache import ai_cache
from app.services.ai.base.base_schema import AtomicSuggestion

from app.services.ai.registros.context import RegistrosContext
from app.services.ai.registros.priority_alchemist.schema import PriorityAlchemistContext
from app.services.ai.registros.priority_alchemist.prompts import SYSTEM_PROMPT, USER_PROMPT_TEMPLATE

logger = logging.getLogger(__name__)

class PriorityAlchemistAgent:
    """
    Agente Especialista: Priorização e Limpeza de Backlog.
    """
    DOMAIN = "registros"
    AGENT_NAME = "priority_alchemist"

    @classmethod
    async def run(cls, global_context: RegistrosContext) -> List[AtomicSuggestion]:
        # 1. Filtros Python (Calcula Idade da Tarefa)
        estagnadas = []
        alta_prioridade = []
        
        try:
            today_dt = datetime.strptime(global_context.data_atual, "%Y-%m-%d")
        except ValueError:
            today_dt = datetime.now() # Fallback

        for task in global_context.tarefas:
            # Ajuste conforme o status exato do seu enum ('done', 'concluida', etc)
            if task.status == 'concluida': 
                continue

            # Check de Alta Prioridade
            if hasattr(task, 'prioridade') and task.prioridade and task.prioridade.lower() == 'alta':
                alta_prioridade.append(task)

            # Check de Estagnação (Criada há > 15 dias e ainda pendente)
            # Assumimos que created_at vem no formato YYYY-MM-DD ou ISO
            try:
                # Garante que seja string antes de fazer split
                c_date = str(task.created_at)
                created_dt = datetime.strptime(c_date.split('T')[0], "%Y-%m-%d")
                days_old = (today_dt - created_dt).days
                
                if days_old >= 15: # Ajustado para 15 conforme regra de negócio (estava 7 no código anterior, mas prompt diz 15)
                    # Adiciona atributo temporário para o prompt saber a idade
                    setattr(task, '_days_old', days_old) 
                    estagnadas.append(task)
            except Exception:
                continue # Ignora se data estiver bugada

        # Se não tem nada velho nem inflação de prioridade (menos de 3 altas), ignora
        if not estagnadas and len(alta_prioridade) < 5: # Ajustado para < 5 para evitar chamadas triviais
            return []

        # 2. Contexto
        agent_context = PriorityAlchemistContext(
            data_atual=global_context.data_atual,
            tarefas_estagnadas=estagnadas,
            tarefas_alta_prioridade=alta_prioridade
        )
        context_dict = agent_context.model_dump()

        # 3. Cache
        cached_response = await ai_cache.get(cls.DOMAIN, cls.AGENT_NAME, context_dict)
        if cached_response:
            return cached_response

        # 4. Formatter (CORRIGIDO: Acesso via atributo .titulo)
        def format_stale(tasks):
            if not tasks: return "Nenhuma."
            # Usa getattr pois _days_old foi injetado dinamicamente
            return "\n".join([f"- {t.titulo} (Criada há {getattr(t, '_days_old', 15)} dias)" for t in tasks])

        def format_high(tasks):
            if not tasks: return "Nenhuma."
            return "\n".join([f"- {t.titulo}" for t in tasks])

        user_prompt = USER_PROMPT_TEMPLATE.format(
            data_atual=context_dict["data_atual"],
            estagnadas_json=format_stale(estagnadas),
            alta_prioridade_json=format_high(alta_prioridade)
        )

        # 5. LLM Call
        try:
            raw_response = await llm_client.call_model(
                system_prompt=SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.3 # Equilibrado
            )

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