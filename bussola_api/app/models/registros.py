from sqlalchemy import Column, Integer, String, Boolean, Text, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
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
    nome = Column(String(100), nullable=False, unique=True)
    cor = Column(String(7), default="#FFFFFF") # Ex: Hex color para UI
    
    anotacoes = relationship("Anotacao", back_populates="grupo")

class Anotacao(Base):
    __tablename__ = 'anotacao'

    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String(200), nullable=True) # Título opcional agora
    conteudo = Column(Text, nullable=True)
    fixado = Column(Boolean, default=False)
    data_criacao = Column(DateTime, default=datetime.utcnow)
    
    # Relacionamento com Grupo (Substitui a string 'tipo')
    grupo_id = Column(Integer, ForeignKey('grupo_anotacao.id'), nullable=True)
    grupo = relationship("GrupoAnotacao", back_populates="anotacoes")

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
    
    # Novos Campos Solicitados
    prioridade = Column(String(20), default="Média") # Crítica, Alta, Média, Baixa
    prazo = Column(DateTime, nullable=True)          # Prazo opcional
    
    status = Column(String(50), default=StatusTarefa.PENDENTE.value) # Pendente, Em andamento, Concluído
    fixado = Column(Boolean, default=False)
    
    data_criacao = Column(DateTime, default=datetime.utcnow)
    data_conclusao = Column(DateTime, nullable=True)

    subtarefas = relationship("Subtarefa", back_populates="tarefa", cascade="all, delete-orphan")

class Subtarefa(Base):
    __tablename__ = 'subtarefa'

    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String(200), nullable=False)
    concluido = Column(Boolean, default=False)
    
    tarefa_id = Column(Integer, ForeignKey('tarefa.id'), nullable=False)
    tarefa = relationship("Tarefa", back_populates="subtarefas")