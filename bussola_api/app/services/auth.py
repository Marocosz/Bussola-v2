from datetime import timedelta
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
import requests
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
        user = self.session.query(User).filter(User.email == email).first()
        
        if not user or not security.verify_password(password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email ou senha incorretos",
            )
        
        if not user.is_active:
            raise HTTPException(status_code=400, detail="Usuário inativo")

        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        return Token(
            access_token=security.create_access_token(
                user.id, expires_delta=access_token_expires
            ),
            token_type="bearer",
        )

    def authenticate_google(self, google_token: str) -> Token:
        # 1. Valida Google
        try:
            google_response = requests.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {google_token}"}
            )
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Falha ao conectar com Google: {str(e)}")
        
        if google_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Token do Google inválido ou expirado.")
            
        user_info = google_response.json()
        email = user_info.get("email")
        name = user_info.get("name")
        
        if not email:
            raise HTTPException(status_code=400, detail="Token do Google não contém e-mail.")

        # 2. Busca ou Cria
        user = self.session.query(User).filter(User.email == email).first()

        if not user:
            random_password = secrets.token_urlsafe(16)
            user = User(
                email=email,
                full_name=name if name else email.split("@")[0],
                hashed_password=security.get_password_hash(random_password),
                is_active=True,
                is_superuser=False,
                is_premium=False 
            )
            self.session.add(user)
            self.session.commit()
            self.session.refresh(user)
        
        elif not user.is_active:
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
        
        # [NOVO] Lógica SaaS vs Self-Hosted
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
        
        # Tenta enviar e-mail real se configurado
        if settings.EMAILS_ENABLED:
            try:
                await send_password_reset_email(email_to=user.email, token=reset_token)
                return "Email de recuperação enviado."
            except Exception as e:
                print(f"Erro SMTP: {e}")
        
        # [MODIFICADO] Fallback Terminal para Self-Hosted
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