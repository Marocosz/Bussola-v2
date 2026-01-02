"""
=======================================================================================
ARQUIVO: orchestrator.py (Orquestrador de Treino / Coach Digital)
=======================================================================================

OBJETIVO:
    Atuar como o HUB central de inteligência para o domínio de Treino (Coach).
    Este módulo coordena a execução paralela de agentes especialistas para analisar
    o plano de treino e o perfil do usuário, gerando insights sobre volume, técnica e intensidade.

CAMADA:
    Services / AI / Ritmo / Coach (Backend).
    É o ponto de entrada chamado pelo `RitmoOrchestrator` (que coordena Saúde + Treino).

RESPONSABILIDADES:
    1. Preparação de Dados: Mapear os modelos do banco (RitmoBio, RitmoPlanoTreino) para contextos de IA.
    2. Execução Paralela: Rodar VolumeArchitect, TechniqueMaster e IntensityStrategist simultaneamente.
    3. Agregação: Consolidar todas as sugestões geradas em uma lista única.
    4. Tolerância a Falhas: Garantir que a falha de um agente não impeça o retorno dos outros.

INTEGRAÇÕES:
    - LangGraph: Framework de orquestração de fluxo.
    - Agentes: VolumeArchitect, TechniqueMaster, IntensityStrategist.
    - Models: RitmoBio e RitmoPlanoTreino (SQLAlchemy/Pydantic).
"""

import logging
import operator
from typing import List, Annotated, TypedDict

from langgraph.graph import StateGraph, END

# Imports Models (Dados do Banco)
from app.models.ritmo import RitmoBio, RitmoPlanoTreino
from app.services.ai.base.base_schema import AtomicSuggestion

# Imports Agents (Inteligência Especializada)
from app.services.ai.ritmo.coach.volume_architect.agent import VolumeArchitectAgent
from app.services.ai.ritmo.coach.volume_architect.schema import VolumeArchitectContext

from app.services.ai.ritmo.coach.technique_master.agent import TechniqueMasterAgent
from app.services.ai.ritmo.coach.technique_master.schema import TechniqueMasterContext, ExerciseItem

from app.services.ai.ritmo.coach.intensity_strategist.agent import IntensityStrategistAgent
from app.services.ai.ritmo.coach.intensity_strategist.schema import IntensityStrategistContext

logger = logging.getLogger(__name__)

# ==============================================================================
# 1. STATE DEFINITION (Estado Compartilhado)
# ==============================================================================

class CoachState(TypedDict):
    """
    Define a estrutura de dados que trafega pelo grafo de execução.
    """
    # Inputs (Dados Brutos do Banco)
    bio: RitmoBio
    plano: RitmoPlanoTreino
    
    # Output Acumulado
    # Annotated com operator.add instrui o LangGraph a SOMAR as listas retornadas
    # por cada nó, permitindo que múltiplos agentes contribuam para a mesma lista final.
    suggestions: Annotated[List[AtomicSuggestion], operator.add]

# ==============================================================================
# 2. NODES (Adaptadores e Executores)
# ==============================================================================
# Cada função abaixo atua como um "Nó" no grafo.
# Elas têm a responsabilidade crucial de converter o modelo de dados do banco (SQLAlchemy)
# para o schema específico (Pydantic) esperado por cada Agente.

async def run_volume_architect(state: CoachState):
    """
    Nó executor do Arquiteto de Volume.
    
    Lógica de Adaptação:
    Percorre todo o plano de treino para somar as séries por grupo muscular.
    Isso evita que o Agente precise iterar sobre dias e exercícios complexos.
    """
    bio = state["bio"]
    plano = state["plano"]
    
    # Agregação de Volume (Séries por Grupo Muscular)
    volume_map = {}
    if plano.dias:
        for dia in plano.dias:
            # Model: O relacionamento correto é 'exercicios'
            if dia.exercicios:
                for exercicio in dia.exercicios:
                    # Fallback para "Geral" caso grupo muscular esteja vazio
                    grupo = getattr(exercicio, "grupo_muscular", "Geral") or "Geral"
                    series = getattr(exercicio, "series", 3)
                    
                    if grupo in volume_map:
                        volume_map[grupo] += int(series)
                    else:
                        volume_map[grupo] = int(series)

    # Mapeamento de Perfil
    # Usamos 'nivel_atividade' como proxy para experiência, já que 'experiencia_treino' não existe no model
    nivel = getattr(bio, "nivel_atividade", "iniciante")
    
    context = VolumeArchitectContext(
        nivel_usuario=str(nivel),
        objetivo=getattr(bio, "objetivo", "saude"),
        volume_semanal=volume_map
    )
    
    results = await VolumeArchitectAgent.run(context)
    return {"suggestions": results}

