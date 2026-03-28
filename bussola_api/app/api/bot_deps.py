from fastapi import Header, HTTPException, Depends
from sqlalchemy.orm import Session

from app.core.config import settings
from app.api.deps import get_db
from app.models.user import User


def require_bot_token(x_bot_service_token: str = Header(...)):
    """Valida o SERVICE_TOKEN do bot. Usado em todos os endpoints /bot/."""
    if not settings.BOT_SERVICE_TOKEN:
        raise HTTPException(status_code=503, detail="Bot service não configurado")
    if x_bot_service_token != settings.BOT_SERVICE_TOKEN:
        raise HTTPException(status_code=401, detail="Token de serviço inválido")


def get_bot_user(
    discord_id: str,
    db: Session = Depends(get_db),
    _=Depends(require_bot_token),
) -> User:
    """
    Resolve discord_id → User autenticado.
    Usado em endpoints que exigem que o usuário já esteja vinculado.
    """
    user = db.query(User).filter(User.discord_id == discord_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=403, detail="Usuário não encontrado ou inativo")
    return user
