"""
=======================================================================================
ARQUIVO: external.py (Serviço de Dados Externos)
=======================================================================================

OBJETIVO:
    Gerenciar a comunicação com APIs externas e Feeds RSS para enriquecer o sistema
    com informações em tempo real (Clima e Notícias).

PARTE DO SISTEMA:
    Backend / Service Layer / Integrations.

RESPONSABILIDADES:
    1. Consumir API de Clima (OpenWeatherMap) com estratégia de cache.
    2. Consumir e normalizar múltiplos Feeds RSS de notícias.
    3. Filtrar conteúdo de notícias (Blocklist/Keywords) para relevância.
    4. Gerenciar Cache (Redis) para evitar rate-limits e melhorar performance.
    5. Executar tarefas de I/O intensivo (RSS parsing) em paralelo.

COMUNICAÇÃO:
    - Redis (Cache).
    - APIs Externas (OpenWeather, G1, TechCrunch, etc via HTTP).
    - Utilizado por: app.api.endpoints.home (Dashboard).

=======================================================================================
"""

import json
import httpx
import feedparser
import redis.asyncio as redis
import asyncio
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
from typing import List, Optional, Dict, Any

from app.core.config import settings

# --------------------------------------------------------------------------------------
# CONFIGURAÇÃO DE CURADORIA DE NOTÍCIAS
# --------------------------------------------------------------------------------------
# Centraliza as fontes (URLs), regras de inclusão (keywords) e exclusão (blocklist).
# Estrutura usada para filtrar o dilúvio de notícias RSS e entregar apenas o relevante.
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
        
        # Headers para simular um navegador real.
        # Muitos servidores de RSS (como Cloudflare) bloqueiam requisições sem User-Agent definido.
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }

    def _init_redis(self):
        """
        Inicializa a conexão com o Redis com tolerância a falhas.
        
        Por que existe:
            O cache é uma melhoria de performance, não um requisito crítico.
            Se o Redis falhar, o sistema deve continuar funcionando (fazendo requisições diretas),
            embora mais lento.
        """
        if self.redis_url:
            try:
                # Timeouts curtos garantem que a API não trave esperando o Redis conectar
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

    def get_available_topics(self) -> List[Dict[str, str]]:
        """
        Helper para o Frontend: Retorna quais tópicos estão disponíveis no backend.
        Evita hardcode de IDs no código React.
        """
        topics_list = []
        for key, config in TOPIC_CONFIG.items():
            topics_list.append({
                "id": key,
                "label": config.get("label", key.capitalize())
            })
        return topics_list

    # ==========================================================================
    # WEATHER SERVICE (CLIMA)
    # ==========================================================================
    async def get_weather(self, city: str = "Uberlandia") -> Optional[Dict[str, Any]]:
        """
        Busca dados climáticos da OpenWeatherMap com padrão Cache-Aside.

        Lógica de Cache:
        1. Verifica Redis (Cache Hit).
        2. Se não houver, chama API Externa.
        3. Salva no Redis por 30 minutos (TTL 1800s).
        """
        # Normalização da chave de cache
        city_clean = (city or "Uberlandia").lower().strip().replace(" ", "")
        cache_key = f"weather:{city_clean}"
        
        # 1. Leitura do Cache
        if self.redis_client:
            try:
                cached = await self.redis_client.get(cache_key)
                if cached:
                    return json.loads(cached)
            except Exception as e:
                print(f"[Redis Error] Falha ao ler clima: {e}")

        # 2. Chamada à API Externa
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
                
                # Mapeamento de códigos de clima (ID) para ícones CSS (Weather Icons)
                # Faixas baseadas na doc da OpenWeatherMap: https://openweathermap.org/weather-conditions
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

                # 3. Escrita no Cache
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
    # NEWS SERVICE (RSS AGGREGATOR)
    # ==========================================================================
    
    def _filter_article(self, title: str, summary: str, config: dict) -> bool:
        """
        Aplica regras de negócio para decidir se uma notícia é relevante.
        
        Regras:
        1. Blocklist tem prioridade: Se contiver termos proibidos (ex: "promoção"), descarta.
        2. Keywords: Se houver lista de keywords configurada, o texto DEVE conter pelo menos uma.
        """
        text = (title + " " + summary).lower()
        
        # 1. Verifica Blocklist
        if any(bad in text for bad in config.get("blocklist", [])): 
            return False
            
        # 2. Verifica Keywords (Whitelist)
        keywords = config.get("keywords", [])
        return True if not keywords else any(kw in text for kw in keywords)

    def _fetch_topic_feeds(self, topic: str) -> List[Dict]:
        """
        Worker Síncrono: Baixa e processa todos os feeds de um único tópico.
        
        Por que é síncrono?
            A lib 'feedparser' não é assíncrona. Executamos este método dentro de
            uma ThreadPool para não bloquear o event loop principal do FastAPI.
        """
        config = TOPIC_CONFIG.get(topic)
        if not config: return []
        
        articles = []
        for url in config["urls"]:
            try:
                # Usa httpx para baixar o XML bruto (permite setar headers e timeouts)
                # Evita erro 403 Forbidden comum em sites que bloqueiam bots simples
                response = httpx.get(url, headers=self.headers, timeout=5.0, follow_redirects=True)
                if response.status_code != 200:
                    continue
                
                # Parse do XML
                feed = feedparser.parse(response.content)
                feed_title = feed.feed.get('title', url)
                
                # Processa as primeiras 15 entradas (limite de segurança por feed)
                for entry in feed.entries[:15]: 
                    summary = getattr(entry, 'summary', '')
                    
                    # Aplica filtro de conteúdo
                    if self._filter_article(entry.title, summary, config):
                        # Normalização de data (RSS é caótico com datas)
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
                # Falha em um feed não deve parar os outros
                continue
                
        # Remove duplicatas e ordena por data (mais recente primeiro)
        unique_articles = []
        seen = set()
        for art in sorted(articles, key=lambda x: x['published_at'], reverse=True):
            if art['title'].lower() not in seen:
                unique_articles.append(art)
                seen.add(art['title'].lower())
                
        return unique_articles

    async def get_news_by_topics(self, user_topics: List[str]) -> List[Dict]:
        """
        Agregador Principal de Notícias (Método Público Assíncrono).
        
        Lógica de Execução:
        1. Cache-First: Verifica quais tópicos já estão salvos no Redis.
        2. Paralelismo: Para tópicos não cacheados, dispara threads paralelas (_fetch_topic_feeds).
        3. Composição: Junta notícias cacheadas com as novas.
        4. Agrupamento: Seleciona ~8 notícias de cada tópico solicitado.
        5. Ordenação: Mistura tudo cronologicamente.

        Retorno:
            Lista plana de artigos pronta para o frontend.
        """
        if not user_topics: user_topics = ["tech"]
        
        # Validação de input
        valid_topics = [t for t in user_topics if t in TOPIC_CONFIG]
        if not valid_topics: valid_topics = ["tech"]

        articles_by_topic = {} 
        missing_topics = []

        # 1. Recuperação do Cache (por tópico)
        if self.redis_client:
            for topic in valid_topics:
                try:
                    cache_key = f"news_topic_v2:{topic}" 
                    cached = await self.redis_client.get(cache_key)
                    if cached: 
                        articles_by_topic[topic] = json.loads(cached)
                    else: 
                        missing_topics.append(topic)
                except: 
                    missing_topics.append(topic)
        else:
            missing_topics = list(valid_topics)

        # 2. Busca Paralela de Tópicos Faltantes
        if missing_topics:
            loop = asyncio.get_running_loop()
            # ThreadPoolExecutor permite I/O concorrente (múltiplos requests HTTP ao mesmo tempo)
            with ThreadPoolExecutor(max_workers=10) as executor:
                futures = [loop.run_in_executor(executor, self._fetch_topic_feeds, topic) for topic in missing_topics]
                results = await asyncio.gather(*futures)
                
                for topic, articles in zip(missing_topics, results):
                    if articles:
                        # Salva no Redis (TTL: 1 hora)
                        if self.redis_client:
                             try: 
                                 await self.redis_client.setex(f"news_topic_v2:{topic}", 3600, json.dumps(articles))
                             except: pass
                        articles_by_topic[topic] = articles
                    else:
                        articles_by_topic[topic] = []

        # 3. Montagem da Lista Final (Quota por tópico)
        final_list = []
        ITEMS_PER_TOPIC = 8 

        for topic in valid_topics:
            topic_articles = articles_by_topic.get(topic, [])
            final_list.extend(topic_articles[:ITEMS_PER_TOPIC])

        # 4. Ordenação Cronológica Unificada
        final_list.sort(key=lambda x: x['published_at'], reverse=True)
        
        return final_list

external_service = ExternalDataService()