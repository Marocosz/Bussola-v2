import logging
import uuid
from typing import List, Any, Dict, Union

from pydantic import ValidationError

from app.services.ai.base.base_schema import AtomicSuggestion

logger = logging.getLogger(__name__)

class PostProcessor:
    """
    Camada de segurança e limpeza de dados.
    Recebe o output bruto (dicionário ou lista) do LLM e converte em
    uma lista estrita de objetos AtomicSuggestion validados.
    """

    @staticmethod
    def process_response(
        raw_data: Union[Dict[str, Any], List[Dict[str, Any]]],
        domain: str,
        agent_source: str
    ) -> List[AtomicSuggestion]:
        """
        Processa o payload bruto do LLM.
        
        Args:
            raw_data: O JSON retornado pelo LangChain (pode ser dict ou list).
            domain: O domínio de origem (ex: 'nutri', 'coach') para fallback.
            agent_source: O nome do agente (ex: 'macro_auditor') para fallback.
            
        Returns:
            Lista de objetos AtomicSuggestion validados.
        """
        valid_suggestions: List[AtomicSuggestion] = []
        items_to_process = []

        # 1. Normalização de Estrutura (Dict -> List)
        # Às vezes o LLM envelopa a lista em chaves como "suggestions", "items", "data"
        if isinstance(raw_data, dict):
            # Tenta encontrar a lista dentro de chaves comuns
            found_list = False
            for key in ["suggestions", "items", "dicas", "alerts", "analysis"]:
                if key in raw_data and isinstance(raw_data[key], list):
                    items_to_process = raw_data[key]
                    found_list = True
                    break
            
            # Se não achou lista interna, assume que o próprio dict é um item único
            if not found_list:
                items_to_process = [raw_data]
        
        elif isinstance(raw_data, list):
            items_to_process = raw_data
        
        else:
            logger.error(f"[{agent_source}] Formato de resposta desconhecido: {type(raw_data)}")
            return []

        # 2. Validação e Enriquecimento Item a Item
        for item in items_to_process:
            if not isinstance(item, dict):
                continue

            try:
                # Fallback: Injeta dados de contexto se o LLM esqueceu
                if "domain" not in item or not item["domain"]:
                    item["domain"] = domain
                
                if "agent_source" not in item or not item["agent_source"]:
                    item["agent_source"] = agent_source
                
                # Fallback: Garante ID
                if "id" not in item or not item["id"]:
                    item["id"] = str(uuid.uuid4())

                # Fallback: Defaults seguros
                if "severity" not in item:
                    item["severity"] = "low"
                if "actionable" not in item:
                    item["actionable"] = False

                # 3. Validação Pydantic (Strict)
                suggestion = AtomicSuggestion(**item)
                valid_suggestions.append(suggestion)

            except ValidationError as e:
                logger.warning(f"[{agent_source}] Item inválido descartado: {e}. Dados: {item}")
                continue
            except Exception as e:
                logger.error(f"[{agent_source}] Erro inesperado ao processar item: {e}")
                continue

        return valid_suggestions