import os
import json
import re
import httpx
import feedparser
import redis
import asyncio
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
from typing import List, Optional, Dict, Any

from app.core.config import settings

# --- Configurações de Fontes de Notícias ---
# Mapeia tópicos (IDs) para URLs e palavras-chave
TOPIC_CONFIG = {
    "tech": {
        "urls": [
            "https://canaltech.com.br/rss/",
            "https://tecnoblog.net/feed/",
            "https://gizmodo.uol.com.br/feed/",
            "https://www.tecmundo.com.br/rss",
            "https://mittechreview.com.br/feed/"
        ],
        "keywords": ['inteligência artificial', 'chatgpt', 'openai', 'apple', 'google', 'microsoft', 'linux', 'python'],
        "blocklist": ["tv", "promoção", "oferta", "review", "celular"]
    },
    "finance": {
        "urls": [
            "https://www.infomoney.com.br/feed/",
            "https://braziljournal.com/feed/",
            "https://investnews.com.br/feed/"
        ],
        "keywords": ['ibovespa', 'dólar', 'ações', 'mercado', 'bitcoin', 'economia', 'selic'],
        "blocklist": []
    },
    "crypto": {
        "urls": [
            "https://br.cointelegraph.com/rss",
            "https://www.criptofacil.com/feed/"
        ],
        "keywords": ['bitcoin', 'ethereum', 'blockchain', 'crypto', 'criptomoeda'],
        "blocklist": []
    },
    "sports": {
        "urls": [
            "https://www.espn.com.br/rss",
            "https://ge.globo.com/rss/ge/" # Feed geral do GE
        ],
        "keywords": ['futebol', 'basquete', 'vôlei', 'f1', 'campeonato'],
        "blocklist": []
    },
    "world": {
         "urls": [
            "https://g1.globo.com/rss/g1/",
            "https://rss.noticias.uol.com.br/ultnot/index.xml"
         ],
         "keywords": [], # Aceita tudo, filtrando apenas blocklist global se houver
         "blocklist": ["bbb", "fofoca", "reality", "horóscopo"]
    }
}

