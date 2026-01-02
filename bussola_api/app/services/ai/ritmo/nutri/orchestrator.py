"""
=======================================================================================
ARQUIVO: orchestrator.py (Orquestrador de Nutrição)
=======================================================================================

OBJETIVO:
    Atuar como o HUB central de inteligência para o domínio de Nutrição.
    Este módulo coordena a execução paralela de múltiplos agentes especialistas
    para analisar a dieta e o perfil biológico do usuário, consolidando insights
    sobre macros, composição de refeições e variedade alimentar.

CAMADA:
    Services / AI / Ritmo / Nutri (Backend).
    É o ponto de entrada chamado pelo `RitmoOrchestrator` (que coordena Saúde + Treino).

RESPONSABILIDADES:
    1. Adaptação de Dados: Converter modelos do banco (SQLAlchemy) para Contextos de IA (Pydantic).
    2. Recálculo de Métricas: Agregar macros (Prot/Carb/Gord) a partir dos alimentos, caso o banco tenha apenas totais.
    3. Execução Paralela: Rodar MacroAuditor, MealDetective e VarietyExpert simultaneamente via LangGraph.
    4. Resiliência: Garantir que falhas em um agente não impeçam o retorno dos outros.

INTEGRAÇÕES:
    - LangGraph: Framework de orquestração de fluxo.
    - Agentes: MacroAuditor, MealDetective, VarietyExpert.
    - Models: RitmoBio e RitmoDietaConfig.
"""

import logging
import operator
from typing import List, Annotated, TypedDict

from langgraph.graph import StateGraph, END

# Imports Models
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
# 1. STATE DEFINITION (Estado Compartilhado)
# ------------------------------------------------------------------------------
class NutriState(TypedDict):
    """
    Define a estrutura de dados que trafega pelo grafo de execução.
    """
    # Inputs (Dados Brutos do Banco)
    bio: RitmoBio
    dieta: RitmoDietaConfig
    
    # Output Acumulado
    # Annotated com operator.add instrui o LangGraph a SOMAR (append) as listas 
    # retornadas por cada nó, permitindo contribuição paralela sem sobrescrita.
    suggestions: Annotated[List[AtomicSuggestion], operator.add]

# ------------------------------------------------------------------------------
# 2. NODES (Adaptadores e Executores)
# ------------------------------------------------------------------------------
# Cada função abaixo atua como um "Nó" no grafo.
# Elas são responsáveis por isolar a lógica de conversão de dados (Model -> Schema)
# e chamar o agente correspondente.

async def run_macro_auditor(state: NutriState):
    """
    Nó executor do Auditor de Macros.
    
    Responsabilidade de Adaptação:
    O modelo `RitmoDietaConfig` pode armazenar apenas calorias totais.
    Este nó itera sobre todos os alimentos para somar Proteínas, Carbos e Gorduras
    manualmente, garantindo que o agente receba dados precisos para a auditoria matemática.
    """
    bio = state["bio"]
    dieta = state["dieta"]
    
    # Recálculo de totais agregados (Regra de Negócio: Precisão vem dos itens)
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
        # Mapeamento com defaults seguros para evitar crash se o perfil estiver incompleto
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
    """
    Nó executor do Detetive de Refeições.
    
    Responsabilidade de Adaptação:
    Constrói uma hierarquia completa (Refeição -> Alimentos) para análise de qualidade.
    Cria um contexto temporal artificial (nome + ordem) já que o modelo não possui horário fixo.
    """
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
                        nome=str(item.nome), 
                        # Formata quantidade e unidade para string legível (ex: "100g")
                        quantidade=f"{item.quantidade}{item.unidade}", 
                        proteina=prot,
                        carbo=carb,
                        gordura=fat
                    ))
            
            refeicoes_ctx.append(RefeicaoContext(
                id=ref.id,
                nome=ref.nome,
                # Contexto temporal inferido pela ordem, crucial para crononutrição
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
    """
    Nó executor do Especialista em Variedade.
    
    Responsabilidade de Adaptação:
    Extrai apenas metadados simples (Nome, Quantidade, Refeição).
    O agente de variedade não precisa de dados macro-nutricionais, apenas semânticos.
    """
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
        restricoes=[] # Futuro: Injetar alergias/intolerâncias do RitmoBio aqui
    )
    
    results = await VarietyExpertAgent.run(context)
    return {"suggestions": results}

# ------------------------------------------------------------------------------
# 3. GRAPH BUILDER (Configuração do Fluxo)
# ------------------------------------------------------------------------------
def build_nutri_graph():
    """
    Constrói a topologia de execução.
    Configura todos os agentes para execução simultânea (paralelismo).
    """
    workflow = StateGraph(NutriState)
    
    # 1. Adicionar Nós
    workflow.add_node("macro_auditor", run_macro_auditor)
    workflow.add_node("meal_detective", run_meal_detective)
    workflow.add_node("variety_expert", run_variety_expert)
    
    # 2. Configurar Entradas (Paralelismo)
    # Define múltiplos pontos de entrada para iniciar a execução concorrente.
    workflow.set_entry_point("macro_auditor") 
    workflow.set_entry_point("meal_detective")
    workflow.set_entry_point("variety_expert")
    
    # 3. Configurar Saídas (Convergência)
    workflow.add_edge("macro_auditor", END)
    workflow.add_edge("meal_detective", END)
    workflow.add_edge("variety_expert", END)
    
    return workflow.compile()

# Instância compilada do grafo (Singleton)
nutri_graph = build_nutri_graph()

# ------------------------------------------------------------------------------
# 4. CLASSE DE FACHADA (Interface Pública)
# ------------------------------------------------------------------------------
class NutriOrchestrator:
    """
    Fachada para simplificar a chamada da inteligência Nutricional.
    Isola a complexidade do LangGraph do restante da aplicação.
    """
    @staticmethod
    async def analyze(bio: RitmoBio, dieta: RitmoDietaConfig) -> List[AtomicSuggestion]:
        """
        Executa a análise completa da dieta.
        
        Args:
            bio: Perfil biológico (TMB, Peso, Objetivo).
            dieta: Configuração da dieta (Refeições, Alimentos).
            
        Returns:
            Lista consolidada de sugestões de todos os agentes.
        """
        logger.info(f"Iniciando NutriOrchestrator para BioID: {bio.id}")
        
        initial_state = {
            "bio": bio, 
            "dieta": dieta, 
            "suggestions": []
        }
        
        try:
            # Invoca o Grafo Assíncrono
            final_state = await nutri_graph.ainvoke(initial_state)
            return final_state["suggestions"]
            
        except Exception as e:
            # Catch-all de segurança: Retorna lista vazia em vez de derrubar a request
            logger.error(f"Erro crítico no NutriOrchestrator Graph: {e}")
            return []