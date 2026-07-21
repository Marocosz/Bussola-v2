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

from sqlalchemy import Column, Integer, String, Boolean, Text, DateTime, Date, ForeignKey, Enum, JSON
from sqlalchemy.orm import relationship, backref
from app.db.base_class import Base
from app.core.timezone import now_utc # [NOVO]
import enum

# Enum para garantir consistência de status no banco e no código
class StatusTarefa(str, enum.Enum):
    PENDENTE = "Pendente"
    EM_ANDAMENTO = "Em andamento"
    BLOQUEADO = "Bloqueado"
    CONCLUIDO = "Concluído"
    CANCELADO = "Cancelado"

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
    ordem = Column(Integer, nullable=False, default=0)  # Posição dentro da coluna do board
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


# ─────────────────────────────────────────────────────────────────────────────
# JORNADA — Módulo de Hábitos
# ─────────────────────────────────────────────────────────────────────────────

class StatusHabito(str, enum.Enum):
    ATIVO     = "ativo"
    PAUSADO   = "pausado"
    ARQUIVADO = "arquivado"


class Habito(Base):
    """
    Define um hábito recorrente do usuário (ex: Meditação às 07:00).

    Campos:
        horario      — "HH:MM" — horário alvo do dia.
        frequencia   — JSON list de strings: ["seg","ter","qua","qui","sex","sab","dom"]
        duracao_min  — Duração estimada em minutos (influencia o tamanho visual da bolinha).
        cor          — Cor hex usada na visualização do mapa de hábitos.
        status       — ativo | pausado | arquivado.
    """
    __tablename__ = 'habito'

    id           = Column(Integer, primary_key=True, index=True)
    titulo       = Column(String(200), nullable=False)
    descricao    = Column(Text, nullable=True)
    horario      = Column(String(5), nullable=False)              # "HH:MM"
    frequencia   = Column(JSON, default=lambda: ["seg","ter","qua","qui","sex","sab","dom"])
    duracao_min  = Column(Integer, default=15)
    cor          = Column(String(7), default="#4A6DFF")
    status       = Column(String(20), default=StatusHabito.ATIVO.value)
    data_criacao = Column(DateTime, default=now_utc)

    user_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    user    = relationship("User", back_populates="habitos")

    # Cascade Delete: remover o hábito apaga todos os registros de check-in.
    registros = relationship("HabitoRegistro", back_populates="habito", cascade="all, delete-orphan")


class HabitoRegistro(Base):
    """
    Representa o check-in diário de um hábito.

    Regra: Apenas um registro por (habito_id, data) — garantido pela constraint unique.
    """
    __tablename__ = 'habito_registro'

    id         = Column(Integer, primary_key=True, index=True)
    habito_id  = Column(Integer, ForeignKey('habito.id'), nullable=False)
    data       = Column(Date, nullable=False)       # Data do check-in (sem hora)
    concluido  = Column(Boolean, default=False)

    habito = relationship("Habito", back_populates="registros")