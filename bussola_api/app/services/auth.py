from datetime import timedelta
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
import httpx # [MUDANÇA] Alterado de requests para httpx para suportar async
import secrets
from jose import jwt, JWTError

from app.models.user import User
from app.schemas.user import UserCreate, NewPassword
from app.schemas.token import Token
from app.core import security
from app.core.config import settings
from app.utils.email import send_password_reset_email

class AuthService:
    def __init__(self, session: Session):
        self.session = session

    def authenticate_user(self, email: str, password: str) -> Token:
        # 1. Busca Usuário
        user = self.session.query(User).filter(User.email == email).first()
        
        # 2. Verifica Credenciais
        if not user or not user.hashed_password or not security.verify_password(password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email ou senha incorretos.",
            )
        
        # 3. Verifica Status
        if not user.is_active:
            raise HTTPException(status_code=400, detail="Usuário inativo.")

        # 4. [LÓGICA SAAS VS SELF-HOSTED] (Movida da Rota para cá)
        if settings.DEPLOYMENT_MODE == "SAAS" and not user.is_verified:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, 
                detail="Seu e-mail ainda não foi verificado. Verifique sua caixa de entrada."
            )

        # 5. Gera Token
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        return Token(
            access_token=security.create_access_token(
                user.id, expires_delta=access_token_expires
            ),
            token_type="bearer",
        )

    async def authenticate_google(self, google_token: str) -> Token:
        # 1. Valida token na API do Google (Logica movida da Rota)
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

        # 2. Busca, Cria ou Atualiza Usuário
        user = self.session.query(User).filter(User.email == email).first()

        if not user:
            # Criação de novo usuário via Google
            user = User(
                email=email,
                full_name=name,
                avatar_url=picture,
                auth_provider="google",
                provider_id=google_sub,
                is_verified=True, 
                is_active=True,
                hashed_password=None # Google users não tem senha local
            )
            self.session.add(user)
            self.session.commit()
            self.session.refresh(user)
        else:
            # Atualização de usuário existente (Account Linking)
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

        # 3. Gera Token
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        return Token(
            access_token=security.create_access_token(
                user.id, expires_delta=access_token_expires
            ),
            token_type="bearer",
        )

    def register_user(self, user_in: UserCreate) -> User:
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

    async def recover_password(self, email: str) -> str:
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

    def reset_password(self, payload: NewPassword) -> str:
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