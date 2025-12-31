"""
=======================================================================================
ARQUIVO: registros.py (Modelo de Dados - Produtividade e Tarefas)
=======================================================================================

OBJETIVO:
    Suportar o módulo de produtividade, incluindo Notas (estilo Keep), Links e
    Gestão de Tarefas hierárquicas (Subtarefas).

PARTE DO SISTEMA:
    Backend / Database Layer.

RESPONSABILIDADES:
    1. GrupoAnotacao: Organização lógica (Pastas/Tags).
    2. Anotacao: Conteúdo textual livre.
    3. Tarefa/Subtarefa: Gestão de atividades com suporte a aninhamento recursivo.

COMUNICAÇÃO:
    - Relaciona-se com: User.
=======================================================================================
"""

from sqlalchemy import Column, Integer, String, Boolean, Text, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship, backref
from app.db.base_class import Base
from app.core.timezone import now_utc # [NOVO]
import enum

# Enum para garantir consistência de status no banco e no código
class StatusTarefa(str, enum.Enum):
    PENDENTE = "Pendente"
    EM_ANDAMENTO = "Em andamento"
    CONCLUIDO = "Concluído"

class GrupoAnotacao(Base):
    """
    Agrupador de notas (semelhante a cadernos ou pastas).
    """
    __tablename__ = 'grupo_anotacao'

    id = Column(Integer, primary_key=True, index=True)
    # Nome não é unique globalmente, pois usuários diferentes podem ter grupos com mesmo nome.
    nome = Column(String(100), nullable=False) 
    cor = Column(String(7), default="#FFFFFF") 
    
    # [SEGURANÇA] Vínculo com Usuário
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    user = relationship("User", back_populates="grupos_anotacao")

    anotacoes = relationship("Anotacao", back_populates="grupo")

class Anotacao(Base):
    """
    Nota de texto simples ou rica.
    """
    __tablename__ = 'anotacao'

    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String(200), nullable=True)
    conteudo = Column(Text, nullable=True)
    
    # Dashboard: Notas fixadas aparecem no topo ou na home.
    fixado = Column(Boolean, default=False)
    data_criacao = Column(DateTime, default=now_utc) # [CORREÇÃO]
    
    grupo_id = Column(Integer, ForeignKey('grupo_anotacao.id'), nullable=True)
    grupo = relationship("GrupoAnotacao", back_populates="anotacoes")

    # [SEGURANÇA] Vínculo com Usuário
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    user = relationship("User", back_populates="anotacoes")

    # Cascade Delete: Se apagar a nota, apaga os links associados.
    links = relationship("Link", back_populates="anotacao", cascade="all, delete-orphan")

class Link(Base):
    """
    Recurso auxiliar para salvar URLs dentro de uma anotação.
    """
    __tablename__ = 'link'
    id = Column(Integer, primary_key=True, index=True)
    url = Column(String(500), nullable=False)
    anotacao_id = Column(Integer, ForeignKey('anotacao.id'), nullable=False)
    anotacao = relationship("Anotacao", back_populates="links")

# --- Nova Estrutura de Tarefas ---

class Tarefa(Base):
    """
    Entidade raiz de uma atividade a ser realizada (ToDo / Kanban).
    """
    __tablename__ = 'tarefa'

    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String(200), nullable=False)
    descricao = Column(Text, nullable=True)
    
    prioridade = Column(String(20), default="Média")
    prazo = Column(DateTime, nullable=True)
    
    # Usa os valores do Enum definido no topo
    status = Column(String(50), default=StatusTarefa.PENDENTE.value)
    fixado = Column(Boolean, default=False)
    
    data_criacao = Column(DateTime, default=now_utc) # [CORREÇÃO]
    data_conclusao = Column(DateTime, nullable=True)

    # [SEGURANÇA] Vínculo com Usuário
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    user = relationship("User", back_populates="tarefas")

    # Cascade Delete: Apagar a tarefa remove todas as subtarefas recursivamente.
    subtarefas = relationship("Subtarefa", back_populates="tarefa", cascade="all, delete-orphan")

class Subtarefa(Base):
    """
    Item de checklist ou passo menor de uma Tarefa.
    Suporta aninhamento infinito (Subtarefa dentro de Subtarefa).
    """
    __tablename__ = 'subtarefa'

    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String(200), nullable=False)
    concluido = Column(Boolean, default=False)
    
    # Vínculo com a tarefa "Raiz" (Mãe de todas)
    tarefa_id = Column(Integer, ForeignKey('tarefa.id'), nullable=False)
    
    # Estrutura de Árvore (Adjacency List):
    # Aponta para outra subtarefa superior, permitindo n-níveis de profundidade.
    parent_id = Column(Integer, ForeignKey('subtarefa.id'), nullable=True)
    
    # Relacionamentos
    tarefa = relationship("Tarefa", back_populates="subtarefas")
    
    # Configuração de Auto-Relacionamento:
    # 'remote_side=[id]' é necessário para o SQLAlchemy entender a relação recursiva.
    subtarefas = relationship(
        "Subtarefa",
        backref=backref('parent', remote_side=[id]),
        cascade="all, delete-orphan"
    )