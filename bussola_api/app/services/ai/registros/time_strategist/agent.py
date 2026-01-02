"""
=======================================================================================
ARQUIVO: agent.py (Agente TimeStrategist)
=======================================================================================

OBJETIVO:
    Implementar o "Estrategista de Tempo".
    Este agente atua no domínio de REGISTROS (Tarefas) com foco no CURTO PRAZO e URGÊNCIA.
    
    Sua missão é atuar como um "Policial de Prazos": cobrar o que está atrasado e 
    organizar o que deve ser feito hoje, garantindo que o usuário não perca datas.

CAMADA:
    Services / AI / Registros (Backend).
    É invocado pelo `RegistrosOrchestrator` durante a análise de produtividade.

RESPONSABILIDADES:
    1. Filtragem Temporal (Python): Selecionar apenas tarefas vencidas ou para hoje.
    2. Otimização de Recursos: Abortar a execução se não houver urgências (economiza tokens).
    3. Análise de Viabilidade: Verificar se o volume de tarefas de "hoje" cabe nas horas restantes.
    4. Geração de Alertas: Criar avisos de atraso ou planos de ação para o dia.

INTEGRAÇÕES:
    - LLMFactory: Para analisar a viabilidade da agenda do dia.
    - AgentCache: Para evitar chamadas repetidas se a lista de tarefas não mudou.
    - RegistrosContext: Fonte de dados (Lista de Tarefas).
"""

import logging
from datetime import datetime
from typing import List

from app.services.ai.base.llm_factory import llm_client
from app.services.ai.base.post_processor import PostProcessor
from app.services.ai.base.cache import ai_cache
from app.services.ai.base.base_schema import AtomicSuggestion

from app.services.ai.registros.context import RegistrosContext
from app.services.ai.registros.time_strategist.schema import TimeStrategistContext
from app.services.ai.registros.time_strategist.prompts import SYSTEM_PROMPT, USER_PROMPT_TEMPLATE

logger = logging.getLogger(__name__)

class TimeStrategistAgent:
    """
    Agente Especialista: Curto Prazo, Prazos e Viabilidade Imediata.
    
    Diferencial:
    Ao contrário do FlowArchitect (que olha a semana) ou TaskBreaker (que olha a clareza),
    este agente olha exclusivamente para o calendário: "O que vence hoje?" e "O que já venceu?".
    """
    DOMAIN = "registros"
    AGENT_NAME = "time_strategist"

    @classmethod
    async def run(cls, global_context: RegistrosContext) -> List[AtomicSuggestion]:
        """
        Executa a análise de urgência e prazos.

        Args:
            global_context: Contém todas as tarefas, data e hora atual.

        Returns:
            Lista de sugestões focadas em recuperação de atrasos ou foco diário.
        """
        
        # ----------------------------------------------------------------------
        # 1. FILTRAGEM TEMPORAL (Lógica de Negócio / Python)
        # ----------------------------------------------------------------------
        # Decisão de Arquitetura:
        # Realizamos a triagem das tarefas via código antes de chamar a IA.
        # Motivo: Não faz sentido gastar tokens enviando tarefas do mês que vem para
        # um agente que só se preocupa com "Hoje" e "Ontem".
        
        atrasadas = []
        hoje = []
        
        today_str = global_context.data_atual # Formato esperado: YYYY-MM-DD
        
        for task in global_context.tarefas:
            # Tarefas concluídas não geram urgência
            if task.status == 'concluida':
                continue
                
            # Tarefas sem data ("Someday/Maybe") são ignoradas por este agente.
            # Elas serão tratadas pelo FlowArchitect ou PriorityAlchemist.
            if not task.data_vencimento:
                continue
            
            # Classificação rígida baseada na data
            if task.data_vencimento < today_str:
                atrasadas.append(task)
            elif task.data_vencimento == today_str:
                hoje.append(task)

        # ----------------------------------------------------------------------
        # 2. OTIMIZAÇÃO DE CUSTO (Early Exit)
        # ----------------------------------------------------------------------
        # Se não há incêndios para apagar (atrasadas) nem agenda para hoje,
        # o agente não tem função. Encerramos para economizar API Calls e Latência.
        if not atrasadas and not hoje:
            return []

        # ----------------------------------------------------------------------
        # 3. MONTAGEM DO CONTEXTO ESPECÍFICO
        # ----------------------------------------------------------------------
        # Cria um sub-contexto focado apenas no que importa para a estratégia de tempo.
        agent_context = TimeStrategistContext(
            data_atual=global_context.data_atual,
            hora_atual=global_context.hora_atual, # Importante para saber quanto tempo resta no dia
            dia_semana=global_context.dia_semana,
            tarefas_atrasadas=atrasadas,
            tarefas_hoje=hoje
        )
        
        context_dict = agent_context.model_dump()

        # ----------------------------------------------------------------------
        # 4. VERIFICAÇÃO DE CACHE
        # ----------------------------------------------------------------------
        cached_response = await ai_cache.get(cls.DOMAIN, cls.AGENT_NAME, context_dict)
        if cached_response:
            return cached_response

        # ----------------------------------------------------------------------
        # 5. PREPARAÇÃO DO PROMPT
        # ----------------------------------------------------------------------
        # Formatadores auxiliares para converter objetos em texto plano para a LLM.
        # Incluímos a Prioridade para ajudar a IA a sugerir o que fazer primeiro.
        def format_list(tasks):
            if not tasks: return "Nenhuma."
            return "\n".join([f"- {t['titulo']} (Prioridade: {t['prioridade']})" for t in tasks])

        user_prompt = USER_PROMPT_TEMPLATE.format(
            hora_atual=context_dict["hora_atual"],
            atrasadas_json=format_list(context_dict["tarefas_atrasadas"]),
            hoje_json=format_list(context_dict["tarefas_hoje"])
        )

        # ----------------------------------------------------------------------
        # 6. CHAMADA LLM E PÓS-PROCESSAMENTO
        # ----------------------------------------------------------------------
        try:
            # Temperature 0.2:
            # Agentes de prazo precisam ser rigorosos e lógicos. 
            # Baixa criatividade evita alucinações sobre "renegociar prazos com o universo".
            raw_response = await llm_client.call_model(
                system_prompt=SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.2 
            )

            # Validação e Normalização (Garante Schema AtomicSuggestion)
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