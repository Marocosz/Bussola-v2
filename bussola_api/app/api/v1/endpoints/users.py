from typing import Any, List
from datetime import timedelta

# [NOVO] Imports para manipulação de Token e validação
from jose import jwt, JWTError
from fastapi import APIRouter, Body, Depends, HTTPException, status
from fastapi.encoders import jsonable_encoder
from pydantic.networks import EmailStr
from sqlalchemy.orm import Session

from app.api import deps
from app.core import security
from app.core.config import settings
from app.models.user import User
from app.schemas.user import User as UserSchema, UserCreate, UserUpdate
from app.core.security import get_password_hash

# [NOVO] Import da função de email (certifique-se que o arquivo existe em app/utils/email.py)
# Se você salvou em outro lugar, ajuste este import.
from app.utils.email import send_account_verification_email 

router = APIRouter()

# 1. Rota para ler os dados do PRÓPRIO usuário logado
@router.get("/me", response_model=UserSchema)
def read_user_me(
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    return current_user

# 2. Rota PÚBLICA de Registro
# [ATENÇÃO] Alterado para 'async def' para permitir envio de email
@router.post("/open", response_model=UserSchema)
async def create_user_open(
    *,
    db: Session = Depends(deps.get_db),
    user_in: UserCreate,
) -> Any:
    """
    Rota de registro público.
    Lógica de Segurança:
    1. Se for o 1º usuário: Cria VERIFICADO (True) e ADMIN.
    2. Demais usuários: Cria NÃO VERIFICADO (False) e envia e-mail com Token.
    """
    
    # --- LÓGICA DE PROTEÇÃO (SaaS vs Self-Hosted) ---
    user_count = db.query(User).count()
    
    if not settings.ENABLE_PUBLIC_REGISTRATION:
        # Se registro fechado, só permite se for o PRIMEIRO usuário (Instalação limpa)
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

    # --- DEFINIÇÃO DE PERMISSÕES INICIAIS ---
    is_first_user = (user_count == 0)
    
    # Se for o primeiro usuário (Admin), nasce verificado.
    # Se for usuário comum, nasce bloqueado (False).
    should_be_verified = is_first_user 

    db_user = User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        is_active=True,
        
        # Privilégios
        is_superuser=is_first_user, 
        is_premium=is_first_user, # 1º user ganha premium tbm
        
        # [NOVO] Segurança de Auth
        is_verified=should_be_verified, 
        auth_provider="local"
    )
    
    db.add(db_user)
    db.commit()
    db_user.refresh()

    # --- ENVIO DE EMAIL COM TOKEN REAL ---
    if not should_be_verified:
        try:
            # 1. Gera Token de Verificação (Válido por 24 horas)
            verify_token = security.create_access_token(
                subject=db_user.id, # O 'sub' do token é o ID do usuário
                expires_delta=timedelta(hours=24)
            )
            
            # 2. Envia o Email
            await send_account_verification_email(
                email_to=user_in.email, 
                token=verify_token
            )
        except Exception as e:
            # Logamos o erro mas não cancelamos a criação do usuário para não frustrar o user.
            # Idealmente, use um logger aqui (ex: logger.error(f"Email failed: {e}"))
            print(f"ERRO CRÍTICO AO ENVIAR EMAIL: {e}")
    
    return db_user

# 3. [NOVO] Rota para Verificar Email
@router.post("/verify-email", response_model=Any)
def verify_email(
    token: str, 
    email: EmailStr,
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Valida o email do usuário decodificando o Token JWT.
    """
    # 1. Busca usuário
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    if user.is_verified:
        return {"msg": "Email já verificado anteriormente."}

    # 2. Valida Token
    try:
        # [CORREÇÃO] Acessando a constante ALGORITHM agora definida em security
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[security.ALGORITHM]
        )
        token_sub = payload.get("sub") # ID do usuário dentro do token
        
        if not token_sub or str(token_sub) != str(user.id):
            raise HTTPException(status_code=403, detail="Token inválido para este usuário.")
            
    except (JWTError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="O link de verificação é inválido ou expirou."
        )

    # 3. Sucesso
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
        is_superuser=False, 
        
        # Admin criando manualmente -> Assume-se verificado e seguro
        is_verified=True,
        auth_provider="local"
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return db_user