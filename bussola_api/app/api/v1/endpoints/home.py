from fastapi import APIRouter, Depends
from typing import Any
import asyncio

from app.schemas.home import HomeDashboardResponse
from app.services.external import external_service
from app.api.deps import get_current_user

router = APIRouter()

@router.get("/", response_model=HomeDashboardResponse)
async def get_home_data(
    current_user: Any = Depends(get_current_user)
) -> Any:
    """
    Retorna os dados para a Home: Clima e Notícias Tech.
    URL: GET /api/v1/home
    """
    
    weather_data, news_data = await asyncio.gather(
        external_service.get_weather(city="Uberlandia"),
        external_service.get_tech_news()
    )
    
    return {
        "weather": weather_data,
        "tech_news": news_data
    }