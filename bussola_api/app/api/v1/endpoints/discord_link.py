from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db, CurrentUser
from app.models.discord_link_token import DiscordLinkToken
from app.models.user import User

router = APIRouter()


class ConfirmLinkRequest(BaseModel):
    token: str


class ConfirmLinkResponse(BaseModel):
    message: str


@router.post("/confirm", response_model=ConfirmLinkResponse)
def confirm_discord_link(
    payload: ConfirmLinkRequest,
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

    if link_token.expires_at < datetime.now(timezone.utc):
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

    return {"message": "Conta vinculada com sucesso!"}
