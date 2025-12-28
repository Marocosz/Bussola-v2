import logging
import operator
from typing import List, Annotated, TypedDict

# Adicionado START aqui
from langgraph.graph import StateGraph, END, START 

# Import Models
from app.services.ai.registros.context import RegistrosContext
from app.services.ai.base.base_schema import AtomicSuggestion

# --- IMPORTS DOS AGENTES (Todos ativos) ---
from app.services.ai.registros.time_strategist.agent import TimeStrategistAgent
from app.services.ai.registros.flow_architect.agent import FlowArchitectAgent
from app.services.ai.registros.priority_alchemist.agent import PriorityAlchemistAgent
from app.services.ai.registros.task_breaker.agent import TaskBreakerAgent

logger = logging.getLogger(__name__)

# ------------------------------------------------------------------------------
# 1. STATE
# ------------------------------------------------------------------------------
class RegistrosState(TypedDict):
    context: RegistrosContext
    # Annotated com operator.add permite que os agentes "somem" listas
    suggestions: Annotated[List[AtomicSuggestion], operator.add]

# ------------------------------------------------------------------------------
# 2. NODES (Funções Wrappers)
# ------------------------------------------------------------------------------

async def run_time_strategist(state: RegistrosState):
    try:
        results = await TimeStrategistAgent.run(state["context"])
        return {"suggestions": results}
    except Exception as e:
        logger.error(f"[Orchestrator] Erro no Time Strategist: {e}")
        return {"suggestions": []}

async def run_flow_architect(state: RegistrosState):
    try:
        results = await FlowArchitectAgent.run(state["context"])
        return {"suggestions": results}
    except Exception as e:
        logger.error(f"[Orchestrator] Erro no Flow Architect: {e}")
        return {"suggestions": []}

async def run_priority_alchemist(state: RegistrosState):
    try:
        # Dica de Debug: Log para saber se ele foi chamado
        logger.info("[Orchestrator] Chamando Priority Alchemist...") 
        results = await PriorityAlchemistAgent.run(state["context"])
        logger.info(f"[Orchestrator] Priority Alchemist retornou {len(results)} sugestões.")
        return {"suggestions": results}
    except Exception as e:
        logger.error(f"[Orchestrator] Erro no Priority Alchemist: {e}")
        return {"suggestions": []}

async def run_task_breaker(state: RegistrosState):
    try:
        # Dica de Debug
        logger.info("[Orchestrator] Chamando Task Breaker...")
        results = await TaskBreakerAgent.run(state["context"])
        logger.info(f"[Orchestrator] Task Breaker retornou {len(results)} sugestões.")
        return {"suggestions": results}
    except Exception as e:
        logger.error(f"[Orchestrator] Erro no Task Breaker: {e}")
        return {"suggestions": []}

# ------------------------------------------------------------------------------
# 3. GRAPH BUILDER (CORRIGIDO)
# ------------------------------------------------------------------------------
def build_registros_graph():
    workflow = StateGraph(RegistrosState)
    
    # Adicionando Nós
    workflow.add_node("time_strategist", run_time_strategist)
    workflow.add_node("flow_architect", run_flow_architect)
    workflow.add_node("priority_alchemist", run_priority_alchemist)
    workflow.add_node("task_breaker", run_task_breaker)
    
    # CORREÇÃO: Paralelismo Real usando START
    # Em vez de set_entry_point multiplos, criamos arestas do INÍCIO para todos os nós
    workflow.add_edge(START, "time_strategist")
    workflow.add_edge(START, "flow_architect")
    workflow.add_edge(START, "priority_alchemist")
    workflow.add_edge(START, "task_breaker")
    
    # Definindo Fim
    workflow.add_edge("time_strategist", END)
    workflow.add_edge("flow_architect", END)
    workflow.add_edge("priority_alchemist", END)
    workflow.add_edge("task_breaker", END)
    
    return workflow.compile()

registros_graph = build_registros_graph()

class RegistrosOrchestrator:
    """
    Fachada única para chamar toda a inteligência de Registros.
    """
    @staticmethod
    async def analyze(context: RegistrosContext) -> List[AtomicSuggestion]:
        logger.info(f"Iniciando RegistrosOrchestrator para UserID: {context.user_id}")
        
        initial_state = {
            "context": context, 
            "suggestions": []
        }
        
        try:
            # Invoca o Graph
            final_state = await registros_graph.ainvoke(initial_state)
            
            # Ordenação de Inteligência: Críticos primeiro, depois High, Medium, Low
            def severity_key(s):
                order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "none": 4}
                return order.get(s.severity, 5)
            
            # Como suggestions é Annotated com operator.add, o LangGraph já juntou tudo numa lista
            sorted_suggestions = sorted(final_state["suggestions"], key=severity_key)
            
            return sorted_suggestions
            
        except Exception as e:
            logger.critical(f"Erro CATÁSTROFICO no RegistrosOrchestrator: {e}", exc_info=True)
            return []