"""add_estudos_tables

Revision ID: e4b8c1d2a9f7
Revises: c7e2a9d4f1b3
Create Date: 2026-10-02 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e4b8c1d2a9f7'
down_revision: Union[str, Sequence[str], None] = 'c7e2a9d4f1b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Tabelas do módulo Estudos (temas, materiais, respostas).

    Escrita à mão: o create_all() do boot já cria as tabelas em prod; em um banco
    já populado use `alembic stamp head` (ver CLAUDE.md).
    """
    op.create_table(
        "estudo_tema",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("user.id"), nullable=False),
        sa.Column("nome", sa.String(length=100), nullable=False),
        sa.Column("cor", sa.String(length=7), nullable=True),
        sa.Column("icone", sa.String(length=50), nullable=True),
        sa.Column("descricao", sa.String(length=500), nullable=True),
        sa.Column("criado_em", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("user_id", "nome", name="uq_estudo_tema_user_nome"),
    )
    op.create_index("ix_estudo_tema_user_id", "estudo_tema", ["user_id"])

    op.create_table(
        "estudo_material",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("user.id"), nullable=False),
        sa.Column("tema_id", sa.Integer(), sa.ForeignKey("estudo_tema.id"), nullable=True),
        sa.Column("tipo", sa.String(length=20), nullable=False),
        sa.Column("titulo", sa.String(length=200), nullable=False),
        sa.Column("subtitulo", sa.String(length=300), nullable=True),
        sa.Column("nivel", sa.String(length=20), nullable=False),
        sa.Column("tags", sa.JSON(), nullable=False),
        sa.Column("blocos", sa.JSON(), nullable=False),
        sa.Column("fontes", sa.JSON(), nullable=False),
        sa.Column("seq_bloco", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("estudado_em", sa.DateTime(), nullable=True),
        sa.Column("criado_em", sa.DateTime(), nullable=True),
        sa.Column("atualizado_em", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_estudo_material_user_id", "estudo_material", ["user_id"])
    op.create_index("ix_estudo_material_tema_id", "estudo_material", ["tema_id"])

    op.create_table(
        "estudo_resposta",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("user.id"), nullable=False),
        sa.Column("material_id", sa.Integer(), sa.ForeignKey("estudo_material.id", ondelete="CASCADE"), nullable=False),
        sa.Column("bloco_id", sa.String(length=24), nullable=False),
        sa.Column("resposta", sa.JSON(), nullable=True),
        sa.Column("acertou", sa.Boolean(), nullable=False),
        sa.Column("respondido_em", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_estudo_resposta_user_id", "estudo_resposta", ["user_id"])
    op.create_index("ix_estudo_resposta_material_id", "estudo_resposta", ["material_id"])


def downgrade() -> None:
    op.drop_index("ix_estudo_resposta_material_id", table_name="estudo_resposta")
    op.drop_index("ix_estudo_resposta_user_id", table_name="estudo_resposta")
    op.drop_table("estudo_resposta")
    op.drop_index("ix_estudo_material_tema_id", table_name="estudo_material")
    op.drop_index("ix_estudo_material_user_id", table_name="estudo_material")
    op.drop_table("estudo_material")
    op.drop_index("ix_estudo_tema_user_id", table_name="estudo_tema")
    op.drop_table("estudo_tema")
