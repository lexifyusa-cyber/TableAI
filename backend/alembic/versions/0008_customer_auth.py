"""Add auth_user_id to customers for Supabase-linked customer accounts.

Revision ID: 0008
Revises: 0007
Create Date: 2026-06-15
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "customers",
        sa.Column("auth_user_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index("ix_customers_auth_user_id", "customers", ["auth_user_id"])


def downgrade() -> None:
    op.drop_index("ix_customers_auth_user_id", "customers")
    op.drop_column("customers", "auth_user_id")
