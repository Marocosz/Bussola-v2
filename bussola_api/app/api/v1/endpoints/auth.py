from datetime import timedelta
from typing import Annotated, Any
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel
import requests
import secrets

# Importamos o Model do banco
from app.models.user import User

# Importamos os Schemas
from app.schemas.user import User as UserSchema, UserCreate
from app.schemas.token import Token

from app.core import security
from app.core.config import settings
from app.api import deps

router = APIRouter()

class GoogleLoginRequest(BaseModel):
    token: str

# Rota padrão: /api/v1/login/access-token
@router.post("/access-token", response_model=Token)
def login_access_token(
    session: deps.SessionDep,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()]
) -> Token:
    """
    OAuth2 compatible token login, get an access token for future requests.
    """
    user = session.query(User).filter(User.email == form_data.username).first()
    
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email ou senha incorretos",
        )
    
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Usuário inativo")

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return Token(
        access_token=security.create_access_token(
            user.id, expires_delta=access_token_expires
        ),
        token_type="bearer",
    )

# ==============================================================================
# [CORREÇÃO] ROTA GOOGLE: Mudei de "/login/google" para apenas "/google"
# O prefixo /login já vem do router principal. URL Final: /api/v1/login/google
# ==============================================================================
@router.post("/google", response_model=Token)
def login_google(
    payload: GoogleLoginRequest,
    session: deps.SessionDep,
) -> Any:
    """
    Login via Google.
    """
    # 1. Valida o token chamando a API do Google
    try:
        google_response = requests.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {payload.token}"}
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Falha ao conectar com Google: {str(e)}")
    
    if google_response.status_code != 200:
        raise HTTPException(status_code=400, detail="Token do Google inválido ou expirado.")
        
    user_info = google_response.json()
    
    email = user_info.get("email")
    name = user_info.get("name")
    
    if not email:
        raise HTTPException(status_code=400, detail="Token do Google não contém e-mail.")

    # 2. Verifica/Cria usuário
    user = session.query(User).filter(User.email == email).first()

    if not user:
        random_password = secrets.token_urlsafe(16)
        
        user = User(
            email=email,
            full_name=name if name else email.split("@")[0],
            hashed_password=security.get_password_hash(random_password),
            is_active=True,
            is_superuser=False,
            is_premium=False 
        )
        session.add(user)
        session.commit()
        session.refresh(user)
    
    elif not user.is_active:
        raise HTTPException(status_code=400, detail="Usuário inativo.")

    # 3. Gera Token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return Token(
        access_token=security.create_access_token(
            user.id, expires_delta=access_token_expires
        ),
        token_type="bearer",
    )

# Rota para registro público (Manual)
# Nota: Verifique se no frontend você está chamando /api/v1/login/register
@router.post("/register", response_model=UserSchema)
def register_public_user(
    session: deps.SessionDep,
    user_in: UserCreate,
) -> Any:
    """
    Registro público de novos usuários.
    """
    if not settings.ENABLE_PUBLIC_REGISTRATION:
        user_count = session.query(User).count()
        if user_count > 0:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="O registro público está fechado nesta instância."
            )

    existing_user = session.query(User).filter(User.email == user_in.email).first()
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Este e-mail já está cadastrado no sistema.",
        )
    
    db_user = User(
        email=user_in.email,
        hashed_password=security.get_password_hash(user_in.password),
        full_name=user_in.full_name,
        is_active=True,
        is_superuser=False, 
        is_premium=False    
    )
    
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    
    return db_user