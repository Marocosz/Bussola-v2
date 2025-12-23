from fastapi import APIRouter, Depends
from typing import Any
import asyncio

from app.schemas.home import HomeDashboardResponse
from app.services.external import external_service
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter()

@router.get("/", response_model=HomeDashboardResponse)
async def get_home_data(
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Retorna os dados para a Home: Clima e Notícias.
    Usa asyncio.gather para processar Clima e Notícias em paralelo
    sem travar o servidor.
    """
    
    # Define valores padrão caso o usuário não tenha configurado
    city = current_user.city if current_user.city else "Uberlandia"
    topics = current_user.news_preferences if current_user.news_preferences else ["tech"]

    # Criamos as coroutines (as funções async)
    weather_task = external_service.get_weather(city=city)
    news_task = external_service.get_news_by_topics(user_topics=topics)

    # asyncio.gather dispara as duas ao mesmo tempo.
    # Com o redis.asyncio, se o Redis demorar, o Event Loop continua livre.
    weather_data, news_data = await asyncio.gather(
        weather_task,
        news_task
    )
    
    return {
        "weather": weather_data,
        "tech_news": news_data
    }