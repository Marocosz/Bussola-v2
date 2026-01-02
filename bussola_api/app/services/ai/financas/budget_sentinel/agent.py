"""
=======================================================================================
ARQUIVO: agent.py (Agente BudgetSentinel)
=======================================================================================

OBJETIVO:
    Implementar o "Guarda de Orçamento" (Budget Sentinel).
    Este agente é responsável pela análise TÁTICA e IMEDIATA da execução orçamentária.
    
    Diferente do StrategyArchitect (que olha o longo prazo), o Sentinel olha o AGORA.
    Ele responde à pergunta: "Estou gastando rápido demais para o dia do mês que estamos?"

CAMADA:
    Services / AI / Financas (Backend).
    É invocado pelo `FinancasOrchestrator` durante a análise financeira geral.

RESPONSABILIDADES:
    1. Cálculo de Burn Rate: Comparar % do Mês Decorrido vs % do Orçamento Consumido.
    2. Filtragem Temporal: Garantir que gastos futuros (agendados) não disparem alarmes falsos.
    3. Detecção de Anomalias de Ritmo: Identificar categorias que vão "quebrar" antes do fim do mês.
    4. Feedback Positivo: Reconhecer e elogiar quando o controle está perfeito (Início de Mês).

INTEGRAÇÕES:
    - LLMFactory: Para gerar o texto persuasivo do alerta.
    - AgentCache: Para evitar reprocessamento desnecessário.
    - FinancasContext: Fonte de dados (Transações e Metas).
"""

import logging
import json
from datetime import datetime, date
import calendar
from typing import List, Dict, Any

from app.services.ai.base.llm_factory import llm_client
from app.services.ai.base.post_processor import PostProcessor
from app.services.ai.base.cache import ai_cache
from app.services.ai.base.base_schema import AtomicSuggestion

# Contextos e Schemas do Domínio Financeiro
from app.services.ai.financas.context import FinancasContext
from app.services.ai.financas.budget_sentinel.schema import BudgetSentinelContext, AnaliseCategoria
from app.services.ai.financas.budget_sentinel.prompts import SYSTEM_PROMPT, USER_PROMPT_TEMPLATE

logger = logging.getLogger(__name__)

