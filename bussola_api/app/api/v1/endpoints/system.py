"""
=======================================================================================
ARQUIVO: system.py (Configurações Globais do Sistema)
=======================================================================================

OBJETIVO:
    Expor configurações públicas e estado do sistema para o Frontend.
    Isso permite que a interface se adapte dinamicamente (ex: esconder botão de Google
    se a chave não estiver configurada, ou liberar cadastro no primeiro acesso).

PARTE DO SISTEMA:
    Backend / API Layer / Endpoints

RESPONSABILIDADES:
    1. Informar o modo de deploy (SaaS vs Self-Hosted).
    2. Gerenciar Flags de Funcionalidades (Feature Toggles) baseadas no .env.
    3. Implementar lógica de "Setup Inicial" para instalações novas.

COMUNICAÇÃO:
    - Lê: app.core.config.settings (Variáveis de Ambiente).
    - Consulta: app.models.user (Contagem de usuários).

=======================================================================================
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api import deps
from app.core.config import settings
from app.schemas.system import SystemConfig
from app.models.user import User

router = APIRouter()

@router.get("/config", response_model=SystemConfig)
def get_system_info(db: Session = Depends(deps.get_db)):
    """
    Retorna o mapa de funcionalidades ativas e o estado do registro.
    
    Contexto:
        Chamado pelo Frontend na inicialização da aplicação (Splash Screen ou Login)
        para decidir quais componentes renderizar.
    """
    
    # Define o estado base conforme configuração estática do .env
    is_registration_open = settings.ENABLE_PUBLIC_REGISTRATION
    
    # ----------------------------------------------------------------------------------
    # REGRA DE NEGÓCIO: BOOTSTRAP / SETUP INICIAL
    # ----------------------------------------------------------------------------------
    # Problema: Se o usuário subir um container Self-Hosted com registro fechado por padrão,
    # ele nunca conseguirá criar a primeira conta de administrador.
    #
    # Solução: Se estivermos em modo SELF_HOSTED e o banco estiver vazio (0 usuários),
    # forçamos a abertura do registro temporariamente.
    if settings.DEPLOYMENT_MODE == "SELF_HOSTED":
        user_count = db.query(User).count()
        if user_count == 0:
            is_registration_open = True

    return {
        "deployment_mode": settings.DEPLOYMENT_MODE,
        "public_registration": is_registration_open,
        
        # ------------------------------------------------------------------------------
        # FEATURE FLAGS (Disponibilidade de Integrações)
        # ------------------------------------------------------------------------------
        # Converte a presença das chaves de API em booleanos.
        # O Frontend usa isso para esconder botões (ex: "Entrar com Google") se
        # o backend não estiver configurado para tal, evitando erros de clique.
        "google_login_enabled": bool(settings.GOOGLE_CLIENT_ID),
        "discord_login_enabled": bool(settings.DISCORD_CLIENT_ID),
        "stripe_enabled": bool(settings.STRIPE_SECRET_KEY),
        
        "version": "2.0.0"
    }