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
# [ATUALIZADO] Inclui labels para o Frontend e novas categorias
TOPIC_CONFIG = {
    "tech": {
        "label": "Tecnologia",
        "urls": [
            "https://tecnoblog.net/feed/",
            "https://canaltech.com.br/rss/",
            "https://www.tecmundo.com.br/rss",
            "https://gizmodo.uol.com.br/feed/",
            "https://olhardigital.com.br/feed/",
            "https://jovemnerd.com.br/feed/nerdbunker/"
        ],
        "keywords": [
            'ia', 'inteligência artificial', 'chatgpt', 'openai', 'gemini', 
            'apple', 'iphone', 'google', 'android', 'microsoft', 'windows', 
            'linux', 'python', 'cibersegurança', 'hardware', 'processador', 'nvidia'
        ],
        "blocklist": ["oferta", "desconto", "cupom", "promoção", "review", "compre", "barato", "black friday"]
    },
    "finance": {
        "label": "Mercado & Finanças",
        "urls": [
            "https://www.infomoney.com.br/feed/",
            "https://braziljournal.com/feed/",
            "https://investnews.com.br/feed/",
            "https://valorinveste.globo.com/rss/valorinveste/ultimas-noticias",
            "https://www.cnnbrasil.com.br/economia/feed/"
        ],
        "keywords": [
            'ibovespa', 'dólar', 'ações', 'mercado', 'selic', 'economia', 
            'investimento', 'banco central', 'pib', 'inflação', 'dividendos'
        ],
        "blocklist": ["patrocinado", "publi", "curso", "assinatura"]
    },
    "crypto": {
        "label": "Criptomoedas",
        "urls": [
            "https://br.cointelegraph.com/rss",
            "https://portaldobitcoin.uol.com.br/feed/",
            "https://www.criptofacil.com/feed/"
        ],
        "keywords": [
            'bitcoin', 'btc', 'ethereum', 'eth', 'blockchain', 'crypto', 
            'criptomoeda', 'nft', 'defi', 'binance', 'etf'
        ],
        "blocklist": ["cassino", "bet", "aposta", "patrocinado"]
    },
    "sports": {
        "label": "Esportes",
        "urls": [
            "https://ge.globo.com/rss/ge/",
            "https://www.espn.com.br/rss",
            "https://www.lance.com.br/rss",
            "https://www.gazetaesportiva.com/feed/"
        ],
        "keywords": [
            'futebol', 'brasileirão', 'libertadores', 'copa', 'seleção', 
            'neymar', 'flamengo', 'corinthians', 'palmeiras', 'são paulo',
            'f1', 'fórmula 1', 'nba', 'basquete', 'vôlei', 'ufc'
        ],
        "blocklist": []
    },
    "world": {
         "label": "Mundo & Notícias",
         "urls": [
            "https://g1.globo.com/rss/g1/",
            "https://rss.noticias.uol.com.br/ultnot/index.xml",
            "https://www.cnnbrasil.com.br/feed/",
            "https://www.bbc.com/portuguese/index.xml"
         ],
         "keywords": [], 
         "blocklist": ["bbb", "fofoca", "reality", "horóscopo", "novela", "famosos"]
    },
    "games": {
        "label": "Games & Geek",
        "urls": [
            "https://br.ign.com/feed.xml",
            "https://jovemnerd.com.br/feed/nerdbunker/",
            "https://www.theenemy.com.br/rss"
        ],
        "keywords": ['game', 'jogo', 'playstation', 'xbox', 'nintendo', 'steam', 'pc', 'rpg', 'gta', 'zelda'],
        "blocklist": ["filme", "série"]
    },
    "science": {
        "label": "Ciência & Espaço",
        "urls": [
            "https://canaltech.com.br/rss/espaco/",
            "https://hypescience.com/feed/",
            "https://www.bbc.com/portuguese/topics/c404v027pd4t/index.xml"
        ],
        "keywords": ['nasa', 'espaço', 'universo', 'ciência', 'medicina', 'descoberta', 'estudo', 'planeta'],
        "blocklist": []
    },
    "entertainment": {
        "label": "Cinema & TV",
        "urls": [
            "https://www.omelete.com.br/rss",
            "https://jovemnerd.com.br/feed/nerdbunker/",
            "https://pipocamoderna.com.br/feed/"
        ],
        "keywords": ['filme', 'série', 'netflix', 'marvel', 'dc', 'cinema', 'streaming', 'hbo'],
        "blocklist": []
    }
}

