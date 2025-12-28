import logging
import operator
from typing import List, Annotated, TypedDict

from langgraph.graph import StateGraph, END

# Import Models
from app.services.ai.agenda.context import AgendaContext
from app.services.ai.base.base_schema import AtomicSuggestion

# --- IMPORTS DOS AGENTES (Descomente à medida que criá-los) ---
from app.services.ai.agenda.time_strategist.agent import TimeStrategistAgent
from app.services.ai.agenda.flow_architect.agent import FlowArchitectAgent
from app.services.ai.agenda.priority_alchemist.agent import PriorityAlchemistAgent
from app.services.ai.agenda.task_breaker.agent import TaskBreakerAgent

logger = logging.getLogger(__name__)

# ------------------------------------------------------------------------------
# 1. STATE (O Estado Compartilhado do Graph)
# ------------------------------------------------------------------------------
class AgendaState(TypedDict):
    context: AgendaContext
    # Annotated com operator.add permite que os agentes "somem" listas em vez de sobrescrever
    suggestions: Annotated[List[AtomicSuggestion], operator.add]

# ------------------------------------------------------------------------------
# 2. NODES (Os Executores)
# ------------------------------------------------------------------------------

# async def run_time_strategist(state: AgendaState):
#     # Implementação futura
#     return {"suggestions": []}

async def run_flow_architect(state: AgendaState):
    """Executa o Visionário de Longo Prazo"""
    try:
        # Passamos o contexto completo, o agente filtra o que precisa
        results = await FlowArchitectAgent.run(state["context"])
        return {"suggestions": results}
    except Exception as e:
        logger.error(f"[Orchestrator] Erro no Flow Architect: {e}")
        return {"suggestions": []}

# async def run_priority_alchemist(state: AgendaState):
#     return {"suggestions": []}

# async def run_task_breaker(state: AgendaState):
#     return {"suggestions": []}

# ------------------------------------------------------------------------------
# 3. GRAPH BUILDER
# ------------------------------------------------------------------------------
def build_agenda_graph():
    workflow = StateGraph(AgendaState)
    
    # Adicionando Nós (Futuramente descomente os outros)
    # workflow.add_node("time_strategist", run_time_strategist)
    workflow.add_node("flow_architect", run_flow_architect)
    # workflow.add_node("priority_alchemist", run_priority_alchemist)
    # workflow.add_node("task_breaker", run_task_breaker)
    
    # Definindo Start (Paralelismo Total)
    # workflow.set_entry_point("time_strategist")
    workflow.set_entry_point("flow_architect")
    # workflow.set_entry_point("priority_alchemist")
    # workflow.set_entry_point("task_breaker")
    
    # Definindo Fim
    # workflow.add_edge("time_strategist", END)
    workflow.add_edge("flow_architect", END)
    # workflow.add_edge("priority_alchemist", END)
    # workflow.add_edge("task_breaker", END)
    
    return workflow.compile()

agenda_graph = build_agenda_graph()

class AgendaOrchestrator:
    """
    Fachada única para chamar toda a inteligência da Agenda.
    """
    @staticmethod
    async def analyze(context: AgendaContext) -> List[AtomicSuggestion]:
        logger.info(f"Iniciando AgendaOrchestrator para UserID: {context.user_id}")
        
        initial_state = {
            "context": context, 
            "suggestions": []
        }
        
        try:
            # Invoca o Graph
            final_state = await agenda_graph.ainvoke(initial_state)
            
            # Ordenação de Inteligência: Críticos primeiro, depois High, Medium, Low
            def severity_key(s):
                order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "none": 4}
                return order.get(s.severity, 5)
            
            sorted_suggestions = sorted(final_state["suggestions"], key=severity_key)
            
            return sorted_suggestions
            
        except Exception as e:
            logger.critical(f"Erro CATÁSTROFICO no AgendaOrchestrator: {e}", exc_info=True)
            return []