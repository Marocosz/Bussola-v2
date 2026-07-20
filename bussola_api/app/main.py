"""
=======================================================================================
ARQUIVO: main.py (Ponto de Entrada da Aplicação)
=======================================================================================

OBJETIVO:
    Inicializar a aplicação FastAPI, configurar middlewares essenciais (como CORS),
    garantir a criação da estrutura do banco de dados e registrar as rotas da API.

PARTE DO SISTEMA:
    Backend / Entrypoint.

RESPONSABILIDADES:
    1. Carregar variáveis de ambiente (.env) antes de qualquer outra configuração.
    2. Inicializar o banco de dados (criar tabelas se não existirem).
    3. Instanciar o servidor FastAPI com metadados do projeto.
    4. Configurar segurança de acesso via navegador (CORS).
    5. Centralizar e incluir todas as rotas (endpoints) da versão v1.

COMUNICAÇÃO:
    - Importa configurações de: app.core.config.
    - Importa rotas de: app.api.v1.router.
    - Importa infraestrutura de banco de: app.db.session e app.db.base.

=======================================================================================
"""

# --- INICIALIZAÇÃO DE AMBIENTE ---
# É crucial que o 'dotenv' seja carregado antes de importar 'app.core.config'.
# Isso garante que a classe Settings leia o arquivo .env local corretamente
# antes de tentar acessar variáveis de ambiente.
from dotenv import load_dotenv
import os

load_dotenv()
# Logging deve ser inicializado antes de qualquer outra importação que possa logar
from app.core.config import settings as _settings_for_logging
from app.core.logging_config import setup_logging
setup_logging(_settings_for_logging.LOG_LEVEL)
# -------------------------------------

from fastapi import FastAPI
from fastapi.responses import HTMLResponse # Necessário para servir o HTML do Scalar
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.api.v1.router import api_router
from app.db.session import engine
# Importamos 'base' para garantir que todos os Models sejam lidos pelo SQLAlchemy
from app.db import base
import logging
from fastapi import Request
from fastapi.responses import JSONResponse
from app.api.middleware.logging_middleware import RequestLoggingMiddleware

# --------------------------------------------------------------------------------------
# INICIALIZAÇÃO DO BANCO DE DADOS
# --------------------------------------------------------------------------------------
# create_all cria as tabelas que ainda não existem (idempotente). É o criador de
# tabelas no boot deste deploy; o Alembic mantém o histórico/evolução do schema.
#
# GOVERNANÇA (importante):
#   - `create_all` NÃO altera tabelas existentes (não adiciona colunas). Mudanças de
#     schema em tabelas já criadas DEVEM ir por migration Alembic aplicada em prod.
#   - Caminho para tornar o Alembic autoritativo no boot (evita a ambiguidade de duas
#     fontes de verdade), SEM derrubar prod (ver ~/.claude/COOLIFY-DEPLOY-CHECKLIST 7.6½):
#       1) `alembic stamp head` no container de prod (marca a versão atual, já que as
#          tabelas foram criadas por create_all e o alembic_version pode estar atrás);
#       2) depois: rodar `alembic upgrade head` no entrypoint + SKIP_DB_CREATE_ALL=1.
#
# SKIP_DB_CREATE_ALL=1 desliga o create_all (usado nos testes, que criam o próprio
# schema em SQLite in-memory, e ao rodar `alembic revision --autogenerate`).
if os.getenv("SKIP_DB_CREATE_ALL", "").lower() not in ("1", "true", "yes"):
    base.Base.metadata.create_all(bind=engine)

# --------------------------------------------------------------------------------------
# DEFINIÇÃO DA APLICAÇÃO
# --------------------------------------------------------------------------------------
app = FastAPI(
    title=settings.PROJECT_NAME,
    # Define a URL onde o JSON do OpenAPI (Swagger) será servido
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    
    # [DOCUMENTAÇÃO PADRÃO] 
    # Mantemos o Swagger UI ativo na rota padrão (/docs) e o ReDoc em (/redoc)
    # para testes rápidos e compatibilidade.
    docs_url="/docs",
    redoc_url="/redoc"
)

