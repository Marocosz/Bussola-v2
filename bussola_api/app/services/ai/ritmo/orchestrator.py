"""
=======================================================================================
ARQUIVO: orchestrator.py (Orquestrador Mestre do Ritmo)
=======================================================================================

OBJETIVO:
    Atuar como o HUB central de inteligência para todo o módulo "Ritmo" (Saúde Integrada).
    Este módulo é o "Gerente Geral" que coordena os departamentos de Nutrição e Treino.

CAMADA:
    Services / AI / Ritmo (Backend).
    É o ponto de entrada chamado pelo Controller (`app/api/v1/endpoints/ai.py`).

RESPONSABILIDADES:
    1. Orquestração de Domínio: Receber dados de saúde e decidir quais sub-orquestradores acionar.
    2. Paralelismo: Disparar análises de Nutrição e Treino simultaneamente para reduzir latência.
    3. Agregação e Resiliência: Juntar todos os insights e garantir que a falha de um lado (ex: Treino)
       não impeça o retorno do outro (ex: Nutrição).
    4. Priorização Global: Ordenar a lista final mista para que o usuário veja o mais crítico primeiro.

INTEGRAÇÕES:
    - NutriOrchestrator: Especialista em Dieta.
    - CoachOrchestrator: Especialista em Treino.
    - Models: RitmoBio, RitmoDietaConfig, RitmoPlanoTreino.
"""

import logging
import asyncio
from typing import List, Optional

# Models SQL
from app.models.ritmo import RitmoBio, RitmoDietaConfig, RitmoPlanoTreino

# Base Schemas
from app.services.ai.base.base_schema import AtomicSuggestion
from app.services.ai.ritmo.schema import RitmoAnalysisResponse

# Sub-Orchestrators (Especialistas de Domínio)
from app.services.ai.ritmo.nutri.orchestrator import NutriOrchestrator
from app.services.ai.ritmo.coach.orchestrator import CoachOrchestrator

logger = logging.getLogger(__name__)

class RitmoOrchestrator:
    """
    Controlador Principal da IA do Ritmo.
    """
    
    @classmethod
    async def analyze_profile(
        cls, 
        bio: RitmoBio, 
        dieta: Optional[RitmoDietaConfig] = None, 
        plano_treino: Optional[RitmoPlanoTreino] = None
    ) -> RitmoAnalysisResponse:
        """
        Executa a análise 360º do perfil do usuário.
        
        LÓGICA:
        Verifica quais dados estão disponíveis (Dieta? Treino?) e aciona os
        respectivos especialistas em paralelo.
        
        Args:
            bio: Dados biológicos e antropométricos (Peso, Altura, Objetivo) - OBRIGATÓRIO.
            dieta: Configuração de dieta ativa (Refeições, Alimentos) - OPCIONAL.
            plano_treino: Plano de treino ativo (Fichas, Exercícios) - OPCIONAL.
            
        Returns:
            Objeto contendo a lista unificada e priorizada de sugestões.
        """
        
        # Validação de Dependência Crítica
        # Sem dados biológicos (Contexto do Usuário), nenhuma IA consegue operar corretamente.
        if not bio:
            logger.warning("Tentativa de análise de IA sem Bio definida.")
            return RitmoAnalysisResponse(suggestions=[])

        tasks = []

        # ----------------------------------------------------------------------
        # 1. AGENDAMENTO DE TAREFAS (Dispatch)
        # ----------------------------------------------------------------------
        # Verifica a existência dos dados antes de agendar a task.
        # Isso evita chamar orquestradores com None, economizando recursos.
        
        if dieta:
            tasks.append(NutriOrchestrator.analyze(bio, dieta))
        
        if plano_treino:
            tasks.append(CoachOrchestrator.analyze(bio, plano_treino))

        # ----------------------------------------------------------------------
        # 2. EXECUÇÃO CONCORRENTE (Asyncio)
        # ----------------------------------------------------------------------
        # Executa Nutri e Coach ao mesmo tempo.
        # 'return_exceptions=True' é crucial aqui: implementa "Degradação Graciosa".
        # Se o módulo de Treino quebrar, o usuário ainda recebe as dicas de Nutrição.
        results_lists = await asyncio.gather(*tasks, return_exceptions=True)

        # ----------------------------------------------------------------------
        # 3. CONSOLIDAÇÃO (Flattening & Error Handling)
        # ----------------------------------------------------------------------
        final_suggestions: List[AtomicSuggestion] = []

        for result in results_lists:
            # Caminho Feliz: O orquestrador retornou uma lista de sugestões
            if isinstance(result, list):
                final_suggestions.extend(result)
            
            # Caminho de Falha: Um dos orquestradores explodiu
            elif isinstance(result, Exception):
                logger.error(f"Erro em um dos sub-orquestradores: {result}")
                # Apenas logamos. O fluxo continua com o que tivermos de sucesso.

        # ----------------------------------------------------------------------
        # 4. ORDENAÇÃO INTELIGENTE (Priorização Global)
        # ----------------------------------------------------------------------
        # Como misturamos insights de Nutrição e Treino, precisamos reordenar
        # para garantir que alertas críticos (ex: Lesão ou Déficit Extremo)
        # apareçam no topo do Dashboard, independente da origem.
        
        severity_weight = {
            "critical": 4,
            "high": 3,
            "warning": 3, # Mapping de compatibilidade para sistemas legados
            "medium": 2,
            "suggestion": 1,
            "tip": 1,
            "praise": 0,
            "low": 0
        }

        # Ordenação reversa (Maior peso primeiro)
        # Soma o peso da severidade + peso do tipo para desempate.
        final_suggestions.sort(
            key=lambda x: severity_weight.get(x.severity, 0) + severity_weight.get(x.type, 0),
            reverse=True
        )

        logger.info(f"Análise Ritmo concluída. Total de insights: {len(final_suggestions)}")
        
        return RitmoAnalysisResponse(suggestions=final_suggestions)