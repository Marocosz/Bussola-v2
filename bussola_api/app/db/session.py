from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

# Configuração específica para SQLite
# check_same_thread=False é necessário apenas para SQLite, 
# pois ele não lida bem com múltiplas threads por padrão.
connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.DATABASE_URL, 
    connect_args=connect_args
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)