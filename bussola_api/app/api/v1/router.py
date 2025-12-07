from fastapi import APIRouter
from app.api.v1.endpoints import auth, home

api_router = APIRouter()

# auth
api_router.include_router(auth.router, prefix="/login", tags=["login"])

# Home
api_router.include_router(home.router, prefix="/home", tags=["home"])

# Futuros módulos
# api_router.include_router(agenda.router, prefix="/agenda", tags=["agenda"])
# api_router.include_router(financas.router, prefix="/financas", tags=["financas"])