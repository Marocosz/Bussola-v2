from fastapi import APIRouter, Depends
from app.api import deps

# Importação Explícita
from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.home import router as home_router
from app.api.v1.endpoints.financas import router as financas_router
from app.api.v1.endpoints.panorama import router as panorama_router
from app.api.v1.endpoints.registros import router as registros_router
from app.api.v1.endpoints.cofre import router as cofre_router
from app.api.v1.endpoints.agenda import router as agenda_router
from app.api.v1.endpoints.ritmo import router as ritmo_router

api_router = APIRouter()

# --- ROTA PÚBLICA (Sem verificação de token) ---
api_router.include_router(auth_router, prefix="/login", tags=["login"])

# --- ROTAS PROTEGIDAS (Exigem Token) ---
# Essa lista garante a segurança mesmo se esquecer o Depends no endpoint individual
protected_deps = [Depends(deps.get_current_user)]

api_router.include_router(home_router, prefix="/home", tags=["home"], dependencies=protected_deps)
api_router.include_router(financas_router, prefix="/financas", tags=["financas"], dependencies=protected_deps)
api_router.include_router(panorama_router, prefix="/panorama", tags=["panorama"], dependencies=protected_deps)
api_router.include_router(registros_router, prefix="/registros", tags=["registros"], dependencies=protected_deps)
api_router.include_router(cofre_router, prefix="/cofre", tags=["cofre"], dependencies=protected_deps)
api_router.include_router(agenda_router, prefix="/agenda", tags=["agenda"], dependencies=protected_deps)
api_router.include_router(ritmo_router, prefix="/ritmo", tags=["ritmo"], dependencies=protected_deps)