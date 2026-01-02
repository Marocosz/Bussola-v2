"""
=======================================================================================
ARQUIVO: agent.py (Agente PriorityAlchemist)
=======================================================================================

OBJETIVO:
    Implementar o "Alquimista de Prioridades".
    Este agente atua no domínio de REGISTROS (Tarefas) com foco em saneamento de backlog.
    Ele combate dois problemas principais:
    1. Estagnação: Tarefas velhas que nunca são concluídas (Backlog Rot).
    2. Inflação de Prioridade: Quando o usuário marca tudo como "Alta" e nada é urgente.

CAMADA:
    Services / AI / Registros (Backend).
    É invocado pelo `RegistrosOrchestrator` durante a análise de produtividade.

RESPONSABILIDADES:
    1. Filtragem Temporal (Python): Calcular a "idade" das tarefas matematicamente (não via LLM).
    2. Detecção de Estagnação: Identificar itens criados há mais de 15 dias sem conclusão.
    3. Engenharia de Prompt: Formatar listas de tarefas de forma concisa para economizar tokens.
    4. Curadoria: Sugerir arquivamento, deleção ou re-priorização de tarefas.

INTEGRAÇÕES:
    - LLMFactory: Para gerar sugestões de limpeza e organização.
    - AgentCache: Para evitar reanalisar listas que não mudaram.
    - RegistrosContext: Fonte de dados (Lista completa de tarefas do usuário).
"""

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
    
    Lógica Principal:
    Transforma um backlog caótico em uma lista acionável, sugerindo
    o que deve ser eliminado para que o importante brilhe.
    """
    DOMAIN = "registros"
    AGENT_NAME = "priority_alchemist"

    @classmethod
    async def run(cls, global_context: RegistrosContext) -> List[AtomicSuggestion]:
        """
        Executa a análise de priorização de tarefas.

        Args:
            global_context: Contém todas as tarefas ativas do usuário e a data atual.

        Returns:
            Lista de sugestões de limpeza (ex: "Arquive esta tarefa antiga").
        """
        
        # ----------------------------------------------------------------------
        # 1. FILTRAGEM E LÓGICA DE NEGÓCIO (Python > LLM)
        # ----------------------------------------------------------------------
        # Decisão de Arquitetura:
        # Não enviamos todas as tarefas para a IA. Fazemos a triagem baseada em regras
        # rígidas (Data de Criação e Prioridade) para economizar tokens e garantir precisão.
        
        estagnadas = []
        alta_prioridade = []
        
        try:
            today_dt = datetime.strptime(global_context.data_atual, "%Y-%m-%d")
        except ValueError:
            today_dt = datetime.now() 

        for task in global_context.tarefas:
            # Ignora tarefas já finalizadas (não requerem ação)
            if task.status == 'concluida': 
                continue

            # Regra de Negócio: Detecção de "Tudo é Urgente"
            # Coletamos todas as tarefas marcadas como 'alta' para verificar se há inflação.
            if hasattr(task, 'prioridade') and task.prioridade and task.prioridade.lower() == 'alta':
                alta_prioridade.append(task)

            # Regra de Negócio: Detecção de "Zumbis" (Tarefas Estagnadas)
            # Tarefas criadas há mais de 15 dias que ainda estão pendentes.
            try:
                # Normalização de data (pode vir como string ISO do banco ou objeto)
                c_date = str(task.created_at)
                created_dt = datetime.strptime(c_date.split('T')[0], "%Y-%m-%d")
                days_old = (today_dt - created_dt).days
                
                if days_old >= 15: 
                    # Injeção de Atributo:
                    # Adicionamos '_days_old' dinamicamente ao objeto para uso no formatador do prompt.
                    # Isso evita recalcular a data dentro da string de formatação.
                    setattr(task, '_days_old', days_old) 
                    estagnadas.append(task)
            except Exception:
                continue # Proteção contra dados corrompidos de data

        # ----------------------------------------------------------------------
        # 2. OTIMIZAÇÃO DE CUSTO (Early Exit)
        # ----------------------------------------------------------------------
        # Se o usuário não tem tarefas velhas E não tem muitas prioridades altas (< 5),
        # o backlog é considerado saudável. Não gastamos dinheiro chamando a LLM.
        if not estagnadas and len(alta_prioridade) < 5: 
            return []

        # ----------------------------------------------------------------------
        # 3. MONTAGEM DO CONTEXTO
        # ----------------------------------------------------------------------
        agent_context = PriorityAlchemistContext(
            data_atual=global_context.data_atual,
            tarefas_estagnadas=estagnadas,
            tarefas_alta_prioridade=alta_prioridade
        )
        context_dict = agent_context.model_dump()

        # ----------------------------------------------------------------------
        # 4. VERIFICAÇÃO DE CACHE
        # ----------------------------------------------------------------------
        cached_response = await ai_cache.get(cls.DOMAIN, cls.AGENT_NAME, context_dict)
        if cached_response:
            return cached_response

        # ----------------------------------------------------------------------
        # 5. PREPARAÇÃO DO PROMPT (Formatadores Auxiliares)
        # ----------------------------------------------------------------------
        # Transformam os objetos de tarefa em strings descritivas para a LLM.
        
        def format_stale(tasks):
            if not tasks: return "Nenhuma."
            # Usa o atributo injetado '_days_old' para dar contexto temporal à IA
            return "\n".join([f"- {t.titulo} (Criada há {getattr(t, '_days_old', 15)} dias)" for t in tasks])

        def format_high(tasks):
            if not tasks: return "Nenhuma."
            return "\n".join([f"- {t.titulo}" for t in tasks])

        user_prompt = USER_PROMPT_TEMPLATE.format(
            data_atual=context_dict["data_atual"],
            estagnadas_json=format_stale(estagnadas),
            alta_prioridade_json=format_high(alta_prioridade)
        )

        # ----------------------------------------------------------------------
        # 6. CHAMADA LLM E PÓS-PROCESSAMENTO
        # ----------------------------------------------------------------------
        try:
            # Temperature 0.3: Um pouco mais analítico que o FlowArchitect (0.4),
            # pois precisa tomar decisões mais duras sobre arquivamento.
            raw_response = await llm_client.call_model(
                system_prompt=SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.3 
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