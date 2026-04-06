"""
=======================================================================================
ARQUIVO: session.py (Infraestrutura de Conexão com Banco de Dados)
=======================================================================================

OBJETIVO:
    Configurar a Engine do SQLAlchemy e a fábrica de sessões (SessionLocal) que gerencia
    as transações do banco de dados.

PARTE DO SISTEMA:
    Backend / Core Infrastructure

RESPONSABILIDADES:
    1. Criar a Engine de conexão (Connection Pool).
    2. Aplicar configurações específicas de driver (ex: SQLite vs Postgres).
    3. Configurar a estratégia de "Ping" para manter conexões vivas.
    4. Prover a fábrica `SessionLocal` para injeção de dependência nas rotas.

COMUNICAÇÃO:
    - Recebe config de: app.core.config.settings
    - Utilizado por: app.api.deps (Dependency Injection)

=======================================================================================
"""

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

# --------------------------------------------------------------------------------------
# CONFIGURAÇÃO ESPECÍFICA DE DRIVER
# --------------------------------------------------------------------------------------
connect_args = {}

# SQLite tem uma limitação de thread por padrão (uma conexão só pode ser usada pela
# thread que a criou). Como o FastAPI é assíncrono/multi-thread, precisamos desativar
# essa checagem ("check_same_thread": False) para evitar erros de concorrência.
if "sqlite" in settings.DATABASE_URL:
    connect_args["check_same_thread"] = False

# --------------------------------------------------------------------------------------
# CRIAÇÃO DA ENGINE
# --------------------------------------------------------------------------------------
# pool_pre_ping=True:
# Habilita um teste de conexão ("ping") antes de entregar a sessão para a aplicação.
# - Em produção (Postgres/MySQL), evita erros 500 caso o banco tenha reiniciado
#   ou a conexão tenha caído por timeout no firewall.
engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True
)

# Habilita WAL mode no SQLite para permitir leituras concorrentes durante escritas.
# Sem isso, múltiplos workers/threads podem causar "database is locked" erros.
if "sqlite" in settings.DATABASE_URL:
    @event.listens_for(engine, "connect")
    def _set_sqlite_wal(dbapi_conn, connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.close()

# --------------------------------------------------------------------------------------
# FÁBRICA DE SESSÕES
# --------------------------------------------------------------------------------------
# autocommit=False:
# Garante controle transacional explícito. Alterações só persistem com db.commit().
# Isso é crucial para integridade de dados e rollbacks em caso de erro.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)