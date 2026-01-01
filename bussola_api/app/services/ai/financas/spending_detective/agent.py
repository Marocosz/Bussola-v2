import logging
import json
from typing import List, Dict, Any

from app.services.ai.base.llm_factory import llm_client
from app.services.ai.base.post_processor import PostProcessor
from app.services.ai.base.cache import ai_cache
from app.services.ai.base.base_schema import AtomicSuggestion

# Contextos
from app.services.ai.financas.context import FinancasContext
from app.services.ai.financas.spending_detective.schema import SpendingDetectiveContext, CategoriaAnalise
from app.services.ai.financas.spending_detective.prompts import SYSTEM_PROMPT, USER_PROMPT_TEMPLATE

logger = logging.getLogger(__name__)

class SpendingDetectiveAgent:
    """
    Agente Especialista: Auditoria de Gastos e Anomalias.
    Responsabilidade: Comparar gastos atuais com médias históricas e apontar desvios.
    """
    DOMAIN = "financas"
    AGENT_NAME = "spending_detective"

    @classmethod
    async def run(cls, global_context: FinancasContext) -> List[AtomicSuggestion]:
        # 1. Pré-Processamento Matemático (Python > LLM para cálculos)
        # O agente recebe o contexto global e prepara o contexto específico
        # calculando a variância percentual e absoluta.
        
        analise_cats = []
        
        # Dicionário auxiliar para mapear médias
        mapa_medias = {m['categoria']: m['valor_media'] for m in global_context.historico_medias}
        
        # Agrupa transações atuais por categoria (se o contexto já não trouxer agrupado)
        # Vamos assumir que FinancasContext já traz um resumo_atual ou calculamos aqui.
        # Para robustez, vamos calcular baseados nas transações atuais.
        gastos_atuais_map = {}
        for t in global_context.transacoes_periodo:
            cat = t.get('categoria', 'Outros')
            val = float(t.get('valor', 0))
            if t.get('tipo') == 'despesa': # Só analisa despesas
                gastos_atuais_map[cat] = gastos_atuais_map.get(cat, 0) + val

        # Monta a análise comparativa
        for cat, valor_atual in gastos_atuais_map.items():
            media = mapa_medias.get(cat, 0)
            
            # Cálculo de Variação
            variacao = 0
            if media > 0:
                variacao = ((valor_atual - media) / media) * 100
            elif valor_atual > 0:
                variacao = 100.0 # Se não tinha média e gastou, é aumento infinito
            
            # Filtro de Relevância: Só enviamos para LLM analisar se:
            # 1. Gasto atual é relevante (> R$ 50)
            # 2. Desvio é notável (ex: variou +/- 10%) ou não tem média
            if valor_atual > 50:
                analise_cats.append(CategoriaAnalise(
                    categoria=cat,
                    total_atual=round(valor_atual, 2),
                    media_historica=round(media, 2),
                    variacao_percentual=round(variacao, 1)
                ))

        # 2. Montagem do Contexto do Agente
        agent_context = SpendingDetectiveContext(
            mes_analise=global_context.periodo_analise_label, # ex: "Janeiro 2026"
            analise_categorias=analise_cats,
            transacoes_detalhadas=global_context.transacoes_periodo, # Passamos tudo para ele achar os culpados
            assinaturas_identificadas=[] # Poderíamos implementar lógica de detecção de recorrência aqui
        )
        
        context_dict = agent_context.model_dump()
        
        # Otimização: Se não gastou nada, não tem o que auditar
        if not context_dict["analise_categorias"]:
            return []

        # 3. Cache Check
        cached_response = await ai_cache.get(cls.DOMAIN, cls.AGENT_NAME, context_dict)
        if cached_response:
            return cached_response

        # 4. Preparação do Prompt
        analise_str = cls._format_variance_analysis(context_dict["analise_categorias"])
        transacoes_str = cls._format_transactions(context_dict["transacoes_detalhadas"])

        user_prompt = USER_PROMPT_TEMPLATE.format(
            mes_analise=context_dict["mes_analise"],
            analise_categorias_json=analise_str,
            transacoes_json=transacoes_str
        )

        try:
            # 5. LLM Call
            raw_response = await llm_client.call_model(
                system_prompt=SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.2 # Baixa criatividade, foco analítico
            )

            # 6. Post-Processing
            suggestions = PostProcessor.process_response(
                raw_data=raw_response,
                domain=cls.DOMAIN, 
                agent_source=cls.AGENT_NAME
            )

            # 7. Cache Save
            if suggestions:
                await ai_cache.set(cls.DOMAIN, cls.AGENT_NAME, context_dict, suggestions)

            return suggestions

        except Exception as e:
            logger.error(f"Falha no {cls.AGENT_NAME}: {e}")
            return []

    @staticmethod
    def _format_variance_analysis(items: List[Dict[str, Any]]) -> str:
        """Formata a comparação estatística para o LLM."""
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
        """Lista transações para que a IA possa citar 'O culpado'."""
        # Ordenar por valor decrescente (os maiores gastos são os mais relevantes)
        sorted_items = sorted(items, key=lambda x: x.get('valor', 0), reverse=True)
        
        lines = []
        # Limita às Top 20 maiores transações para economizar tokens
        for item in sorted_items[:20]:
            lines.append(
                f"- R$ {item.get('valor')} em '{item.get('descricao')}' "
                f"({item.get('data')}) [{item.get('categoria')}]"
            )
        return "\n".join(lines)