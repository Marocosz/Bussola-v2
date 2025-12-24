import os
from pathlib import Path
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

# [NOVO] Define a raiz do projeto dinamicamente
# __file__ = app/core/config.py
# .parent  = app/core
# .parent  = app
# .parent  = raiz do projeto (bussola_api)
BASE_DIR = Path(__file__).resolve().parent.parent.parent

class Settings(BaseSettings):
    # Informações Básicas
    PROJECT_NAME: str = "Bússola API"
    API_V1_STR: str = "/api/v1"
    
    # Segurança
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 dias
    ALGORITHM: str = "HS256"

    # Banco de Dados
    DATABASE_URL: str

    # Chaves de API (IA e Externas - Obrigatórias para funcionamento base)
    GROQ_API_KEY: str
    OPENWEATHER_API_KEY: str
    NEWS_API_KEY: str
    
    # Configurações do Redis
    REDIS_URL: str

    # Segurança de Dados
    ENCRYPTION_KEY: str
    
    GROQ_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None

    # Configuração da IA
    # Opções: "groq", "gemini", "openai"
    LLM_PROVIDER: str = "groq" 
    LLM_MODEL_NAME: Optional[str] = None # Se None, usa o default do factory

    # =========================================================
    # CONFIGURAÇÕES DE MODO (SAAS vs SELF-HOSTED)
    # =========================================================
    DEPLOYMENT_MODE: str = "SELF_HOSTED" 
    ENABLE_PUBLIC_REGISTRATION: bool = True 

    # Configurações de E-mail
    MAIL_USERNAME: Optional[str] = None
    MAIL_PASSWORD: Optional[str] = None
    MAIL_FROM: Optional[str] = None
    MAIL_PORT: int = 587
    MAIL_SERVER: Optional[str] = None
    MAIL_STARTTLS: bool = True
    MAIL_SSL_TLS: bool = False

    @property
    def EMAILS_ENABLED(self) -> bool:
        return bool(self.MAIL_SERVER and self.MAIL_USERNAME and self.MAIL_PASSWORD)

    # =========================================================
    # INTEGRAÇÕES OPCIONAIS
    # =========================================================
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    STRIPE_SECRET_KEY: Optional[str] = None
    STRIPE_WEBHOOK_SECRET: Optional[str] = None
    DISCORD_BOT_TOKEN: Optional[str] = None
    DISCORD_CLIENT_ID: Optional[str] = None
    
    

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173", 
        "http://localhost:3000", 
        "http://127.0.0.1:5173"
    ]
    
    # [NOVO] Caminho para dados estáticos (Json, uploads, etc)
    # Isso garante que funcione no Docker ou Local
    DATA_DIR: str = os.path.join(str(BASE_DIR), "data")

    # Carrega as variáveis do arquivo .env automaticamente
    model_config = SettingsConfigDict(
        env_file=".env", 
        env_ignore_empty=True,
        extra="ignore"
    )

settings = Settings()