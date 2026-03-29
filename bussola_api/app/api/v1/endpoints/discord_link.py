from datetime import datetime

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db, CurrentUser
from app.core.config import settings
from app.models.discord_link_token import DiscordLinkToken
from app.models.user import User

router = APIRouter()


class ConfirmLinkRequest(BaseModel):
    token: str


class ConfirmLinkResponse(BaseModel):
    message: str


def _notify_bot(discord_id: str) -> None:
    """
    Fire-and-forget: avisa o bot que um vínculo foi confirmado.
    Chamado como BackgroundTask — falhas não afetam a resposta ao usuário.
    """
    if not settings.BOT_WEBHOOK_URL:
        return
    try:
        with httpx.Client(timeout=5.0) as client:
            client.post(
                f"{settings.BOT_WEBHOOK_URL}/webhook/discord-linked",
                json={"discord_id": discord_id},
                headers={"X-Bot-Service-Token": settings.BOT_SERVICE_TOKEN or ""},
            )
    except Exception:
        pass  # Bot pode estar temporariamente indisponível


@router.post("/confirm", response_model=ConfirmLinkResponse)
def confirm_discord_link(
    payload: ConfirmLinkRequest,
    background_tasks: BackgroundTasks,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    """
    Chamado pelo frontend após o usuário autenticar.
    Vincula o discord_id (do token) ao usuário logado.
    """
    link_token = db.query(DiscordLinkToken).filter(
        DiscordLinkToken.token == payload.token,
        DiscordLinkToken.used == False,
    ).first()

    if not link_token:
        raise HTTPException(status_code=404, detail="Token inválido ou já utilizado")

    if link_token.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Token expirado. Gere um novo link pelo Discord")

    # Garante que o discord_id não está vinculado a outra conta
    existing = db.query(User).filter(
        User.discord_id == link_token.discord_id
    ).first()
    if existing and existing.id != current_user.id:
        raise HTTPException(
            status_code=400,
            detail="Este Discord já está vinculado a outra conta Bussola"
        )

    current_user.discord_id = link_token.discord_id
    link_token.used = True
    db.commit()

    background_tasks.add_task(_notify_bot, link_token.discord_id)

    return {"message": "Conta vinculada com sucesso!"}
