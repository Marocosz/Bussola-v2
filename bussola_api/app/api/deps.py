"""
=======================================================================================
ARQUIVO: deps.py (Dependências da API)
=======================================================================================

OBJETIVO:
    Centralizar as dependências injetáveis do FastAPI. Gerencia o ciclo de vida da 
    sessão do banco de dados, a lógica de autenticação (JWT) e a verificação de permissões.

PARTE DO SISTEMA:
    Backend / API Core / Security

RESPONSABILIDADES:
    1. Prover sessões de banco de dados isoladas por requisição.
    2. Decodificar e validar tokens JWT.
    3. Recuperar o usuário atual do banco de dados.
    4. Aplicar regras de negócio de segurança (ex: bloquear usuários inativos).
    5. Autorizar acesso administrativo (Superuser).

COMUNICAÇÃO:
    - Utilizado por: Todos os Endpoints (routers) da API.
    - Conecta com: app.core.security (JWT), app.db (Session), app.models (User).

=======================================================================================
"""

from typing import Generator, Annotated
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from pydantic import ValidationError
from sqlalchemy.orm import Session
import redis

from app.core import security
from app.core.config import settings
from app.db.session import SessionLocal
from app.models.user import User
from app.schemas.token import TokenPayload

# Configura o esquema de segurança OAuth2.
# Define a URL que o Swagger UI utilizará para obter o token de acesso.
reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/login/access-token"
)

# Conexão Global com Redis (Connection Pool)
redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)

def get_db() -> Generator:
    """
    Gerencia o ciclo de vida da sessão do banco de dados.
    
    Por que existe:
        Garante que cada requisição tenha sua própria sessão isolada e,
        crucialmente, que a conexão seja fechada (db.close) após o término
        da requisição, mesmo em caso de erros.
    """
    try:
        db = SessionLocal()
        yield db
    finally:
        db.close()

# Alias para injeção de dependência limpa nas rotas
SessionDep = Annotated[Session, Depends(get_db)]
TokenDep = Annotated[str, Depends(reusable_oauth2)]

def get_current_user(session: SessionDep, token: TokenDep) -> User:
    """
    Autentica a requisição validando o Token JWT e recuperando o usuário.

    Regras de Negócio e Segurança:
    1. Valida a assinatura do JWT usando a SECRET_KEY.
    2. [NOVO] Verifica se o token está na BLACKLIST do Redis (Logout).
    3. Converte o 'sub' do token para buscar o usuário no banco.
    4. Garante que o usuário ainda existe no banco.
    5. Garante que o usuário está ATIVO (bloqueia acesso de usuários banidos/inativos
       mesmo que possuam um token válido).

    Retorna:
        User: Instância do usuário autenticado.
    """
    
    # [CHECK BLACKLIST] Se o token foi revogado, nega acesso instantaneamente.
    if redis_client.exists(f"blacklist:{token}"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessão revogada. Faça login novamente.",
        )

    try:
        # Decodifica e valida assinatura/expiração do token
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        token_data = TokenPayload(**payload)
        
        # [CHECK TYPE] Garante que é um Access Token, não Refresh
        if payload.get("type") != "access":
             raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Tipo de token inválido para acesso.",
            )

    except (JWTError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Não foi possível validar as credenciais",
        )
    
    # Busca o usuário pelo ID contido no 'sub' do token
    user = session.query(User).filter(User.id == int(token_data.sub)).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    # Regra de Segurança: Impede login de usuários desativados logicamente
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Usuário inativo")
        
    return user

# Alias para injeção direta do usuário autenticado nas rotas
CurrentUser = Annotated[User, Depends(get_current_user)]

def get_current_active_superuser(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Middleware de autorização para rotas administrativas.

    Lógica:
        Aproveita a autenticação já feita por 'get_current_user' e adiciona
        uma camada extra de verificação da flag 'is_superuser'.
    
    Retorna:
        User: O usuário admin, ou lança 403 se não tiver permissão.
    """
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=403, 
            detail="Privilégios insuficientes. Apenas administradores podem realizar esta ação."
        )
    return current_user