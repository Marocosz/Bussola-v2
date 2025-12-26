"""
=======================================================================================
ARQUIVO: auth.py (Endpoints de Autenticação)
=======================================================================================

OBJETIVO:
    Expor as rotas públicas relacionadas ao ciclo de vida da identidade do usuário:
    Login (Local e Social), Cadastro, Recuperação e Redefinição de Senha.

PARTE DO SISTEMA:
    Backend / API Layer / Auth

RESPONSABILIDADES:
    1. Receber dados de formulários ou JSON (Login/Registro).
    2. Instanciar o `AuthService` injetando a sessão de banco atual.
    3. Converter exceções de negócio do Service em respostas HTTP adequadas.
    4. Retornar Tokens JWT ou mensagens de confirmação para o cliente.

COMUNICAÇÃO:
    - Chama: app.services.auth.AuthService (Regras de Negócio).
    - Recebe: app.schemas.user/token (Formatos de Dados).
    - Depende: app.api.deps (Injeção de Banco de Dados).

=======================================================================================
"""

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

# Schema simples para receber o token do Google no corpo da requisição JSON
class GoogleLoginRequest(BaseModel):
    token: str

# --------------------------------------------------------------------------------------
# LOGIN PADRÃO (OAUTH2)
# --------------------------------------------------------------------------------------
@router.post("/access-token", response_model=Token)
def login_access_token(
    session: deps.SessionDep,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()]
) -> Token:
    """
    Realiza o login tradicional (E-mail e Senha).
    
    Compatibilidade:
        Utiliza `OAuth2PasswordRequestForm` para ser compatível com a especificação OAuth2.
        Isso permite que o Swagger UI (botão 'Authorize') funcione nativamente.
        
    Mapeamento:
        O campo `form_data.username` contém o e-mail do usuário.
    """
    # Instancia o serviço injetando a sessão da requisição atual
    service = AuthService(session)
    return service.authenticate_user(email=form_data.username, password=form_data.password)

# --------------------------------------------------------------------------------------
# LOGIN SOCIAL (GOOGLE)
# --------------------------------------------------------------------------------------
@router.post("/google", response_model=Token)
async def login_google(
    payload: GoogleLoginRequest,
    session: deps.SessionDep,
) -> Any:
    """
    Endpoint para Login ou Cadastro via Google.
    
    Fluxo:
        Recebe o `id_token` gerado pelo Frontend (React/Firebase/Google SDK),
        valida sua autenticidade no Service e retorna nosso JWT interno.
    """
    service = AuthService(session)
    # Delega a validação externa e o account linking para o serviço
    return await service.authenticate_google(google_token=payload.token)

# --------------------------------------------------------------------------------------
# REGISTRO DE USUÁRIO
# --------------------------------------------------------------------------------------
@router.post("/register", response_model=UserSchema)
def register_public_user(
    session: deps.SessionDep,
    user_in: UserCreate,
) -> Any:
    """
    Cria um novo usuário no sistema.
    
    Regras de Negócio:
        O serviço validará se o registro público está habilitado nas configurações
        e se o e-mail já existe.
    """
    service = AuthService(session)
    return service.register_user(user_in)

# --------------------------------------------------------------------------------------
# RECUPERAÇÃO DE SENHA (FLUXO)
# --------------------------------------------------------------------------------------
@router.post("/password-recovery/{email}", response_model=Msg)
async def recover_password(email: str, session: deps.SessionDep) -> Any:
    """
    Inicia o fluxo de 'Esqueci minha senha'.
    Gera um token temporário e envia por e-mail (se SMTP configurado).
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
    Finaliza a redefinição de senha.
    Requer o token recebido por e-mail e a nova senha desejada.
    """
    service = AuthService(session)
    message = service.reset_password(payload)
    return {"msg": message}