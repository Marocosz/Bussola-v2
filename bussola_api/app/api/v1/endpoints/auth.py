from datetime import timedelta
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core import security
from app.core.config import settings
from app.api import deps
from app.models.user import User
from app.schemas.token import Token

router = APIRouter()

@router.post("/access-token", response_model=Token)
def login_access_token(
    session: deps.SessionDep,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()]
) -> Token:
    """
    OAuth2 compatible token login, get an access token for future requests.
    """
    # 1. Busca o usuário pelo Email (o form_data.username do OAuth2 contém o email)
    user = session.query(User).filter(User.email == form_data.username).first()
    
    # 2. Verifica se usuário existe e a senha bate
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email ou senha incorretos",
        )
    
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Usuário inativo")

    # 3. Gera o Token JWT
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return Token(
        access_token=security.create_access_token(
            user.id, expires_delta=access_token_expires
        ),
        token_type="bearer",
    )