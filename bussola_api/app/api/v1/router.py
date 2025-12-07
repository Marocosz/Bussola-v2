from fastapi import APIRouter
from app.api.v1.endpoints import auth, home

api_router = APIRouter()

# Autenticação (já deve existir)
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])

# Home
api_router.include_router(home.router, prefix="/home", tags=["home"])

# Futuros módulos (placeholders por enquanto, descomente conforme criarmos)
# api_router.include_router(agenda.router, prefix="/agenda", tags=["agenda"])
# api_router.include_router(financas.router, prefix="/financas", tags=["financas"])
# ...