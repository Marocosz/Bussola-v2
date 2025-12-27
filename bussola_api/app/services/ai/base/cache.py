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
    Utiliza Redis para armazenar respostas baseadas no hash do contexto de entrada.
    Evita chamadas redundantes ao LLM (Economia de $$ e Latência).
    """
    
    # Tempo de vida do cache em segundos (ex: 24 horas)
    # Se o usuário não mudar nada em 24h, forçamos uma reanálise de qualquer jeito.
    TTL_SECONDS = 60 * 60 * 24 

    def __init__(self):
        self.redis = redis.from_url(settings.REDIS_URL, decode_responses=True)

    def _generate_key(self, domain: str, agent_name: str, context: Dict[str, Any]) -> str:
        """
        Gera uma chave única baseada no conteúdo.
        Ordena as chaves do dicionário para garantir que {a:1, b:2} gere o mesmo hash que {b:2, a:1}.
        """
        # Serializa o contexto de forma determinística
        context_str = json.dumps(context, sort_keys=True, default=str)
        
        # Cria hash MD5
        context_hash = hashlib.md5(context_str.encode('utf-8')).hexdigest()
        
        # Formato da chave: ai:cache:{domain}:{agent}:{hash}
        return f"ai:cache:{domain}:{agent_name}:{context_hash}"

    async def get(self, domain: str, agent_name: str, context: Dict[str, Any]) -> Optional[List[AtomicSuggestion]]:
        """
        Tenta recuperar uma resposta válida do cache.
        """
        try:
            key = self._generate_key(domain, agent_name, context)
            cached_data = await self.redis.get(key)
            
            if not cached_data:
                return None

            logger.info(f"[{agent_name}] Cache HIT ⚡ (Key: {key})")
            
            # Deserializa de JSON para Lista de Objetos Pydantic
            raw_list = json.loads(cached_data)
            return [AtomicSuggestion(**item) for item in raw_list]

        except Exception as e:
            logger.error(f"Erro ao ler cache Redis: {e}")
            return None # Em caso de erro no Redis, segue sem cache (Failover)

    async def set(self, domain: str, agent_name: str, context: Dict[str, Any], suggestions: List[AtomicSuggestion]):
        """
        Salva o resultado da IA no Redis.
        """
        try:
            if not suggestions:
                return # Não cacheia listas vazias/falhas

            key = self._generate_key(domain, agent_name, context)
            
            # Serializa Lista de Pydantic -> JSON
            # usa model_dump_json() ou dict() para garantir compatibilidade
            data_to_save = json.dumps([s.model_dump(mode='json') for s in suggestions])
            
            await self.redis.setex(key, self.TTL_SECONDS, data_to_save)
            logger.debug(f"[{agent_name}] Cache SAVED 💾")

        except Exception as e:
            logger.error(f"Erro ao salvar no cache Redis: {e}")

# Instância Singleton
ai_cache = AgentCache()