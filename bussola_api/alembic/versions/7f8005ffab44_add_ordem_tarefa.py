"""add_ordem_tarefa

Revision ID: 7f8005ffab44
Revises: a1b2c3d4e5f6
Create Date: 2026-07-20 23:17:34.057908

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7f8005ffab44'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Prioridade -> peso, para o backfill inicial dar uma ordem sensata.
_PESO_PRIO = {"Crítica": 0, "Alta": 1, "Média": 2, "Baixa": 3}


def upgrade() -> None:
    """Adiciona `tarefa.ordem` e faz backfill numerando cada coluna por prioridade/prazo."""
    op.add_column(
        "tarefa",
        sa.Column("ordem", sa.Integer(), nullable=False, server_default="0"),
    )

    # Backfill em Python (portável — não depende de window functions do SQLite).
    bind = op.get_bind()
    rows = bind.execute(
        sa.text("SELECT id, user_id, status, prioridade, prazo FROM tarefa")
    ).fetchall()

    # Agrupa por (user_id, status) e ordena por prioridade, prazo, id.
    grupos: dict = {}
    for r in rows:
        grupos.setdefault((r.user_id, r.status), []).append(r)

    for _, tarefas in grupos.items():
        tarefas.sort(
            key=lambda x: (
                _PESO_PRIO.get(x.prioridade, 9),
                x.prazo is None,          # com prazo primeiro
                str(x.prazo),
                x.id,
            )
        )
        for idx, t in enumerate(tarefas):
            bind.execute(
                sa.text("UPDATE tarefa SET ordem = :o WHERE id = :id"),
                {"o": idx, "id": t.id},
            )


def downgrade() -> None:
    """Remove a coluna `tarefa.ordem`."""
    op.drop_column("tarefa", "ordem")
