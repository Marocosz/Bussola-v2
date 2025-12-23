from typing import Any, List

from fastapi import APIRouter, Body, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from pydantic.networks import EmailStr
from sqlalchemy.orm import Session

from app.api import deps
from app.core.config import settings
from app.models.user import User
from app.schemas.user import User as UserSchema, UserCreate, UserUpdate
from app.core.security import get_password_hash

router = APIRouter()

# 1. Rota para ler os dados do PRÓPRIO usuário logado
@router.get("/me", response_model=UserSchema)
def read_user_me(
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    return current_user

# 2. Rota PÚBLICA de Registro (A Lógica que faltava)
@router.post("/open", response_model=UserSchema)
def create_user_open(
    *,
    db: Session = Depends(deps.get_db),
    user_in: UserCreate,
) -> Any:
    """
    Rota de registro público.
    Lógica:
    1. Se for SaaS: Sempre aberto (assumindo que settings.ENABLE_PUBLIC_REGISTRATION=True).
    2. Se for Self-Hosted:
       - Se for o PRIMEIRO usuário do banco: Permite e cria como ADMIN.
       - Se já tiver usuários: Verifica se ENABLE_PUBLIC_REGISTRATION é True.
    """
    
    # --- LÓGICA DE PROTEÇÃO ---
    user_count = db.query(User).count()
    
    # Verifica se o registro é permitido
    if not settings.ENABLE_PUBLIC_REGISTRATION:
        # Se registro fechado, só permite se for o PRIMEIRO usuário (Instalação limpa)
        if user_count > 0:
            raise HTTPException(
                status_code=403,
                detail="O registro público está desativado nesta instância.",
            )

    # --- VERIFICAÇÃO DE EMAIL ---
    user = db.query(User).filter(User.email == user_in.email).first()
    if user:
        raise HTTPException(
            status_code=400,
            detail="Este e-mail já está cadastrado.",
        )

    # --- CRIAÇÃO DO USUÁRIO ---
    # Se for o primeiro usuário do sistema, ele vira Superuser automaticamente
    is_first_user = (user_count == 0)
    
    db_user = User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        is_active=True,
        is_superuser=is_first_user, # <--- O Pulo do gato: 1º user vira Admin
        is_premium=is_first_user    # 1º user ganha premium tbm (opcional)
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return db_user

# 3. Rota para ADMIN criar novos usuários manualmente
@router.post("/", response_model=UserSchema)
def create_user_admin_manual(
    *,
    db: Session = Depends(deps.get_db),
    user_in: UserCreate,
    current_user: User = Depends(deps.get_current_active_superuser), # Só Admin entra aqui
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
        is_superuser=False, # Criado pelo admin, nasce como user normal
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return db_user