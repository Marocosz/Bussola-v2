"""
=======================================================================================
ARQUIVO: post_processor.py (Normalização e Validação de Saída da IA)
=======================================================================================

OBJETIVO:
    Atuar como uma camada de "limpeza e segurança" (Sanitization Layer) para os dados
    retornados pelos Modelos de Linguagem (LLMs).
    
    Como LLMs não são determinísticos, a estrutura do JSON retornado pode variar
    sutilmente (ex: lista pura vs. dicionário com chave "items"). Este arquivo garante
    que o restante do sistema receba sempre uma estrutura de dados previsível e tipada.

CAMADA:
    Services / AI (Backend).
    É executado imediatamente após o retorno da `LLMFactory` e antes de salvar no Cache
    ou devolver para o Orquestrador.

RESPONSABILIDADES:
    1. Normalização Estrutural: Converter saídas variadas (Dict ou List) em uma Lista plana.
    2. Enriquecimento de Dados: Injetar metadados que a IA pode ter esquecido (Domínio, Agente).
    3. Validação Estrita: Usar Pydantic para garantir que apenas dados válidos cheguem ao Frontend.
    4. Tolerância a Falhas: Descartar itens inválidos individualmente sem quebrar a requisição inteira.

COMUNICAÇÃO:
    - Recebe dados de: `LLMFactory` (JSON bruto).
    - Utiliza: `AtomicSuggestion` (Schema base) para validação.
    - Envia dados para: `Agentes` e `Orquestradores` (Dados limpos).
"""

import logging
import uuid
from typing import List, Any, Dict, Union

from pydantic import ValidationError

from app.services.ai.base.base_schema import AtomicSuggestion

logger = logging.getLogger(__name__)

class PostProcessor:
    """
    Processador de pós-execução para LLMs.
    Garante que a alucinação estrutural da IA não cause erros de runtime na aplicação.
    """

    @staticmethod
    def process_response(
        raw_data: Union[Dict[str, Any], List[Dict[str, Any]]],
        domain: str,
        agent_source: str
    ) -> List[AtomicSuggestion]:
        """
        Processa, corrige e valida o payload bruto retornado pelo LLM.
        
        MOTIVAÇÃO:
        Mesmo instruindo a IA a retornar JSON, ela pode:
        1. Envelopar a lista numa chave (ex: {"suggestions": [...]}).
        2. Esquecer campos obrigatórios (ex: id, domain).
        3. Gerar Enums inválidos.
        
        Este método resolve esses problemas programaticamente.

        ENTRADA:
        - raw_data: O objeto Python (Dict ou List) parseado do JSON da IA.
        - domain: O contexto de negócio (ex: 'financas') para injeção de fallback.
        - agent_source: O nome do agente (ex: 'spending_detective') para injeção de fallback.
            
        SAÍDA:
        - Lista de objetos `AtomicSuggestion` 100% validados e prontos para o Frontend.
        """
        valid_suggestions: List[AtomicSuggestion] = []
        items_to_process = []

        # ----------------------------------------------------------------------
        # 1. NORMALIZAÇÃO DE ESTRUTURA (Heurística de Desempacotamento)
        # ----------------------------------------------------------------------
        # O objetivo aqui é extrair uma lista de itens, independente de como a IA formatou o JSON raiz.
        
        if isinstance(raw_data, dict):
            # Cenário A: A IA retornou um objeto envelope (ex: {"items": [...]})
            # Tentamos adivinhar a chave onde a lista está escondida.
            found_list = False
            possible_keys = ["suggestions", "items", "dicas", "alerts", "analysis", "data"]
            
            for key in possible_keys:
                if key in raw_data and isinstance(raw_data[key], list):
                    items_to_process = raw_data[key]
                    found_list = True
                    break
            
            # Cenário B: A IA retornou um único objeto de sugestão (não uma lista)
            if not found_list:
                items_to_process = [raw_data]
        
        elif isinstance(raw_data, list):
            # Cenário C: A IA retornou a lista diretamente (O cenário ideal)
            items_to_process = raw_data
        
        else:
            # Cenário D: Formato irrecuperável (ex: string solta ou null)
            logger.error(f"[{agent_source}] Formato de resposta desconhecido/inválido: {type(raw_data)}")
            return []

        # ----------------------------------------------------------------------
        # 2. VALIDAÇÃO E ENRIQUECIMENTO (Item a Item)
        # ----------------------------------------------------------------------
        for item in items_to_process:
            if not isinstance(item, dict):
                continue # Pula primitivos (strings/ints) soltos na lista

            try:
                # --- Lógica de Fallback (Auto-Correção) ---
                # Se a IA esquecer de repetir o 'domain' ou 'agent_source' em cada item
                # (o que é comum para economizar tokens), nós injetamos aqui baseados
                # no contexto da chamada da função.
                
                if "domain" not in item or not item["domain"]:
                    item["domain"] = domain
                
                if "agent_source" not in item or not item["agent_source"]:
                    item["agent_source"] = agent_source
                
                # Garante um ID único para o React renderizar listas sem warnings de 'key'
                if "id" not in item or not item["id"]:
                    item["id"] = str(uuid.uuid4())

                # Aplica defaults seguros para campos opcionais visuais
                if "severity" not in item:
                    item["severity"] = "low"
                if "actionable" not in item:
                    item["actionable"] = False

                # --- Validação Pydantic (Strict Mode) ---
                # Aqui ocorre a "mágica" da validação dos Enums e Tipos.
                # Se o item não respeitar o contrato (schema), ele lança erro.
                suggestion = AtomicSuggestion(**item)
                valid_suggestions.append(suggestion)

            except ValidationError as e:
                # Estratégia de Resiliência:
                # Se UM item estiver estragado, descartamos apenas ele e aproveitamos o resto.
                # Não quebramos a experiência do usuário por causa de um erro parcial da IA.
                logger.warning(f"[{agent_source}] Item inválido descartado pelo Schema: {e}. Dados: {item}")
                continue
            except Exception as e:
                logger.error(f"[{agent_source}] Erro inesperado ao processar item: {e}")
                continue

        return valid_suggestions