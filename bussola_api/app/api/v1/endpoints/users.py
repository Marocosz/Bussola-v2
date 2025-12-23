from typing import Any, List

from fastapi import APIRouter, Body, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from pydantic.networks import EmailStr
from sqlalchemy.orm import Session

from app.api import deps
from app.core.config import settings
from app.models.user import User
from app.schemas.user import User as UserSchema, UserCreate, UserUpdate

router = APIRouter()

# 1. Rota para ler os dados do PRÓPRIO usuário logado
# O Frontend chama: GET /users/me
@router.get("/me", response_model=UserSchema)
def read_user_me(
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Get current user.
    """
    return current_user

# 2. Rota para CRIAR novos usuários (Apenas Admin)
# O Frontend chama: POST /users/
@router.post("/", response_model=UserSchema)
def create_user(
    *,
    db: Session = Depends(deps.get_db),
    user_in: UserCreate,
    current_user: User = Depends(deps.get_current_active_superuser), # <--- Só Superuser entra aqui
) -> Any:
    """
    Create new user.
    """
    # Verifica se já existe
    user = db.query(User).filter(User.email == user_in.email).first()
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this username already exists in the system.",
        )
    
    # Cria usando a função do CRUD ou manual (aqui fazendo manual simplificado para facilitar)
    from app.core.security import get_password_hash
    
    db_user = User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        is_active=True,
        is_superuser=False, # Criado pelo admin, nasce normal
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return db_user