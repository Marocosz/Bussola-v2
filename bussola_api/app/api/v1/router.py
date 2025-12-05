from fastapi import APIRouter

# Aqui importaremos os endpoints de cada módulo (auth, financas, etc)
# from app.api.v1.endpoints import auth, financas

api_router = APIRouter()

# Exemplo de registro de rota (faremos isso depois)
# api_router.include_router(auth.router, prefix="/login", tags=["login"])