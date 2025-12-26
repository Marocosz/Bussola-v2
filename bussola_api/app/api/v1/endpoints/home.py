"""
=======================================================================================
ARQUIVO: home.py (Endpoints do Dashboard Principal)
=======================================================================================

OBJETIVO:
    Fornecer dados para os widgets da tela inicial (Home/Dashboard).
    Diferente do 'Panorama' (que foca em métricas internas), este módulo foca em 
    informações externas e utilitárias (Clima e Notícias).

PARTE DO SISTEMA:
    Backend / API Layer / Endpoints

RESPONSABILIDADES:
    1. Obter dados climáticos baseados na localização preferida do usuário.
    2. Agregar notícias RSS baseadas nos tópicos de interesse do usuário.
    3. Fornecer metadados (lista de tópicos disponíveis) para configuração no Frontend.

COMUNICAÇÃO:
    - Chama: app.services.external (Lógica de API Externa e Cache Redis).
    - Depende: app.models.user (Preferências: city, news_preferences).

=======================================================================================
"""

from fastapi import APIRouter, Depends
from typing import Any, List, Optional, Dict

# Importamos os Schemas individuais para validação de resposta
from app.schemas.home import WeatherData, NewsArticle
from app.services.external import external_service
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter()

# --------------------------------------------------------------------------------------
# WIDGET: CLIMA
# --------------------------------------------------------------------------------------
@router.get("/weather", response_model=Optional[WeatherData])
async def get_weather_widget(
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Retorna os dados climáticos atuais para o widget da Home.
    
    Lógica de Personalização:
        Utiliza o campo 'city' do perfil do usuário. 
        Se o usuário não tiver configurado (None), usa "Uberlandia" como fallback 
        para garantir que a UI não quebre ou fique vazia.
    
    Performance:
        A chamada ao 'external_service' é assíncrona e gerencia o cache (Redis) internamente.
    """
    # Define valores padrão (Fallback)
    city = current_user.city if current_user.city else "Uberlandia"
    
    # Busca apenas o clima
    weather_data = await external_service.get_weather(city=city)
    
    return weather_data

# --------------------------------------------------------------------------------------
# WIDGET: NOTÍCIAS (RSS FEED)
# --------------------------------------------------------------------------------------
@router.get("/news", response_model=List[NewsArticle])
async def get_news_widget(
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Retorna um feed agregado de notícias.
    
    Lógica de Personalização:
        Utiliza 'news_preferences' (lista de strings) do perfil do usuário.
        Se a lista estiver vazia, assume "tech" como padrão.
    """
    # Define tópicos padrão (Fallback)
    topics = current_user.news_preferences if current_user.news_preferences else ["tech"]
    
    # O serviço busca feeds em paralelo, filtra e cacheia o resultado
    news_data = await external_service.get_news_by_topics(user_topics=topics)
    
    return news_data

# --------------------------------------------------------------------------------------
# METADADOS DE CONFIGURAÇÃO
# --------------------------------------------------------------------------------------
@router.get("/news/topics", response_model=List[Dict[str, str]])
async def get_available_topics(
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Fornece a lista de tópicos suportados pelo Backend.
    
    Por que existe:
        Permite que o Frontend construa menus de seleção (Dropdowns/Checkboxes) 
        dinamicamente, sem precisar hardcodar as opções "tech", "finance", etc.
        no código React. Se adicionarmos um tópico novo no Backend, o Front atualiza sozinho.
    """
    return external_service.get_available_topics()