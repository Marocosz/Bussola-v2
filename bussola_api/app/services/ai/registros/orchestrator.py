"""
=======================================================================================
ARQUIVO: orchestrator.py (Orquestrador de Registros/Tarefas)
=======================================================================================

OBJETIVO:
    Atuar como o HUB central de inteligência para a área de Produtividade (Registros).
    Sua função é receber o contexto do usuário (lista de tarefas, data) e coordenar
    a execução de múltiplos Agentes Especialistas em paralelo para gerar insights.

CAMADA:
    Services / AI / Registros (Backend).
    Este arquivo é o ponto de entrada único chamado pelo `ai.py` (Controller).

RESPONSABILIDADES:
    1. Definição de Estado (LangGraph): Gerenciar o fluxo de dados entre os agentes.
    2. Paralelismo: Executar 4 agentes simultaneamente para garantir performance.
    3. Agregação: Juntar as sugestões de todos os agentes em uma lista única.
    4. Priorização: Ordenar os insights finais por severidade antes de devolver ao usuário.

INTEGRAÇÕES:
    - LangGraph: Framework para orquestração de fluxo de trabalho (Workflows).
    - Agentes Especialistas: 
        * TimeStrategist (Foco Diário)
        * FlowArchitect (Foco Semanal)
        * PriorityAlchemist (Limpeza de Backlog)
        * TaskBreaker (Quebra de Tarefas)
"""

import logging
import operator
from typing import List, Annotated, TypedDict

# Imports do LangGraph (Framework de Orquestração)
# START é o ponto de partida do grafo, END é o ponto de saída.
from langgraph.graph import StateGraph, END, START 

# Imports de Models Base e Contexto
from app.services.ai.registros.context import RegistrosContext
from app.services.ai.base.base_schema import AtomicSuggestion

# --- IMPORTS DOS AGENTES ESPECIALISTAS ---
from app.services.ai.registros.time_strategist.agent import TimeStrategistAgent
from app.services.ai.registros.flow_architect.agent import FlowArchitectAgent
from app.services.ai.registros.priority_alchemist.agent import PriorityAlchemistAgent
from app.services.ai.registros.task_breaker.agent import TaskBreakerAgent

logger = logging.getLogger(__name__)

# ==============================================================================
# 1. STATE DEFINITION (O Estado Compartilhado do Grafo)
# ==============================================================================

class RegistrosState(TypedDict):
    """
    Define a estrutura de dados que trafega entre os nós do grafo.
    """
    # Dados de entrada imutáveis para os agentes lerem
    context: RegistrosContext
    
    # Lista acumuladora de resultados.
    # 'Annotated[..., operator.add]' instrui o LangGraph a SOMAR (append) os resultados
    # de cada nó, em vez de sobrescrever. Isso permite que agentes paralelos contribuam
    # para a mesma lista final sem conflito.
    suggestions: Annotated[List[AtomicSuggestion], operator.add]

# ==============================================================================
# 2. NODES (Funções Executoras dos Agentes)
# ==============================================================================
# Cada função abaixo representa um "Nó" no grafo de execução.
# Elas encapsulam a chamada ao Agente e tratam exceções individualmente
# para que a falha de um não derrube o processo inteiro.

async def run_time_strategist(state: RegistrosState):
    """Executa o estrategista de tempo (Foco: O que fazer hoje?)."""
    try:
        results = await TimeStrategistAgent.run(state["context"])
        return {"suggestions": results}
    except Exception as e:
        logger.error(f"[Orchestrator] Erro no Time Strategist: {e}")
        return {"suggestions": []} # Retorna lista vazia em caso de erro (Failover)

async def run_flow_architect(state: RegistrosState):
    """Executa o arquiteto de fluxo (Foco: Balanceamento semanal)."""
    try:
        results = await FlowArchitectAgent.run(state["context"])
        return {"suggestions": results}
    except Exception as e:
        logger.error(f"[Orchestrator] Erro no Flow Architect: {e}")
        return {"suggestions": []}

