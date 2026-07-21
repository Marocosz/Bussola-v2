"""add_tipo_pagamento_transacao

Revision ID: b3d9f2a1c4e7
Revises: 7f8005ffab44
Create Date: 2026-07-21 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3d9f2a1c4e7'
down_revision: Union[str, Sequence[str], None] = '7f8005ffab44'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Adiciona `transacao.tipo_pagamento` (forma de pagamento).

    Nullable e sem backfill: linhas legadas ficam NULL ("não informado").
    A obrigatoriedade é regra de UI; a coluna nullable também permite que o
    self-heal de boot (sync_missing_columns) a crie em prod sem derrubar o app.
    """
    op.add_column(
        "transacao",
        sa.Column("tipo_pagamento", sa.String(length=30), nullable=True),
    )


def downgrade() -> None:
    """Remove a coluna `transacao.tipo_pagamento`."""
    op.drop_column("transacao", "tipo_pagamento")
