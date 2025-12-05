from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean
from app.db.base import Base

class Compromisso(Base):
    __tablename__ = 'compromisso'

    id = Column(Integer, primary_key=True)
    titulo = Column(String(150), nullable=False)
    descricao = Column(Text, nullable=True)
    data_hora = Column(DateTime, nullable=False)
    local = Column(String(200), nullable=True)
    lembrete = Column(Boolean, default=False)
    status = Column(String(20), nullable=False, default='Pendente')