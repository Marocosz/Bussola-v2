from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from datetime import datetime
from app.db.base_class import Base

class Compromisso(Base):
    __tablename__ = 'compromisso'

    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String(200), nullable=False)
    descricao = Column(Text, nullable=True)
    local = Column(String(200), nullable=True)
    data_hora = Column(DateTime, nullable=False) # Data e Hora do evento
    lembrete = Column(Boolean, default=False)
    
    # Status: 'Pendente', 'Realizado', 'Perdido'
    status = Column(String(50), default='Pendente')