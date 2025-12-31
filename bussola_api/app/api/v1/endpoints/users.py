"""
=======================================================================================
ARQUIVO: users.py (Endpoints de Gestão de Usuários)
=======================================================================================
OBJETIVO:
    Gerenciar dados do usuário (Perfil, Admin) e verificações de conta.
    NOTA: O registro público agora fica em 'auth.py'.
"""

from typing import Any, List, Optional
from jose import jwt, JWTError
from fastapi import APIRouter, Body, Depends, HTTPException, status
from pydantic.networks import EmailStr
from sqlalchemy.orm import Session

from app.api import deps
from app.core import security
from app.core.config import settings
from app.models.user import User
from app.schemas.user import User as UserSchema, UserCreate
from app.core.security import get_password_hash, verify_password

router = APIRouter()

# --------------------------------------------------------------------------------------
# GESTÃO DO PRÓPRIO PERFIL (MY ACCOUNT)
# --------------------------------------------------------------------------------------

@router.get("/me", response_model=UserSchema)
def read_user_me(
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Retorna os dados do usuário atualmente logado."""
    return current_user

@router.patch("/me", response_model=UserSchema)
def update_user_me(
    *,
    db: Session = Depends(deps.get_db),
    full_name: Optional[str] = Body(None),
    email: Optional[EmailStr] = Body(None),
    city: Optional[str] = Body(None),
    news_preferences: Optional[List[str]] = Body(None),
    current_password: Optional[str] = Body(None),
    new_password: Optional[str] = Body(None),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Atualiza dados do perfil com verificação de segurança."""
    
    # 1. Validação de Segurança (Mudanças Sensíveis)
    if (new_password or (email and email != current_user.email)) and current_user.auth_provider == "local":
        if not current_password or not verify_password(current_password, current_user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A senha atual está incorreta."
            )

    # 2. Atualização de campos simples
    if full_name is not None:
        current_user.full_name = full_name
    if city is not None:
        current_user.city = city
    if news_preferences is not None:
        current_user.news_preferences = news_preferences

    # 3. Atualização de E-mail
    if email is not None and current_user.auth_provider == "local":
        if email != current_user.email:
            existing = db.query(User).filter(User.email == email).first()
            if existing:
                raise HTTPException(status_code=400, detail="Este e-mail já está em uso.")
            current_user.email = email

    # 4. Troca de Senha
    if new_password is not None and current_user.auth_provider == "local":
        current_user.hashed_password = get_password_hash(new_password)

    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user

# --------------------------------------------------------------------------------------
# VERIFICAÇÃO DE CONTA
# --------------------------------------------------------------------------------------

@router.post("/verify-email", response_model=dict)
def verify_email(
    token: str, 
    email: EmailStr,
    db: Session = Depends(deps.get_db)
) -> Any:
    """Valida o token de e-mail e ativa a conta."""
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    if user.is_verified:
        return {"msg": "Email já verificado anteriormente."}

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[security.ALGORITHM])
        token_sub = payload.get("sub")
        if not token_sub or str(token_sub) != str(user.id):
            raise HTTPException(status_code=403, detail="Token inválido.")
    except (JWTError, ValueError):
        raise HTTPException(status_code=403, detail="Link inválido ou expirado.")

    user.is_verified = True
    db.add(user)
    db.commit()
    
    return {"msg": "Email verificado com sucesso!"}

# --------------------------------------------------------------------------------------
# CRIAÇÃO MANUAL (ADMIN)
# --------------------------------------------------------------------------------------

@router.post("/", response_model=UserSchema)
def create_user_admin_manual(
    *,
    db: Session = Depends(deps.get_db),
    user_in: UserCreate,
    current_user: User = Depends(deps.get_current_active_superuser), 
) -> Any:
    """Admin cria usuários manualmente."""
    user = db.query(User).filter(User.email == user_in.email).first()
    if user:
        raise HTTPException(status_code=400, detail="Email já existe.")
    
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