# --------------------------------------------------------------------------------------
# RATE LIMITING (SLOWAPI) - [NOVO]
# --------------------------------------------------------------------------------------
# Inicializa o Limiter usando o endereço IP remoto como chave de contagem.
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# --------------------------------------------------------------------------------------
# HANDLER GLOBAL DE ERROS
# --------------------------------------------------------------------------------------
_logger = logging.getLogger("api.main")

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    request_id = getattr(request.state, "request_id", "unknown")
    _logger.critical(
        "Erro interno não tratado",
        extra={
            "request_id": request_id,
            "path": request.url.path,
            "error_type": type(exc).__name__,
            "error": str(exc),
        },
        exc_info=True,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Erro interno do servidor.", "request_id": request_id},
    )

# --------------------------------------------------------------------------------------
# CONFIGURAÇÃO DE SEGURANÇA (CORS)
# --------------------------------------------------------------------------------------
# O CORS (Cross-Origin Resource Sharing) permite que o navegador (Frontend)
# faça requisições para este Backend, mesmo estando em portas/domínios diferentes 
# (ex: Frontend em localhost:5173 e Backend em localhost:8000).
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        # Lista de origens permitidas (definida no .env/config)
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        # DEV: libera qualquer porta localhost/127.0.0.1 (o Vite pode subir em
        # 5173, 5174, 5175… conforme a porta esteja livre). Nunca casa com o
        # domínio de produção, então é seguro manter aqui.
        allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
        # Permite envio de cookies/credenciais
        allow_credentials=True,
        # Permite todos os métodos HTTP (GET, POST, PUT, DELETE, etc)
        allow_methods=["*"],
        # Permite todos os headers
        allow_headers=["*"],
    )

# --------------------------------------------------------------------------------------
# LOGGING DE REQUISIÇÕES
# --------------------------------------------------------------------------------------
app.add_middleware(RequestLoggingMiddleware)

# --------------------------------------------------------------------------------------
# DOCUMENTAÇÃO ALTERNATIVA (SCALAR)
# --------------------------------------------------------------------------------------
# Adiciona uma rota separada (/scalar) para servir a interface moderna do Scalar.
# Ela consome o mesmo 'openapi.json' que o Swagger, mas oferece uma UX diferente.
@app.get("/scalar", include_in_schema=False)
async def scalar_html():
    """
    Renderiza a documentação da API utilizando a interface Scalar.
    Acessível em: http://localhost:8000/scalar
    """
    openapi_url = f"{settings.API_V1_STR}/openapi.json"
    
    return HTMLResponse(f"""
        <!doctype html>
        <html>
          <head>
            <title>Bússola V2 - Scalar Docs</title>
            <meta charset="utf-8" />
            <meta
              name="viewport"
              content="width=device-width, initial-scale=1" />
            <style>
              body {{
                margin: 0;
              }}
            </style>
          </head>
          <body>
            <script
              id="api-reference"
              data-url="{openapi_url}"></script>
            <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
          </body>
        </html>
    """)

# --------------------------------------------------------------------------------------
# REGISTRO DE ROTAS
# --------------------------------------------------------------------------------------
# Inclui o roteador principal que agrupa todos os endpoints (Auth, Users, Finanças, etc).
# Adiciona o prefixo global (ex: /api/v1) a todas as rotas.
app.include_router(api_router, prefix=settings.API_V1_STR)

# --------------------------------------------------------------------------------------
# ROTA DE HEALTH CHECK
# --------------------------------------------------------------------------------------
@app.get("/")
def root():
    """
    Rota raiz para verificação de saúde da API.
    Útil para Load Balancers ou para checar se o deploy foi bem sucedido.
    """
    return {"message": "Bússola API está online! 🧭"}