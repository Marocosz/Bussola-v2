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

# --- Configurações ---
SAFE_KEYWORDS = [
    'inteligência artificial', 'chatgpt', 'openai', 'claude 3', 'gemini',
    'machine learning', 'aprendizado de máquina', 'llm'
]
SHORT_KEYWORDS = ['ia', 'ai']
BLOCKLIST = [
    "tv", "smart tv", "desconto", "promoção", "preço", "oferta",
    "celular", "smartphone", "review", "análise", "notebook"
]
FEEDS_URLS = [
    "https://canaltech.com.br/rss/inteligencia-artificial/",
    "https://tecnoblog.net/feed/",
    "https://gizmodo.uol.com.br/feed/",
    "https://www.tecmundo.com.br/rss",
    "https://mittechreview.com.br/feed/"
]

class ExternalDataService:
    def __init__(self):
        self.redis_client = None
        # Tenta pegar do settings primeiro, fallback para os.getenv
        redis_url = getattr(settings, 'REDIS_URL', os.getenv('REDIS_URL'))
        
        if redis_url:
            try:
                self.redis_client = redis.from_url(redis_url, decode_responses=True)
            except Exception as e:
                print(f"[Aviso] Redis não conectado: {e}")

    async def get_weather(self, city: str = "Uberlandia") -> Optional[Dict[str, Any]]:
        # Tenta pegar do settings primeiro, fallback para os.getenv
        api_key = getattr(settings, 'OPENWEATHER_API_KEY', os.getenv('OPENWEATHER_API_KEY'))
        
        if not api_key:
            print("[Erro] OPENWEATHER_API_KEY não encontrada no .env ou settings.")
            return None

        # URL encoding básico e construção da URL
        url = f"https://api.openweathermap.org/data/2.5/weather?q={city},BR&appid={api_key}&units=metric&lang=pt_br"

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, timeout=10.0) # Aumentei timeout para garantir
                
                if response.status_code != 200:
                    print(f"[Erro API Clima] Status: {response.status_code} | Resposta: {response.text}")
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
                
                return {
                    "temperature": round(data['main']['temp']),
                    "description": data['weather'][0]['description'],
                    "icon_class": icon_map.get(icon_code, "wi-cloud")
                }
            except Exception as e:
                print(f"[Exception] Erro ao buscar clima: {e}")
                return None

    def _contains_keywords(self, text: str) -> bool:
        text = text.lower()
        if any(bad in text for bad in BLOCKLIST):
            return False
        if any(keyword in text for keyword in SAFE_KEYWORDS):
            return True
        for kw in SHORT_KEYWORDS:
            if re.search(rf"\b{kw}\b", text):
                return True
        return False

    def _fetch_single_feed(self, url: str) -> List[Dict]:
        articles = []
        try:
            feed = feedparser.parse(url)
            feed_title = feed.feed.get('title', url)

            for entry in feed.entries:
                if not hasattr(entry, 'title') or not hasattr(entry, 'link'):
                    continue
                
                title = entry.title
                summary = getattr(entry, 'summary', '')

                if self._contains_keywords(title) or (self._contains_keywords(summary) and self._contains_keywords(title + " " + summary)):
                    pub_date = getattr(entry, 'published_parsed', None)
                    dt_object = datetime(*pub_date[:6]).replace(tzinfo=timezone.utc) if pub_date else datetime.now(timezone.utc)
                    
                    articles.append({
                        'title': entry.title,
                        'url': entry.link,
                        'source': {'name': feed_title},
                        'published_at': dt_object.isoformat()
                    })
        except Exception as e:
            print(f"[Aviso] Erro no feed {url}: {e}")
        return articles

    async def get_tech_news(self) -> List[Dict]:
        cache_key = "tech_news_cache"
        
        # 1. Tenta Cache
        if self.redis_client:
            try:
                cached = self.redis_client.get(cache_key)
                if cached:
                    return json.loads(cached)
            except Exception:
                pass

        # 2. Busca Live
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = asyncio.get_event_loop()
        
        all_articles = []
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = [loop.run_in_executor(executor, self._fetch_single_feed, url) for url in FEEDS_URLS]
            results = await asyncio.gather(*futures)
            
            for feed_res in results:
                all_articles.extend(feed_res)

        sorted_articles = sorted(all_articles, key=lambda x: x['published_at'], reverse=True)
        unique_articles = []
        seen = set()
        for art in sorted_articles:
            if art['title'].lower() not in seen:
                unique_articles.append(art)
                seen.add(art['title'].lower())
        
        final = unique_articles[:6]

        # 3. Salva Cache
        if self.redis_client and final:
            try:
                self.redis_client.setex(cache_key, 43200, json.dumps(final))
            except Exception:
                pass
                
        return final

external_service = ExternalDataService()