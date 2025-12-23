from typing import Any, List
from datetime import timedelta

from jose import jwt, JWTError
from fastapi import APIRouter, Body, Depends, HTTPException, status, BackgroundTasks
from fastapi.encoders import jsonable_encoder
from pydantic.networks import EmailStr
from sqlalchemy.orm import Session

from app.api import deps
from app.core import security
from app.core.config import settings
from app.models.user import User
from app.schemas.user import User as UserSchema, UserCreate, UserUpdate
from app.core.security import get_password_hash

# Import da função de email
from app.utils.email import send_account_verification_email 

router = APIRouter()

# 1. Rota para ler os dados do PRÓPRIO usuário logado
@router.get("/me", response_model=UserSchema)
def read_user_me(
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    return current_user

# 2. Rota PÚBLICA de Registro
@router.post("/open", response_model=UserSchema)
async def create_user_open(
    *,
    db: Session = Depends(deps.get_db),
    user_in: UserCreate,
    background_tasks: BackgroundTasks
) -> Any:
    """
    Rota de registro público.
    Lógica de Segurança:
    - No Self-Hosted: 1º usuário é Admin Verificado.
    - No SaaS: Todos nascem desativados e aguardam e-mail.
    """
    
    user_count = db.query(User).count()
    is_saas = (settings.DEPLOYMENT_MODE == "SAAS") # Verifica se é SaaS
    
    # --- LÓGICA DE PROTEÇÃO DE REGISTRO ---
    if not settings.ENABLE_PUBLIC_REGISTRATION:
        if user_count > 0:
            raise HTTPException(
                status_code=403,
                detail="O registro público está desativado nesta instância.",
            )

    # --- VERIFICAÇÃO DE DUPLICIDADE ---
    user = db.query(User).filter(User.email == user_in.email).first()
    if user:
        raise HTTPException(
            status_code=400,
            detail="Este e-mail já está cadastrado.",
        )

    # --- DEFINIÇÃO DE PERMISSÕES INICIAIS (CORRIGIDO) ---
    # No SaaS, is_first_user não importa para privilégios ou verificação
    if is_saas:
        is_admin = False
        should_be_verified = False
    else:
        # Modo Self-Hosted: Primeiro é o mestre
        is_admin = (user_count == 0)
        should_be_verified = is_admin

    db_user = User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        is_active=True,
        is_superuser=is_admin, 
        is_premium=is_admin, 
        is_verified=should_be_verified, 
        auth_provider="local"
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    # --- ENVIO DE EMAIL (BACKGROUND) ---
    if not should_be_verified:
        verify_token = security.create_access_token(
            subject=db_user.id, 
            expires_delta=timedelta(hours=24)
        )
        
        background_tasks.add_task(
            send_account_verification_email,
            email_to=user_in.email, 
            token=verify_token
        )
    
    return db_user

# 3. Rota para Verificar Email
@router.post("/verify-email", response_model=Any)
def verify_email(
    token: str, 
    email: EmailStr,
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Valida o email do usuário decodificando o Token JWT.
    """
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    if user.is_verified:
        return {"msg": "Email já verificado anteriormente."}

    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[security.ALGORITHM]
        )
        token_sub = payload.get("sub")
        
        if not token_sub or str(token_sub) != str(user.id):
            raise HTTPException(status_code=403, detail="Token inválido para este usuário.")
            
    except (JWTError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="O link de verificação é inválido ou expirou."
        )

    user.is_verified = True
    db.add(user)
    db.commit()
    
    return {"msg": "Email verificado com sucesso! Você pode fazer login."}

# 4. Rota para ADMIN criar novos usuários manualmente
@router.post("/", response_model=UserSchema)
def create_user_admin_manual(
    *,
    db: Session = Depends(deps.get_db),
    user_in: UserCreate,
    current_user: User = Depends(deps.get_current_active_superuser), 
) -> Any:
    """
    Criação manual de usuários pelo Painel Admin.
    """
    user = db.query(User).filter(User.email == user_in.email).first()
    if user:
        raise HTTPException(
            status_code=400,
            detail="User with this email already exists.",
        )
    
    db_user = User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        is_active=True,
        is_superuser=False, 
        is_verified=True,
        auth_provider="local"
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return db_user