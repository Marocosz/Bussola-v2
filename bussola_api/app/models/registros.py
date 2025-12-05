from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.db.base import Base

class Anotacao(Base):
    __tablename__ = 'anotacao'

    id = Column(Integer, primary_key=True)
    titulo = Column(String(200), nullable=False)
    conteudo = Column(Text, nullable=True)
    tipo = Column(String(50), nullable=False, default='Geral')
    fixado = Column(Boolean, default=False, index=True)
    data_criacao = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    is_tarefa = Column(Boolean, default=False)
    status_tarefa = Column(String(50), nullable=True, default='Pendente')

    links = relationship('Link', back_populates='anotacao', cascade="all, delete-orphan", lazy=True)

class Link(Base):
    __tablename__ = 'link'

    id = Column(Integer, primary_key=True)
    url = Column(String(500), nullable=False)
    anotacao_id = Column(Integer, ForeignKey('anotacao.id'), nullable=False)

    anotacao = relationship('Anotacao', back_populates='links')