from fastapi import APIRouter
from app.core.config import settings
from app.schemas.system import SystemConfig

# Esta linha estava faltando, o que causava o erro
router = APIRouter()

@router.get("/config", response_model=SystemConfig)
def get_system_info():
    """
    Retorna configurações públicas do sistema para o Frontend
    adaptar a interface (ex: esconder botão de Google se não estiver configurado).
    """
    return {
        "deployment_mode": settings.DEPLOYMENT_MODE,
        "public_registration": settings.ENABLE_PUBLIC_REGISTRATION,
        
        # Verifica se as chaves existem para retornar True/False
        "google_login_enabled": bool(settings.GOOGLE_CLIENT_ID),
        "discord_login_enabled": bool(settings.DISCORD_CLIENT_ID),
        "stripe_enabled": bool(settings.STRIPE_SECRET_KEY),
        
        "version": "2.0.0"
    }