class ExternalDataService:
    def __init__(self):
        self.redis_client = None
        self.redis_url = settings.REDIS_URL
        self._init_redis()
        
        # Headers para simular um navegador e evitar bloqueios em RSS (Erro 403)
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }

    def _init_redis(self):
        """Inicializa a conexão com o Redis de forma segura."""
        if self.redis_url:
            try:
                # socket_timeout curto para não travar a API se o Redis estiver fora
                self.redis_client = redis.from_url(
                    self.redis_url, 
                    decode_responses=True,
                    socket_connect_timeout=2,
                    socket_timeout=2
                )
                print(f"[Redis] Cliente configurado para: {self.redis_url.split('@')[-1]}") 
            except Exception as e:
                print(f"[ERRO] Falha crítica ao configurar Redis: {e}")
                self.redis_client = None
        else:
            print("[Aviso] REDIS_URL não definida. Cache desativado.")

    # [NOVO] Método para listar tópicos disponíveis dinamicamente
    def get_available_topics(self) -> List[Dict[str, str]]:
        """Retorna a lista de tópicos configurados no sistema (ID e Label)."""
        topics_list = []
        for key, config in TOPIC_CONFIG.items():
            topics_list.append({
                "id": key,
                "label": config.get("label", key.capitalize())
            })
        return topics_list

    # ==========================================================================
    # WEATHER SERVICE
    # ==========================================================================
    async def get_weather(self, city: str = "Uberlandia") -> Optional[Dict[str, Any]]:
        # Limpeza básica do nome da cidade para cache key
        city_clean = (city or "Uberlandia").lower().strip().replace(" ", "")
        cache_key = f"weather:{city_clean}"
        
        # 1. Tenta Cache (Redis)
        if self.redis_client:
            try:
                cached = await self.redis_client.get(cache_key)
                if cached:
                    return json.loads(cached)
            except Exception as e:
                print(f"[Redis Error] Falha ao ler clima: {e}")

        # 2. Busca na API
        api_key = settings.OPENWEATHER_API_KEY
        if not api_key:
            return None

        url = f"https://api.openweathermap.org/data/2.5/weather?q={city}&appid={api_key}&units=metric&lang=pt_br"

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, timeout=4.0)
                if response.status_code != 200:
                    return None
                
                data = response.json()
                
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

                # 3. Salva no Cache (30 min = 1800s)
                if self.redis_client:
                    try:
                        await self.redis_client.setex(cache_key, 1800, json.dumps(result))
                    except Exception as e:
                        print(f"[Redis Error] Falha ao salvar clima: {e}")

                return result
            except Exception as e:
                print(f"[API Error] Erro OpenWeather: {e}")
                return None

    # ==========================================================================
    # NEWS SERVICE (ROBUSTO)
    # ==========================================================================
    
    def _filter_article(self, title: str, summary: str, config: dict) -> bool:
        """Filtra artigos baseados em keywords e blocklist."""
        text = (title + " " + summary).lower()
        
        # 1. Verifica Blocklist (Termos proibidos)
        if any(bad in text for bad in config.get("blocklist", [])): 
            return False
            
        # 2. Verifica Keywords (Se houver lista, tem que ter pelo menos uma)
        keywords = config.get("keywords", [])
        return True if not keywords else any(kw in text for kw in keywords)

    def _fetch_topic_feeds(self, topic: str) -> List[Dict]:
        """
        Busca feeds de forma síncrona (rodará em thread).
        """
        config = TOPIC_CONFIG.get(topic)
        if not config: return []
        
        articles = []
        for url in config["urls"]:
            try:
                # Usa httpx com headers para baixar o XML (evita bloqueio 403)
                response = httpx.get(url, headers=self.headers, timeout=5.0, follow_redirects=True)
                if response.status_code != 200:
                    continue
                
                # Processa o XML
                feed = feedparser.parse(response.content)
                feed_title = feed.feed.get('title', url)
                
                # [MELHORIA] Aumentamos para 15 para ter margem após filtragem
                for entry in feed.entries[:15]: 
                    summary = getattr(entry, 'summary', '')
                    if self._filter_article(entry.title, summary, config):
                        pub_date = getattr(entry, 'published_parsed', None)
                        if pub_date:
                            dt_object = datetime(*pub_date[:6]).replace(tzinfo=timezone.utc)
                        else:
                            dt_object = datetime.now(timezone.utc)
                        
                        articles.append({
                            'title': entry.title, 
                            'url': entry.link, 
                            'source': {'name': feed_title},
                            'published_at': dt_object.isoformat(), 
                            'topic': topic
                        })
            except Exception as e:
                # Log silencioso para não poluir o terminal, apenas ignora a fonte ruim
                continue
                
        # Ordena por data (mais recente) e remove duplicados básicos
        # Nota: Retornamos TUDO que achamos aqui. O corte de quantidade acontece depois.
        unique_articles = []
        seen = set()
        for art in sorted(articles, key=lambda x: x['published_at'], reverse=True):
            if art['title'].lower() not in seen:
                unique_articles.append(art)
                seen.add(art['title'].lower())
                
        return unique_articles

    async def get_news_by_topics(self, user_topics: List[str]) -> List[Dict]:
        """
        Retorna notícias agregadas. 
        Regra: Busca garantir ~8 notícias POR TÓPICO selecionado.
        """
        if not user_topics: user_topics = ["tech"]
        
        # Garante que os tópicos existem na config
        valid_topics = [t for t in user_topics if t in TOPIC_CONFIG]
        if not valid_topics: valid_topics = ["tech"]

        articles_by_topic = {} # Armazena listas separadas: {'tech': [...], 'finance': [...]}
        missing_topics = []

        # 1. Tenta recuperar do Cache (Tópico por Tópico)
        if self.redis_client:
            for topic in valid_topics:
                try:
                    cache_key = f"news_topic_v2:{topic}" # v2 para invalidar cache antigo se houver
                    cached = await self.redis_client.get(cache_key)
                    if cached: 
                        articles_by_topic[topic] = json.loads(cached)
                    else: 
                        missing_topics.append(topic)
                except: 
                    missing_topics.append(topic)
        else:
            missing_topics = list(valid_topics)

        # 2. Busca tópicos faltantes em paralelo (API Externa)
        if missing_topics:
            loop = asyncio.get_running_loop()
            # Aumentamos workers para lidar com múltiplas requisições HTTP
            with ThreadPoolExecutor(max_workers=10) as executor:
                futures = [loop.run_in_executor(executor, self._fetch_topic_feeds, topic) for topic in missing_topics]
                results = await asyncio.gather(*futures)
                
                for topic, articles in zip(missing_topics, results):
                    if articles:
                        # Salva no Cache (1 hora)
                        if self.redis_client:
                             try: 
                                 await self.redis_client.setex(f"news_topic_v2:{topic}", 3600, json.dumps(articles))
                             except: pass
                        articles_by_topic[topic] = articles
                    else:
                        articles_by_topic[topic] = []

        # 3. Montagem Final (Regra: 8 por tipo)
        final_list = []
        ITEMS_PER_TOPIC = 8 

        for topic in valid_topics:
            topic_articles = articles_by_topic.get(topic, [])
            # Pega os X primeiros deste tópico
            final_list.extend(topic_articles[:ITEMS_PER_TOPIC])

        # 4. Ordenação Final da Lista Mista
        # Ordenamos tudo por data para que o feed fique cronológico, 
        # mas garantindo que o conteúdo de todos os tópicos esteja presente.
        final_list.sort(key=lambda x: x['published_at'], reverse=True)
        
        return final_list

external_service = ExternalDataService()