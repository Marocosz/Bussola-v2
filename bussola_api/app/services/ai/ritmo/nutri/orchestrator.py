import logging
import operator
from typing import List, Annotated, TypedDict

from langgraph.graph import StateGraph, END

# Import Models
from app.models.ritmo import RitmoBio, RitmoDietaConfig

# Import Schemas Base
from app.services.ai.base.base_schema import AtomicSuggestion

# Import Agentes
from app.services.ai.ritmo.nutri.macro_auditor.agent import MacroAuditorAgent
from app.services.ai.ritmo.nutri.macro_auditor.schema import MacroAuditorContext

from app.services.ai.ritmo.nutri.meal_detective.agent import MealDetectiveAgent
from app.services.ai.ritmo.nutri.meal_detective.schema import MealDetectiveContext, RefeicaoContext, AlimentoItemContext

from app.services.ai.ritmo.nutri.variety_expert.agent import VarietyExpertAgent
from app.services.ai.ritmo.nutri.variety_expert.schema import VarietyExpertContext, FoodItemSimple

logger = logging.getLogger(__name__)

# ------------------------------------------------------------------------------
# 1. STATE
# ------------------------------------------------------------------------------
class NutriState(TypedDict):
    bio: RitmoBio
    dieta: RitmoDietaConfig
    suggestions: Annotated[List[AtomicSuggestion], operator.add]

# ------------------------------------------------------------------------------
# 2. NODES (Mappers Corrigidos conforme models/ritmo.py)
# ------------------------------------------------------------------------------

async def run_macro_auditor(state: NutriState):
    bio = state["bio"]
    dieta = state["dieta"]
    
    # Recalcula totais da dieta, pois o model RitmoDietaConfig só guarda calorias
    total_prot = 0.0
    total_carb = 0.0
    total_gord = 0.0
    
    if dieta.refeicoes:
        for ref in dieta.refeicoes:
            if ref.alimentos:
                for alim in ref.alimentos:
                    total_prot += float(alim.proteina or 0)
                    total_carb += float(alim.carbo or 0)
                    total_gord += float(alim.gordura or 0)

    context = MacroAuditorContext(
        # Mapeamento CORRETO com models/ritmo.py
        peso_atual=float(bio.peso or 70.0),
        objetivo=bio.objetivo or "manutencao",
        tmb=float(bio.tmb or 1500.0),
        get=float(bio.gasto_calorico_total or 2000.0),
        
        dieta_calorias=float(dieta.calorias_calculadas or 0),
        dieta_proteina=total_prot,
        dieta_carbo=total_carb,
        dieta_gordura=total_gord,
        
        agua_ml=float(bio.meta_agua or 2000.0),
        user_level=bio.nivel_atividade or "moderado"
    )
    
    results = await MacroAuditorAgent.run(context)
    return {"suggestions": results}

async def run_meal_detective(state: NutriState):
    dieta = state["dieta"]
    bio = state["bio"]
    
    refeicoes_ctx = []
    
    if dieta.refeicoes:
        for ref in dieta.refeicoes:
            alimentos_ctx = []
            total_cal = 0.0
            
            if ref.alimentos:
                for item in ref.alimentos:
                    prot = float(item.proteina or 0)
                    carb = float(item.carbo or 0)
                    fat = float(item.gordura or 0)
                    cal = float(item.calorias or 0)
                    total_cal += cal

                    alimentos_ctx.append(AlimentoItemContext(
                        nome=str(item.nome), # Model: nome
                        # Model: quantidade (float) + unidade (str)
                        quantidade=f"{item.quantidade}{item.unidade}", 
                        proteina=prot,
                        carbo=carb,
                        gordura=fat
                    ))
            
            refeicoes_ctx.append(RefeicaoContext(
                id=ref.id,
                nome=ref.nome,
                # Model não tem 'horario', usamos o nome e ordem como contexto temporal
                horario=f"{ref.nome} (Ref {ref.ordem})", 
                alimentos=alimentos_ctx,
                total_calorias=total_cal
            ))

    context = MealDetectiveContext(
        refeicoes=refeicoes_ctx,
        objetivo_usuario=bio.objetivo or "saude"
    )
    
    results = await MealDetectiveAgent.run(context)
    return {"suggestions": results}

async def run_variety_expert(state: NutriState):
    dieta = state["dieta"]
    
    foods_simple = []
    if dieta.refeicoes:
        for ref in dieta.refeicoes:
            if ref.alimentos:
                for item in ref.alimentos:
                    foods_simple.append(FoodItemSimple(
                        nome=str(item.nome),
                        quantidade=f"{item.quantidade}{item.unidade}",
                        refeicao=ref.nome
                    ))
    
    context = VarietyExpertContext(
        alimentos_dieta=foods_simple,
        restricoes=[] 
    )
    
    results = await VarietyExpertAgent.run(context)
    return {"suggestions": results}

# ------------------------------------------------------------------------------
# 3. GRAPH
# ------------------------------------------------------------------------------
def build_nutri_graph():
    workflow = StateGraph(NutriState)
    
    workflow.add_node("macro_auditor", run_macro_auditor)
    workflow.add_node("meal_detective", run_meal_detective)
    workflow.add_node("variety_expert", run_variety_expert)
    
    workflow.set_entry_point("macro_auditor") 
    workflow.set_entry_point("meal_detective")
    workflow.set_entry_point("variety_expert")
    
    workflow.add_edge("macro_auditor", END)
    workflow.add_edge("meal_detective", END)
    workflow.add_edge("variety_expert", END)
    
    return workflow.compile()

nutri_graph = build_nutri_graph()

class NutriOrchestrator:
    @staticmethod
    async def analyze(bio: RitmoBio, dieta: RitmoDietaConfig) -> List[AtomicSuggestion]:
        logger.info(f"Iniciando NutriOrchestrator para BioID: {bio.id}")
        initial_state = {"bio": bio, "dieta": dieta, "suggestions": []}
        try:
            final_state = await nutri_graph.ainvoke(initial_state)
            return final_state["suggestions"]
        except Exception as e:
            logger.error(f"Erro crítico no NutriOrchestrator Graph: {e}")
            return []