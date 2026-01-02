"""
=======================================================================================
ARQUIVO: agent.py (Agente SpendingDetective)
=======================================================================================

OBJETIVO:
    Implementar o "Detetive de Gastos".
    Este agente atua como um Auditor Financeiro Automatizado, focado no PASSADO.
    Sua missão é responder: "Por que gastei tanto este mês?" e "Onde fugi do padrão?".

CAMADA:
    Services / AI / Financas (Backend).
    É invocado pelo `FinancasOrchestrator` como parte da análise financeira completa.

RESPONSABILIDADES:
    1. Análise Estatística: Calcular matematicamente o desvio (variância) entre o gasto atual e a média histórica.
    2. Identificação de Culpados: Cruzar o aumento da categoria com as transações para apontar qual compra causou o furo.
    3. Filtragem de Ruído: Ignorar variações insignificantes (pequenos valores) para focar no que importa.
    4. Geração de Insights: Produzir explicações textuais claras via LLM sobre as anomalias detectadas.

INTEGRAÇÕES:
    - LLMFactory: Para interpretar os dados estatísticos e gerar texto humano.
    - AgentCache: Para evitar recálculos caros se os dados não mudaram.
    - FinancasContext: Fonte de dados (Transações do mês e Histórico de 90 dias).
"""

import logging
import json
from typing import List, Dict, Any

from app.services.ai.base.llm_factory import llm_client
from app.services.ai.base.post_processor import PostProcessor
from app.services.ai.base.cache import ai_cache
from app.services.ai.base.base_schema import AtomicSuggestion

# Contextos e Schemas do Domínio Financeiro
from app.services.ai.financas.context import FinancasContext
from app.services.ai.financas.spending_detective.schema import SpendingDetectiveContext, CategoriaAnalise
from app.services.ai.financas.spending_detective.prompts import SYSTEM_PROMPT, USER_PROMPT_TEMPLATE

logger = logging.getLogger(__name__)

