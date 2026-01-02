"""
=======================================================================================
ARQUIVO: cache.py (Gerenciamento de Cache para IA)
=======================================================================================

OBJETIVO:
    Prover uma camada de cache inteligente e transparente para os Agentes de IA.
    Sua função principal é evitar que requisições idênticas (mesmo contexto de dados)
    sejam enviadas repetidamente para as LLMs (OpenAI, etc.), economizando custos
    e reduzindo drasticamente o tempo de resposta.

CAMADA:
    Services / Infraestrutura (Backend).
    Atua como um middleware entre os 'Orchestrators' e a 'LLM Factory'.

RESPONSABILIDADES:
    1. Hashing Determinístico: Criar assinaturas únicas para contextos de dados complexos.
    2. Persistência Volátil: Armazenar resultados prontos no Redis com expiração automática (TTL).
    3. Serialização: Converter objetos Pydantic (AtomicSuggestion) para JSON e vice-versa.
    4. Failover Silencioso: Se o cache falhar, o sistema deve continuar funcionando (chamando a IA real).

INTEGRAÇÕES:
    - Redis: Banco de dados em memória para armazenamento chave-valor.
    - Agentes de IA: Consumidores do cache.
    - Pydantic Models: Estrutura de dados que é serializada/deserializada.
"""

import hashlib
import json
import logging
from typing import List, Optional, Any, Dict
import redis.asyncio as redis

from app.core.config import settings
from app.services.ai.base.base_schema import AtomicSuggestion

logger = logging.getLogger(__name__)

class AgentCache:
    """
    Gerenciador de Cache para Agentes de IA.
    
    Implementa a estratégia de "Cache-Aside" simplificada:
    O agente pergunta se tem cache; se tiver, usa; se não, processa e salva.
    """
    
    # Tempo de vida (TTL) do cache em segundos.
    # Decisão de Negócio: 24 horas foi definido como o limite seguro onde os dados do usuário
    # provavelmente mudaram o suficiente para justificar uma nova análise da IA.
    TTL_SECONDS = 60 * 60 * 24 

    def __init__(self):
        # Inicializa a conexão com o Redis usando o pool assíncrono.
        # 'decode_responses=True' garante que recebemos strings, não bytes.
        self.redis = redis.from_url(settings.REDIS_URL, decode_responses=True)

    def _generate_key(self, domain: str, agent_name: str, context: Dict[str, Any]) -> str:
        """
        Gera uma chave de cache única e determinística baseada no conteúdo do contexto.

        POR QUE ISSO EXISTE:
        Diferente de chaves simples (ID do usuário), o contexto da IA é complexo e variável.
        Precisamos garantir que se o usuário enviar os mesmos dados, mas em ordem diferente
        no JSON, o hash gerado seja IDÊNTICO.

        ENTRADA:
        - domain: "financas"
        - agent_name: "spending_detective"
        - context: {"saldo": 100, "gastos": [...]}

        RETORNO:
        - String: "ai:cache:financas:spending_detective:a1b2c3d4..."
        """
        # 1. Serialização Determinística
        # 'sort_keys=True' é CRUCIAL aqui. Garante que {"a": 1, "b": 2} gere o mesmo
        # hash que {"b": 2, "a": 1}. Sem isso, o cache seria ineficiente.
        context_str = json.dumps(context, sort_keys=True, default=str)
        
        # 2. Hashing
        # Usamos MD5 por ser rápido e suficiente para evitar colisão nesse cenário de cache.
        # Não é usado para criptografia de segurança.
        context_hash = hashlib.md5(context_str.encode('utf-8')).hexdigest()
        
        # Formato de namespace para facilitar limpeza/debug no Redis se necessário
        return f"ai:cache:{domain}:{agent_name}:{context_hash}"

    async def get(self, domain: str, agent_name: str, context: Dict[str, Any]) -> Optional[List[AtomicSuggestion]]:
        """
        Tenta recuperar uma resposta pronta do cache.

        FLUXO:
        1. Gera o hash do contexto atual.
        2. Busca no Redis.
        3. Se encontrar (HIT), reconstrói os objetos Pydantic originais.
        4. Se der erro (Redis fora do ar), loga e retorna None para não derrubar o sistema.

        RETORNO:
        - Lista de AtomicSuggestion se houver HIT.
        - None se houver MISS ou erro.
        """
        try:
            key = self._generate_key(domain, agent_name, context)
            cached_data = await self.redis.get(key)
            
            if not cached_data:
                return None

            logger.info(f"[{agent_name}] Cache HIT ⚡ (Key: {key})")
            
            # Deserialização: JSON String -> Lista de Dicts -> Lista de Objetos Pydantic
            # Isso garante que o restante do sistema receba objetos tipados, não dicionários brutos.
            raw_list = json.loads(cached_data)
            return [AtomicSuggestion(**item) for item in raw_list]

        except Exception as e:
            # Estratégia de Resiliência:
            # Falhas no cache não devem impedir o funcionamento da IA.
            # Apenas logamos o erro e forçamos o processamento real (Bypass).
            logger.error(f"Erro ao ler cache Redis: {e}")
            return None 

    async def set(self, domain: str, agent_name: str, context: Dict[str, Any], suggestions: List[AtomicSuggestion]):
        """
        Salva o resultado do processamento da IA no Redis para uso futuro.

        REGRAS DE NEGÓCIO:
        - Não cacheia listas vazias (pode ter sido um erro temporário da IA ou falta de dados).
        - Aplica TTL para evitar dados obsoletos (stale data).
        """
        try:
            if not suggestions:
                return # Proteção contra cache de falhas ou estados vazios

            key = self._generate_key(domain, agent_name, context)
            
            # Serialização: Objetos Pydantic -> Lista de Dicts -> JSON String
            # 'mode=json' garante que Enums e UUIDs sejam convertidos corretamente para strings.
            data_to_save = json.dumps([s.model_dump(mode='json') for s in suggestions])
            
            await self.redis.setex(key, self.TTL_SECONDS, data_to_save)
            logger.debug(f"[{agent_name}] Cache SAVED 💾")

        except Exception as e:
            # Falha ao salvar não é crítica para o usuário, apenas perde a otimização.
            logger.error(f"Erro ao salvar no cache Redis: {e}")

# ==============================================================================
# INSTÂNCIA SINGLETON
# ==============================================================================
# Criamos uma única instância para ser importada em toda a aplicação.
# Isso permite o reaproveitamento do pool de conexões do Redis.
ai_cache = AgentCache()