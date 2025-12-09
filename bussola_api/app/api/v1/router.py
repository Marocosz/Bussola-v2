from fastapi import APIRouter
from app.api.v1.endpoints import auth, home,financas, panorama, registros, cofre, agenda

api_router = APIRouter()

# auth
api_router.include_router(auth.router, prefix="/login", tags=["login"])

# Home
api_router.include_router(home.router, prefix="/home", tags=["home"])

# Finanças
api_router.include_router(financas.router, prefix="/financas", tags=["financas"])

# Panorama
api_router.include_router(panorama.router, prefix="/panorama", tags=["panorama"])

# Registros
api_router.include_router(registros.router, prefix="/registros", tags=["registros"]) 

# Cofre
api_router.include_router(cofre.router, prefix="/cofre", tags=["cofre"])

# Agenda
api_router.include_router(agenda.router, prefix="/agenda", tags=["agenda"])