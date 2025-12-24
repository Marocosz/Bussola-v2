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
        # [CORREÇÃO] Usa diretamente settings.REDIS_URL
        self.redis_url = settings.REDIS_URL
        self._init_redis()

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

        # 2. Busca na API (Usa settings)
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
                
                result = {
                    "temperature": round(data['main']['temp']),
                    "description": data['weather'][0]['description'],
                    "icon_class": "wi-cloud", 
                    "city": data.get('name', city)
                }

                # 3. Salva no Cache
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
        config = TOPIC_CONFIG.get(topic)
        if not config: return []
        articles = []
        for url in config["urls"]:
            try:
                feed = feedparser.parse(url)
                feed_title = feed.feed.get('title', url)
                for entry in feed.entries[:10]:
                    if self._filter_article(entry.title, getattr(entry, 'summary', ''), config):
                        pub_date = getattr(entry, 'published_parsed', None)
                        dt_object = datetime(*pub_date[:6]).replace(tzinfo=timezone.utc) if pub_date else datetime.now(timezone.utc)
                        articles.append({
                            'title': entry.title, 'url': entry.link, 'source': {'name': feed_title},
                            'published_at': dt_object.isoformat(), 'topic': topic
                        })
            except: continue
        return articles

    async def get_news_by_topics(self, user_topics: List[str]) -> List[Dict]:
        if not user_topics: user_topics = ["tech"]
        final_articles, missing_topics = [], []

        # 1. Tenta recuperar do Cache
        if self.redis_client:
            for topic in user_topics:
                try:
                    cache_key = f"news_topic:{topic}"
                    cached = await self.redis_client.get(cache_key)
                    if cached: final_articles.extend(json.loads(cached))
                    else: missing_topics.append(topic)
                except: missing_topics.append(topic)
        else:
            missing_topics = [t for t in user_topics if t in TOPIC_CONFIG]

        # 2. Busca tópicos faltantes
        if missing_topics:
            loop = asyncio.get_running_loop()
            with ThreadPoolExecutor(max_workers=5) as executor:
                futures = [loop.run_in_executor(executor, self._fetch_topic_feeds, topic) for topic in missing_topics]
                results = await asyncio.gather(*futures)
                for topic, articles in zip(missing_topics, results):
                    if articles:
                        if self.redis_client:
                             try: await self.redis_client.setex(f"news_topic:{topic}", 7200, json.dumps(articles))
                             except: pass
                        final_articles.extend(articles)

        unique_articles, seen = [], set()
        for art in sorted(final_articles, key=lambda x: x['published_at'], reverse=True):
            if art['title'].lower() not in seen:
                unique_articles.append(art)
                seen.add(art['title'].lower())
        
        return unique_articles[:12]

external_service = ExternalDataService()