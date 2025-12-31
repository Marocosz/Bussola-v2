"""
=======================================================================================
ARQUIVO: router.py (Roteador Central da API v1)
=======================================================================================

OBJETIVO:
    Centralizar e organizar todas as rotas da versão 1 da API.
    Atua como um "Hub" que agrega os roteadores específicos de cada módulo (auth, 
    finanças, agenda, etc) em um único objeto router principal.

PARTE DO SISTEMA:
    Backend / API Layer.

RESPONSABILIDADES:
    1. Importar os controllers (endpoints) de cada domínio.
    2. Definir os prefixos de URL (ex: /financas, /agenda).
    3. Organizar a documentação do Swagger através de tags.

COMUNICAÇÃO:
    - Importado por: app.main (que inclui este router na aplicação FastAPI principal).
    - Agrega: app.api.v1.endpoints.* (todos os módulos de endpoints).

=======================================================================================
"""

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
    users,
    ai
)

# Instância principal que acumulará todas as rotas
api_router = APIRouter()

# --------------------------------------------------------------------------------------
# REGISTRO DE ROTAS (Sub-routers)
# --------------------------------------------------------------------------------------
# A estratégia abaixo modulariza a API. Cada include_router anexa um conjunto
# de endpoints sob um prefixo específico, mantendo o código desacoplado.

# Auth / Login
# Prefixo definido como "/login" para compatibilidade semântica com OAuth2 e Frontend.
# Endpoint final resultante: /api/v1/login/access-token
api_router.include_router(auth.router, prefix="/auth", tags=["login"])

# Módulos de Domínio (Funcionalidades principais)
api_router.include_router(home.router, prefix="/home", tags=["home"])
api_router.include_router(financas.router, prefix="/financas", tags=["financas"])
api_router.include_router(agenda.router, prefix="/agenda", tags=["agenda"])
api_router.include_router(registros.router, prefix="/registros", tags=["registros"])
api_router.include_router(ritmo.router, prefix="/ritmo", tags=["ritmo"])
api_router.include_router(cofre.router, prefix="/cofre", tags=["cofre"])
api_router.include_router(panorama.router, prefix="/panorama", tags=["panorama"])

# Módulo de IA (Serviço de Inteligência / Chat)
api_router.include_router(ai.router, prefix="/ai", tags=["ai"]) 

# Módulos de Sistema e Administração
api_router.include_router(system.router, prefix="/system", tags=["system"])
api_router.include_router(users.router, prefix="/users", tags=["users"])