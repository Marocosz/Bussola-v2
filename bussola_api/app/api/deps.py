from typing import Generator, Annotated
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.core import security
from app.core.config import settings
from app.db.session import SessionLocal
from app.models.user import User
from app.schemas.token import TokenPayload

# [CORREÇÃO] Ajustado para /login/access-token para bater com o router acima
reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/login/access-token"
)

# 1. Dependência de Banco de Dados
def get_db() -> Generator:
    try:
        db = SessionLocal()
        yield db
    finally:
        db.close()

# Alias para facilitar o uso nas rotas
SessionDep = Annotated[Session, Depends(get_db)]
TokenDep = Annotated[str, Depends(reusable_oauth2)]

# 2. Obter Usuário Atual (Validação de Token)
def get_current_user(session: SessionDep, token: TokenDep) -> User:
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        token_data = TokenPayload(**payload)
    except (JWTError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Não foi possível validar as credenciais",
        )
    
    # O token guarda o ID como string (sub), convertemos para int se necessário
    user = session.query(User).filter(User.id == int(token_data.sub)).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Usuário inativo")
        
    return user

# 3. Alias para Usuário Atual
CurrentUser = Annotated[User, Depends(get_current_user)]

# 4. Verificação de Super Usuário
def get_current_active_superuser(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Verifica se o usuário logado é um Super Administrador.
    """
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=403, 
            detail="Privilégios insuficientes. Apenas administradores podem realizar esta ação."
        )
    return current_user