class ExternalDataService:
    def __init__(self):
        self.redis_client = None
        redis_url = getattr(settings, 'REDIS_URL', os.getenv('REDIS_URL'))
        
        if redis_url:
            try:
                self.redis_client = redis.from_url(redis_url, decode_responses=True)
            except Exception as e:
                print(f"[Aviso] Redis não conectado: {e}")

    # ==========================================================================
    # WEATHER SERVICE
    # ==========================================================================
    async def get_weather(self, city: str = "Uberlandia") -> Optional[Dict[str, Any]]:
        if not city:
            city = "Uberlandia"

        # 1. Normalização da chave de cache (remove espaços e acentos simples)
        city_clean = city.lower().strip().replace(" ", "")
        cache_key = f"weather:{city_clean}"
        
        # 2. Tenta Cache (TTL 30 min = 1800s)
        if self.redis_client:
            cached = self.redis_client.get(cache_key)
            if cached:
                return json.loads(cached)

        # 3. Busca na API
        api_key = getattr(settings, 'OPENWEATHER_API_KEY', os.getenv('OPENWEATHER_API_KEY'))
        if not api_key:
            return None

        url = f"https://api.openweathermap.org/data/2.5/weather?q={city}&appid={api_key}&units=metric&lang=pt_br"

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, timeout=5.0)
                
                if response.status_code != 200:
                    print(f"[Erro API Clima] City: {city} | Status: {response.status_code}")
                    return None
                
                data = response.json()
                
                # Mapeamento de Ícones
                icon_code = data['weather'][0]['icon']
                icon_map = {
                    "01d": "wi-day-sunny", "01n": "wi-night-clear",
                    "02d": "wi-day-cloudy", "02n": "wi-night-alt-cloudy",
                    "03d": "wi-cloud", "03n": "wi-cloud",
                    "04d": "wi-cloudy", "04n": "wi-cloudy",
                    "09d": "wi-showers", "09n": "wi-showers",
                    "10d": "wi-day-rain", "10n": "wi-night-alt-rain",
                    "11d": "wi-thunderstorm", "11n": "wi-thunderstorm",
                    "13d": "wi-snow", "13n": "wi-snow",
                    "50d": "wi-fog", "50n": "wi-fog",
                }
                
                result = {
                    "temperature": round(data['main']['temp']),
                    "description": data['weather'][0]['description'],
                    "icon_class": icon_map.get(icon_code, "wi-cloud"),
                    "city": data.get('name', city)
                }

                # 4. Salva no Cache
                if self.redis_client:
                    self.redis_client.setex(cache_key, 1800, json.dumps(result))

                return result

            except Exception as e:
                print(f"[Exception] Erro ao buscar clima para {city}: {e}")
                return None

    # ==========================================================================
    # NEWS SERVICE (Topic Based)
    # ==========================================================================
    
    def _filter_article(self, title: str, summary: str, config: dict) -> bool:
        """Verifica se o artigo passa nos filtros do tópico."""
        text = (title + " " + summary).lower()
        
        # 1. Blocklist (proibidos)
        if any(bad in text for bad in config.get("blocklist", [])):
            return False
            
        # 2. Keywords (se a lista estiver vazia, aceita tudo que não foi bloqueado)
        keywords = config.get("keywords", [])
        if not keywords:
            return True
            
        # 3. Verifica se tem pelo menos uma palavra chave
        return any(kw in text for kw in keywords)

    def _fetch_topic_feeds(self, topic: str) -> List[Dict]:
        """Busca feeds de um tópico específico (rodando em thread separada)."""
        config = TOPIC_CONFIG.get(topic)
        if not config:
            return []

        articles = []
        for url in config["urls"]:
            try:
                feed = feedparser.parse(url)
                feed_title = feed.feed.get('title', url)

                for entry in feed.entries[:10]: # Limita a 10 por feed para não pesar
                    if not hasattr(entry, 'title') or not hasattr(entry, 'link'):
                        continue
                    
                    if self._filter_article(entry.title, getattr(entry, 'summary', ''), config):
                        pub_date = getattr(entry, 'published_parsed', None)
                        dt_object = datetime(*pub_date[:6]).replace(tzinfo=timezone.utc) if pub_date else datetime.now(timezone.utc)
                        
                        articles.append({
                            'title': entry.title,
                            'url': entry.link,
                            'source': {'name': feed_title},
                            'published_at': dt_object.isoformat(),
                            'topic': topic
                        })
            except Exception as e:
                print(f"[Aviso] Erro no feed {url}: {e}")
        
        return articles

    async def get_news_by_topics(self, user_topics: List[str]) -> List[Dict]:
        """
        Busca notícias baseadas nos tópicos do usuário.
        Usa cache POR TÓPICO para economizar processamento.
        """
        if not user_topics:
            user_topics = ["tech"] # Default

        final_articles = []
        missing_topics = []

        # 1. Tenta recuperar do Cache para cada tópico
        if self.redis_client:
            for topic in user_topics:
                cache_key = f"news_topic:{topic}"
                cached = self.redis_client.get(cache_key)
                if cached:
                    final_articles.extend(json.loads(cached))
                else:
                    if topic in TOPIC_CONFIG:
                        missing_topics.append(topic)
        else:
            missing_topics = [t for t in user_topics if t in TOPIC_CONFIG]

        # 2. Busca os tópicos que faltaram (em paralelo)
        if missing_topics:
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                loop = asyncio.get_event_loop()
            
            with ThreadPoolExecutor(max_workers=5) as executor:
                futures = [loop.run_in_executor(executor, self._fetch_topic_feeds, topic) for topic in missing_topics]
                results = await asyncio.gather(*futures)
                
                # Processa resultados e salva no cache individualmente
                for topic, articles in zip(missing_topics, results):
                    if articles:
                        # Salva Cache do tópico por 2 horas (7200s)
                        if self.redis_client:
                             self.redis_client.setex(f"news_topic:{topic}", 7200, json.dumps(articles))
                        final_articles.extend(articles)

        # 3. Ordena tudo por data (mais recente primeiro)
        sorted_articles = sorted(final_articles, key=lambda x: x['published_at'], reverse=True)
        
        # 4. Remove duplicatas (pelo título)
        unique_articles = []
        seen = set()
        for art in sorted_articles:
            if art['title'].lower() not in seen:
                unique_articles.append(art)
                seen.add(art['title'].lower())
        
        # Retorna os top 12
        return unique_articles[:12]

    # Mantendo compatibilidade com código antigo se necessário
    async def get_tech_news(self) -> List[Dict]:
        return await self.get_news_by_topics(["tech"])

external_service = ExternalDataService()