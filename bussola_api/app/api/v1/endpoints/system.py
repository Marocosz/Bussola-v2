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
    Retorna configurações públicas do sistema para o Frontend.
    Lógica Inteligente: Se for SELF_HOSTED e não houver usuários,
    libera o registro (Setup Inicial) mesmo que .env diga False.
    """
    
    # Lógica padrão do arquivo de configuração
    is_registration_open = settings.ENABLE_PUBLIC_REGISTRATION
    
    # Lógica de Override para Setup Inicial (Self-Hosted)
    if settings.DEPLOYMENT_MODE == "SELF_HOSTED":
        user_count = db.query(User).count()
        if user_count == 0:
            is_registration_open = True

    return {
        "deployment_mode": settings.DEPLOYMENT_MODE,
        "public_registration": is_registration_open,
        
        # Verifica se as chaves existem para retornar True/False
        "google_login_enabled": bool(settings.GOOGLE_CLIENT_ID),
        "discord_login_enabled": bool(settings.DISCORD_CLIENT_ID),
        "stripe_enabled": bool(settings.STRIPE_SECRET_KEY),
        
        "version": "2.0.0"
    }