async def run_priority_alchemist(state: RegistrosState):
    """Executa o alquimista de prioridades (Foco: Limpeza de backlog/velharias)."""
    try:
        logger.info("[Orchestrator] Chamando Priority Alchemist...") 
        results = await PriorityAlchemistAgent.run(state["context"])
        logger.info(f"[Orchestrator] Priority Alchemist retornou {len(results)} sugestões.")
        return {"suggestions": results}
    except Exception as e:
        logger.error(f"[Orchestrator] Erro no Priority Alchemist: {e}")
        return {"suggestions": []}

async def run_task_breaker(state: RegistrosState):
    """Executa o quebrador de tarefas (Foco: Clareza e granularidade)."""
    try:
        logger.info("[Orchestrator] Chamando Task Breaker...")
        results = await TaskBreakerAgent.run(state["context"])
        logger.info(f"[Orchestrator] Task Breaker retornou {len(results)} sugestões.")
        return {"suggestions": results}
    except Exception as e:
        logger.error(f"[Orchestrator] Erro no Task Breaker: {e}")
        return {"suggestions": []}

# ==============================================================================
# 3. GRAPH BUILDER (Construção do Fluxo de Trabalho)
# ==============================================================================

def build_registros_graph():
    """
    Configura a topologia do grafo de execução.
    Define que todos os 4 agentes devem rodar em PARALELO.
    """
    workflow = StateGraph(RegistrosState)
    
    # 1. Registrar os Nós (Quem vai trabalhar?)
    workflow.add_node("time_strategist", run_time_strategist)
    workflow.add_node("flow_architect", run_flow_architect)
    workflow.add_node("priority_alchemist", run_priority_alchemist)
    workflow.add_node("task_breaker", run_task_breaker)
    
    # 2. Configurar Arestas de Início (Paralelismo)
    # Ao conectar START a múltiplos nós, o LangGraph entende que deve iniciá-los ao mesmo tempo.
    workflow.add_edge(START, "time_strategist")
    workflow.add_edge(START, "flow_architect")
    workflow.add_edge(START, "priority_alchemist")
    workflow.add_edge(START, "task_breaker")
    
    # 3. Configurar Arestas de Fim (Convergência)
    # Todos os nós convergem para END, onde o estado é finalizado e retornado.
    workflow.add_edge("time_strategist", END)
    workflow.add_edge("flow_architect", END)
    workflow.add_edge("priority_alchemist", END)
    workflow.add_edge("task_breaker", END)
    
    return workflow.compile()

# Instância compilada do grafo pronta para uso (Singleton)
registros_graph = build_registros_graph()

# ==============================================================================
# 4. CLASSE DE FACHADA (Interface Pública)
# ==============================================================================

class RegistrosOrchestrator:
    """
    Fachada (Facade) para simplificar a chamada da inteligência de Registros.
    O resto do sistema chama apenas RegistrosOrchestrator.analyze(), sem saber
    que existe um grafo complexo por trás.
    """
    
    @staticmethod
    async def analyze(context: RegistrosContext) -> List[AtomicSuggestion]:
        """
        Método principal de análise.
        
        Args:
            context: Objeto contendo todas as tarefas e dados do usuário.
            
        Returns:
            Lista ordenada e priorizada de sugestões.
        """
        logger.info(f"Iniciando RegistrosOrchestrator para UserID: {context.user_id}")
        
        initial_state = {
            "context": context, 
            "suggestions": [] # Começa vazio, será populado pelos agentes
        }
        
        try:
            # Invoca o Grafo de forma assíncrona
            final_state = await registros_graph.ainvoke(initial_state)
            
            # --- Lógica de Priorização Final ---
            # O LangGraph nos devolve uma lista misturada. Precisamos ordenar
            # para que os alertas CRÍTICOS apareçam no topo da UI.
            def severity_key(s):
                # Mapeia Enum para Inteiro (Menor = Mais Prioritário)
                order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "none": 4}
                return order.get(s.severity, 5)
            
            sorted_suggestions = sorted(final_state["suggestions"], key=severity_key)
            
            return sorted_suggestions
            
        except Exception as e:
            # Catch-all de segurança máxima. O orquestrador não pode derrubar a API.
            logger.critical(f"Erro CATÁSTROFICO no RegistrosOrchestrator: {e}", exc_info=True)
            return []