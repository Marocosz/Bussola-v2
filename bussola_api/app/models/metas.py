"""
=======================================================================================
ARQUIVO: metas.py (Modelo de Dados - Metas & Cofrinhos)
=======================================================================================

OBJETIVO:
    Definir as entidades do sistema de metas de poupança (cofrinhos): o objetivo
    (Meta) e o extrato de movimentações (aportes/retiradas).

RESPONSABILIDADES:
    1. Meta: objetivo com valor-alvo e saldo acumulado (cache denormalizado).
    2. MovimentacaoMeta: cada aporte ou retirada; reusa status Pendente/Efetivada.
=======================================================================================
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, Date, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.db.base_class import Base
from app.db.types import MoneyCents  # dinheiro = centavos inteiros no banco, reais no Python
from app.core.timezone import now_utc


class Meta(Base):
    """Cofrinho: um objetivo de poupança com valor-alvo e saldo acumulado."""
    __tablename__ = "meta"

    id = Column(Integer, primary_key=True)
    nome = Column(String(150), nullable=False)
    valor_alvo = Column(MoneyCents, nullable=False)

    # Cache denormalizado: soma das movimentações efetivadas (aporte − retirada).
    saldo_atual = Column(MoneyCents, nullable=False, default=0.0)

    data_alvo = Column(Date, nullable=True)

    icone = Column(String(50), nullable=True, default="fa-solid fa-piggy-bank")
    cor = Column(String(7), nullable=True, default="#4f46e5")
    imagem_url = Column(String(500), nullable=True)

    trancada = Column(Boolean, nullable=False, default=False)
    status = Column(String(50), nullable=False, default="ativa")  # ativa|concluida|arquivada

    aporte_mensal_valor = Column(MoneyCents, nullable=True)
    aporte_mensal_dia = Column(Integer, nullable=True)

    created_at = Column(DateTime, nullable=False, default=now_utc)
    concluida_em = Column(DateTime, nullable=True)

    user_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    user = relationship("User", back_populates="metas")

    movimentacoes = relationship(
        "MovimentacaoMeta",
        back_populates="meta",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class MovimentacaoMeta(Base):
    """Extrato do cofrinho: um aporte ou retirada."""
    __tablename__ = "movimentacao_meta"

    id = Column(Integer, primary_key=True)
    meta_id = Column(Integer, ForeignKey("meta.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False)

    tipo = Column(String(20), nullable=False)  # aporte|retirada
    valor = Column(MoneyCents, nullable=False)  # centavos no banco; reais no Python
    data = Column(DateTime, nullable=False, default=now_utc)

    status = Column(String(50), nullable=False, default="Efetivada")  # Pendente|Efetivada
    origem = Column(String(20), nullable=False, default="manual")     # manual|agendado
    id_grupo_recorrencia = Column(String(100), nullable=True, index=True)
    observacao = Column(String(300), nullable=True)

    meta = relationship("Meta", back_populates="movimentacoes")
