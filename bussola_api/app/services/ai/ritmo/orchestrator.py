import logging
import asyncio
from typing import List, Optional

# Models SQL
from app.models.ritmo import RitmoBio, RitmoDietaConfig, RitmoPlanoTreino

# Base Schemas
from app.services.ai.base.base_schema import AtomicSuggestion
from app.services.ai.ritmo.schema import RitmoAnalysisResponse

# Sub-Orchestrators
from app.services.ai.ritmo.nutri.orchestrator import NutriOrchestrator
from app.services.ai.ritmo.coach.orchestrator import CoachOrchestrator

logger = logging.getLogger(__name__)

class RitmoOrchestrator:
    """
    Controlador Principal da IA do Ritmo.
    Responsabilidades:
    1. Receber os modelos de dados do Service Layer.
    2. Despachar para Nutri e Coach em paralelo.
    3. Agregar, ordenar e entregar o resultado final.
    """
    
    @classmethod
    async def analyze_profile(
        cls, 
        bio: RitmoBio, 
        dieta: Optional[RitmoDietaConfig] = None, 
        plano_treino: Optional[RitmoPlanoTreino] = None
    ) -> RitmoAnalysisResponse:
        """
        Executa a análise completa do perfil do usuário.
        
        Args:
            bio: Dados biológicos (Obrigatório).
            dieta: Configuração de dieta ativa (Opcional).
            plano_treino: Plano de treino ativo (Opcional).
        """
        if not bio:
            logger.warning("Tentativa de análise de IA sem Bio definida.")
            return RitmoAnalysisResponse(suggestions=[])

        tasks = []

        # 1. Agendamento de Tarefas Paralelas
        # Só chamamos o orquestrador se o dado existir
        if dieta:
            tasks.append(NutriOrchestrator.analyze(bio, dieta))
        
        if plano_treino:
            tasks.append(CoachOrchestrator.analyze(bio, plano_treino))

        # 2. Execução Concorrente (Wait for all)
        # Retorna uma lista de listas: [[sugestoes_nutri], [sugestoes_coach]]
        results_lists = await asyncio.gather(*tasks, return_exceptions=True)

        # 3. Consolidação (Flattening)
        final_suggestions: List[AtomicSuggestion] = []

        for result in results_lists:
            if isinstance(result, list):
                final_suggestions.extend(result)
            elif isinstance(result, Exception):
                logger.error(f"Erro em um dos sub-orquestradores: {result}")
                # Não quebramos a request, apenas logamos o erro (Degradação Graciosa)

        # 4. Ordenação Inteligente (Post-Processing)
        # Prioridade: critical > high > medium > low
        severity_weight = {
            "critical": 4,
            "high": 3,
            "warning": 3, # warning tratado como high
            "medium": 2,
            "suggestion": 1,
            "tip": 1,
            "praise": 0,
            "low": 0
        }

        # Sort in-place reverso (maior peso primeiro)
        final_suggestions.sort(
            key=lambda x: severity_weight.get(x.severity, 0) + severity_weight.get(x.type, 0),
            reverse=True
        )

        logger.info(f"Análise Ritmo concluída. Total de insights: {len(final_suggestions)}")
        
        return RitmoAnalysisResponse(suggestions=final_suggestions)