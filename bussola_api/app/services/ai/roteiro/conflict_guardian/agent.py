"""
=======================================================================================
ARQUIVO: agent.py (Agente ConflictGuardian)
=======================================================================================

OBJETIVO:
    Implementar o "Guardião de Conflitos" para o domínio de ROTEIRO (Agenda).
    Este agente atua como um validador lógico de agendamento.
    
    Sua missão é detectar impossibilidades físicas na agenda, como estar em dois
    lugares ao mesmo tempo (choque de horário) ou não ter tempo hábil de 
    deslocamento entre eventos distantes.

CAMADA:
    Services / AI / Roteiro (Backend).
    É invocado pelo `RoteiroOrchestrator` durante a análise de agenda.

RESPONSABILIDADES:
    1. Detecção de Sobreposição: Identificar eventos que ocorrem no mesmo intervalo de tempo.
    2. Viabilidade Logística: (Se o LLM for capaz) Alertar sobre deslocamentos impossíveis (ex: SP -> RJ em 10min).
    3. Análise Temporal: Ordenar eventos cronologicamente para facilitar o raciocínio da IA.
    4. Formatação Eficiente: Converter listas longas de eventos mensais em texto conciso.

INTEGRAÇÕES:
    - LLMFactory: Para "ler" a agenda e encontrar erros de lógica.
    - AgentCache: Para evitar reprocessar a mesma agenda se nada mudou.
    - RoteiroContext: Fonte de dados (Lista de Compromissos).
"""

import logging
import json
from typing import List, Dict, Any

from app.services.ai.base.llm_factory import llm_client
from app.services.ai.base.post_processor import PostProcessor
from app.services.ai.base.cache import ai_cache
from app.services.ai.base.base_schema import AtomicSuggestion

# Contextos e Schemas do Domínio Roteiro
from app.services.ai.roteiro.context import RoteiroContext
from app.services.ai.roteiro.conflict_guardian.schema import ConflictGuardianContext
from app.services.ai.roteiro.conflict_guardian.prompts import SYSTEM_PROMPT, USER_PROMPT_TEMPLATE

logger = logging.getLogger(__name__)

class ConflictGuardianAgent:
    """
    Agente Especialista: Auditoria de Conflitos e Viabilidade Logística.
    
    Lógica Principal:
    Diferente de agentes criativos, este agente precisa ser exato.
    Se o Evento A termina às 10:00 e o Evento B começa às 09:30, é um conflito factual.
    """
    DOMAIN = "roteiro"
    AGENT_NAME = "conflict_guardian"

    @classmethod
    async def run(cls, global_context: RoteiroContext) -> List[AtomicSuggestion]:
        """
        Executa a varredura de conflitos na agenda.

        Args:
            global_context: Contém a lista de compromissos do período analisado (mês).

        Returns:
            Lista de alertas de conflito ou impossibilidade logística.
        """
        
        # ----------------------------------------------------------------------
        # 1. MAPEAMENTO DE CONTEXTO (Global -> Local)
        # ----------------------------------------------------------------------
        # Criamos um sub-contexto específico para auditoria de conflitos,
        # isolando apenas datas e eventos.
        agent_context = ConflictGuardianContext(
            data_inicio=global_context.data_inicio, 
            data_fim=global_context.data_fim,       
            eventos_periodo=global_context.agenda_itens 
        )
        
        context_dict = agent_context.model_dump()
        
        # Otimização: Se a agenda está vazia, não há conflitos possíveis.
        if not context_dict["eventos_periodo"]:
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
        # A formatação é crítica aqui. Listas JSON puras podem confundir a LLM com
        # excesso de chaves. Transformamos em um formato "Log Textual" ordenado,
        # que facilita a detecção visual de sobreposições.
        agenda_str = cls._format_agenda_mensal(context_dict["eventos_periodo"])

        user_prompt = USER_PROMPT_TEMPLATE.format(
            data_inicio=context_dict["data_inicio"],
            data_fim=context_dict["data_fim"],
            agenda_json=agenda_str
        )

        try:
            # ------------------------------------------------------------------
            # 4. CHAMADA LLM E PÓS-PROCESSAMENTO
            # ------------------------------------------------------------------
            # Temperature 0.0:
            # ESSENCIAL. Queremos zero alucinação. Um conflito existe ou não existe.
            # A IA deve atuar como uma máquina lógica estrita.
            raw_response = await llm_client.call_model(
                system_prompt=SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.0 
            )

            # Normalização e Validação
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
    def _format_agenda_mensal(items: List[Dict[str, Any]]) -> str:
        """
        Formata a lista de eventos para otimizar a detecção de conflitos pela LLM.
        
        LÓGICA DE FORMATAÇÃO:
        1. Ordenação Cronológica: Fundamental. A IA lê sequencialmente. Eventos fora de ordem
           dificultam a percepção de que o Evento A encavala no Evento B.
        2. Extração de ISO Dates: Transforma "2023-10-27T09:00:00" em "2023-10-27 [09:00]".
        3. Clareza Visual: Uma linha por evento.

        Args:
            items: Lista de dicionários de eventos (raw).

        Returns:
            String formatada tipo log (ex: "- [DATA] HORA | LOCAL | TITULO").
        """
        sanitized = []
        
        # Ordenação composta: Primeiro por Data, depois por Hora de Início.
        # Isso garante que eventos do mesmo dia fiquem agrupados e na ordem correta.
        sorted_items = sorted(
            items, 
            key=lambda x: (x.get('start_time', ''), x.get('end_time', ''))
        )

        for item in sorted_items:
            start_raw = item.get('start_time', '')
            
            # Tratamento de Strings de Data (Parsing manual robusto para evitar libs pesadas aqui)
            try:
                if 'T' in start_raw:
                    date_part = start_raw.split('T')[0]
                    # Pega apenas HH:MM
                    time_part = start_raw.split('T')[1][:5]
                else:
                    # Fallback para strings simples "YYYY-MM-DD HH:MM"
                    date_part = start_raw[:10]
                    time_part = start_raw[-5:]
                
                end_raw = item.get('end_time', '')
                if 'T' in end_raw:
                    end_time_part = end_raw.split('T')[1][:5]
                else:
                    end_time_part = end_raw[-5:] if end_raw else "??"
            except:
                # Fallback de segurança para dados sujos no banco
                date_part = "Data Desconhecida"
                time_part = start_raw
                end_time_part = item.get('end_time', '??')

            # Montagem da Linha
            sanitized.append(
                f"- [{date_part}] {time_part} até {end_time_part} | "
                f"Local: {item.get('location', 'N/A')} | "
                f"Evento: {item.get('title')}"
            )
        
        # Retorna bloco de texto único
        return "\n".join(sanitized)