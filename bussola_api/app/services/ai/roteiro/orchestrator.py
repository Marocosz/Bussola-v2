"""
=======================================================================================
ARQUIVO: orchestrator.py (Orquestrador de Roteiro e Agenda)
=======================================================================================

OBJETIVO:
    Atuar como o HUB central de inteligência para o domínio de Roteiro (Agenda/Calendário).
    Este módulo coordena a execução de múltiplos agentes especialistas para analisar
    compromissos, detectar conflitos, avaliar carga de trabalho e sugerir logística.

CAMADA:
    Services / AI / Roteiro (Backend).
    É o ponto de entrada chamado pelo `ai.py` (Controller).

RESPONSABILIDADES:
    1. Unificação de Contexto: Transformar dados brutos da agenda em um objeto de contexto imutável.
    2. Execução Paralela: Disparar ConflictGuardian, DensityAuditor, RecoveryAgent e TravelMarshal simultaneamente.
    3. Resiliência: Garantir que a falha de um agente não impeça o retorno dos insights dos outros.
    4. Curadoria (CFO Logic): Filtrar ruídos (ex: checklists genéricos), deduplicar e ordenar por severidade.

INTEGRAÇÕES:
    - Agentes: ConflictGuardian, DensityAuditor, RecoveryAgent, TravelMarshal.
    - Contexto: RoteiroContext.
"""

import asyncio
import logging
import json
from typing import List, Dict, Any

# Imports dos Agentes Especialistas
from app.services.ai.roteiro.conflict_guardian.agent import ConflictGuardianAgent
from app.services.ai.roteiro.density_auditor.agent import DensityAuditorAgent
from app.services.ai.roteiro.recovery_agent.agent import RecoveryAgent
from app.services.ai.roteiro.travel_marshal.agent import TravelMarshalAgent

# Contexto e Schema Base
from app.services.ai.roteiro.context import RoteiroContext
from app.services.ai.base.base_schema import AtomicSuggestion

logger = logging.getLogger(__name__)

class RoteiroOrchestrator:
    """
    Orquestrador do domínio Roteiro.
    Responsável por instanciar o contexto e coordenar a execução paralela
    dos agentes especialistas (Scatter-Gather Pattern).
    """
    
    @staticmethod
    async def analyze_schedule(
        data_atual: str,
        dia_semana: str,
        data_inicio: str,
        data_fim: str,
        agenda_itens: List[Dict[str, Any]],
        preferences: Dict[str, Any] = None
    ) -> List[AtomicSuggestion]:
        """
        Executa a análise completa da agenda do usuário.
        
        Args:
            data_atual: Data de referência (hoje).
            data_inicio, data_fim: Janela de análise (ex: mês corrente).
            agenda_itens: Lista bruta de compromissos vindos do banco/integração.
            preferences: Preferências do usuário (opcional).
            
        Returns:
            Lista consolidada, filtrada e ordenada de sugestões.
        """
        
        # ----------------------------------------------------------------------
        # 1. MONTAGEM DO CONTEXTO GLOBAL
        # ----------------------------------------------------------------------
        # Cria a "Single Source of Truth" (Fonte Única da Verdade).
        # Todos os agentes leem deste mesmo objeto, garantindo consistência.
        context = RoteiroContext(
            data_atual=data_atual,
            dia_semana=dia_semana,
            data_inicio=data_inicio,
            data_fim=data_fim,
            agenda_itens=agenda_itens,
            user_preferences=preferences or {}
        )
        
        logger.info("RoteiroOrchestrator: iniciando análise", extra={"agenda_count": len(agenda_itens)})

        # ----------------------------------------------------------------------
        # 2. EXECUÇÃO PARALELA (Asyncio)
        # ----------------------------------------------------------------------
        # Dispara todos os agentes simultaneamente para reduzir a latência total.
        # 'return_exceptions=True' implementa Degradação Graciosa:
        # Se um agente falhar, os outros continuam e o fluxo não quebra.
        results = await asyncio.gather(
            ConflictGuardianAgent.run(context),
            DensityAuditorAgent.run(context),
            RecoveryAgent.run(context),
            TravelMarshalAgent.run(context),
            return_exceptions=True
        )

        # ----------------------------------------------------------------------
        # 3. CONSOLIDAÇÃO E TRATAMENTO DE ERROS
        # ----------------------------------------------------------------------
        raw_suggestions: List[AtomicSuggestion] = []
        
        agents_map = ["ConflictGuardian", "DensityAuditor", "RecoveryAgent", "TravelMarshal"]

        for i, result in enumerate(results):
            agent_name = agents_map[i]
            
            # Tratamento individual de falhas
            if isinstance(result, Exception):
                logger.error("Agente retornou erro", extra={"agent": agent_name, "result": str(result)})
                continue

            if result:
                raw_suggestions.extend(result)

                if len(result) > 0:
                    logger.debug("Sugestões do agente", extra={"agent": agent_name, "count": len(result)})
                else:
                    logger.info("Agente sem sugestões", extra={"agent": agent_name})

        # ----------------------------------------------------------------------
        # 4. PÓS-PROCESSAMENTO E FILTROS DE UX
        # ----------------------------------------------------------------------
        cleaned_suggestions = []
        seen_keys = set()
        
        # Mapa de prioridade para ordenação final (Menor valor = Maior prioridade)
        severity_order = {"high": 0, "medium": 1, "low": 2, "none": 3}

        for suggestion in raw_suggestions:
            # --- Regra de Negócio Específica: TravelMarshal ---
            # O TravelMarshal às vezes gera checklists genéricos ("Faça uma lista") 
            # para eventos que ele acha que são viagens, mas não são.
            # Aqui aplicamos um filtro semântico estrito: se não tiver palavras-chave
            # de viagem no conteúdo, descartamos o checklist para evitar ruído.
            if suggestion.agent_source == "travel_marshal" and suggestion.type == 'info':
                content_lower = suggestion.content.lower()
                title_lower = suggestion.title.lower()
                if "checklist" in title_lower and not any(x in content_lower for x in ["viagem", "voo", "aeroporto", "mala"]):
                    continue

            # --- Filtro de Deduplicação ---
            # Garante unicidade baseada no Título + Alvo da ação.
            key = f"{suggestion.title}-{suggestion.action.target}"
            if key in seen_keys:
                continue
            
            seen_keys.add(key)
            cleaned_suggestions.append(suggestion)

        # ----------------------------------------------------------------------
        # 5. ORDENAÇÃO FINAL
        # ----------------------------------------------------------------------
        # Ordena para que cards de alta severidade (High) apareçam primeiro na UI.
        cleaned_suggestions.sort(key=lambda x: severity_order.get(x.severity, 99))

        logger.info("RoteiroOrchestrator: análise concluída")
        logger.info("Redução de ruído aplicada", extra={"original": len(raw_suggestions), "final": len(cleaned_suggestions)})
        
        return cleaned_suggestions