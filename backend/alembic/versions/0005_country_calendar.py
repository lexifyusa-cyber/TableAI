"""tenants.country_code + tenants.cultural_context; allow 'calendar' bucket kind

Revision ID: 0005
Revises: 0004
Create Date: 2026-04-20
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tenants", sa.Column("country_code", sa.String(2)))
    op.add_column(
        "tenants",
        sa.Column(
            "cultural_context",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="{}",
        ),
    )

    # Widen knowledge_sources check constraint to include 'calendar' bucket.
    op.drop_constraint("knowledge_sources_bucket_check", "knowledge_sources", type_="check")
    op.create_check_constraint(
        "knowledge_sources_bucket_check",
        "knowledge_sources",
        "bucket IN ('menu','business','reputation','social','operational','local','customer','calendar')",
    )


def downgrade() -> None:
    op.drop_constraint("knowledge_sources_bucket_check", "knowledge_sources", type_="check")
    op.create_check_constraint(
        "knowledge_sources_bucket_check",
        "knowledge_sources",
        "bucket IN ('menu','business','reputation','social','operational','local','customer')",
    )
    op.drop_column("tenants", "cultural_context")
    op.drop_column("tenants", "country_code")