async def run_technique_master(state: CoachState):
    """
    Nó executor do Mestre da Técnica.
    
    Lógica de Adaptação:
    Extrai uma lista única de nomes de exercícios para análise biomecânica.
    Remove duplicatas (ex: Agachamento na Seg e na Qui conta como 1 análise).
    """
    plano = state["plano"]
    
    unique_exercises = []
    seen_names = set()
    
    if plano.dias:
        for dia in plano.dias:
            if dia.exercicios:
                for item in dia.exercicios:
                    nome = getattr(item, "nome_exercicio", None)
                    
                    # Deduplicação baseada no nome
                    if nome and nome not in seen_names:
                        unique_exercises.append(ExerciseItem(
                            nome=str(nome),
                            categoria=getattr(item, "grupo_muscular", "Geral") or "Geral"
                        ))
                        seen_names.add(nome)

    # Limitamos a 15 exercícios para economizar tokens e focar nos principais
    context = TechniqueMasterContext(
        exercicios_chave=unique_exercises[:15]
    )
    
    results = await TechniqueMasterAgent.run(context)
    return {"suggestions": results}

async def run_intensity_strategist(state: CoachState):
    """
    Nó executor do Estrategista de Intensidade.
    
    Lógica de Adaptação:
    Foca apenas no perfil do usuário (Bio) para definir diretrizes gerais de esforço (RPE),
    já que a intensidade é mais ligada ao objetivo do que aos exercícios em si.
    """
    bio = state["bio"]
    
    nivel = getattr(bio, "nivel_atividade", "iniciante")
    
    context = IntensityStrategistContext(
        nivel_usuario=str(nivel),
        foco_treino=getattr(bio, "objetivo", "hipertrofia")
    )
    
    results = await IntensityStrategistAgent.run(context)
    return {"suggestions": results}

# ==============================================================================
# 3. GRAPH BUILDER (Configuração do Fluxo)
# ==============================================================================

def build_coach_graph():
    """
    Constrói a topologia de execução.
    Configura todos os nós para rodarem em paralelo a partir do início.
    """
    workflow = StateGraph(CoachState)
    
    # 1. Adicionar Nós
    workflow.add_node("volume_architect", run_volume_architect)
    workflow.add_node("technique_master", run_technique_master)
    workflow.add_node("intensity_strategist", run_intensity_strategist)
    
    # 2. Configurar Entradas (Paralelismo)
    # Definindo múltiplos entry points, o LangGraph inicia todos simultaneamente.
    workflow.set_entry_point("volume_architect")
    workflow.set_entry_point("technique_master")
    workflow.set_entry_point("intensity_strategist")
    
    # 3. Configurar Saídas (Convergência)
    workflow.add_edge("volume_architect", END)
    workflow.add_edge("technique_master", END)
    workflow.add_edge("intensity_strategist", END)
    
    return workflow.compile()

# Instância Singleton do Grafo Compilado
coach_graph = build_coach_graph()

# ==============================================================================
# 4. CLASSE DE FACHADA (Interface Pública)
# ==============================================================================

class CoachOrchestrator:
    """
    Fachada para simplificar a chamada da inteligência de Treino.
    Encapsula a complexidade do grafo e do estado inicial.
    """
    
    @staticmethod
    async def analyze(bio: RitmoBio, plano: RitmoPlanoTreino) -> List[AtomicSuggestion]:
        """
        Executa a análise completa de treino.
        
        Args:
            bio: Dados biométricos e perfil do usuário.
            plano: Estrutura do treino (dias, exercícios, séries).
            
        Returns:
            Lista consolidada de sugestões de todos os agentes.
        """
        logger.info(f"Iniciando CoachOrchestrator para BioID: {bio.id}")
        
        initial_state = {
            "bio": bio, 
            "plano": plano, 
            "suggestions": []
        }
        
        try:
            # Invoca o Grafo Assíncrono
            final_state = await coach_graph.ainvoke(initial_state)
            return final_state["suggestions"]
            
        except Exception as e:
            # Catch-all para evitar que falhas na IA quebrem a aplicação principal
            logger.error(f"Erro crítico no CoachOrchestrator: {e}")
            return []