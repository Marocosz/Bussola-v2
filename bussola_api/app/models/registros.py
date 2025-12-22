from sqlalchemy import Column, Integer, String, Boolean, Text, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship, backref
from datetime import datetime
from app.db.base_class import Base
import enum

# Enums para status (opcional, mas recomendado para PostgreSQL)
class StatusTarefa(str, enum.Enum):
    PENDENTE = "Pendente"
    EM_ANDAMENTO = "Em andamento"
    CONCLUIDO = "Concluído"

class GrupoAnotacao(Base):
    __tablename__ = 'grupo_anotacao'

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(100), nullable=False) # Removido unique global para permitir nomes iguais de users diferentes
    cor = Column(String(7), default="#FFFFFF") 
    
    # [SEGURANÇA] Vínculo com Usuário
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    user = relationship("User", back_populates="grupos_anotacao")

    anotacoes = relationship("Anotacao", back_populates="grupo")

class Anotacao(Base):
    __tablename__ = 'anotacao'

    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String(200), nullable=True)
    conteudo = Column(Text, nullable=True)
    fixado = Column(Boolean, default=False)
    data_criacao = Column(DateTime, default=datetime.utcnow)
    
    grupo_id = Column(Integer, ForeignKey('grupo_anotacao.id'), nullable=True)
    grupo = relationship("GrupoAnotacao", back_populates="anotacoes")

    # [SEGURANÇA] Vínculo com Usuário
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    user = relationship("User", back_populates="anotacoes")

    links = relationship("Link", back_populates="anotacao", cascade="all, delete-orphan")

class Link(Base):
    __tablename__ = 'link'
    id = Column(Integer, primary_key=True, index=True)
    url = Column(String(500), nullable=False)
    anotacao_id = Column(Integer, ForeignKey('anotacao.id'), nullable=False)
    anotacao = relationship("Anotacao", back_populates="links")

# --- Nova Estrutura de Tarefas ---

class Tarefa(Base):
    __tablename__ = 'tarefa'

    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String(200), nullable=False)
    descricao = Column(Text, nullable=True)
    
    prioridade = Column(String(20), default="Média")
    prazo = Column(DateTime, nullable=True)
    
    status = Column(String(50), default=StatusTarefa.PENDENTE.value)
    fixado = Column(Boolean, default=False)
    
    data_criacao = Column(DateTime, default=datetime.utcnow)
    data_conclusao = Column(DateTime, nullable=True)

    # [SEGURANÇA] Vínculo com Usuário
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    user = relationship("User", back_populates="tarefas")

    subtarefas = relationship("Subtarefa", back_populates="tarefa", cascade="all, delete-orphan")

class Subtarefa(Base):
    __tablename__ = 'subtarefa'

    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String(200), nullable=False)
    concluido = Column(Boolean, default=False)
    
    tarefa_id = Column(Integer, ForeignKey('tarefa.id'), nullable=False)
    
    parent_id = Column(Integer, ForeignKey('subtarefa.id'), nullable=True)
    
    # Relacionamentos
    tarefa = relationship("Tarefa", back_populates="subtarefas")
    
    # Filhos
    subtarefas = relationship(
        "Subtarefa",
        backref=backref('parent', remote_side=[id]),
        cascade="all, delete-orphan"
    )