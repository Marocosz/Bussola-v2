import logging
import operator
from typing import List, Annotated, TypedDict

from langgraph.graph import StateGraph, END

# Imports Models
from app.models.ritmo import RitmoBio, RitmoPlanoTreino
from app.services.ai.base.base_schema import AtomicSuggestion

# Imports Agents
from app.services.ai.ritmo.coach.volume_architect.agent import VolumeArchitectAgent
from app.services.ai.ritmo.coach.volume_architect.schema import VolumeArchitectContext

from app.services.ai.ritmo.coach.technique_master.agent import TechniqueMasterAgent
from app.services.ai.ritmo.coach.technique_master.schema import TechniqueMasterContext, ExerciseItem

from app.services.ai.ritmo.coach.intensity_strategist.agent import IntensityStrategistAgent
from app.services.ai.ritmo.coach.intensity_strategist.schema import IntensityStrategistContext

logger = logging.getLogger(__name__)

# ------------------------------------------------------------------------------
# 1. STATE
# ------------------------------------------------------------------------------
class CoachState(TypedDict):
    bio: RitmoBio
    plano: RitmoPlanoTreino
    suggestions: Annotated[List[AtomicSuggestion], operator.add]

# ------------------------------------------------------------------------------
# 2. NODES (Mappers Corrigidos conforme models/ritmo.py)
# ------------------------------------------------------------------------------

async def run_volume_architect(state: CoachState):
    bio = state["bio"]
    plano = state["plano"]
    
    volume_map = {}
    if plano.dias:
        for dia in plano.dias:
            # Model: relacionamento é 'exercicios', não 'items'
            if dia.exercicios:
                for exercicio in dia.exercicios:
                    grupo = getattr(exercicio, "grupo_muscular", "Geral") or "Geral"
                    series = getattr(exercicio, "series", 3)
                    
                    if grupo in volume_map:
                        volume_map[grupo] += int(series)
                    else:
                        volume_map[grupo] = int(series)

    # Model: Usamos 'nivel_atividade' pois 'experiencia_treino' não existe no schema fornecido
    nivel = getattr(bio, "nivel_atividade", "iniciante")
    
    context = VolumeArchitectContext(
        nivel_usuario=str(nivel),
        objetivo=getattr(bio, "objetivo", "saude"),
        volume_semanal=volume_map
    )
    
    results = await VolumeArchitectAgent.run(context)
    return {"suggestions": results}

async def run_technique_master(state: CoachState):
    plano = state["plano"]
    
    unique_exercises = []
    seen_names = set()
    
    if plano.dias:
        for dia in plano.dias:
            if dia.exercicios:
                for item in dia.exercicios:
                    # Model: nome_exercicio
                    nome = getattr(item, "nome_exercicio", None)
                    if nome and nome not in seen_names:
                        unique_exercises.append(ExerciseItem(
                            nome=str(nome),
                            categoria=getattr(item, "grupo_muscular", "Geral") or "Geral"
                        ))
                        seen_names.add(nome)

    context = TechniqueMasterContext(
        exercicios_chave=unique_exercises[:15]
    )
    
    results = await TechniqueMasterAgent.run(context)
    return {"suggestions": results}

async def run_intensity_strategist(state: CoachState):
    bio = state["bio"]
    
    nivel = getattr(bio, "nivel_atividade", "iniciante")
    
    context = IntensityStrategistContext(
        nivel_usuario=str(nivel),
        foco_treino=getattr(bio, "objetivo", "hipertrofia")
    )
    
    results = await IntensityStrategistAgent.run(context)
    return {"suggestions": results}

# ------------------------------------------------------------------------------
# 3. GRAPH
# ------------------------------------------------------------------------------
def build_coach_graph():
    workflow = StateGraph(CoachState)
    
    workflow.add_node("volume_architect", run_volume_architect)
    workflow.add_node("technique_master", run_technique_master)
    workflow.add_node("intensity_strategist", run_intensity_strategist)
    
    workflow.set_entry_point("volume_architect")
    workflow.set_entry_point("technique_master")
    workflow.set_entry_point("intensity_strategist")
    
    workflow.add_edge("volume_architect", END)
    workflow.add_edge("technique_master", END)
    workflow.add_edge("intensity_strategist", END)
    
    return workflow.compile()

coach_graph = build_coach_graph()

class CoachOrchestrator:
    @staticmethod
    async def analyze(bio: RitmoBio, plano: RitmoPlanoTreino) -> List[AtomicSuggestion]:
        logger.info(f"Iniciando CoachOrchestrator para BioID: {bio.id}")
        initial_state = {"bio": bio, "plano": plano, "suggestions": []}
        try:
            final_state = await coach_graph.ainvoke(initial_state)
            return final_state["suggestions"]
        except Exception as e:
            logger.error(f"Erro crítico no CoachOrchestrator: {e}")
            return []