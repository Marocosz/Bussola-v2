import asyncio
import logging
import json
from typing import List, Dict, Any

# Imports dos Agentes
from app.services.ai.roteiro.conflict_guardian.agent import ConflictGuardianAgent
from app.services.ai.roteiro.density_auditor.agent import DensityAuditorAgent
from app.services.ai.roteiro.recovery_agent.agent import RecoveryAgent
from app.services.ai.roteiro.travel_marshal.agent import TravelMarshalAgent

# Contexto e Schema Base
from app.services.ai.roteiro.context import RoteiroContext
from app.services.ai.base.base_schema import AtomicSuggestion

logger = logging.getLogger(__name__)

class RoteiroOrchestrator:
    """
    Orquestrador do domínio Roteiro.
    Responsável por instanciar o contexto e coordenar a execução paralela
    dos agentes especialistas.
    """
    
    @staticmethod
    async def analyze_schedule(
        data_atual: str,
        dia_semana: str,
        data_inicio: str,
        data_fim: str,
        agenda_itens: List[Dict[str, Any]],
        preferences: Dict[str, Any] = None
    ) -> List[AtomicSuggestion]:
        """
        Ponto de entrada principal para análise de roteiro.
        """
        
        # 1. Montagem do Contexto Global (Single Source of Truth)
        context = RoteiroContext(
            data_atual=data_atual,
            dia_semana=dia_semana,
            data_inicio=data_inicio,
            data_fim=data_fim,
            agenda_itens=agenda_itens,
            user_preferences=preferences or {}
        )
        
        print(f"\n[RoteiroOrchestrator] 🚀 Iniciando análise. Itens na agenda: {len(agenda_itens)}")

        # 2. Execução Paralela dos Agentes (Scatter-Gather Pattern)
        results = await asyncio.gather(
            ConflictGuardianAgent.run(context),
            DensityAuditorAgent.run(context),
            RecoveryAgent.run(context),
            TravelMarshalAgent.run(context),
            return_exceptions=True
        )

        # 3. Consolidação dos Resultados Brutos
        raw_suggestions: List[AtomicSuggestion] = []
        
        agents_map = ["ConflictGuardian", "DensityAuditor", "RecoveryAgent", "TravelMarshal"]

        for i, result in enumerate(results):
            agent_name = agents_map[i]
            
            if isinstance(result, Exception):
                print(f"❌ [ERRO] {agent_name}: {result}")
                logger.error(f"[RoteiroOrchestrator] Erro no agente {agent_name}: {result}")
                continue
                
            if result:
                raw_suggestions.extend(result)
                
                # --- LOG NO TERMINAL (Visualizar o que cada agente gerou ANTES do filtro) ---
                if len(result) > 0:
                    print(f"\n{'='*20} 🤖 {agent_name.upper()} ({len(result)}) {'='*20}")
                    for suggestion in result:
                        print(json.dumps(suggestion.model_dump(), indent=2, ensure_ascii=False))
                    print(f"{'='*60}\n")
                else:
                    print(f"⚪ {agent_name}: Sem sugestões.")

        # 4. Pós-Processamento e Limpeza de Ruído (Deduplicação e Filtros de UX)
        cleaned_suggestions = []
        seen_keys = set()
        
        # Definição de ordem de severidade para ordenação final
        severity_order = {"high": 0, "medium": 1, "low": 2, "none": 3}

        for suggestion in raw_suggestions:
            # Filtro 1: "Lobotomia" no TravelMarshal (Segurança Extra)
            # Se for checklist genérico sem menção a viagem/voo/estrada, ignora.
            if suggestion.agent_source == "travel_marshal" and suggestion.type == 'info':
                content_lower = suggestion.content.lower()
                title_lower = suggestion.title.lower()
                if "checklist" in title_lower and not any(x in content_lower for x in ["viagem", "voo", "aeroporto", "mala"]):
                    continue

            # Filtro 2: Deduplicação Simples
            # Evita que o mesmo alerta apareça duas vezes (mesmo título e mesmo alvo)
            key = f"{suggestion.title}-{suggestion.action.target}"
            if key in seen_keys:
                continue
            
            seen_keys.add(key)
            cleaned_suggestions.append(suggestion)

        # 5. Ordenação Final
        cleaned_suggestions.sort(key=lambda x: severity_order.get(x.severity, 99))

        print(f"[RoteiroOrchestrator] ✅ Análise concluída.")
        print(f"📊 Redução de Ruído: {len(raw_suggestions)} insights originais -> {len(cleaned_suggestions)} insights finais.\n")
        
        return cleaned_suggestions