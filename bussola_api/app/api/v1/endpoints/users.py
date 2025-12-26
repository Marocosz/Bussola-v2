"""
=======================================================================================
ARQUIVO: users.py (Endpoints de Gestão de Usuários)
=======================================================================================

OBJETIVO:
    Gerenciar o ciclo de vida dos usuários, desde o registro público até a gestão
    do próprio perfil e ações administrativas.

PARTE DO SISTEMA:
    Backend / API Layer / Endpoints

RESPONSABILIDADES:
    1. CRUD do próprio usuário (/me) com validação de senha atual para mudanças críticas.
    2. Registro público (/open) com lógica adaptativa para SaaS (Verificação Obrigatória)
       ou Self-Hosted (Verificação Automática).
    3. Confirmação de E-mail via token.
    4. Criação manual de usuários por Admins.

COMUNICAÇÃO:
    - Chama: app.core.security (Hash de senhas e Tokens).
    - Chama: app.utils.email (Disparo assíncrono).
    - Depende: app.models.user.

=======================================================================================
"""

from typing import Any, List, Optional
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
from app.core.security import get_password_hash, verify_password

# Import da função de email para fluxo de verificação
from app.utils.email import send_account_verification_email 

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
    """
    Atualiza dados do perfil.
    
    Regra de Segurança Crítica:
        Para alterar dados sensíveis (E-mail ou Senha) em contas 'locais',
        é OBRIGATÓRIO fornecer a 'current_password' para provar identidade.
        Isso evita sequestro de conta caso o usuário deixe o PC desbloqueado.
    """
    
    # 1. Validação de Segurança (Mudanças Sensíveis)
    if (new_password or (email and email != current_user.email)) and current_user.auth_provider == "local":
        if not current_password or not verify_password(current_password, current_user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A senha atual está incorreta. Confirmação necessária para alterações de segurança."
            )

    # 2. Atualização de campos de Perfil (Safe Fields)
    if full_name is not None:
        current_user.full_name = full_name
    if city is not None:
        current_user.city = city
    if news_preferences is not None:
        current_user.news_preferences = news_preferences

    # 3. Atualização de E-mail (Requer validação de unicidade)
    if email is not None and current_user.auth_provider == "local":
        if email != current_user.email:
            existing_user = db.query(User).filter(User.email == email).first()
            if existing_user:
                raise HTTPException(status_code=400, detail="Este e-mail já está em uso por outro usuário.")
            current_user.email = email

    # 4. Troca de Senha
    if new_password is not None and current_user.auth_provider == "local":
        current_user.hashed_password = get_password_hash(new_password)

    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user

# --------------------------------------------------------------------------------------
# REGISTRO PÚBLICO (SIGN UP)
# --------------------------------------------------------------------------------------

@router.post("/open", response_model=UserSchema)
async def create_user_open(
    *,
    db: Session = Depends(deps.get_db),
    user_in: UserCreate,
    background_tasks: BackgroundTasks
) -> Any:
    """
    Criação de nova conta pelo próprio usuário.
    
    Lógica de Deploy (SaaS vs Self-Hosted):
    - SaaS: Cria como 'is_verified=False' e envia e-mail de confirmação.
    - Self-Hosted:
        - 1º Usuário: Vira Admin (Superuser) e Verificado automaticamente.
        - Próximos: Criados como Verificados (para facilitar uso familiar/local),
          mas sem poderes de Admin.
    """
    user_count = db.query(User).count()
    is_saas = (settings.DEPLOYMENT_MODE == "SAAS")
    
    # Verifica flag global de permissão
    if not settings.ENABLE_PUBLIC_REGISTRATION:
        # Se já existe usuário admin, bloqueia novos registros
        if user_count > 0:
            raise HTTPException(
                status_code=403,
                detail="O registro público está desativado nesta instância.",
            )

    user = db.query(User).filter(User.email == user_in.email).first()
    if user:
        raise HTTPException(
            status_code=400,
            detail="Este e-mail já está cadastrado.",
        )

    # Definição de Permissões Iniciais
    if is_saas:
        # Ambiente Comercial: Ninguém é admin, verificação de e-mail obrigatória.
        is_admin = False
        should_be_verified = False
    else:
        # Ambiente Pessoal: O primeiro vira dono. Verificação de e-mail dispensada.
        is_admin = (user_count == 0)
        should_be_verified = True 

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

    # Disparo de E-mail Assíncrono (Background Task)
    if is_saas and not should_be_verified:
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

# --------------------------------------------------------------------------------------
# VERIFICAÇÃO DE CONTA
# --------------------------------------------------------------------------------------

@router.post("/verify-email", response_model=Any)
def verify_email(
    token: str, 
    email: EmailStr,
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Valida o token recebido por e-mail e ativa a conta (is_verified=True).
    Essencial para permitir o login em ambientes SaaS.
    """
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    if user.is_verified:
        return {"msg": "Email já verificado anteriormente."}

    try:
        # Decodifica JWT e valida se pertence ao usuário correto
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

# --------------------------------------------------------------------------------------
# CRIAÇÃO MANUAL (ADMIN)
# --------------------------------------------------------------------------------------

@router.post("/", response_model=UserSchema)
def create_user_admin_manual(
    *,
    db: Session = Depends(deps.get_db),
    user_in: UserCreate,
    # Apenas Superusuários podem acessar esta rota
    current_user: User = Depends(deps.get_current_active_superuser), 
) -> Any:
    """
    Permite que um Admin crie outros usuários manualmente, contornando
    as restrições de registro público.
    Útil para convidar membros da equipe ou família em ambiente fechado.
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
        is_verified=True, # Usuário criado por Admin é confiável
        auth_provider="local"
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return db_user