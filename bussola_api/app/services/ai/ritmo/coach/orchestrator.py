import logging
import operator
from typing import List, Annotated, TypedDict

from langgraph.graph import StateGraph, END

# Imports do Sistema
from app.models.ritmo import RitmoBio, RitmoPlanoTreino
from app.services.ai.base.base_schema import AtomicSuggestion

# Imports dos Agentes
from app.services.ai.ritmo.coach.volume_architect.agent import VolumeArchitectAgent
from app.services.ai.ritmo.coach.volume_architect.schema import VolumeArchitectContext

from app.services.ai.ritmo.coach.technique_master.agent import TechniqueMasterAgent
from app.services.ai.ritmo.coach.technique_master.schema import TechniqueMasterContext, ExerciseItem

from app.services.ai.ritmo.coach.intensity_strategist.agent import IntensityStrategistAgent
from app.services.ai.ritmo.coach.intensity_strategist.schema import IntensityStrategistContext

logger = logging.getLogger(__name__)

# ------------------------------------------------------------------------------
# 1. STATE DEFINITION
# ------------------------------------------------------------------------------
class CoachState(TypedDict):
    bio: RitmoBio
    plano: RitmoPlanoTreino
    suggestions: Annotated[List[AtomicSuggestion], operator.add]

# ------------------------------------------------------------------------------
# 2. NODE FUNCTIONS (Adapters)
# ------------------------------------------------------------------------------

async def run_volume_architect(state: CoachState):
    bio = state["bio"]
    plano = state["plano"]
    
    # Mapper: Calcula volume real iterando sobre dias e exercícios
    volume_map = {}
    
    if plano.dias:
        for dia in plano.dias:
            if dia.items:
                for exercicio in dia.items:
                    # Assumindo que o model RitmoTreinoItem tem 'series' e 'grupo_muscular'
                    # Ajuste conforme seu model real
                    grupo = getattr(exercicio, "grupo_muscular", "Geral")
                    series = getattr(exercicio, "series", 3)
                    
                    if grupo in volume_map:
                        volume_map[grupo] += int(series)
                    else:
                        volume_map[grupo] = int(series)

    context = VolumeArchitectContext(
        nivel_usuario=bio.experiencia_treino or "iniciante",
        objetivo=bio.objetivo or "saude",
        volume_semanal=volume_map
    )
    
    results = await VolumeArchitectAgent.run(context)
    return {"suggestions": results}

async def run_technique_master(state: CoachState):
    plano = state["plano"]
    
    # Mapper: Extrai lista de exercícios únicos
    unique_exercises = []
    seen_names = set()
    
    if plano.dias:
        for dia in plano.dias:
            if dia.items:
                for item in dia.items:
                    nome = getattr(item, "exercicio_nome", "Exercício")
                    if nome not in seen_names:
                        unique_exercises.append(ExerciseItem(
                            nome=nome,
                            categoria=getattr(item, "grupo_muscular", "Geral")
                        ))
                        seen_names.add(nome)

    context = TechniqueMasterContext(
        exercicios_chave=unique_exercises[:15] # Limita para não estourar prompt
    )
    
    results = await TechniqueMasterAgent.run(context)
    return {"suggestions": results}

async def run_intensity_strategist(state: CoachState):
    bio = state["bio"]
    
    context = IntensityStrategistContext(
        nivel_usuario=bio.experiencia_treino or "iniciante",
        foco_treino=bio.objetivo or "hipertrofia"
    )
    
    results = await IntensityStrategistAgent.run(context)
    return {"suggestions": results}

# ------------------------------------------------------------------------------
# 3. GRAPH CONSTRUCTION
# ------------------------------------------------------------------------------
def build_coach_graph():
    workflow = StateGraph(CoachState)
    
    # Nodes
    workflow.add_node("volume_architect", run_volume_architect)
    workflow.add_node("technique_master", run_technique_master)
    workflow.add_node("intensity_strategist", run_intensity_strategist)
    
    # Edges (Parallel Execution)
    workflow.set_entry_point("volume_architect")
    workflow.set_entry_point("technique_master")
    workflow.set_entry_point("intensity_strategist")
    
    workflow.add_edge("volume_architect", END)
    workflow.add_edge("technique_master", END)
    workflow.add_edge("intensity_strategist", END)
    
    return workflow.compile()

coach_graph = build_coach_graph()

# ------------------------------------------------------------------------------
# 4. FACADE
# ------------------------------------------------------------------------------
class CoachOrchestrator:
    @staticmethod
    async def analyze(bio: RitmoBio, plano: RitmoPlanoTreino) -> List[AtomicSuggestion]:
        logger.info(f"Iniciando CoachOrchestrator via LangGraph para BioID: {bio.id}")
        
        initial_state = {
            "bio": bio,
            "plano": plano,
            "suggestions": []
        }
        
        try:
            final_state = await coach_graph.ainvoke(initial_state)
            return final_state["suggestions"]
        except Exception as e:
            logger.error(f"Erro crítico no CoachOrchestrator: {e}")
            return []