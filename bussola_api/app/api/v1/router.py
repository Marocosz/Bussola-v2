from fastapi import APIRouter
from app.api.v1.endpoints import auth, home,financas

api_router = APIRouter()

# auth
api_router.include_router(auth.router, prefix="/login", tags=["login"])

# Home
api_router.include_router(home.router, prefix="/home", tags=["home"])

# Finanças
api_router.include_router(financas.router, prefix="/financas", tags=["financas"])
