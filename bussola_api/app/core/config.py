from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

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

    # =========================================================
    # CONFIGURAÇÕES DE MODO (SAAS vs SELF-HOSTED)
    # =========================================================
    # Define se é "SAAS" ou "SELF_HOSTED"
    DEPLOYMENT_MODE: str = "SELF_HOSTED" 
    
    # Define se o registro é aberto (SaaS) ou fechado (Self-Hosted após setup)
    ENABLE_PUBLIC_REGISTRATION: bool = True 

    # =========================================================
    # INTEGRAÇÕES OPCIONAIS (SaaS / Premium)
    # =========================================================
    # Login Social (Google)
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None

    # Pagamentos (Stripe)
    STRIPE_SECRET_KEY: Optional[str] = None
    STRIPE_WEBHOOK_SECRET: Optional[str] = None

    # Discord Bot
    DISCORD_BOT_TOKEN: Optional[str] = None
    DISCORD_CLIENT_ID: Optional[str] = None

    # CORS (Permitir que o React acesse o Backend)
    # Por padrão permite localhost:5173 (Vite) e localhost:3000 (React padrão)
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173", 
        "http://localhost:3000", 
        "http://127.0.0.1:5173"
    ]

    # Carrega as variáveis do arquivo .env automaticamente
    model_config = SettingsConfigDict(
        env_file=".env", 
        env_ignore_empty=True,
        extra="ignore" # Ignora variáveis extras no .env que não estejam listadas aqui
    )

settings = Settings()