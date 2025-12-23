from typing import Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.config import settings
from app.schemas.system import SystemConfig
from app.api import deps
from app.models.user import User

router = APIRouter()

@router.get("/config", response_model=SystemConfig)
def get_system_config(
    session: Session = Depends(deps.get_db), # [NOVO] Precisamos do banco agora
) -> Any:
    """
    Retorna configurações públicas do sistema.
    Calcula dinamicamente se o registro deve estar aberto.
    """
    
    # 1. Conta quantos usuários existem
    user_count = session.query(User).count()
    
    # 2. A MÁGICA DO PRIMEIRO ACESSO:
    # O registro é permitido se:
    # A) A configuração explicita mandar (SaaS)
    # OU
    # B) Não existir NENHUM usuário no banco (Primeira instalação Self-Hosted)
    is_registration_open = settings.ENABLE_PUBLIC_REGISTRATION or (user_count == 0)

    return SystemConfig(
        deployment_mode=settings.DEPLOYMENT_MODE,
        
        # O Frontend recebe o valor calculado, não o valor bruto do .env
        public_registration=is_registration_open, 
        
        google_login_enabled=bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET),
        discord_login_enabled=bool(settings.DISCORD_CLIENT_ID),
        stripe_enabled=bool(settings.STRIPE_SECRET_KEY)
    )