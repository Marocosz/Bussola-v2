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
    Personalizado com base na Cidade e Preferências do Usuário.
    """
    
    # Define valores padrão caso o usuário não tenha configurado
    city = current_user.city if current_user.city else "Uberlandia"
    topics = current_user.news_preferences if current_user.news_preferences else ["tech"]

    # Busca em paralelo (Clima + Notícias dos tópicos escolhidos)
    weather_data, news_data = await asyncio.gather(
        external_service.get_weather(city=city),
        external_service.get_news_by_topics(user_topics=topics)
    )
    
    return {
        "weather": weather_data,
        "tech_news": news_data # O nome do campo no JSON ainda é tech_news por compatibilidade com front
    }