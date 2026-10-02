"""add_mcp_auth_tables

Revision ID: c7e2a9d4f1b3
Revises: b3d9f2a1c4e7
Create Date: 2026-10-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c7e2a9d4f1b3'
down_revision: Union[str, Sequence[str], None] = 'b3d9f2a1c4e7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Tabelas do Authorization Server do MCP (clientes, códigos, tokens).

    Escrita à mão: o create_all() do boot já cria as tabelas em prod; em um banco
    já populado use `alembic stamp head` (ver CLAUDE.md).
    """
    op.create_table(
        "mcp_client",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("client_id", sa.String(length=64), nullable=False),
        sa.Column("client_name", sa.String(length=200), nullable=False),
        sa.Column("redirect_uris", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_mcp_client_client_id", "mcp_client", ["client_id"], unique=True)

    op.create_table(
        "mcp_auth_code",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code_hash", sa.String(length=64), nullable=False),
        sa.Column("client_id", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("user.id"), nullable=False),
        sa.Column("redirect_uri", sa.String(length=500), nullable=False),
        sa.Column("code_challenge", sa.String(length=128), nullable=False),
        sa.Column("scopes", sa.String(length=200), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("used", sa.Boolean(), nullable=False),
    )
    op.create_index("ix_mcp_auth_code_code_hash", "mcp_auth_code", ["code_hash"], unique=True)

    op.create_table(
        "mcp_token",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("user.id"), nullable=False),
        sa.Column("client_id", sa.String(length=64), nullable=True),
        sa.Column("kind", sa.String(length=10), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("scopes", sa.String(length=200), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("last_used_at", sa.DateTime(), nullable=True),
        sa.Column("revoked", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_mcp_token_token_hash", "mcp_token", ["token_hash"], unique=True)
    op.create_index("ix_mcp_token_client_id", "mcp_token", ["client_id"], unique=False)


def downgrade() -> None:
    """Remove as tabelas do MCP."""
    op.drop_index("ix_mcp_token_client_id", table_name="mcp_token")
    op.drop_index("ix_mcp_token_token_hash", table_name="mcp_token")
    op.drop_table("mcp_token")
    op.drop_index("ix_mcp_auth_code_code_hash", table_name="mcp_auth_code")
    op.drop_table("mcp_auth_code")
    op.drop_index("ix_mcp_client_client_id", table_name="mcp_client")
    op.drop_table("mcp_client")
