"""
=======================================================================================
ARQUIVO: auth.py (Serviço de Autenticação)
=======================================================================================

OBJETIVO:
    Centralizar toda a lógica de negócio relacionada à identidade do usuário, login,
    registro e recuperação de acesso. Este serviço atua como a "ponte" entre os 
    endpoints da API (Rotas) e os dados do usuário (Models).

PARTE DO SISTEMA:
    Backend / Service Layer.

RESPONSABILIDADES:
    1. Autenticação Local (Email/Senha): Validação de hash e emissão de tokens.
    2. Autenticação Social (Google): Validação de token externo e Account Linking.
    3. Registro de Usuários: Criação de contas com regras de permissão (Admin/Comum).
    4. Gestão de Senhas: Fluxo de "Esqueci minha senha" e redefinição segura.

COMUNICAÇÃO:
    - Models: app.models.user.User
    - Utils: app.core.security (Hashing/JWT), app.utils.email (Disparo de emails)
    - Externo: Google OAuth API (via httpx)

=======================================================================================
"""

from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
import httpx 
import secrets
from jose import jwt, JWTError

from app.models.user import User
from app.schemas.user import UserCreate, NewPassword
from app.schemas.token import Token
from app.core import security
from app.core.config import settings
from app.utils.email import send_password_reset_email
from app.api.deps import redis_client # Import do Redis

