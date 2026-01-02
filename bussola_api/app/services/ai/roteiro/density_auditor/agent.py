"""
=======================================================================================
ARQUIVO: agent.py (Agente DensityAuditor)
=======================================================================================

OBJETIVO:
    Implementar o "Auditor de Densidade" para o domínio de ROTEIRO (Agenda).
    Este agente foca na ERGONOMIA e SAÚDE MENTAL da agenda.
    
    Diferente do ConflictGuardian (que busca erros lógicos/sobreposições), 
    este agente busca padrões de exaustão, fragmentação excessiva (context switching)
    e falta de pausas.

CAMADA:
    Services / AI / Roteiro (Backend).
    É invocado pelo `RoteiroOrchestrator` como parte da análise de agenda.

RESPONSABILIDADES:
    1. Análise de Carga: Identificar dias com excesso de horas comprometidas.
    2. Detecção de Fragmentação: Alertar sobre "agenda queijo suíço" (muitos buracos inúteis entre reuniões).
    3. Context Switching: Identificar trocas bruscas de contexto (ex: Reunião Criativa -> Planilha Financeira).
    4. Engenharia de Prompt: Formatar a agenda para evidenciar a duração e sequência dos blocos.

INTEGRAÇÕES:
    - LLMFactory: Para analisar os padrões de tempo.
    - AgentCache: Para evitar reanalisar agendas estáticas.
    - RoteiroContext: Fonte de dados (Lista de Compromissos).
"""

import logging
import json
from datetime import datetime
from typing import List, Dict, Any

# Imports da arquitetura base
from app.services.ai.base.llm_factory import llm_client
from app.services.ai.base.post_processor import PostProcessor
from app.services.ai.base.cache import ai_cache
from app.services.ai.base.base_schema import AtomicSuggestion

# Imports do contexto do domínio Roteiro
from app.services.ai.roteiro.context import RoteiroContext
from app.services.ai.roteiro.density_auditor.schema import DensityAuditorContext
from app.services.ai.roteiro.density_auditor.prompts import SYSTEM_PROMPT, USER_PROMPT_TEMPLATE

logger = logging.getLogger(__name__)

class DensityAuditorAgent:
    """
    Agente Especialista: Análise de Carga de Trabalho, Fragmentação e Ergonomia.
    Focado em evitar burnout e otimizar o fluxo de trabalho (Flow).
    """
    DOMAIN = "roteiro"
    AGENT_NAME = "density_auditor"

    @classmethod
    async def run(cls, global_context: RoteiroContext) -> List[AtomicSuggestion]:
        """
        Executa a auditoria de densidade da agenda.

        Args:
            global_context: Contém a lista de compromissos do período.

        Returns:
            Lista de sugestões focadas em otimização de tempo e bem-estar.
        """
        
        # ----------------------------------------------------------------------
        # 1. MAPEAMENTO DE CONTEXTO (Global -> Local)
        # ----------------------------------------------------------------------
        # Isolamos apenas os dados necessários para análise de densidade.
        agent_context = DensityAuditorContext(
            data_inicio=global_context.data_inicio,
            data_fim=global_context.data_fim,
            eventos_periodo=global_context.agenda_itens
        )
        
        context_dict = agent_context.model_dump()
        
        # Otimização: Sem eventos, não há densidade para auditar.
        if not context_dict["eventos_periodo"]:
            return []

        # ----------------------------------------------------------------------
        # 2. VERIFICAÇÃO DE CACHE
        # ----------------------------------------------------------------------
        cached_response = await ai_cache.get(cls.DOMAIN, cls.AGENT_NAME, context_dict)
        if cached_response:
            return cached_response

        # ----------------------------------------------------------------------
        # 3. PREPARAÇÃO DO PROMPT
        # ----------------------------------------------------------------------
        # Utilizamos um formatador específico (_format_schedule_for_density) que
        # destaca DURAÇÃO e TIPO de atividade, facilitando para a LLM identificar
        # blocos massivos de trabalho ou fragmentação.
        agenda_str = cls._format_schedule_for_density(context_dict["eventos_periodo"])

        user_prompt = USER_PROMPT_TEMPLATE.format(
            data_inicio=context_dict["data_inicio"],
            data_fim=context_dict["data_fim"],
            agenda_json=agenda_str
        )

        try:
            # ------------------------------------------------------------------
            # 4. CHAMADA LLM E PÓS-PROCESSAMENTO
            # ------------------------------------------------------------------
            # Temperature 0.1:
            # Análise de densidade requer consistência técnica. Queremos que a IA
            # aponte fatos (ex: "4 horas sem pausa"), não opiniões criativas.
            raw_response = await llm_client.call_model(
                system_prompt=SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.1 
            )

            # Validação e Normalização
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

    @staticmethod
    def _format_schedule_for_density(items: List[Dict[str, Any]]) -> str:
        """
        Formata a agenda destacando a DURAÇÃO e a SEQUÊNCIA dos eventos.
        
        OBJETIVO:
        Ajudar o LLM a visualizar 'blocos' de tempo e 'buracos' (gaps).
        Ao explicitar horário de início e fim lado a lado, facilitamos o cálculo
        de tempo de deslocamento e pausas pela IA.
        
        SAÍDA ESPERADA:
        "- [2023-10-27] 09:00 até 11:00 | Atividade: Deep Work | Tipo: Trabalho | Local: Escritório"
        """
        sanitized = []
        
        # Ordenação cronológica absoluta é vital para identificar sequências sem pausa
        sorted_items = sorted(
            items, 
            key=lambda x: (x.get('start_time', ''), x.get('end_time', ''))
        )

        for item in sorted_items:
            # Extração e Cálculo de Tempo
            # O objetivo aqui é fornecer uma string limpa "HH:MM até HH:MM".
            time_info = "Horário irregular"
            try:
                start = item.get('start_time', '')
                end = item.get('end_time', '')
                
                # Suporte robusto a formatos ISO com ou sem 'T'
                s_time = start[11:16] if 'T' in start else start[-8:][:5]
                e_time = end[11:16] if 'T' in end else end[-8:][:5]
                
                time_info = f"{s_time} até {e_time}"
            except:
                pass # Mantém "Horário irregular" se falhar o parse

            # Inclusão de Categoria
            # Fundamental para detectar Context Switching (ex: Criativo vs Administrativo)
            categoria = item.get('category', 'Geral')
            
            sanitized.append(
                f"- [{item.get('start_time', '')[:10]}] {time_info} | "
                f"Atividade: {item.get('title', 'Sem título')} | "
                f"Tipo: {categoria} | Local: {item.get('location', 'N/A')}"
            )
        
        return "\n".join(sanitized)