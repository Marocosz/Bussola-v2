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
        # 1. Mapeamento de Contexto
        agent_context = DensityAuditorContext(
            data_inicio=global_context.data_inicio,
            data_fim=global_context.data_fim,
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
        # Formatamos focando em DURAÇÃO e TIPO, que são vitais para análise de densidade
        agenda_str = cls._format_schedule_for_density(context_dict["eventos_periodo"])

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
                temperature=0.1 # Baixa temperatura para manter a análise técnica e consistente
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
    def _format_schedule_for_density(items: List[Dict[str, Any]]) -> str:
        """
        Formata a agenda destacando a DURAÇÃO e a SEQUÊNCIA dos eventos.
        Isso ajuda o LLM a visualizar 'blocos' de tempo e 'buracos' (gaps).
        """
        sanitized = []
        # Ordenação cronológica absoluta
        sorted_items = sorted(
            items, 
            key=lambda x: (x.get('start_time', ''), x.get('end_time', ''))
        )

        for item in sorted_items:
            # Tenta calcular a duração para facilitar a vida do LLM
            duration_str = "Duração desconhecida"
            try:
                # Assumindo formato ISO completo ou parciais, lógica simplificada para exemplo
                # Num cenário real, usar datetime.strptime é o ideal
                start = item.get('start_time', '')
                end = item.get('end_time', '')
                # Apenas repassamos os horários brutos, o LLM é bom em calcular deltas se os horários estiverem claros
                time_info = f"{start[11:16] if 'T' in start else start[-8:]} até {end[11:16] if 'T' in end else end[-8:]}"
            except:
                time_info = "Horário irregular"

            # Inclui categoria/tags se houver, pois ajuda a detectar context switching
            categoria = item.get('category', 'Geral')
            
            sanitized.append(
                f"- [{item.get('start_time', '')[:10]}] {time_info} | "
                f"Atividade: {item.get('title', 'Sem título')} | "
                f"Tipo: {categoria} | Local: {item.get('location', 'N/A')}"
            )
        
        return "\n".join(sanitized)