"""provenance JSONB on tenants and menu_items, media_assets table, menu_items.image_path

Revision ID: 0007
Revises: 0006
Create Date: 2026-05-18
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Provenance JSONB columns
    op.add_column(
        "tenants",
        sa.Column(
            "provenance",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )
    op.add_column(
        "menu_items",
        sa.Column(
            "provenance",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )
    # Local cached image path (relative to backend/static/media/{tier}/)
    op.add_column(
        "menu_items",
        sa.Column("image_path", sa.Text(), nullable=True),
    )

    # media_assets table — index of every downloaded image across the three tiers.
    op.create_table(
        "media_assets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("tier", sa.String(16), nullable=False),
        sa.Column("classification", sa.String(64), nullable=False),
        sa.Column("relative_path", sa.Text(), nullable=False),
        sa.Column("source", sa.String(64), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=True),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("mime", sa.String(64), nullable=False),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("bytes", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "tier IN ('public','private','internal')",
            name="media_assets_tier_check",
        ),
        sa.UniqueConstraint("tier", "relative_path", name="media_assets_tier_path_unique"),
    )
    op.create_index(
        "ix_media_assets_tenant_class",
        "media_assets",
        ["tenant_id", "classification"],
    )
    op.create_index("ix_media_assets_sha256", "media_assets", ["sha256"])


def downgrade() -> None:
    op.drop_index("ix_media_assets_sha256", table_name="media_assets")
    op.drop_index("ix_media_assets_tenant_class", table_name="media_assets")
    op.drop_table("media_assets")
    op.drop_column("menu_items", "image_path")
    op.drop_column("menu_items", "provenance")
    op.drop_column("tenants", "provenance")
