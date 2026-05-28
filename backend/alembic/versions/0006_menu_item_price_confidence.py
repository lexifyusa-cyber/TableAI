"""menu_items.price_confidence — how trustworthy is the scraped price

Revision ID: 0006
Revises: 0005
Create Date: 2026-05-15
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "menu_items",
        sa.Column("price_confidence", sa.String(8), nullable=True),
    )
    op.create_check_constraint(
        "menu_items_price_confidence_check",
        "menu_items",
        "price_confidence IS NULL OR price_confidence IN ('high','medium','low')",
    )


def downgrade() -> None:
    op.drop_constraint("menu_items_price_confidence_check", "menu_items", type_="check")
    op.drop_column("menu_items", "price_confidence")
