import logging
import json
from datetime import datetime
from dateutil.relativedelta import relativedelta
from typing import List, Dict, Any

from app.services.ai.base.llm_factory import llm_client
from app.services.ai.base.post_processor import PostProcessor
from app.services.ai.base.cache import ai_cache
from app.services.ai.base.base_schema import AtomicSuggestion

# Contextos
from app.services.ai.financas.context import FinancasContext
from app.services.ai.financas.provisions_architect.schema import ProvisionsContext, ProvisaoItem
from app.services.ai.financas.provisions_architect.prompts import SYSTEM_PROMPT, USER_PROMPT_TEMPLATE

logger = logging.getLogger(__name__)

class ProvisionsArchitectAgent:
    """
    Agente Especialista: Provisões e Metas de Longo Prazo.
    Responsabilidade: Calcular a viabilidade matemática de metas e sugerir aportes de suavização.
    """
    DOMAIN = "financas"
    AGENT_NAME = "provisions_architect"

    @classmethod
    async def run(cls, global_context: FinancasContext) -> List[AtomicSuggestion]:
        # 1. Pré-Processamento Matemático
        # Vamos iterar sobre as metas cadastradas e calcular a "Saúde da Meta"
        
        analise_items = []
        
        # Converte string data_atual para objeto date para cálculos
        try:
            hj = datetime.strptime(global_context.data_atual, "%Y-%m-%d").date()
        except:
            hj = datetime.now().date()

        for meta in global_context.metas_provisoes:
            # Extração segura
            alvo_dt_str = meta.get('data_alvo')
            valor_total = float(meta.get('valor_total', 0))
            valor_atual = float(meta.get('valor_acumulado', 0))
            nome = meta.get('nome', 'Meta')
            
            # Cálculo de Prazos
            meses_restantes = 0
            if alvo_dt_str:
                try:
                    alvo_dt = datetime.strptime(alvo_dt_str, "%Y-%m-%d").date()
                    # Diferença em meses (aproximada)
                    r = relativedelta(alvo_dt, hj)
                    meses_restantes = r.years * 12 + r.months
                    if meses_restantes < 1: meses_restantes = 1 # Evita divisão por zero
                except:
                    meses_restantes = 12 # Default se data inválida
            else:
                meses_restantes = 12 # Default anual

            # Cálculo Financeiro
            falta = valor_total - valor_atual
            aporte_ideal = 0
            if falta > 0:
                aporte_ideal = falta / meses_restantes
            
            # Progresso
            progresso = 0
            if valor_total > 0:
                progresso = (valor_atual / valor_total) * 100
            
            # Status Simplificado para a IA
            status = "Em dia"
            # Se deveria ter X% pelo tempo decorrido e tem menos, está atrasado.
            # (Lógica simplificada: Aporte Ideal vs Aporte Real Médio seria melhor, mas requer histórico da meta)
            
            # Vamos classificar pela urgência do aporte
            if aporte_ideal > (global_context.media_sobra_mensal * 0.5) and global_context.media_sobra_mensal > 0:
                status = "Crítico (Inviável)" # Precisa de 50% da sobra livre só pra essa meta
            elif aporte_ideal > 0 and meses_restantes <= 3 and progresso < 50:
                status = "Atrasado (Urgente)"
            elif progresso >= 100:
                status = "Concluído"

            analise_items.append(ProvisaoItem(
                nome=nome,
                data_alvo=alvo_dt_str or "N/A",
                valor_total=round(valor_total, 2),
                valor_acumulado=round(valor_atual, 2),
                progresso_percentual=round(progresso, 1),
                meses_restantes=meses_restantes,
                aporte_mensal_ideal=round(aporte_ideal, 2),
                status_matematico=status
            ))

        # 2. Montagem do Contexto
        agent_context = ProvisionsContext(
            data_atual=global_context.data_atual,
            analise_provisoes=analise_items,
            capacidade_poupanca_media=round(global_context.media_sobra_mensal, 2)
        )
        
        context_dict = agent_context.model_dump()
        
        # Otimização: Sem metas, sem análise
        if not context_dict["analise_provisoes"]:
            return []

        # 3. Cache Check
        cached_response = await ai_cache.get(cls.DOMAIN, cls.AGENT_NAME, context_dict)
        if cached_response:
            return cached_response

        # 4. Preparação do Prompt
        analise_str = cls._format_goals_analysis(context_dict["analise_provisoes"])

        user_prompt = USER_PROMPT_TEMPLATE.format(
            data_atual=context_dict["data_atual"],
            analise_metas_json=analise_str,
            capacidade_poupanca=context_dict["capacidade_poupanca_media"]
        )

        try:
            # 5. LLM Call
            raw_response = await llm_client.call_model(
                system_prompt=SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.2 
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
    def _format_goals_analysis(items: List[Dict[str, Any]]) -> str:
        lines = []
        for item in items:
            lines.append(
                f"- META: {item['nome'].upper()} | "
                f"Alvo: R$ {item['valor_total']} em {item['data_alvo']} | "
                f"Atual: R$ {item['valor_acumulado']} ({item['progresso_percentual']}%) | "
                f"Restam: {item['meses_restantes']} meses | "
                f"Necessário Agora: R$ {item['aporte_mensal_ideal']}/mês | "
                f"Status: {item['status_matematico']}"
            )
        return "\n".join(lines)