from fastapi import APIRouter, Depends
from typing import Any, List, Optional

# Importamos os Schemas individuais
from app.schemas.home import WeatherData, NewsArticle
from app.services.external import external_service
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter()

@router.get("/weather", response_model=Optional[WeatherData])
async def get_weather_widget(
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Endpoint exclusivo para o Widget de Clima.
    Busca no Redis primeiro, se falhar ou expirar, busca na OpenWeather.
    """
    # Define valores padrão
    city = current_user.city if current_user.city else "Uberlandia"
    
    # Busca apenas o clima
    weather_data = await external_service.get_weather(city=city)
    
    return weather_data

@router.get("/news", response_model=List[NewsArticle])
async def get_news_widget(
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Endpoint exclusivo para o Widget de Notícias.
    Busca feeds RSS com cache no Redis.
    """
    # Define tópicos padrão
    topics = current_user.news_preferences if current_user.news_preferences else ["tech"]
    
    # Busca apenas as notícias
    news_data = await external_service.get_news_by_topics(user_topics=topics)
    
    return news_data