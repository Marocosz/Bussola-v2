"""add_habitos_jornada

Revision ID: 5b827727960a
Revises: 6109ea6c3d5d
Create Date: 2026-03-08 01:54:30.644736

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5b827727960a'
down_revision: Union[str, Sequence[str], None] = '6109ea6c3d5d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Cria as tabelas do módulo Jornada (Hábitos)."""
    op.create_table(
        'habito',
        sa.Column('id',           sa.Integer(),    nullable=False),
        sa.Column('titulo',       sa.String(200),  nullable=False),
        sa.Column('descricao',    sa.Text(),        nullable=True),
        sa.Column('horario',      sa.String(5),    nullable=False),
        sa.Column('frequencia',   sa.JSON(),        nullable=True),
        sa.Column('duracao_min',  sa.Integer(),    nullable=True),
        sa.Column('cor',          sa.String(7),    nullable=True),
        sa.Column('status',       sa.String(20),   nullable=True),
        sa.Column('data_criacao', sa.DateTime(),   nullable=True),
        sa.Column('user_id',      sa.Integer(),    nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['user.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_habito_id'), 'habito', ['id'], unique=False)

    op.create_table(
        'habito_registro',
        sa.Column('id',        sa.Integer(), nullable=False),
        sa.Column('habito_id', sa.Integer(), nullable=False),
        sa.Column('data',      sa.Date(),    nullable=False),
        sa.Column('concluido', sa.Boolean(), nullable=True),
        sa.ForeignKeyConstraint(['habito_id'], ['habito.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_habito_registro_id'), 'habito_registro', ['id'], unique=False)


def downgrade() -> None:
    """Remove as tabelas do módulo Jornada."""
    op.drop_index(op.f('ix_habito_registro_id'), table_name='habito_registro')
    op.drop_table('habito_registro')
    op.drop_index(op.f('ix_habito_id'), table_name='habito')
    op.drop_table('habito')
