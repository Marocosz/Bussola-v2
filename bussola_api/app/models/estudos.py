"""
=======================================================================================
ARQUIVO: estudos.py (Modelo de Dados - Estudos)
=======================================================================================

OBJETIVO:
    Biblioteca de materiais de estudo: temas, materiais (blocos tipados em JSON, validados
    por app/schemas/estudos_blocos.py) e respostas de quiz/questão aberta.

NOTA:
    Colunas JSON são sempre REATRIBUÍDAS (lista nova), nunca mutadas no lugar — o
    SQLAlchemy só detecta a mudança por atribuição.
=======================================================================================
"""

from sqlalchemy import JSON, Boolean, Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.timezone import now_utc
from app.db.base_class import Base


class EstudoTema(Base):
    """Agrupador de materiais (nome único por usuário)."""
    __tablename__ = "estudo_tema"
    __table_args__ = (UniqueConstraint("user_id", "nome", name="uq_estudo_tema_user_nome"),)

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False, index=True)
    nome = Column(String(100), nullable=False)
    cor = Column(String(7), nullable=True, default="#4A6DFF")
    icone = Column(String(50), nullable=True, default="fa-book-open")
    descricao = Column(String(500), nullable=True)
    criado_em = Column(DateTime, default=now_utc)


class EstudoMaterial(Base):
    """Um material de estudo: cabeçalho + blocos tipados + fontes citadas."""
    __tablename__ = "estudo_material"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False, index=True)
    tema_id = Column(Integer, ForeignKey("estudo_tema.id"), nullable=True, index=True)
    tipo = Column(String(20), nullable=False)                     # aula|resumo|comparativo|exercicios
    titulo = Column(String(200), nullable=False)
    subtitulo = Column(String(300), nullable=True)
    nivel = Column(String(20), nullable=False, default="intermediario")
    tags = Column(JSON, nullable=False, default=list)
    blocos = Column(JSON, nullable=False, default=list)
    fontes = Column(JSON, nullable=False, default=list)           # [{titulo, url}]
    seq_bloco = Column(Integer, nullable=False, default=0)        # maior b<n> já emitido
    estudado_em = Column(DateTime, nullable=True)
    criado_em = Column(DateTime, default=now_utc)
    atualizado_em = Column(DateTime, default=now_utc)

    tema = relationship("EstudoTema", lazy="joined")

    @property
    def estudado(self) -> bool:
        return self.estudado_em is not None

    @property
    def tema_nome(self):
        return self.tema.nome if self.tema else None

    @property
    def tema_cor(self):
        return self.tema.cor if self.tema else None


class EstudoResposta(Base):
    """Resposta a um bloco quiz/questao_aberta (histórico; o material pode mudar depois)."""
    __tablename__ = "estudo_resposta"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False, index=True)
    material_id = Column(Integer, ForeignKey("estudo_material.id", ondelete="CASCADE"), nullable=False, index=True)
    bloco_id = Column(String(24), nullable=False)
    resposta = Column(JSON, nullable=True)                         # índice da opção (quiz) ou texto
    acertou = Column(Boolean, nullable=False)
    respondido_em = Column(DateTime, default=now_utc)
