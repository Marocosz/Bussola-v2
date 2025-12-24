from datetime import timedelta
from typing import Annotated, Any
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy.orm import Session
import httpx 

# Imports de Schemas
from app.schemas.user import User as UserSchema, UserCreate, NewPassword
from app.schemas.token import Token
from app.schemas.msg import Msg

# Imports do Service e Core Security
from app.services.auth import AuthService
from app.core import security
from app.core.config import settings
from app.models.user import User
from app.api import deps

router = APIRouter()

# Schema Local
class GoogleLoginRequest(BaseModel):
    token: str

@router.post("/access-token", response_model=Token)
def login_access_token(
    session: deps.SessionDep,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()]
) -> Token:
    """
    OAuth2 compatible token login.
    Lógica de Segurança:
    1. Verifica credenciais (Email/Senha).
    2. [SaaS vs Self-Hosted] Verifica is_verified apenas se modo for SaaS.
    """
    # 1. Busca Usuário
    user = session.query(User).filter(User.email == form_data.username).first()
    
    # 2. Verifica Senha (se user existe e tem senha definida)
    if not user or not user.hashed_password or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Email ou senha incorretos."
        )
    
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Usuário inativo.")

    # 3. [LÓGICA SAAS VS SELF-HOSTED]
    # Se for SAAS, exige e-mail verificado. Se for SELF_HOSTED, permite o login.
    if settings.DEPLOYMENT_MODE == "SAAS" and not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Seu e-mail ainda não foi verificado. Verifique sua caixa de entrada."
        )

    # 4. Gera Token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return Token(
        access_token=security.create_access_token(
            user.id, expires_delta=access_token_expires
        ),
        token_type="bearer",
    )

@router.post("/google", response_model=Token)
async def login_google(
    payload: GoogleLoginRequest,
    session: deps.SessionDep,
) -> Any:
    """
    Login via Google.
    Lógica de Account Linking:
    1. Valida token (Access Token) na API do Google.
    2. Se usuário não existe -> Cria (Verificado=True, Senha=Null).
    3. Se usuário existe -> Atualiza (Verificado=True, Provider=Google/Hybrid).
    """
    google_user_info = None
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {payload.token}"}
            )
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail="Token do Google inválido ou expirado.")
            google_user_info = response.json()
        except Exception as e:
            print(f"Erro conexão Google: {e}")
            raise HTTPException(status_code=400, detail="Falha ao conectar com o Google.")

    email = google_user_info.get("email")
    google_sub = google_user_info.get("sub") 
    name = google_user_info.get("name")
    picture = google_user_info.get("picture")

    if not email:
         raise HTTPException(status_code=400, detail="Google não retornou o e-mail.")

    user = session.query(User).filter(User.email == email).first()

    if not user:
        user = User(
            email=email,
            full_name=name,
            avatar_url=picture,
            auth_provider="google",
            provider_id=google_sub,
            is_verified=True, 
            is_active=True,
            hashed_password=None 
        )
        session.add(user)
        session.commit()
        session.refresh(user)
    else:
        updated = False
        if not user.is_verified:
            user.is_verified = True
            updated = True
        if not user.provider_id:
            user.provider_id = google_sub
            user.auth_provider = "hybrid" if user.hashed_password else "google"
            updated = True
        if not user.avatar_url and picture:
            user.avatar_url = picture
            updated = True
        if updated:
            session.add(user)
            session.commit()
            session.refresh(user)

    if not user.is_active:
        raise HTTPException(status_code=400, detail="Usuário inativo")

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return Token(
        access_token=security.create_access_token(
            user.id, expires_delta=access_token_expires
        ),
        token_type="bearer",
    )

@router.post("/register", response_model=UserSchema)
def register_public_user(
    session: deps.SessionDep,
    user_in: UserCreate,
) -> Any:
    service = AuthService(session)
    return service.register_user(user_in)

@router.post("/password-recovery/{email}", response_model=Msg)
async def recover_password(email: str, session: deps.SessionDep) -> Any:
    """
    Envia email de recuperação de senha.
    """
    service = AuthService(session)
    message = await service.recover_password(email)
    return {"msg": message}

@router.post("/reset-password", response_model=Msg)
def reset_password(
    payload: NewPassword,
    session: deps.SessionDep,
) -> Any:
    """
    Reseta a senha usando o token recebido no email.
    """
    service = AuthService(session)
    message = service.reset_password(payload)
    return {"msg": message}