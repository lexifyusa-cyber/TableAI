"""RBAC + LLM provider tables + model_config column on tenants

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-19
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "profiles",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(320), nullable=False, unique=True),
        sa.Column("role", sa.String(16), nullable=False),
        sa.Column("display_name", sa.String(128)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("role IN ('admin','employee','owner')", name="profiles_role_check"),
    )

    op.create_table(
        "tenant_owners",
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("profiles.user_id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_tenant_owners_tenant_id", "tenant_owners", ["tenant_id"])

    op.create_table(
        "llm_providers",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("kind", sa.String(32), nullable=False),
        sa.Column("base_url", sa.Text()),
        sa.Column("api_key", sa.Text(), nullable=False, server_default=""),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("kind IN ('anthropic','openai_compat')", name="llm_providers_kind_check"),
    )

    op.create_table(
        "owner_invites",
        sa.Column("token", sa.String(64), primary_key=True),
        sa.Column("code", sa.String(6), nullable=False),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True)),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("note", sa.Text()),
    )
    op.create_index("ix_owner_invites_code", "owner_invites", ["code"])
    op.create_index("ix_owner_invites_tenant_id", "owner_invites", ["tenant_id"])

    # Per-tenant model override (nullable JSONB; falls back to global defaults in app_settings).
    op.add_column(
        "tenants",
        sa.Column("model_config", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("tenants", "model_config")
    op.drop_index("ix_owner_invites_tenant_id", "owner_invites")
    op.drop_index("ix_owner_invites_code", "owner_invites")
    op.drop_table("owner_invites")
    op.drop_table("llm_providers")
    op.drop_index("ix_tenant_owners_tenant_id", "tenant_owners")
    op.drop_table("tenant_owners")
    op.drop_table("profiles")