class BudgetSentinelAgent:
    """
    Agente Especialista: Fiscalização Tática de Orçamento (Burn Rate).
    
    Lógica Principal: "Pacing" (Ritmo).
    Se passou 50% do mês, você não deveria ter gasto 90% do orçamento de Mercado.
    """
    DOMAIN = "financas"
    AGENT_NAME = "budget_sentinel"

    @classmethod
    async def run(cls, global_context: FinancasContext) -> List[AtomicSuggestion]:
        """
        Executa a análise de Burn Rate.
        
        Args:
            global_context: Dados financeiros completos (Transações, Metas, Datas).
            
        Returns:
            Lista de sugestões (Alertas de queima rápida ou Elogios de controle).
        """
        
        # ----------------------------------------------------------------------
        # 1. PRÉ-PROCESSAMENTO MATEMÁTICO (Cálculo de Datas)
        # ----------------------------------------------------------------------
        try:
            # Tenta converter a string YYYY-MM-DD para objeto date python
            dt_ref = datetime.strptime(global_context.data_atual, "%Y-%m-%d").date()
        except:
            dt_ref = date.today()

        # Dados Temporais Fundamentais para o Pacing
        dia_atual = dt_ref.day
        # Obtém o último dia do mês (ex: 28, 30, 31)
        _, ultimo_dia = calendar.monthrange(dt_ref.year, dt_ref.month)
        
        # % do mês que já passou (ex: dia 15/30 = 50%)
        progresso_mes = (dia_atual / ultimo_dia) * 100
        dias_restantes = max(1, ultimo_dia - dia_atual)

        analise_items = []
        
        # ----------------------------------------------------------------------
        # 2. AGRUPAMENTO E FILTRAGEM TEMPORAL (Core Logic)
        # ----------------------------------------------------------------------
        # Objetivo: Somar apenas o que REALMENTE foi gasto (Competência + Caixa).
        # Ignoramos agendamentos futuros para não gerar pânico desnecessário.
        
        gastos_por_categoria = {}
        
        for t in global_context.transacoes_periodo:
            # Sentinel só olha DESPESAS. Receitas não têm "burn rate".
            if t.get('tipo') != 'despesa': continue
            
            try:
                # Converte string para date
                data_tx = datetime.strptime(t.get('data'), "%Y-%m-%d").date()
                
                # Regra de Segurança 1: A transação deve ser deste mês/ano.
                if data_tx.month != dt_ref.month or data_tx.year != dt_ref.year:
                    continue
                
                # Regra de Segurança 2 (CRÍTICA): A transação não pode ser futura.
                # Se hoje é dia 10 e tem um agendamento dia 25, ele NÃO conta como gasto
                # para fins de velocidade de queima (Burn Rate).
                if data_tx > dt_ref:
                    continue
                    
            except:
                continue # Data inválida, ignora silenciosamente

            # Acumulação
            cat = t.get('categoria', 'Outros')
            valor = float(t.get('valor', 0))
            gastos_por_categoria[cat] = gastos_por_categoria.get(cat, 0.0) + valor

        # ----------------------------------------------------------------------
        # 3. ANÁLISE DE CADA ORÇAMENTO (Meta vs Realizado)
        # ----------------------------------------------------------------------
        for orcamento in global_context.metas_orcamentarias:
            cat = orcamento['categoria']
            limite = float(orcamento.get('valor_limite', 0))
            gasto_real = gastos_por_categoria.get(cat, 0.0)
            
            # Se não tem limite definido, não tem como calcular estouro.
            if limite <= 0: continue 

            # Indicadores de Performance
            percentual_gasto = (gasto_real / limite) * 100
            saldo = limite - gasto_real
            # Quanto posso gastar por dia daqui pra frente?
            diaria = saldo / dias_restantes
            
            # --- Definição de Status (A Lógica do Pacing) ---
            # Delta positivo = Gastou mais rápido que o tempo passou.
            delta = percentual_gasto - progresso_mes
            status = "Seguro"

            if percentual_gasto >= 100:
                status = "ESTOURADO"
            elif percentual_gasto >= 90:
                status = "Crítico (Quase Estourando)"
            elif delta > 20: 
                # Ex: Mês em 10%, Gasto em 40% -> Delta +30 (Queima Rápida)
                status = "Acelerado (Queima Rápida)"
            elif delta < -15 and percentual_gasto < 85:
                # Ex: Mês em 80%, Gasto em 50% -> Delta -30 (Economia)
                status = "Economia (Abaixo do esperado)"

            # Filtro de Relevância: Só enviamos para a IA o que precisa de atenção.
            # "Tudo normal" é filtrado para economizar tokens, exceto no início do mês.
            eh_relevante = (
                "ESTOURADO" in status or 
                "Crítico" in status or 
                "Acelerado" in status or
                (status.startswith("Economia") and dias_restantes < 10) # Economia só vale celebrar no fim
            )

            if eh_relevante:
                analise_items.append(AnaliseCategoria(
                    categoria=cat,
                    limite_mensal=round(limite, 2),
                    gasto_atual=round(gasto_real, 2),
                    percentual_consumido=round(percentual_gasto, 1),
                    status_burn_rate=status,
                    saldo_restante=round(saldo, 2),
                    diaria_disponivel=round(diaria, 2)
                ))

        # ----------------------------------------------------------------------
        # 4. TRATAMENTO DE CASOS ESPECIAIS (Feedback Positivo)
        # ----------------------------------------------------------------------
        # Se não há problemas e estamos no começo do mês (até dia 10), 
        # enviamos um item "falso" para o LLM gerar um elogio ("Tudo sob controle").
        if not analise_items and dia_atual <= 10:
            analise_items.append(AnaliseCategoria(
                categoria="VISÃO GERAL DO MÊS",
                limite_mensal=0, 
                gasto_atual=0, 
                percentual_consumido=0,
                status_burn_rate="Tranquilo (Início de Mês)", # Gatilho para o Prompt
                saldo_restante=0, 
                diaria_disponivel=0
            ))

        # ----------------------------------------------------------------------
        # 5. MONTAGEM DO CONTEXTO DO AGENTE
        # ----------------------------------------------------------------------
        agent_context = BudgetSentinelContext(
            dia_atual=dia_atual,
            dias_no_mes=ultimo_dia,
            percentual_mes_decorrido=round(progresso_mes, 1),
            analise_orcamentos=analise_items
        )
        
        context_dict = agent_context.model_dump()
        
        # Se nada relevante foi encontrado (e não caiu na regra do Início de Mês), retorna vazio.
        if not context_dict["analise_orcamentos"]:
            return []

        # ----------------------------------------------------------------------
        # 6. CACHE E CHAMADA LLM
        # ----------------------------------------------------------------------
        # Verifica se já analisamos este cenário exato hoje.
        cached_response = await ai_cache.get(cls.DOMAIN, cls.AGENT_NAME, context_dict)
        if cached_response:
            return cached_response

        # Formata o resumo textual para o Prompt
        analise_str = cls._format_budget_analysis(context_dict["analise_orcamentos"])

        user_prompt = USER_PROMPT_TEMPLATE.format(
            dia_atual=context_dict["dia_atual"],
            dias_no_mes=context_dict["dias_no_mes"],
            progresso_mes=context_dict["percentual_mes_decorrido"],
            analise_orcamentos_json=analise_str
        )

        try:
            # Chama a IA
            raw_response = await llm_client.call_model(
                system_prompt=SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.2 
            )

            # Processa e Valida a resposta
            suggestions = PostProcessor.process_response(
                raw_data=raw_response,
                domain=cls.DOMAIN, 
                agent_source=cls.AGENT_NAME
            )

            # Salva no Cache se houve sucesso
            if suggestions:
                await ai_cache.set(cls.DOMAIN, cls.AGENT_NAME, context_dict, suggestions)

            return suggestions

        except Exception as e:
            logger.error(f"Falha no {cls.AGENT_NAME}: {e}")
            return []

    @staticmethod
    def _format_budget_analysis(items: List[Dict[str, Any]]) -> str:
        """
        Formata a lista de análises em um texto legível para o LLM.
        """
        lines = []
        for item in items:
            # Formatação especial para o item fake de tranquilidade
            if item['categoria'] == "VISÃO GERAL DO MÊS":
                lines.append(f"- STATUS GERAL: {item['status_burn_rate']}. Nenhuma categoria estourada ou acelerada.")
            else:
                lines.append(
                    f"- [{item['status_burn_rate']}] {item['categoria'].upper()}: "
                    f"Gasto Realizado: R$ {item['gasto_atual']} (Meta: R$ {item['limite_mensal']}). "
                    f"Consumido: {item['percentual_consumido']}%. "
                    f"Sobra: R$ {item['saldo_restante']} (Diária Max: R$ {item['diaria_disponivel']})"
                )
        return "\n".join(lines)