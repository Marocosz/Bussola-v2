"""
=======================================================================================
ARQUIVO: auth.py (Endpoints de Autenticação)
=======================================================================================
OBJETIVO:
    Gerenciar o ciclo de vida da sessão e identidade (Login, Logout, Registro, Senhas).
"""

from typing import Annotated, Any
from fastapi import APIRouter, Depends, Request, Header, BackgroundTasks # [CORREÇÃO] Import BackgroundTasks
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.schemas.user import User as UserSchema, UserCreate, NewPassword
from app.schemas.token import Token
from app.services.auth import AuthService
from app.api import deps
from app.core.config import settings

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

# Schemas Locais
class GoogleLoginRequest(BaseModel):
    token: str

class RefreshTokenRequest(BaseModel):
    refresh_token: str

# --------------------------------------------------------------------------------------
# LOGIN & SESSÃO
# --------------------------------------------------------------------------------------

@router.post("/access-token", response_model=Token)
@limiter.limit(settings.RATE_LIMIT_STRATEGY)
def login_access_token(
    request: Request,
    session: deps.SessionDep,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()]
) -> Token:
    """Login tradicional (Username/Password)."""
    service = AuthService(session)
    return service.authenticate_user(email=form_data.username, password=form_data.password)

@router.post("/google", response_model=Token)
@limiter.limit(settings.RATE_LIMIT_STRATEGY)
async def login_google(
    request: Request,
    payload: GoogleLoginRequest,
    session: deps.SessionDep,
) -> Any:
    """Login ou Cadastro via Google OAuth."""
    service = AuthService(session)
    return await service.authenticate_google(google_token=payload.token)

@router.post("/refresh", response_model=Token)
def refresh_access_token(
    payload: RefreshTokenRequest,
    session: deps.SessionDep,
) -> Any:
    """Renova o Access Token usando um Refresh Token válido."""
    service = AuthService(session)
    return service.refresh_token(payload.refresh_token)

@router.post("/logout", response_model=dict)
def logout(
    session: deps.SessionDep,
    authorization: Annotated[str | None, Header()] = None, 
    refresh_token: Annotated[str | None, Header(alias="X-Refresh-Token")] = None
) -> Any:
    """Revoga tokens (Logout Seguro)."""
    service = AuthService(session)
    
    if authorization:
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() == "bearer":
            service.logout(token)
            
    if refresh_token:
        service.logout(refresh_token)
        
    return {"msg": "Logout realizado com sucesso."}

# --------------------------------------------------------------------------------------
# REGISTRO PÚBLICO
# --------------------------------------------------------------------------------------

@router.post("/register", response_model=UserSchema)
@limiter.limit("5/hour") 
def register_public_user(
    request: Request,
    session: deps.SessionDep,
    user_in: UserCreate,
    background_tasks: BackgroundTasks # [CORREÇÃO] Injeção necessária para envio de e-mail
) -> Any:
    """Criação de nova conta pelo próprio usuário."""
    service = AuthService(session)
    # [CORREÇÃO] Passamos as tarefas para o serviço agendar o e-mail
    return service.register_user(user_in, background_tasks)

# --------------------------------------------------------------------------------------
# RECUPERAÇÃO DE SENHA
# --------------------------------------------------------------------------------------

@router.post("/password-recovery/{email}", response_model=dict)
@limiter.limit("3/minute")
async def recover_password(
    request: Request,
    email: str, 
    session: deps.SessionDep
) -> Any:
    """Inicia fluxo de esqueci minha senha."""
    service = AuthService(session)
    msg = await service.recover_password(email)
    return {"msg": msg}

@router.post("/reset-password", response_model=dict)
def reset_password(
    payload: NewPassword,
    session: deps.SessionDep,
) -> Any:
    """Finaliza troca de senha."""
    service = AuthService(session)
    msg = service.reset_password(payload)
    return {"msg": msg}