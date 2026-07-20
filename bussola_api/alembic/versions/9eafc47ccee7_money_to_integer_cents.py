"""money to integer cents

Revision ID: 9eafc47ccee7
Revises: 1e66514e74ae
Create Date: 2026-07-20 13:32:54.281622

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9eafc47ccee7'
down_revision: Union[str, Sequence[str], None] = '1e66514e74ae'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Colunas monetárias (tabela, coluna) — agora armazenadas em CENTAVOS inteiros.
MONEY_COLS = [
    ("transacao", "valor"),
    ("transacao", "valor_total_parcelamento"),
    ("categoria", "meta_limite"),
    ("historico_gasto_mensal", "total_gasto"),
    ("meta", "valor_alvo"),
    ("meta", "saldo_atual"),
    ("meta", "aporte_mensal_valor"),
    ("movimentacao_meta", "valor"),
]


def upgrade() -> None:
    """Reais (float) -> centavos inteiros. Converte os dados existentes."""
    for table, col in MONEY_COLS:
        op.execute(
            f"UPDATE {table} SET {col} = CAST(ROUND({col} * 100) AS INTEGER) "
            f"WHERE {col} IS NOT NULL"
        )


def downgrade() -> None:
    """Centavos inteiros -> reais (float)."""
    for table, col in MONEY_COLS:
        op.execute(
            f"UPDATE {table} SET {col} = {col} / 100.0 "
            f"WHERE {col} IS NOT NULL"
        )
