from typing import List, Optional
from pydantic import BaseModel

# --- Weather Schemas ---
class WeatherData(BaseModel):
    temperature: int
    description: str
    icon_class: str

# --- News Schemas ---
class NewsSource(BaseModel):
    name: str

class NewsArticle(BaseModel):
    title: str
    url: str
    source: NewsSource
    published_at: str

# --- Main Home Response ---
class HomeDashboardResponse(BaseModel):
    weather: Optional[WeatherData] = None
    tech_news: List[NewsArticle] = []
    # Nota: Data e Hora serão gerenciados pelo React no Frontend