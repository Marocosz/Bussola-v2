import logging
import operator
from typing import List, Dict, Any, Annotated, TypedDict

from langchain_core.messages import BaseMessage
from langgraph.graph import StateGraph, END

# Import Models do Sistema (SQLAlchemy)
# Ajuste conforme seu projeto real se necessário
from app.models.ritmo import RitmoBio, RitmoDietaConfig

# Import Schemas Base
from app.services.ai.base.base_schema import AtomicSuggestion

# Import Agentes e seus Contextos
from app.services.ai.ritmo.nutri.macro_auditor.agent import MacroAuditorAgent
from app.services.ai.ritmo.nutri.macro_auditor.schema import MacroAuditorContext

from app.services.ai.ritmo.nutri.meal_detective.agent import MealDetectiveAgent
from app.services.ai.ritmo.nutri.meal_detective.schema import MealDetectiveContext, RefeicaoContext, AlimentoItemContext

from app.services.ai.ritmo.nutri.variety_expert.agent import VarietyExpertAgent
from app.services.ai.ritmo.nutri.variety_expert.schema import VarietyExpertContext, FoodItemSimple

logger = logging.getLogger(__name__)

# ------------------------------------------------------------------------------
# 1. STATE DEFINITION (O "Memória" do Grafo)
# ------------------------------------------------------------------------------
class NutriState(TypedDict):
    """
    Estado global do fluxo de Nutrição.
    
    Annotated[List, operator.add] significa:
    Quando um nó retorna {'suggestions': [...]}, o LangGraph ADICIONA à lista existente
    ao invés de substituir. Isso é perfeito para agregação paralela.
    """
    # Inputs (Read-only durante a execução)
    bio: RitmoBio
    dieta: RitmoDietaConfig
    
    # Output Agregado (Accumulator)
    suggestions: Annotated[List[AtomicSuggestion], operator.add]

# ------------------------------------------------------------------------------
# 2. NODE FUNCTIONS (Os nós de execução)
# ------------------------------------------------------------------------------
# Cada nó faz o trabalho de "Adapter": 
# Pega o State Bruto -> Converte para Contexto Específico -> Roda Agente -> Retorna Update

async def run_macro_auditor(state: NutriState):
    bio = state["bio"]
    dieta = state["dieta"]
    
    # Mapper: SQL Model -> Agent Context
    context = MacroAuditorContext(
        peso_atual=float(bio.peso_atual or 70.0),
        objetivo=bio.objetivo or "manutencao",
        tmb=float(bio.tmb or 1500.0),
        get=float(bio.get_atual or 2000.0),
        dieta_calorias=float(dieta.calorias_calculadas or 0),
        dieta_proteina=float(dieta.proteina_calculada or 0),
        dieta_carbo=float(dieta.carbo_calculado or 0),
        dieta_gordura=float(dieta.gordura_calculada or 0),
        agua_ml=float(bio.agua_diaria_meta or 2000.0),
        user_level=bio.nivel_atividade or "moderado"
    )
    
    results = await MacroAuditorAgent.run(context)
    return {"suggestions": results}

async def run_meal_detective(state: NutriState):
    dieta = state["dieta"]
    bio = state["bio"]
    
    # Mapper Complexo: Itera sobre relacionamentos do SQLAlchemy
    refeicoes_ctx = []
    
    # Assume que dieta.refeicoes é uma lista de objetos carregados (lazy='joined')
    if dieta.refeicoes:
        for ref in dieta.refeicoes:
            alimentos_ctx = []
            total_cal = 0.0
            
            if ref.alimentos:
                for item in ref.alimentos:
                    # Tenta pegar dados do alimento base ou do item
                    # Ajuste conforme seu model real (ex: item.alimento_taco.proteina)
                    prot = float(item.proteina or 0)
                    carb = float(item.carbo or 0)
                    fat = float(item.gordura or 0)
                    
                    # Soma calorias simplificada (4-4-9) se não tiver no banco
                    cal = (prot * 4) + (carb * 4) + (fat * 9)
                    total_cal += cal

                    alimentos_ctx.append(AlimentoItemContext(
                        nome=item.nome_personalizado or "Alimento",
                        quantidade=f"{item.quantidade_g_ml}g",
                        proteina=prot,
                        carbo=carb,
                        gordura=fat
                    ))
            
            refeicoes_ctx.append(RefeicaoContext(
                id=ref.id,
                nome=ref.nome,
                horario=str(ref.horario),
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
    
    # Mapper
    foods_simple = []
    if dieta.refeicoes:
        for ref in dieta.refeicoes:
            if ref.alimentos:
                for item in ref.alimentos:
                    foods_simple.append(FoodItemSimple(
                        nome=item.nome_personalizado or "Alimento",
                        quantidade=f"{item.quantidade_g_ml}g",
                        refeicao=ref.nome
                    ))
    
    context = VarietyExpertContext(
        alimentos_dieta=foods_simple,
        restricoes=[] # Futuro: pegar de bio.restricoes_alimentares
    )
    
    results = await VarietyExpertAgent.run(context)
    return {"suggestions": results}

# ------------------------------------------------------------------------------
# 3. GRAPH CONSTRUCTION (A Montagem da Pipeline)
# ------------------------------------------------------------------------------
def build_nutri_graph():
    workflow = StateGraph(NutriState)
    
    # Adiciona os Nós
    workflow.add_node("macro_auditor", run_macro_auditor)
    workflow.add_node("meal_detective", run_meal_detective)
    workflow.add_node("variety_expert", run_variety_expert)
    
    # Define Fluxo Paralelo
    # Do START, disparamos para todos os 3 nós simultaneamente
    workflow.set_entry_point("macro_auditor") 
    workflow.set_entry_point("meal_detective")
    workflow.set_entry_point("variety_expert")
    
    # Todos convergem para o Fim (o reducer cuida de juntar os dados)
    workflow.add_edge("macro_auditor", END)
    workflow.add_edge("meal_detective", END)
    workflow.add_edge("variety_expert", END)
    
    return workflow.compile()

# Instância compilada do grafo (Singleton)
nutri_graph = build_nutri_graph()

# ------------------------------------------------------------------------------
# 4. ORCHESTRATOR CLASS (A Interface Pública)
# ------------------------------------------------------------------------------
class NutriOrchestrator:
    """
    Fachada para o Grafo de Nutrição.
    """
    
    @staticmethod
    async def analyze(bio: RitmoBio, dieta: RitmoDietaConfig) -> List[AtomicSuggestion]:
        """
        Executa a análise completa de nutrição usando LangGraph.
        """
        logger.info(f"Iniciando NutriOrchestrator via LangGraph para BioID: {bio.id}")
        
        # Estado Inicial
        initial_state = {
            "bio": bio,
            "dieta": dieta,
            "suggestions": [] # Lista vazia inicial
        }
        
        try:
            # Invoca o grafo
            # Como definimos entry points paralelos, o LangGraph gerencia a async
            final_state = await nutri_graph.ainvoke(initial_state)
            
            return final_state["suggestions"]
            
        except Exception as e:
            logger.error(f"Erro crítico no NutriOrchestrator Graph: {e}")
            # Retorna lista vazia em caso de falha catastrófica do grafo
            return []