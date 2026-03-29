import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.bot_deps import require_bot_token
from app.api.deps import get_db
from app.models.discord_link_token import DiscordLinkToken
from app.models.user import User

router = APIRouter()


class LinkTokenRequest(BaseModel):
    discord_id: str


class LinkTokenResponse(BaseModel):
    token: str


class LinkStatusResponse(BaseModel):
    linked: bool


@router.post(
    "/auth/link-token",
    response_model=LinkTokenResponse,
    dependencies=[Depends(require_bot_token)],
)
def generate_link_token(payload: LinkTokenRequest, db: Session = Depends(get_db)):
    """
    Gera um one-time token para vincular discord_id a uma conta Bussola.
    Invalida tokens anteriores não utilizados para o mesmo discord_id.
    """
    already_linked = db.query(User).filter(
        User.discord_id == payload.discord_id
    ).first()
    if already_linked:
        raise HTTPException(
            status_code=400,
            detail="Este Discord já está vinculado a uma conta Bussola"
        )

    # Invalida tokens anteriores não usados para este discord_id
    db.query(DiscordLinkToken).filter(
        DiscordLinkToken.discord_id == payload.discord_id,
        DiscordLinkToken.used == False,
    ).delete()

    new_token = DiscordLinkToken(
        token=str(uuid.uuid4()),
        discord_id=payload.discord_id,
        expires_at=datetime.utcnow() + timedelta(minutes=10),
    )
    db.add(new_token)
    db.commit()

    return {"token": new_token.token}


@router.get(
    "/auth/link-status",
    response_model=LinkStatusResponse,
    dependencies=[Depends(require_bot_token)],
)
def check_link_status(discord_id: str, db: Session = Depends(get_db)):
    """Verifica se um discord_id já está vinculado a alguma conta."""
    user = db.query(User).filter(User.discord_id == discord_id).first()
    return {"linked": user is not None}


class UnlinkRequest(BaseModel):
    discord_id: str


@router.delete(
    "/auth/unlink",
    dependencies=[Depends(require_bot_token)],
)
def unlink_account(payload: UnlinkRequest, db: Session = Depends(get_db)):
    """Remove o vínculo discord_id de uma conta Bussola."""
    user = db.query(User).filter(User.discord_id == payload.discord_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Conta não vinculada")
    user.discord_id = None
    db.commit()
    return {"message": "Conta desvinculada com sucesso"}
