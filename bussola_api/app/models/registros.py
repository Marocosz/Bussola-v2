from sqlalchemy import Column, Integer, String, Boolean, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base import Base # Ajuste o import conforme sua estrutura

class Anotacao(Base):
    __tablename__ = 'anotacao'

    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String(200), nullable=False)
    conteudo = Column(Text, nullable=True) # HTML do Quill
    tipo = Column(String(50), nullable=False, default='Geral')
    fixado = Column(Boolean, default=False)
    data_criacao = Column(DateTime, default=datetime.utcnow)
    
    # Tarefas
    is_tarefa = Column(Boolean, default=False)
    status_tarefa = Column(String(50), nullable=True, default='Pendente') # 'Pendente' | 'Concluído'

    links = relationship("Link", back_populates="anotacao", cascade="all, delete-orphan")

class Link(Base):
    __tablename__ = 'link'

    id = Column(Integer, primary_key=True, index=True)
    url = Column(String(500), nullable=False)
    anotacao_id = Column(Integer, ForeignKey('anotacao.id'), nullable=False)

    anotacao = relationship("Anotacao", back_populates="links")