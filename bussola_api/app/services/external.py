import json
import httpx
import feedparser
import redis.asyncio as redis
import asyncio
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
from typing import List, Optional, Dict, Any

from app.core.config import settings

# --- Configurações de Fontes de Notícias ---
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
            "https://ge.globo.com/rss/ge/"
        ],
        "keywords": ['futebol', 'basquete', 'vôlei', 'f1', 'campeonato'],
        "blocklist": []
    },
    "world": {
         "urls": [
            "https://g1.globo.com/rss/g1/",
            "https://rss.noticias.uol.com.br/ultnot/index.xml"
         ],
         "keywords": [],
         "blocklist": ["bbb", "fofoca", "reality", "horóscopo"]
    }
}

class ExternalDataService:
    def __init__(self):
        self.redis_client = None
        self.redis_url = settings.REDIS_URL
        self._init_redis()
        
        # [NOVO] Headers para simular um navegador e evitar bloqueios em RSS
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }

    def _init_redis(self):
        if self.redis_url:
            try:
                self.redis_client = redis.from_url(
                    self.redis_url, 
                    decode_responses=True,
                    socket_connect_timeout=1,
                    socket_timeout=1
                )
            except Exception as e:
                print(f"[Aviso] Falha ao configurar Redis: {e}")

    # ==========================================================================
    # WEATHER SERVICE
    # ==========================================================================
    async def get_weather(self, city: str = "Uberlandia") -> Optional[Dict[str, Any]]:
        # Limpeza básica do nome da cidade para cache key
        city_clean = (city or "Uberlandia").lower().strip().replace(" ", "")
        cache_key = f"weather:{city_clean}"
        
        # 1. Tenta Cache
        if self.redis_client:
            try:
                cached = await self.redis_client.get(cache_key)
                if cached:
                    return json.loads(cached)
            except Exception:
                pass

        # 2. Busca na API
        api_key = settings.OPENWEATHER_API_KEY
        if not api_key:
            return None

        url = f"https://api.openweathermap.org/data/2.5/weather?q={city}&appid={api_key}&units=metric&lang=pt_br"

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, timeout=3.0)
                if response.status_code != 200:
                    return None
                
                data = response.json()
                
                # Mapeamento simples de ícones
                weather_id = data['weather'][0]['id']
                icon_class = "wi-day-sunny"
                if 200 <= weather_id <= 232: icon_class = "wi-thunderstorm"
                elif 300 <= weather_id <= 321: icon_class = "wi-showers"
                elif 500 <= weather_id <= 531: icon_class = "wi-rain"
                elif 600 <= weather_id <= 622: icon_class = "wi-snow"
                elif 800 == weather_id: icon_class = "wi-day-sunny"
                elif 801 <= weather_id <= 804: icon_class = "wi-cloudy"

                result = {
                    "temperature": round(data['main']['temp']),
                    "description": data['weather'][0]['description'].capitalize(),
                    "icon_class": icon_class, 
                    "city": data.get('name', city)
                }

                # 3. Salva no Cache (30 min)
                if self.redis_client:
                    try:
                        await self.redis_client.setex(cache_key, 1800, json.dumps(result))
                    except: pass

                return result
            except Exception:
                return None

    # ==========================================================================
    # NEWS SERVICE
    # ==========================================================================
    
    def _filter_article(self, title: str, summary: str, config: dict) -> bool:
        text = (title + " " + summary).lower()
        if any(bad in text for bad in config.get("blocklist", [])): return False
        keywords = config.get("keywords", [])
        return True if not keywords else any(kw in text for kw in keywords)

    def _fetch_topic_feeds(self, topic: str) -> List[Dict]:
        """
        Busca feeds de forma síncrona (rodará em thread).
        [MELHORIA] Usa httpx para baixar o XML com User-Agent antes de passar pro feedparser.
        """
        config = TOPIC_CONFIG.get(topic)
        if not config: return []
        
        articles = []
        for url in config["urls"]:
            try:
                # [FIX] Baixa o conteúdo com headers de navegador para evitar bloqueio 403
                response = httpx.get(url, headers=self.headers, timeout=4.0, follow_redirects=True)
                if response.status_code != 200:
                    continue
                
                # Passa o conteúdo XML string para o feedparser
                feed = feedparser.parse(response.content)
                feed_title = feed.feed.get('title', url)
                
                for entry in feed.entries[:5]: # Pega apenas os 5 mais recentes de cada fonte
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
                print(f"Erro ao ler feed {url}: {e}")
                continue
                
        return articles

    async def get_news_by_topics(self, user_topics: List[str]) -> List[Dict]:
        if not user_topics: user_topics = ["tech"]
        final_articles = []
        missing_topics = []

        # 1. Tenta recuperar do Cache
        if self.redis_client:
            for topic in user_topics:
                try:
                    cache_key = f"news_topic:{topic}"
                    cached = await self.redis_client.get(cache_key)
                    if cached: 
                        final_articles.extend(json.loads(cached))
                    else: 
                        missing_topics.append(topic)
                except: 
                    missing_topics.append(topic)
        else:
            missing_topics = [t for t in user_topics if t in TOPIC_CONFIG]

        # 2. Busca tópicos faltantes em paralelo
        if missing_topics:
            loop = asyncio.get_running_loop()
            # Aumentei workers para agilizar
            with ThreadPoolExecutor(max_workers=10) as executor:
                futures = [loop.run_in_executor(executor, self._fetch_topic_feeds, topic) for topic in missing_topics]
                results = await asyncio.gather(*futures)
                
                for topic, articles in zip(missing_topics, results):
                    if articles:
                        if self.redis_client:
                             try: await self.redis_client.setex(f"news_topic:{topic}", 3600, json.dumps(articles))
                             except: pass
                        final_articles.extend(articles)

        # 3. Ordenação e Deduplicação
        unique_articles = []
        seen = set()
        
        # Ordena por data (mais recente primeiro)
        sorted_articles = sorted(final_articles, key=lambda x: x['published_at'], reverse=True)
        
        for art in sorted_articles:
            if art['title'].lower() not in seen:
                unique_articles.append(art)
                seen.add(art['title'].lower())
        
        # [REQUISITO] Retorna exatamente 8 notícias
        return unique_articles[:8]

external_service = ExternalDataService()