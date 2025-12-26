"""
=======================================================================================
ARQUIVO: config.py (Configurações Centrais do Sistema)
=======================================================================================

OBJETIVO:
    Centralizar o gerenciamento de todas as configurações, variáveis de ambiente e
    segredos da aplicação. Utiliza o Pydantic para validação de tipos e carregamento
    automático a partir de arquivos .env ou variáveis do sistema.

PARTE DO SISTEMA:
    Backend / Core (Infraestrutura).

RESPONSABILIDADES:
    1. Mapear variáveis de ambiente para atributos Python tipados.
    2. Definir valores padrão (defaults) para execução local ou desenvolvimento.
    3. Calcular caminhos absolutos de diretórios (essencial para Docker vs Local).
    4. Fornecer flags de feature (ex: SAAS vs SELF_HOSTED).
    5. Centralizar chaves de segurança (JWT, Criptografia, APIs).

COMUNICAÇÃO:
    - Importado por todo o sistema (DB, Auth, Services, Main) através da instância 'settings'.
    - Interage diretamente com o sistema de arquivos e o ambiente de execução (OS).

=======================================================================================
"""

import os
from pathlib import Path
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

# --------------------------------------------------------------------------------------
# RESOLUÇÃO DE CAMINHOS DO SISTEMA
# --------------------------------------------------------------------------------------
# Calcula o diretório raiz do projeto de forma dinâmica baseada na localização deste arquivo.
# Isso garante que referências a arquivos (como SQLite .db ou uploads) funcionem corretamente
# independente do diretório de trabalho atual (CWD), seja rodando localmente ou em contêineres Docker.
BASE_DIR = Path(__file__).resolve().parent.parent.parent

class Settings(BaseSettings):
    """
    Classe de configuração principal.
    O Pydantic lê automaticamente variáveis de ambiente (case-insensitive) que correspondam
    aos nomes dos atributos definidos aqui.
    """

    # Identificação da API
    PROJECT_NAME: str = "Bússola API"
    API_V1_STR: str = "/api/v1"
    
    # ----------------------------------------------------------------------------------
    # SEGURANÇA E CRIPTOGRAFIA
    # ----------------------------------------------------------------------------------
    # SECRET_KEY: Assinatura de tokens JWT e sessões. Comprometimento permite forjar identidade.
    SECRET_KEY: str
    
    # Tempo de vida do token. 8 dias é um padrão longo para conveniência em Apps Mobile/Web.
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8
    ALGORITHM: str = "HS256"

    # ENCRYPTION_KEY: Chave simétrica para criptografar dados sensíveis no banco (Data at Rest).
    # Usado pelo módulo 'app.core.security' ou serviços como o Cofre de Senhas.
    ENCRYPTION_KEY: str

    # ----------------------------------------------------------------------------------
    # INFRAESTRUTURA (DB & CACHE)
    # ----------------------------------------------------------------------------------
    # Connection strings para persistência e cache.
    DATABASE_URL: str
    REDIS_URL: str

    # ----------------------------------------------------------------------------------
    # SERVIÇOS DE IA E APIS EXTERNAS
    # ----------------------------------------------------------------------------------
    # Chaves obrigatórias para funcionalidades base (Clima, Notícias).
    OPENWEATHER_API_KEY: str
    NEWS_API_KEY: str
    
    # Chaves para os provedores de LLM.
    # Definidos como Optional para permitir que o sistema inicie mesmo sem todas as chaves,
    # falhando apenas se o serviço específico for invocado.
    GROQ_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None

    # Controle da Factory de IA:
    # LLM_PROVIDER define qual implementação será instanciada em 'app.services.ai.llm_factory'.
    # Isso permite trocar a inteligência do sistema inteiro mudando apenas esta variável.
    LLM_PROVIDER: str = "groq" 
    LLM_MODEL_NAME: Optional[str] = None # Se None, a Factory usa o modelo default do provedor.

    # ----------------------------------------------------------------------------------
    # REGRAS DE NEGÓCIO E DEPLOY
    # ----------------------------------------------------------------------------------
    # DEPLOYMENT_MODE: Define o comportamento macro do sistema.
    # - "SAAS": Pode ativar limites de uso, pagamentos e multi-tenancy estrito.
    # - "SELF_HOSTED": Pode liberar recursos premium e simplificar o registro.
    DEPLOYMENT_MODE: str = "SELF_HOSTED" 
    
    # Controle de acesso para novos usuários. Importante para instâncias privadas.
    ENABLE_PUBLIC_REGISTRATION: bool = True 

    # ----------------------------------------------------------------------------------
    # CONFIGURAÇÃO DE E-MAIL (SMTP)
    # ----------------------------------------------------------------------------------
    MAIL_USERNAME: Optional[str] = None
    MAIL_PASSWORD: Optional[str] = None
    MAIL_FROM: Optional[str] = None
    MAIL_PORT: int = 587
    MAIL_SERVER: Optional[str] = None
    MAIL_STARTTLS: bool = True
    MAIL_SSL_TLS: bool = False

    @property
    def EMAILS_ENABLED(self) -> bool:
        """
        Verifica se a infraestrutura mínima para envio de e-mails está configurada.
        Utilizado para evitar tentativas de conexão SMTP falhas e ocultar UI relacionada a e-mail.
        """
        return bool(self.MAIL_SERVER and self.MAIL_USERNAME and self.MAIL_PASSWORD)

    # ----------------------------------------------------------------------------------
    # INTEGRAÇÕES DE TERCEIROS (Auth Social, Pagamentos, Chatops)
    # ----------------------------------------------------------------------------------
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    STRIPE_SECRET_KEY: Optional[str] = None
    STRIPE_WEBHOOK_SECRET: Optional[str] = None
    DISCORD_BOT_TOKEN: Optional[str] = None
    DISCORD_CLIENT_ID: Optional[str] = None
    
    # ----------------------------------------------------------------------------------
    # REDE E ARQUIVOS
    # ----------------------------------------------------------------------------------
    # CORS: Lista de origens permitidas para requisições browser-based.
    # Deve incluir o endereço do Frontend em desenvolvimento e produção.
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173", 
        "http://localhost:3000", 
        "http://127.0.0.1:5173"
    ]
    
    # Diretório para armazenamento de arquivos estáticos (uploads, jsons de dados).
    # Usa BASE_DIR para garantir o caminho correto dentro e fora do Docker.
    DATA_DIR: str = os.path.join(str(BASE_DIR), "data")

    # Configuração do Pydantic para carregar o arquivo .env
    model_config = SettingsConfigDict(
        env_file=".env", 
        env_ignore_empty=True,
        extra="ignore" # Ignora variáveis extras no .env que não estão nesta classe
    )

# Instância única exportada para uso em todo o projeto
settings = Settings()