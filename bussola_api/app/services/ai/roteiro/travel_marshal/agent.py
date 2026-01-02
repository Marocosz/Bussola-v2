"""
=======================================================================================
ARQUIVO: agent.py (Agente TravelMarshal)
=======================================================================================

OBJETIVO:
    Implementar o "Marshal de Viagem" para o domínio de ROTEIRO (Agenda).
    Este agente é responsável pela logística e inteligência de deslocamento.
    
    Sua missão é identificar eventos que exigem presença física, viagens ou 
    deslocamentos complexos, alertando sobre tempo de trânsito, check-ins e 
    logística de chegada.

CAMADA:
    Services / AI / Roteiro (Backend).
    É invocado pelo `RoteiroOrchestrator` durante a análise de agenda.

RESPONSABILIDADES:
    1. Filtragem de Contexto: Diferenciar eventos presenciais de remotos (Zoom/Meet).
    2. Detecção de Viagem: Identificar padrões de viagem (Voos, Hotéis, Rodoviária).
    3. Análise Logística: Alertar se o tempo entre um evento e outro é insuficiente dado o deslocamento.
    4. Engenharia de Prompt: Formatar a agenda destacando "Origem" (implícita) e "Destino".

INTEGRAÇÕES:
    - LLMFactory: Para estimar viabilidade de deslocamento e sugerir horários de saída.
    - AgentCache: Para evitar reprocessamento.
    - RoteiroContext: Fonte de dados (Lista de Compromissos).
"""

import logging
import json
from typing import List, Dict, Any

from app.services.ai.base.llm_factory import llm_client
from app.services.ai.base.post_processor import PostProcessor
from app.services.ai.base.cache import ai_cache
from app.services.ai.base.base_schema import AtomicSuggestion

from app.services.ai.roteiro.context import RoteiroContext
from app.services.ai.roteiro.travel_marshal.schema import TravelMarshalContext
from app.services.ai.roteiro.travel_marshal.prompts import SYSTEM_PROMPT, USER_PROMPT_TEMPLATE

logger = logging.getLogger(__name__)

class TravelMarshalAgent:
    """
    Agente Especialista: Logística, Viagens e Tempo de Deslocamento.
    
    Foco:
    Ignora o conteúdo da reunião ("Sobre o que é?") e foca na física ("Onde é?").
    """
    DOMAIN = "roteiro"
    AGENT_NAME = "travel_marshal"

    @classmethod
    async def run(cls, global_context: RoteiroContext) -> List[AtomicSuggestion]:
        """
        Executa a análise de logística e deslocamento.

        Args:
            global_context: Contém a lista de compromissos do período.

        Returns:
            Lista de sugestões sobre tempo de trânsito, alertas de voo ou logística.
        """
        
        # ----------------------------------------------------------------------
        # 1. FILTRAGEM HEURÍSTICA (Python > LLM)
        # ----------------------------------------------------------------------
        # Decisão de Negócio: Nem todo evento da agenda exige deslocamento.
        # Para economizar tokens e focar a IA, removemos reuniões online e
        # priorizamos itens com local físico ou palavras-chave de transporte.
        
        keywords = ['voo', 'flight', 'embarque', 'aeroporto', 'viagem', 'check-in', 'hotel', 'estrada', 'rodoviaria']
        
        eventos_relevantes = []
        for item in global_context.agenda_itens:
            loc = item.get('location', '').lower()
            title = item.get('title', '').lower()
            
            # Lógica de Seleção:
            # 1. Tem local definido E NÃO É online/zoom.
            # 2. OU tem palavra-chave de viagem no título (mesmo sem local preenchido).
            if (loc and 'online' not in loc and 'zoom' not in loc) or any(k in title for k in keywords):
                eventos_relevantes.append(item)

        # ----------------------------------------------------------------------
        # 2. MONTAGEM DE CONTEXTO E OTIMIZAÇÃO
        # ----------------------------------------------------------------------
        agent_context = TravelMarshalContext(
            data_inicio=global_context.data_inicio,
            data_fim=global_context.data_fim,
            eventos_com_deslocamento=eventos_relevantes
        )
        
        context_dict = agent_context.model_dump()
        
        # Se não há eventos presenciais ou viagens, o Marshal não tem trabalho.
        if not context_dict["eventos_com_deslocamento"]:
            return []

        # ----------------------------------------------------------------------
        # 3. VERIFICAÇÃO DE CACHE
        # ----------------------------------------------------------------------
        cached_response = await ai_cache.get(cls.DOMAIN, cls.AGENT_NAME, context_dict)
        if cached_response:
            return cached_response

        # ----------------------------------------------------------------------
        # 4. PREPARAÇÃO DO PROMPT
        # ----------------------------------------------------------------------
        # Formatação específica para logística: Destaca o campo DESTINO.
        agenda_str = cls._format_travel_schedule(context_dict["eventos_com_deslocamento"])

        user_prompt = USER_PROMPT_TEMPLATE.format(
            data_inicio=context_dict["data_inicio"],
            data_fim=context_dict["data_fim"],
            agenda_json=agenda_str
        )

        try:
            # ------------------------------------------------------------------
            # 5. CHAMADA LLM E PÓS-PROCESSAMENTO
            # ------------------------------------------------------------------
            # Temperature 0.1:
            # Logística exige precisão. Não queremos alucinações sobre tempos de voo
            # ou distâncias físicas. O modelo deve ser conservador e analítico.
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
    def _format_travel_schedule(items: List[Dict[str, Any]]) -> str:
        """
        Formata a agenda focando explicitamente em GEOGRAFIA (Destino).
        
        OBJETIVO:
        Ajudar o LLM a entender que o foco é o deslocamento "de -> para".
        Ordenamos cronologicamente para permitir o cálculo de tempo de trânsito entre eventos.
        """
        sanitized = []
        sorted_items = sorted(items, key=lambda x: x.get('start_time', ''))
        
        for item in sorted_items:
            # Destacamos o 'location' como 'DESTINO' no texto para forçar a atenção da IA
            loc = item.get('location', 'Local N/A')
            
            # Limitamos a descrição a 50 chars para economizar tokens, 
            # já que detalhes da pauta não importam para o trânsito.
            sanitized.append(
                f"- [{item.get('start_time')}] {item.get('title')} "
                f"| DESTINO: {loc} "
                f"| Detalhes: {item.get('description', '')[:50]}"
            )
        
        return "\n".join(sanitized)