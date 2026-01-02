"""
=======================================================================================
ARQUIVO: agent.py (Agente TaskBreaker)
=======================================================================================

OBJETIVO:
    Implementar o "Quebrador de Tarefas".
    Este agente atua no domínio de REGISTROS (Tarefas) com foco em CLAREZA e GRANULARIDADE.
    
    Sua missão é combater a procrastinação causada por tarefas vagas (ex: "TCC") ou 
    complexas demais (ex: "Reforma"). Ele sugere quebrar esses "monstros" em passos acionáveis.

CAMADA:
    Services / AI / Registros (Backend).
    É invocado pelo `RegistrosOrchestrator` durante a análise de produtividade.

RESPONSABILIDADES:
    1. Filtragem Heurística (Python): Detectar tarefas vagas sem gastar tokens de IA.
    2. Análise Semântica: Identificar falta de verbos de ação ou palavras-chave de complexidade.
    3. Geração de Subtarefas: Usar a IA para propor um checklist lógico para a tarefa "pai".
    4. Educação: Ensinar o usuário a escrever tarefas melhores (Actionable Items).

INTEGRAÇÕES:
    - LLMFactory: Para "imaginar" os passos necessários de uma tarefa vaga.
    - AgentCache: Para evitar processar a mesma tarefa vaga repetidamente.
    - RegistrosContext: Fonte de dados (Lista de Tarefas).
"""

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
    
    Lógica Principal:
    Uma tarefa só é boa se for acionável. Se o usuário precisa pensar "o que eu faço agora?"
    ao ler a tarefa, este agente entra em ação para sugerir o "como".
    """
    DOMAIN = "registros"
    AGENT_NAME = "task_breaker"

    # Lista estática de verbos comuns para evitar dependência de bibliotecas pesadas de NLP (spacy/nltk).
    # Usada para uma verificação rápida de "acionabilidade".
    COMMON_VERBS = [
        "fazer", "criar", "ligar", "mandar", "enviar", "pagar", "agendar", 
        "escrever", "ler", "estudar", "comprar", "limpar", "arrumar", "corrigir",
        "verificar", "analisar", "buscar"
    ]

    @classmethod
    async def run(cls, global_context: RegistrosContext) -> List[AtomicSuggestion]:
        """
        Executa a análise de granularidade das tarefas.

        Args:
            global_context: Contém todas as tarefas ativas do usuário.

        Returns:
            Lista de sugestões de quebra (ex: "Transforme 'Viagem' em 'Comprar Passagem', 'Reservar Hotel'").
        """
        
        # ----------------------------------------------------------------------
        # 1. FILTRAGEM E HEURÍSTICAS (Python > LLM)
        # ----------------------------------------------------------------------
        # Decisão de Arquitetura:
        # Não enviamos todas as tarefas para a IA. Usamos heurísticas locais para
        # identificar apenas tarefas "suspeitas" de serem vagas. Isso economiza custos
        # e reduz a latência drasticamente.
        
        candidatas = []
        
        for task in global_context.tarefas:
            # Tarefas concluídas não precisam ser quebradas
            if task.status == 'concluida': continue
            
            # Se a tarefa já possui subtarefas registradas no sistema, 
            # entendemos que o usuário já fez o trabalho de quebra.
            if hasattr(task, 'has_subtasks') and task.has_subtasks: 
                continue

            # --- Heurística 1: Ambiguidade por Tamanho ---
            # Títulos muito curtos (1 ou 2 palavras) geralmente são categorias, não tarefas.
            # Ex: "Banco" (Vago) vs "Ir ao Banco pagar boleto" (Claro).
            titulo = str(task.titulo) if task.titulo else ""
            words = titulo.split()
            is_short = len(words) <= 2
            
            # --- Heurística 2: Falta de Ação (Verbos) ---
            # Uma tarefa sem verbo geralmente é um substantivo/projeto.
            first_word_lower = words[0].lower() if words else ""
            has_verb = any(v in first_word_lower for v in cls.COMMON_VERBS)
            
            # Combinação: Se for curto E sem verbo, é um forte candidato a ser vago.
            if is_short and not has_verb:
                candidatas.append(task)
                
            # --- Heurística 3: Palavras-Chave de Complexidade ---
            # Mesmo que tenha verbo, certas palavras indicam projetos inteiros disfarçados de tarefa.
            # Ex: "Fazer reforma da cozinha" é impossível de concluir em um dia.
            elif any(w in titulo.lower() for w in ["projeto", "viagem", "reforma", "mudança", "construção"]):
                candidatas.append(task)

        # Otimização: Se nenhuma tarefa vaga foi detectada, encerramos aqui.
        if not candidatas:
            return []

        # ----------------------------------------------------------------------
        # 2. MONTAGEM DO CONTEXTO
        # ----------------------------------------------------------------------
        agent_context = TaskBreakerContext(
            data_atual=global_context.data_atual,
            tarefas_analise=candidatas
        )
        context_dict = agent_context.model_dump()

        # ----------------------------------------------------------------------
        # 3. VERIFICAÇÃO DE CACHE
        # ----------------------------------------------------------------------
        cached_response = await ai_cache.get(cls.DOMAIN, cls.AGENT_NAME, context_dict)
        if cached_response:
            return cached_response

        # ----------------------------------------------------------------------
        # 4. PREPARAÇÃO DO PROMPT
        # ----------------------------------------------------------------------
        # Formatamos apenas os títulos para a IA.
        # Não precisamos de data, prioridade ou descrição aqui, pois o foco é puramente
        # semântico e estrutural.
        def format_tasks(tasks):
            return "\n".join([f"- {t.titulo}" for t in tasks])

        user_prompt = USER_PROMPT_TEMPLATE.format(
            tarefas_json=format_tasks(candidatas)
        )

        # ----------------------------------------------------------------------
        # 5. CHAMADA LLM E PÓS-PROCESSAMENTO
        # ----------------------------------------------------------------------
        try:
            # Temperature 0.4:
            # Precisamos de criatividade moderada para que a IA "imagine" quais
            # seriam as sub-etapas lógicas de uma tarefa vaga como "TCC".
            raw_response = await llm_client.call_model(
                system_prompt=SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.4 
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