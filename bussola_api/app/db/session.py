from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

# Define argumentos de conexão baseados no tipo de banco
connect_args = {}

# "check_same_thread" é necessário APENAS para SQLite
if "sqlite" in settings.DATABASE_URL:
    connect_args["check_same_thread"] = False

engine = create_engine(
    settings.DATABASE_URL, 
    connect_args=connect_args,
    # pool_pre_ping=True ajuda a evitar quedas de conexão em Postgres
    pool_pre_ping=True 
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)