from datetime import timedelta
from typing import Annotated, Any
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

# Importamos o Model do banco
from app.models.user import User

# Importamos os Schemas com Alias para evitar confusão de nomes
from app.schemas.user import User as UserSchema, UserCreate
from app.schemas.token import Token

from app.core import security
from app.core.config import settings
from app.api import deps

router = APIRouter()

@router.post("/access-token", response_model=Token)
def login_access_token(
    session: deps.SessionDep,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()]
) -> Token:
    """
    OAuth2 compatible token login, get an access token for future requests.
    """
    # 1. Busca o usuário pelo Email diretamente no banco
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

# ==============================================================================
# NOVA ROTA: REGISTRO PÚBLICO (SEM CRUD, DIRETO NA SESSION)
# ==============================================================================
@router.post("/register", response_model=UserSchema)
def register_public_user(
    session: deps.SessionDep,
    user_in: UserCreate,
) -> Any:
    """
    Registro público de novos usuários.
    Bloqueado em modo Self-Hosted se já houver usuários cadastrados e a flag estiver fechada.
    """
    # 1. TRAVA DE SEGURANÇA (SELF-HOSTED)
    if not settings.ENABLE_PUBLIC_REGISTRATION:
        # Conta quantos usuários existem no banco
        user_count = session.query(User).count()
        # Se já tem gente (count > 0), bloqueia novos registros
        if user_count > 0:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="O registro público está fechado nesta instância. Solicite acesso ao administrador."
            )

    # 2. Verificação de e-mail duplicado
    existing_user = session.query(User).filter(User.email == user_in.email).first()
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Este e-mail já está cadastrado no sistema.",
        )
    
    # 3. Criação do usuário MANUALMENTE (Model)
    db_user = User(
        email=user_in.email,
        hashed_password=security.get_password_hash(user_in.password),
        full_name=user_in.full_name,
        is_active=True,
        is_superuser=False, # Usuário público nunca é admin
        is_premium=False    # Usuário público nasce Free
    )
    
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    
    return db_user