class SpendingDetectiveAgent:
    """
    Agente Especialista: Auditoria de Gastos e Anomalias.
    
    Lógica Principal: "Variance Analysis" (Análise de Variância).
    Se a média de gasto em 'Mercado' é R$ 500 e este mês foi R$ 1.000,
    o agente deve identificar esse +100% e buscar nas transações quem somou esses R$ 500 extras.
    """
    DOMAIN = "financas"
    AGENT_NAME = "spending_detective"

    @classmethod
    async def run(cls, global_context: FinancasContext) -> List[AtomicSuggestion]:
        """
        Executa o fluxo de auditoria financeira.

        FLUXO DE EXECUÇÃO:
        1. Agrega transações atuais por categoria.
        2. Compara totais atuais com médias históricas (Python).
        3. Filtra apenas desvios relevantes (Python).
        4. Envia anomalias + lista de transações para a IA explicar (LLM).
        
        Args:
            global_context: Contém todas as transações do mês e as médias históricas de 90 dias.

        Returns:
            Lista de sugestões contendo alertas de anomalias ou insights de consumo.
        """
        
        # ----------------------------------------------------------------------
        # 1. PRÉ-PROCESSAMENTO MATEMÁTICO (Python > LLM)
        # ----------------------------------------------------------------------
        # Decisão de Arquitetura: Não pedimos para a IA calcular somas ou médias.
        # LLMs alucinam em matemática. Fazemos o "hard work" numérico aqui
        # e entregamos o relatório mastigado para ela apenas analisar e explicar.
        
        analise_cats = []
        
        # Mapeamento rápido: Categoria -> Média Histórica (R$)
        mapa_medias = {m['categoria']: m['valor_media'] for m in global_context.historico_medias}
        
        # Agregação: Soma das transações do período atual por categoria.
        # Filtramos apenas 'despesa', pois receitas não são foco de "anomalia de gasto".
        gastos_atuais_map = {}
        for t in global_context.transacoes_periodo:
            cat = t.get('categoria', 'Outros')
            val = float(t.get('valor', 0))
            if t.get('tipo') == 'despesa': 
                gastos_atuais_map[cat] = gastos_atuais_map.get(cat, 0) + val

        # Comparação: Realizado (Atual) vs Histórico (Média)
        for cat, valor_atual in gastos_atuais_map.items():
            media = mapa_medias.get(cat, 0)
            
            # Cálculo de Variância Percentual
            variacao = 0
            if media > 0:
                variacao = ((valor_atual - media) / media) * 100
            elif valor_atual > 0:
                # Caso especial: Categoria nova ou sem histórico anterior.
                # Definimos 100% para indicar um "surgimento" de gasto.
                variacao = 100.0 
            
            # Filtro de Relevância (Redução de Ruído):
            # Não queremos incomodar o usuário com "Você gastou R$ 5 a mais em balas".
            # Regras:
            # 1. O gasto absoluto deve ser relevante (> R$ 50).
            # 2. (Implícito no prompt) A variação deve ser significativa.
            # Nota: Passamos todos que superam R$ 50 para a IA decidir a gravidade do desvio.
            if valor_atual > 50:
                analise_cats.append(CategoriaAnalise(
                    categoria=cat,
                    total_atual=round(valor_atual, 2),
                    media_historica=round(media, 2),
                    variacao_percentual=round(variacao, 1)
                ))

        # ----------------------------------------------------------------------
        # 2. MONTAGEM DO CONTEXTO ESPECÍFICO
        # ----------------------------------------------------------------------
        # Preparamos o pacote de dados estritamente necessário para este agente.
        # Incluímos as transações detalhadas para que a IA possa citar "O Culpado" (ex: "Foi o jantar no Outback").
        agent_context = SpendingDetectiveContext(
            mes_analise=global_context.periodo_analise_label,
            analise_categorias=analise_cats,
            transacoes_detalhadas=global_context.transacoes_periodo, 
            assinaturas_identificadas=[] 
        )
        
        context_dict = agent_context.model_dump()
        
        # Otimização: Se a lista de categorias analisadas estiver vazia (nenhum gasto > R$50),
        # abortamos imediatamente para economizar chamada de API e tempo.
        if not context_dict["analise_categorias"]:
            return []

        # ----------------------------------------------------------------------
        # 3. VERIFICAÇÃO DE CACHE
        # ----------------------------------------------------------------------
        cached_response = await ai_cache.get(cls.DOMAIN, cls.AGENT_NAME, context_dict)
        if cached_response:
            return cached_response

        # ----------------------------------------------------------------------
        # 4. PREPARAÇÃO DO PROMPT
        # ----------------------------------------------------------------------
        # Convertemos os objetos de dados em Strings formatadas (listas com bullets)
        # para facilitar a interpretação semântica pelo Modelo de Linguagem.
        analise_str = cls._format_variance_analysis(context_dict["analise_categorias"])
        transacoes_str = cls._format_transactions(context_dict["transacoes_detalhadas"])

        user_prompt = USER_PROMPT_TEMPLATE.format(
            mes_analise=context_dict["mes_analise"],
            analise_categorias_json=analise_str,
            transacoes_json=transacoes_str
        )

        try:
            # ------------------------------------------------------------------
            # 5. CHAMADA LLM E PÓS-PROCESSAMENTO
            # ------------------------------------------------------------------
            # Temperatura 0.2: Queremos precisão analítica, não criatividade poética.
            raw_response = await llm_client.call_model(
                system_prompt=SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.2 
            )

            # Normalização e Validação (Garante Schema AtomicSuggestion)
            suggestions = PostProcessor.process_response(
                raw_data=raw_response,
                domain=cls.DOMAIN, 
                agent_source=cls.AGENT_NAME
            )

            # Salva no Redis se houver sucesso
            if suggestions:
                await ai_cache.set(cls.DOMAIN, cls.AGENT_NAME, context_dict, suggestions)

            return suggestions

        except Exception as e:
            logger.error(f"Falha no {cls.AGENT_NAME}: {e}")
            return []

    @staticmethod
    def _format_variance_analysis(items: List[Dict[str, Any]]) -> str:
        """
        Formata o relatório estatístico para o Prompt.
        Ex: "- CATEGORIA: MERCADO | Atual: R$ 1000 | Média: R$ 500 | Var: +100%"
        """
        lines = []
        for item in items:
            sinal = "+" if item['variacao_percentual'] > 0 else ""
            lines.append(
                f"- CATEGORIA: {item['categoria'].upper()} | "
                f"Atual: R$ {item['total_atual']} | "
                f"Média: R$ {item['media_historica']} | "
                f"Var: {sinal}{item['variacao_percentual']}%"
            )
        return "\n".join(lines)

    @staticmethod
    def _format_transactions(items: List[Dict[str, Any]]) -> str:
        """
        Lista as transações para o Prompt, permitindo que a IA encontre a causa raiz.
        
        OTIMIZAÇÃO DE TOKENS:
        Ordenamos por valor (decrescente) e pegamos apenas o Top 20.
        Assumimos que anomalias financeiras relevantes raramente são causadas 
        pela 21ª menor compra do mês.
        """
        # Ordenar por valor decrescente (os maiores gastos são os mais relevantes)
        sorted_items = sorted(items, key=lambda x: x.get('valor', 0), reverse=True)
        
        lines = []
        for item in sorted_items[:20]:
            lines.append(
                f"- R$ {item.get('valor')} em '{item.get('descricao')}' "
                f"({item.get('data')}) [{item.get('categoria')}]"
            )
        return "\n".join(lines)