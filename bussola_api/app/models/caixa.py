"""
=======================================================================================
ARQUIVO: caixa.py (Modelo de Dados - Ajustes de Caixa / Saldo Inicial)
=======================================================================================

OBJETIVO:
    Registrar dinheiro que existe fora do mapeamento mensal do Bussola — saldo
    inicial (o que o usuário já tinha antes de usar o app) e injeções/correções
    de caixa pontuais. NÃO é uma Transacao: não entra em receita/despesa nem nos
    gráficos do mês; apenas compõe o Caixa (patrimônio) acumulado.
=======================================================================================
"""

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.db.base_class import Base
from app.db.types import MoneyCents  # dinheiro = centavos inteiros no banco, reais no Python
from app.core.timezone import now_utc


class AjusteCaixa(Base):
    """Ajuste de caixa: entrada/saída de dinheiro histórico, fora do mês."""
    __tablename__ = "ajuste_caixa"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False)

    tipo = Column(String(20), nullable=False, default="entrada")  # entrada|saida
    valor = Column(MoneyCents, nullable=False)                    # centavos no banco; reais no Python
    data = Column(DateTime, nullable=False, default=now_utc)
    observacao = Column(String(300), nullable=True)

    created_at = Column(DateTime, nullable=False, default=now_utc)

    user = relationship("User", back_populates="ajustes_caixa")
