from fastapi import APIRouter

# Importação Explícita (Mais segura contra erros de cache/__init__)
from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.home import router as home_router
from app.api.v1.endpoints.financas import router as financas_router
from app.api.v1.endpoints.panorama import router as panorama_router
from app.api.v1.endpoints.registros import router as registros_router
from app.api.v1.endpoints.cofre import router as cofre_router
from app.api.v1.endpoints.agenda import router as agenda_router

api_router = APIRouter()

# Auth
api_router.include_router(auth_router, prefix="/login", tags=["login"])

# Home
api_router.include_router(home_router, prefix="/home", tags=["home"])

# Finanças
api_router.include_router(financas_router, prefix="/financas", tags=["financas"])

# Panorama
api_router.include_router(panorama_router, prefix="/panorama", tags=["panorama"])

# Registros
api_router.include_router(registros_router, prefix="/registros", tags=["registros"]) 

# Cofre
api_router.include_router(cofre_router, prefix="/cofre", tags=["cofre"])

# Agenda
api_router.include_router(agenda_router, prefix="/agenda", tags=["agenda"])