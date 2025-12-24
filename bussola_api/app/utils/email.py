from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from app.core.config import settings
from pathlib import Path
import os
from dotenv import load_dotenv

load_dotenv()

# Criamos a configuração apenas com valores que não quebram a validação do Pydantic
# Se as variáveis não existirem, usamos strings vazias para evitar o erro de 'NoneType'
conf = ConnectionConfig(
    MAIL_USERNAME=settings.MAIL_USERNAME or "none",
    MAIL_PASSWORD=settings.MAIL_PASSWORD or "none",
    MAIL_FROM=settings.MAIL_FROM or "noreply@bussola.com",
    MAIL_PORT=settings.MAIL_PORT or 587,
    MAIL_SERVER=settings.MAIL_SERVER or "localhost",
    MAIL_STARTTLS=settings.MAIL_STARTTLS,
    MAIL_SSL_TLS=settings.MAIL_SSL_TLS,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True
)

async def send_password_reset_email(email_to: str, token: str):
    """
    Envia email com link de recuperação.
    """
    # Link que aponta para o Frontend
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    reset_link = f"{frontend_url}/reset-password?token={token}"

    html = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                <h2 style="color: #333;">Recuperação de Senha - Bússola</h2>
                <p>Olá,</p>
                <p>Recebemos uma solicitação para redefinir sua senha.</p>
                <p>Clique no botão abaixo para criar uma nova senha:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{reset_link}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                        Redefinir Minha Senha
                    </a>
                </div>
                <p style="font-size: 12px; color: #666;">Se você não solicitou isso, ignore este e-mail. O link expira em breve.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="font-size: 12px; color: #999;">Equipe Bússola</p>
            </div>
        </body>
    </html>
    """
    
    message = MessageSchema(
        subject="Recuperação de Senha - Bússola",
        recipients=[email_to],
        body=html,
        subtype=MessageType.html
    )

    fm = FastMail(conf)
    await fm.send_message(message)

async def send_account_verification_email(email_to: str, token: str):
    """
    Envia email de confirmação de conta.
    """
    # Link que aponta para o Frontend
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    
    # URL para onde o usuário será enviado no React
    verify_link = f"{frontend_url}/verify-email?token={token}&email={email_to}"

    html = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                <h2 style="color: #333;">Bem-vindo ao Bússola!</h2>
                <p>Olá,</p>
                <p>Obrigado por se cadastrar. Para garantir a segurança da sua conta, precisamos confirmar seu endereço de e-mail.</p>
                <p>Clique no botão abaixo para verificar sua conta:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{verify_link}" style="background-color: #10B981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                        Confirmar Meu E-mail
                    </a>
                </div>
                <p style="font-size: 12px; color: #666;">Se você não criou uma conta no Bússola, por favor ignore este e-mail.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="font-size: 12px; color: #999;">Equipe Bússola</p>
            </div>
        </body>
    </html>
    """

    message = MessageSchema(
        subject="Confirmação de E-mail - Bússola",
        recipients=[email_to],
        body=html,
        subtype=MessageType.html
    )

    fm = FastMail(conf)
    await fm.send_message(message)