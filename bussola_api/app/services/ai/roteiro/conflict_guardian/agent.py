import logging
import json
from typing import List, Dict, Any

from app.services.ai.base.llm_factory import llm_client
from app.services.ai.base.post_processor import PostProcessor
from app.services.ai.base.cache import ai_cache
from app.services.ai.base.base_schema import AtomicSuggestion

# Ajuste os imports do contexto global conforme sua estrutura real
from app.services.ai.roteiro.context import RoteiroContext
from app.services.ai.roteiro.conflict_guardian.schema import ConflictGuardianContext
from app.services.ai.roteiro.conflict_guardian.prompts import SYSTEM_PROMPT, USER_PROMPT_TEMPLATE

logger = logging.getLogger(__name__)

class ConflictGuardianAgent:
    """
    Agente Especialista: Auditoria de Conflitos e Viabilidade Logística (Escopo Mensal/Período).
    """
    DOMAIN = "roteiro"
    AGENT_NAME = "conflict_guardian"

    @classmethod
    async def run(cls, global_context: RoteiroContext) -> List[AtomicSuggestion]:
        # 1. Mapeamento de Contexto (Global -> Local)
        # Assumindo que o RoteiroContext agora traz dados do mês ou período
        # Se 'agenda_itens' for do mês todo, perfeito.
        agent_context = ConflictGuardianContext(
            data_inicio=global_context.data_inicio, # ex: 1º do mes
            data_fim=global_context.data_fim,       # ex: 30 do mes
            eventos_periodo=global_context.agenda_itens 
        )
        
        context_dict = agent_context.model_dump()
        
        if not context_dict["eventos_periodo"]:
            return []

        # 2. Cache Check
        cached_response = await ai_cache.get(cls.DOMAIN, cls.AGENT_NAME, context_dict)
        if cached_response:
            return cached_response

        # 3. Preparação do Prompt
        # A formatação agora inclui a DATA explicitamente para cada item
        agenda_str = cls._format_agenda_mensal(context_dict["eventos_periodo"])

        user_prompt = USER_PROMPT_TEMPLATE.format(
            data_inicio=context_dict["data_inicio"],
            data_fim=context_dict["data_fim"],
            agenda_json=agenda_str
        )

        try:
            # 4. LLM Call
            raw_response = await llm_client.call_model(
                system_prompt=SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.0 # Zero criatividade, foco total em lógica
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

    @staticmethod
    def _format_agenda_mensal(items: List[Dict[str, Any]]) -> str:
        """
        Formata a agenda do mês.
        Crucial: Deve incluir DATA, HORA, LOCAL e TÍTULO.
        Ordena por Data e depois por Hora.
        """
        sanitized = []
        
        # Chave de ordenação composta: Data do evento + Hora de início
        # Assumindo formato ISO (YYYY-MM-DD...) a string sort funciona bem
        sorted_items = sorted(
            items, 
            key=lambda x: (x.get('start_time', ''), x.get('end_time', ''))
        )

        for item in sorted_items:
            # Extração robusta da data/hora para visualização do LLM
            start_raw = item.get('start_time', '')
            
            # Formatação visual simples para o prompt
            # Ex: "2023-10-27 [09:00 - 10:00]"
            try:
                # Tenta separar data e hora se for ISO string
                date_part = start_raw.split('T')[0] if 'T' in start_raw else start_raw[:10]
                time_part = start_raw.split('T')[1][:5] if 'T' in start_raw else start_raw[-5:]
                end_time_part = item.get('end_time', '').split('T')[1][:5] if 'T' in item.get('end_time', '') else item.get('end_time', '')[-5:]
            except:
                date_part = "Data?"
                time_part = start_raw
                end_time_part = item.get('end_time')

            sanitized.append(f"- [{date_part}] {time_part} até {end_time_part} | Local: {item.get('location', 'N/A')} | Evento: {item.get('title')}")
        
        # Retorna string única separada por quebras de linha (melhor que JSON puro para listas muito longas de mês)
        return "\n".join(sanitized)