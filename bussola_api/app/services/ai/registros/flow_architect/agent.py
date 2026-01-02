"""
=======================================================================================
ARQUIVO: agent.py (Agente FlowArchitect)
=======================================================================================

OBJETIVO:
    Implementar o "Arquiteto de Fluxo" para o domínio de Registros (Tarefas).
    Este agente é responsável pela visão MACRO e de LONGO PRAZO da produtividade.
    
    Diferente de agentes que quebram tarefas (TaskBreaker) ou priorizam o dia (PriorityAlchemist),
    este agente analisa o volume geral, distribuição semanal e sobrecarga cognitiva.

CAMADA:
    Services / AI / Registros (Backend).
    É invocado pelo `RegistrosOrchestrator` como parte da análise de produtividade.

RESPONSABILIDADES:
    1. Análise de Carga: Verificar se o usuário tem muitas tarefas para pouco tempo.
    2. Planejamento Semanal: Identificar dias livres ou dias sobrecarregados.
    3. Filtragem de Contexto: Selecionar apenas os dados relevantes (Datas e Títulos) para economizar tokens.
    4. Geração de Sugestões: Propor redistribuição de tarefas ou dias de foco.

INTEGRAÇÕES:
    - LLMFactory: Para gerar análises de planejamento e bem-estar.
    - AgentCache: Para evitar reprocessamento de listas de tarefas inalteradas.
    - RegistrosContext: Fonte de dados (Lista de Tarefas do usuário).
"""

import logging
import json
from typing import List

from app.services.ai.base.llm_factory import llm_client
from app.services.ai.base.post_processor import PostProcessor
from app.services.ai.base.cache import ai_cache
from app.services.ai.base.base_schema import AtomicSuggestion

# Contextos e Schemas do Domínio Registros
from app.services.ai.registros.context import RegistrosContext
from app.services.ai.registros.flow_architect.schema import FlowArchitectContext
from app.services.ai.registros.flow_architect.prompts import SYSTEM_PROMPT, USER_PROMPT_TEMPLATE

logger = logging.getLogger(__name__)

class FlowArchitectAgent:
    """
    Agente Especialista: Visão de Longo Prazo e Fluxo de Produtividade.
    
    Foco:
    Não olha para a execução imediata ("Faça isso agora"), mas sim para a 
    saúde do sistema de organização ("Você tem muita coisa para sexta-feira").
    """
    DOMAIN = "registros" 
    AGENT_NAME = "flow_architect"

    @classmethod
    async def run(cls, global_context: RegistrosContext) -> List[AtomicSuggestion]:
        """
        Executa a análise de fluxo de tarefas.

        Args:
            global_context: O contexto completo de registros (todas as tarefas, dados do usuário).

        Returns:
            Lista de sugestões de planejamento ou alertas de sobrecarga.
        """
        
        # ----------------------------------------------------------------------
        # 1. FILTRAGEM E MAPEAMENTO DE CONTEXTO
        # ----------------------------------------------------------------------
        # O agente não precisa de todos os dados do RegistrosContext (ex: hora exata, 
        # detalhes minuciosos). Criamos um sub-contexto (FlowArchitectContext)
        # contendo apenas o necessário para a análise macro.
        agent_context = FlowArchitectContext(
            data_atual=global_context.data_atual,
            dia_semana=global_context.dia_semana,
            tarefas_futuras=global_context.tarefas
        )
        
        context_dict = agent_context.model_dump()
        
        # Otimização de Custo/Performance:
        # Se não há tarefas cadastradas, não há fluxo para analisar.
        # Retorna lista vazia imediatamente para não chamar a LLM.
        if not context_dict["tarefas_futuras"]:
            return []

        # ----------------------------------------------------------------------
        # 2. VERIFICAÇÃO DE CACHE
        # ----------------------------------------------------------------------
        cached_response = await ai_cache.get(cls.DOMAIN, cls.AGENT_NAME, context_dict)
        if cached_response:
            return cached_response

        # ----------------------------------------------------------------------
        # 3. PREPARAÇÃO DO PROMPT (Engenharia de Prompt)
        # ----------------------------------------------------------------------
        # Transformamos a lista de objetos Tarefa em uma string formatada e simplificada.
        # Objetivo: Reduzir drasticamente o consumo de tokens enviando apenas
        # [DATA] TITULO (PRIORIDADE), removendo IDs, descrições longas e metadados irrelevantes
        # para a visão macro.
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
            # ------------------------------------------------------------------
            # 4. CHAMADA LLM E PÓS-PROCESSAMENTO
            # ------------------------------------------------------------------
            # Temperature 0.4:
            # Diferente de agentes financeiros (0.1 ou 0.2), este agente lida com
            # produtividade e bem-estar. Uma temperatura levemente mais alta permite
            # sugestões mais "humanas", empáticas e criativas sobre organização.
            raw_response = await llm_client.call_model(
                system_prompt=SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.4 
            )

            # Normalização e Validação (Garante Schema AtomicSuggestion)
            suggestions = PostProcessor.process_response(
                raw_data=raw_response,
                domain=cls.DOMAIN, 
                agent_source=cls.AGENT_NAME
            )

            # Salva no Redis se houver sucesso
            if suggestions:
                await ai_cache.set(cls.DOMAIN, cls.AGENT_NAME, context_dict, suggestions)

            return suggestions

        except Exception as e:
            logger.error(f"Falha no {cls.AGENT_NAME}: {e}")
            return []