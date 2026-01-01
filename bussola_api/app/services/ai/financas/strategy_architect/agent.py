"""
=======================================================================================
ARQUIVO: agent.py (StrategyArchitect)
=======================================================================================

RESPONSABILIDADE:
    Executar a lógica de comparação entre Metas Configuradas e Histórico Realizado (90d).
    Identificar padrões de comportamento (Diagnósticos) e acionar o LLM para gerar
    recomendações estratégicas.
"""

import logging
import json
from typing import List, Dict, Any

from app.services.ai.base.llm_factory import llm_client
from app.services.ai.base.post_processor import PostProcessor
from app.services.ai.base.cache import ai_cache
from app.services.ai.base.base_schema import AtomicSuggestion

# Contextos e Schemas
from app.services.ai.financas.context import FinancasContext
from app.services.ai.financas.strategy_architect.schema import StrategyContext, ItemAnaliseEstrategica
from app.services.ai.financas.strategy_architect.prompts import SYSTEM_PROMPT, USER_PROMPT_TEMPLATE

logger = logging.getLogger(__name__)

class StrategyArchitectAgent:
    """
    Agente Especialista: Calibragem de Estratégia e Metas.
    Analisa a divergência entre o Planejado (Metas) e o Executado (Histórico).
    """
    DOMAIN = "financas"
    AGENT_NAME = "strategy_architect"

    # Limiares de Tolerância (Thresholds)
    TOLERANCIA_DESVIO = 15.0 # % - Se desvio for menor que isso, consideramos "Na Meta"
    MINIMO_RELEVANTE = 50.0  # R$ - Ignorar desvios menores que 50 reais (ruído)

    @classmethod
    async def run(cls, global_context: FinancasContext) -> List[AtomicSuggestion]:
        # 1. Pré-Processamento: Cruzamento de Dados (Meta vs Realizado)
        # O global_context já traz 'historico_medias' (Realizado) e 'metas_orcamentarias' (Planejado)
        
        # Mapa de Médias Reais: { "Alimentação": 540.00, ... }
        mapa_medias = {m['categoria']: float(m['valor_media']) for m in global_context.historico_medias}
        
        itens_analise: List[ItemAnaliseEstrategica] = []
        
        # Iteramos sobre as METAS configuradas pelo usuário.
        # Se não tem meta configurada, não tem o que calibrar (ignoramos).
        for meta in global_context.metas_orcamentarias:
            categoria = meta['categoria']
            valor_meta = float(meta.get('valor_limite', 0))
            
            # Pega a média realizada (ou 0 se não houve gasto histórico)
            media_real = mapa_medias.get(categoria, 0.0)
            
            if valor_meta <= 0: continue # Ignora metas zeradas

            # Identificação do Tipo (Receita vs Despesa)
            # Como a lista de metas vem misturada ou geralmente é despesa, tentamos inferir
            # ou assumimos despesa (padrão de orçamento). 
            # *Nota: Num sistema ideal, 'metas_orcamentarias' teria o campo 'tipo'. 
            # Aqui assumiremos 'despesa' para orçamentos, a menos que tenhamos info contrária.
            tipo_fluxo = "despesa" 
            
            # --- LÓGICA DE DIAGNÓSTICO MATEMÁTICO ---
            
            # Cálculo do Desvio Percentual
            # (Real - Meta) / Meta
            desvio_pct = ((media_real - valor_meta) / valor_meta) * 100
            diff_absoluta = media_real - valor_meta
            
            diagnostico = "ALINHAMENTO_PERFEITO"
            sugestao_valor = valor_meta

            if tipo_fluxo == "despesa":
                # Lógica para Tetos (Queremos Gasto <= Meta)
                
                if desvio_pct > cls.TOLERANCIA_DESVIO and diff_absoluta > cls.MINIMO_RELEVANTE:
                    # Gasta muito mais que a meta -> Meta é ilusão
                    diagnostico = "TETO_DE_VIDRO"
                    sugestao_valor = media_real # Sugere assumir a realidade
                    
                elif desvio_pct < -cls.TOLERANCIA_DESVIO and diff_absoluta < -cls.MINIMO_RELEVANTE:
                    # Gasta muito menos que a meta -> Dinheiro preso
                    diagnostico = "CAPITAL_ZUMBI"
                    # Sugere reduzir a meta para a média + margem de segurança (10%)
                    sugestao_valor = media_real * 1.10
            
            # Adiciona para análise APENAS se houver diagnóstico relevante (não "Perfeito")
            if diagnostico != "ALINHAMENTO_PERFEITO":
                itens_analise.append(ItemAnaliseEstrategica(
                    categoria=categoria,
                    tipo_fluxo=tipo_fluxo,
                    meta_configurada=round(valor_meta, 2),
                    media_realizada_90d=round(media_real, 2),
                    desvio_percentual=round(desvio_pct, 1),
                    diagnostico=diagnostico,
                    sugestao_ajuste_valor=round(sugestao_valor, 2)
                ))

        # --- TRATAMENTO DE ESTADOS GERAIS ---
        
        # Cenário 1: Sem dados históricos suficientes (Cold Start)
        historico_ok = True
        if not global_context.historico_medias:
            historico_ok = False
            itens_analise = [
                ItemAnaliseEstrategica(
                    categoria="GERAL", tipo_fluxo="despesa", meta_configurada=0, media_realizada_90d=0,
                    desvio_percentual=0, diagnostico="DADOS_INSUFICIENTES"
                )
            ]
            
        # Cenário 2: Tudo Calibrado (Nenhum item relevante gerado e temos histórico)
        elif not itens_analise:
            itens_analise = [
                ItemAnaliseEstrategica(
                    categoria="GERAL", tipo_fluxo="despesa", meta_configurada=0, media_realizada_90d=0,
                    desvio_percentual=0, diagnostico="CALIBRAGEM_GERAL_OK"
                )
            ]

        # 2. Montagem do Contexto
        agent_context = StrategyContext(
            periodo_analise="Histórico de 90 Dias",
            itens_analisados=itens_analise,
            possui_historico_suficiente=historico_ok
        )
        
        context_dict = agent_context.model_dump()

        # 3. Cache Check
        cached_response = await ai_cache.get(cls.DOMAIN, cls.AGENT_NAME, context_dict)
        if cached_response:
            return cached_response

        # 4. Formatação para Prompt
        itens_str = cls._format_items_for_prompt(context_dict["itens_analisados"])

        user_prompt = USER_PROMPT_TEMPLATE.format(
            periodo_analise=context_dict["periodo_analise"],
            historico_status="Suficiente" if context_dict["possui_historico_suficiente"] else "Insuficiente",
            itens_json=itens_str
        )

        try:
            # 5. LLM Call
            raw_response = await llm_client.call_model(
                system_prompt=SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.4 # Um pouco mais criativo para ser persuasivo/consultivo
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
    def _format_items_for_prompt(items: List[Dict[str, Any]]) -> str:
        lines = []
        for item in items:
            if item['categoria'] == "GERAL":
                lines.append(f"- STATUS GERAL DO SISTEMA: {item['diagnostico']}")
            else:
                lines.append(
                    f"- CATEGORIA: {item['categoria']} ({item['tipo_fluxo'].upper()}) | "
                    f"DIAGNÓSTICO: {item['diagnostico']} | "
                    f"Meta: R$ {item['meta_configurada']} vs Real: R$ {item['media_realizada_90d']} "
                    f"(Desvio: {item['desvio_percentual']}%) | "
                    f"Sugestão Matemática: R$ {item['sugestao_ajuste_valor']}"
                )
        return "\n".join(lines)