class AuthService:
    """
    Classe de serviço para gerenciamento de autenticação.
    Instanciada por injeção de dependência nas rotas, recebendo a sessão do banco.
    """
    def __init__(self, session: Session):
        self.session = session

    def _create_tokens(self, user_id: int) -> Token:
        """Helper interno para gerar o par de tokens."""
        access_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        refresh_expires = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        
        return Token(
            access_token=security.create_access_token(user_id, expires_delta=access_expires),
            refresh_token=security.create_refresh_token(user_id, expires_delta=refresh_expires),
            token_type="bearer",
        )

    # ----------------------------------------------------------------------------------
    # AUTENTICAÇÃO LOCAL (LOGIN)
    # ----------------------------------------------------------------------------------
    def authenticate_user(self, email: str, password: str) -> Token:
        """
        Realiza o login tradicional (E-mail e Senha).

        Regras de Negócio:
        1. Verifica se o hash da senha bate com o banco.
        2. Verifica se o usuário está ativo (não banido).
        3. No modo SAAS, exige que o e-mail tenha sido verificado antes de logar.

        Retorna:
            Token: Objeto contendo o access_token, refresh_token e tipo.
        """
        # 1. Busca Usuário
        user = self.session.query(User).filter(User.email == email).first()
        
        # 2. Verifica Credenciais (Hash seguro)
        if not user or not user.hashed_password or not security.verify_password(password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email ou senha incorretos.",
            )
        
        # 3. Verifica Status (Soft Delete / Banimento)
        if not user.is_active:
            raise HTTPException(status_code=400, detail="Usuário inativo.")

        # 4. REGRA DE DEPLOY (SAAS vs SELF-HOSTED)
        if settings.DEPLOYMENT_MODE == "SAAS" and not user.is_verified:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, 
                detail="Seu e-mail ainda não foi verificado. Verifique sua caixa de entrada."
            )

        # 5. Gera e Retorna os Tokens
        return self._create_tokens(user.id)

    # ----------------------------------------------------------------------------------
    # AUTENTICAÇÃO SOCIAL (GOOGLE OAUTH)
    # ----------------------------------------------------------------------------------
    async def authenticate_google(self, google_token: str) -> Token:
        """
        Realiza login ou cadastro via Google.
        """
        
        # 1. VALIDAÇÃO EXTERNA
        google_user_info = None
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    "https://www.googleapis.com/oauth2/v3/userinfo",
                    headers={"Authorization": f"Bearer {google_token}"}
                )
                if response.status_code != 200:
                    raise HTTPException(status_code=400, detail="Token do Google inválido ou expirado.")
                google_user_info = response.json()
            except Exception as e:
                print(f"Erro conexão Google: {e}")
                raise HTTPException(status_code=400, detail="Falha ao conectar com o Google.")
        
        email = google_user_info.get("email")
        google_sub = google_user_info.get("sub") 
        name = google_user_info.get("name")
        picture = google_user_info.get("picture")

        if not email:
             raise HTTPException(status_code=400, detail="Google não retornou o e-mail.")
        
        # [NOVO] Verifica se o email é verificado no Google
        if not google_user_info.get("email_verified"):
             raise HTTPException(status_code=400, detail="O e-mail do Google não está verificado.")

        # 2. GESTÃO DO USUÁRIO
        user = self.session.query(User).filter(User.email == email).first()

        if not user:
            # CASO A: Novo Usuário
            user = User(
                email=email,
                full_name=name,
                avatar_url=picture,
                auth_provider="google",
                provider_id=google_sub,
                is_verified=True, 
                is_active=True,
                hashed_password=None
            )
            self.session.add(user)
            self.session.commit()
            self.session.refresh(user)
        else:
            # CASO B: Usuário Existente
            updated = False
            if not user.is_verified:
                user.is_verified = True
                updated = True
            
            if not user.provider_id:
                user.provider_id = google_sub
                user.auth_provider = "hybrid" if user.hashed_password else "google"
                updated = True
            
            if not user.avatar_url and picture:
                user.avatar_url = picture
                updated = True
                
            if updated:
                self.session.add(user)
                self.session.commit()
                self.session.refresh(user)
        
        if not user.is_active:
            raise HTTPException(status_code=400, detail="Usuário inativo.")

        # 3. GERAÇÃO DE TOKENS
        return self._create_tokens(user.id)

    # ----------------------------------------------------------------------------------
    # REFRESH TOKEN FLOW (RENOVAÇÃO)
    # ----------------------------------------------------------------------------------
    def refresh_token(self, refresh_token: str) -> Token:
        """
        Valida o Refresh Token e emite um novo par Access/Refresh.
        """
        # Checa Blacklist
        if redis_client.exists(f"blacklist:{refresh_token}"):
            raise HTTPException(status_code=401, detail="Refresh token revogado.")

        try:
            payload = jwt.decode(refresh_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            
            if payload.get("type") != "refresh":
                raise HTTPException(status_code=401, detail="Token inválido (não é refresh).")
                
            user_id = payload.get("sub")
            if not user_id:
                raise HTTPException(status_code=401, detail="Token inválido.")
                
        except (JWTError, ValueError):
            raise HTTPException(status_code=401, detail="Refresh token expirado ou inválido.")

        # Opcional: Rotacionar o Refresh Token (Segurança Máxima)
        # Queimamos o anterior e emitimos um novo.
        self.logout(refresh_token) # Revoga o atual
        
        return self._create_tokens(int(user_id))

    # ----------------------------------------------------------------------------------
    # LOGOUT (REVOGAÇÃO)
    # ----------------------------------------------------------------------------------
    def logout(self, token: str) -> None:
        """
        Adiciona o token à Blacklist do Redis até sua expiração natural.
        """
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            # Calcula tempo restante de vida (TTL)
            exp_timestamp = payload.get("exp")
            now_timestamp = datetime.now(timezone.utc).timestamp()
            ttl = int(exp_timestamp - now_timestamp)
            
            if ttl > 0:
                redis_client.setex(f"blacklist:{token}", ttl, "revoked")
                
        except Exception:
            # Se token já inválido, ignora erro
            pass

    # ----------------------------------------------------------------------------------
    # REGISTRO DE USUÁRIO (SIGN UP)
    # ----------------------------------------------------------------------------------
    def register_user(self, user_in: UserCreate) -> User:
        """
        Cria uma nova conta no sistema.

        Regras de Negócio Importantes:
        1. Controle de Registro Público: Verifica se novos cadastros estão liberados no .env.
        2. Primeiro Usuário = Admin: Em instalações Self-Hosted, o primeiro registro
           ganha privilégios de Superusuário automaticamente.
        3. E-mail Único: Impede duplicidade.
        """
        user_count = self.session.query(User).count()
        
        if not settings.ENABLE_PUBLIC_REGISTRATION:
            if user_count > 0:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="O registro público está fechado nesta instância."
                )

        existing_user = self.session.query(User).filter(User.email == user_in.email).first()
        if existing_user:
            raise HTTPException(
                status_code=400,
                detail="Este e-mail já está cadastrado no sistema.",
            )
        
        is_saas = (settings.DEPLOYMENT_MODE == "SAAS")
        is_admin = (not is_saas and user_count == 0)
        should_be_verified = not is_saas or is_admin

        db_user = User(
            email=user_in.email,
            hashed_password=security.get_password_hash(user_in.password),
            full_name=user_in.full_name,
            is_active=True,
            is_superuser=is_admin, 
            is_premium=is_admin,
            is_verified=should_be_verified
        )
        
        self.session.add(db_user)
        self.session.commit()
        self.session.refresh(db_user)
        
        return db_user

    # ----------------------------------------------------------------------------------
    # RECUPERAÇÃO DE SENHA (FORGOT PASSWORD)
    # ----------------------------------------------------------------------------------
    async def recover_password(self, email: str) -> str:
        """
        Inicia o fluxo de recuperação de senha.
        """
        user = self.session.query(User).filter(User.email == email).first()

        if not user:
            return "Se o email estiver cadastrado, as instruções foram enviadas."

        password_reset_expires = timedelta(minutes=15)
        reset_token = security.create_access_token(
            user.id, expires_delta=password_reset_expires
        )
        
        if settings.EMAILS_ENABLED:
            try:
                await send_password_reset_email(email_to=user.email, token=reset_token)
                return "Email de recuperação enviado."
            except Exception as e:
                print(f"Erro SMTP: {e}")
        
        if settings.DEPLOYMENT_MODE == "SELF_HOSTED":
            print("\n" + "="*60)
            print(f"RECUPERAÇÃO DE SENHA (SELF-HOSTED) PARA: {user.email}")
            print(f"LINK: http://localhost:5173/reset-password?token={reset_token}")
            print("="*60 + "\n")
            return "SISTEMA_LOCAL_SEM_EMAIL"

        raise HTTPException(
            status_code=500,
            detail="Falha ao enviar e-mail de recuperação."
        )

    # ----------------------------------------------------------------------------------
    # REDEFINIÇÃO DE SENHA (RESET PASSWORD)
    # ----------------------------------------------------------------------------------
    def reset_password(self, payload: NewPassword) -> str:
        """
        Finaliza a troca de senha usando um token válido.
        """
        try:
            decoded_token = jwt.decode(
                payload.token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
            )
            user_id = decoded_token.get("sub")
            if not user_id:
                raise HTTPException(status_code=400, detail="Token inválido")
        except JWTError:
            raise HTTPException(status_code=400, detail="Token expirado ou inválido")
            
        user = self.session.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")
            
        if not user.is_active:
            raise HTTPException(status_code=400, detail="Usuário inativo")
            
        user.hashed_password = security.get_password_hash(payload.new_password)
        self.session.add(user)
        self.session.commit()
        
        return "Senha alterada com sucesso."