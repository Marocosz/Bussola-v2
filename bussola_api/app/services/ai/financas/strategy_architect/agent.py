"""
=======================================================================================
ARQUIVO: agent.py (Agente StrategyArchitect)
=======================================================================================

OBJETIVO:
    Implementar o "Arquiteto de Estratégia".
    Este agente atua como um Consultor Financeiro de Longo Prazo.
    Sua missão não é julgar um gasto isolado (papel do Detective) ou avisar que o dinheiro
    vai acabar (papel do Oracle), mas sim auditar a POLÍTICA financeira do usuário.

CAMADA:
    Services / AI / Financas (Backend).
    É invocado pelo `FinancasOrchestrator` para compor a visão estratégica.

RESPONSABILIDADES:
    1. Auditoria de Metas: Comparar o que o usuário "diz que vai gastar" (Meta) com o que
       ele "realmente gasta" (Histórico de 90 dias).
    2. Diagnóstico de Comportamento: Identificar padrões como "Teto de Vidro" (gasta sempre mais que a meta)
       ou "Capital Zumbi" (aloca dinheiro que nunca usa).
    3. Calibragem do Sistema: Sugerir ajustes numéricos nas metas para tornar o orçamento realista.
    4. Persuasão: Usar a IA para convencer o usuário a ajustar suas expectativas.

INTEGRAÇÕES:
    - LLMFactory: Para gerar argumentos persuasivos sobre os ajustes sugeridos.
    - AgentCache: Para evitar reprocessamento de cenários inalterados.
    - FinancasContext: Fonte de dados (Metas configuradas e Médias Históricas).
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
from app.services.ai.financas.strategy_architect.schema import StrategyContext, ItemAnaliseEstrategica
from app.services.ai.financas.strategy_architect.prompts import SYSTEM_PROMPT, USER_PROMPT_TEMPLATE

logger = logging.getLogger(__name__)

class StrategyArchitectAgent:
    """
    Agente Especialista: Calibragem de Estratégia e Metas.
    
    Diferencial:
    Enquanto outros agentes olham para Transações (fatos atômicos), este agente olha
    para Intenções (Metas) vs Hábitos (Médias).
    """
    DOMAIN = "financas"
    AGENT_NAME = "strategy_architect"

    # --------------------------------------------------------------------------
    # CONSTANTES DE CALIBRAGEM (Regras de Negócio)
    # --------------------------------------------------------------------------
    # Tolerância de 15%: Se a meta é 100 e o gasto é 110, consideramos "Na Meta".
    # Só alertamos se fugir muito desse desvio padrão aceitável.
    TOLERANCIA_DESVIO = 15.0 
    
    # Mínimo Relevante R$ 50: Ignoramos desvios em categorias de valor irrisório.
    # Ex: Meta R$ 10, Gasto R$ 20 (+100%). Matematicamente grave, financeiramente irrelevante.
    MINIMO_RELEVANTE = 50.0  

    @classmethod
    async def run(cls, global_context: FinancasContext) -> List[AtomicSuggestion]:
        """
        Executa a auditoria de aderência das metas.
        
        Args:
            global_context: Contém 'historico_medias' (Realidade) e 'metas_orcamentarias' (Expectativa).
            
        Returns:
            Lista de sugestões de ajuste de meta (Aumentar Teto, Reduzir Capital Ocioso, etc).
        """
        
        # ----------------------------------------------------------------------
        # 1. PRÉ-PROCESSAMENTO: CRUZAMENTO DE DADOS (O(n))
        # ----------------------------------------------------------------------
        
        # Cria índice hash para busca rápida de médias históricas por categoria.
        # { "Alimentação": 540.00, "Transporte": 200.00, ... }
        mapa_medias = {m['categoria']: float(m['valor_media']) for m in global_context.historico_medias}
        
        itens_analise: List[ItemAnaliseEstrategica] = []
        
        # Iteramos sobre as INTENÇÕES (Metas) do usuário para validá-las contra a REALIDADE.
        for meta in global_context.metas_orcamentarias:
            categoria = meta['categoria']
            valor_meta = float(meta.get('valor_limite', 0))
            
            # Busca a média realizada (Default 0.0 se nunca houve gasto na categoria)
            media_real = mapa_medias.get(categoria, 0.0)
            
            # Regra de Negócio: Ignora metas não configuradas ou zeradas.
            if valor_meta <= 0: continue 

            # Assunção de Domínio: Neste momento, assumimos fluxo de 'despesa' para
            # orçamentos, pois metas de receita geralmente seguem lógica de "Piso" e não "Teto".
            tipo_fluxo = "despesa" 
            
            # ------------------------------------------------------------------
            # 2. LÓGICA DE DIAGNÓSTICO MATEMÁTICO (Core Logic)
            # ------------------------------------------------------------------
            
            # Cálculo do Desvio: Quão longe a realidade está da expectativa?
            # Positivo = Gastou mais que a meta. Negativo = Gastou menos.
            desvio_pct = ((media_real - valor_meta) / valor_meta) * 100
            diff_absoluta = media_real - valor_meta
            
            diagnostico = "ALINHAMENTO_PERFEITO"
            sugestao_valor = valor_meta

            if tipo_fluxo == "despesa":
                # Cenário A: TETO DE VIDRO (Chronic Overshoot)
                # O usuário define uma meta baixa, mas sistematicamente a estoura.
                # A meta virou uma "mentira psicológica" que gera alertas constantes.
                if desvio_pct > cls.TOLERANCIA_DESVIO and diff_absoluta > cls.MINIMO_RELEVANTE:
                    diagnostico = "TETO_DE_VIDRO"
                    sugestao_valor = media_real # A sugestão é: "Aceite a realidade"
                    
                # Cenário B: CAPITAL ZUMBI (Dead Capital)
                # O usuário reserva orçamento, mas não usa. Esse dinheiro "virtual"
                # poderia estar alocado em investimentos ou outras categorias.
                elif desvio_pct < -cls.TOLERANCIA_DESVIO and diff_absoluta < -cls.MINIMO_RELEVANTE:
                    diagnostico = "CAPITAL_ZUMBI"
                    # A sugestão é reduzir a meta para a média real + uma margem de segurança (10%)
                    sugestao_valor = media_real * 1.10
            
            # Filtro: Só enviamos para a IA o que realmente precisa de ajuste.
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

        # ----------------------------------------------------------------------
        # 3. TRATAMENTO DE ESTADOS DE BORDA
        # ----------------------------------------------------------------------
        
        # Caso 1: Cold Start (Usuário novo sem histórico de 90 dias)
        # Não podemos sugerir ajustes estratégicos sem dados.
        historico_ok = True
        if not global_context.historico_medias:
            historico_ok = False
            itens_analise = [
                ItemAnaliseEstrategica(
                    categoria="GERAL", tipo_fluxo="despesa", meta_configurada=0, media_realizada_90d=0,
                    desvio_percentual=0, diagnostico="DADOS_INSUFICIENTES"
                )
            ]
            
        # Caso 2: Sistema Calibrado (Usuário experiente com metas ajustadas)
        # Devemos enviar um feedback positivo (Praise).
        elif not itens_analise:
            itens_analise = [
                ItemAnaliseEstrategica(
                    categoria="GERAL", tipo_fluxo="despesa", meta_configurada=0, media_realizada_90d=0,
                    desvio_percentual=0, diagnostico="CALIBRAGEM_GERAL_OK"
                )
            ]

        # ----------------------------------------------------------------------
        # 4. MONTAGEM DO CONTEXTO DO AGENTE
        # ----------------------------------------------------------------------
        agent_context = StrategyContext(
            periodo_analise="Histórico de 90 Dias",
            itens_analisados=itens_analise,
            possui_historico_suficiente=historico_ok
        )
        
        context_dict = agent_context.model_dump()

        # ----------------------------------------------------------------------
        # 5. CACHE E CHAMADA LLM
        # ----------------------------------------------------------------------
        cached_response = await ai_cache.get(cls.DOMAIN, cls.AGENT_NAME, context_dict)
        if cached_response:
            return cached_response

        # Formatação do Prompt com os diagnósticos matemáticos já calculados
        itens_str = cls._format_items_for_prompt(context_dict["itens_analisados"])

        user_prompt = USER_PROMPT_TEMPLATE.format(
            periodo_analise=context_dict["periodo_analise"],
            historico_status="Suficiente" if context_dict["possui_historico_suficiente"] else "Insuficiente",
            itens_json=itens_str
        )

        try:
            # Temperatura 0.4: Diferente dos outros agentes (0.2), este precisa de um pouco
            # mais de "criatividade" para ser persuasivo e atuar como um consultor,
            # explicando o "porquê" da mudança de estratégia.
            raw_response = await llm_client.call_model(
                system_prompt=SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.4 
            )

            suggestions = PostProcessor.process_response(
                raw_data=raw_response,
                domain=cls.DOMAIN, 
                agent_source=cls.AGENT_NAME
            )

            if suggestions:
                await ai_cache.set(cls.DOMAIN, cls.AGENT_NAME, context_dict, suggestions)

            return suggestions

        except Exception as e:
            logger.error(f"Falha no {cls.AGENT_NAME}: {e}")
            return []

    @staticmethod
    def _format_items_for_prompt(items: List[Dict[str, Any]]) -> str:
        """
        Converte a lista de objetos de análise em texto legível para o LLM.
        Inclui o diagnóstico técnico e a sugestão matemática para guiar a geração do texto.
        """
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