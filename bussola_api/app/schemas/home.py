"""
=======================================================================================
ARQUIVO: home.py (Schemas - Dashboard Principal)
=======================================================================================

OBJETIVO:
    Definir os dados para o Dashboard "Home" (Visão Geral), integrando serviços
    externos como Clima e Notícias.

PARTE DO SISTEMA:
    Backend / API Layer / Integrations.
=======================================================================================
"""

from typing import List, Optional
from pydantic import BaseModel

# --------------------------------------------------------------------------------------
# WEATHER (CLIMA)
# --------------------------------------------------------------------------------------
class WeatherData(BaseModel):
    temperature: int
    description: str
    icon_class: str
    city: str # Confirmação da cidade utilizada na consulta da API

# --------------------------------------------------------------------------------------
# NEWS (NOTÍCIAS)
# --------------------------------------------------------------------------------------
class NewsSource(BaseModel):
    name: str

class NewsArticle(BaseModel):
    title: str
    url: str
    source: NewsSource
    published_at: str
    topic: Optional[str] = "Geral" # Classificação do assunto (ex: Tech, Business)

# --------------------------------------------------------------------------------------
# HOME RESPONSE
# --------------------------------------------------------------------------------------
class HomeDashboardResponse(BaseModel):
    weather: Optional[WeatherData] = None
    tech_news: List[NewsArticle] = []