from typing import Annotated, Any
from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel

# Imports de Schemas
from app.schemas.user import User as UserSchema, UserCreate, NewPassword
from app.schemas.token import Token
from app.schemas.msg import Msg

# Imports do Service
from app.services.auth import AuthService
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
    A lógica de verificação (Senha, SaaS vs Self-Hosted) está no AuthService.
    """
    service = AuthService(session)
    return service.authenticate_user(email=form_data.username, password=form_data.password)

@router.post("/google", response_model=Token)
async def login_google(
    payload: GoogleLoginRequest,
    session: deps.SessionDep,
) -> Any:
    """
    Login via Google.
    A lógica de validação do token Google e criação/atualização do usuário
    foi movida para o AuthService.authenticate_google.
    """
    service = AuthService(session)
    return await service.authenticate_google(token=payload.token)

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