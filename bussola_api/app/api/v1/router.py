from fastapi import APIRouter
from app.api.v1.endpoints import auth

api_router = APIRouter()

# Registra a rota de login
api_router.include_router(auth.router, prefix="/login", tags=["login"])

# Aqui adicionaremos os outros depois (financas, agenda, etc)