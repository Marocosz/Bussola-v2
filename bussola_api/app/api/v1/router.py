from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth, 
    home, 
    financas, 
    agenda, 
    registros, 
    ritmo, 
    cofre, 
    panorama,
    system,
    users
)

api_router = APIRouter()

# [CORREÇÃO] Mudamos prefix="/auth" para prefix="/login"
# Agora a rota final fica: /api/v1/login/access-token
api_router.include_router(auth.router, prefix="/login", tags=["login"])

api_router.include_router(home.router, prefix="/home", tags=["home"])
api_router.include_router(financas.router, prefix="/financas", tags=["financas"])
api_router.include_router(agenda.router, prefix="/agenda", tags=["agenda"])
api_router.include_router(registros.router, prefix="/registros", tags=["registros"])
api_router.include_router(ritmo.router, prefix="/ritmo", tags=["ritmo"])
api_router.include_router(cofre.router, prefix="/cofre", tags=["cofre"])
api_router.include_router(panorama.router, prefix="/panorama", tags=["panorama"])

api_router.include_router(system.router, prefix="/system", tags=["system"])
api_router.include_router(users.router, prefix="/users", tags=["users"])