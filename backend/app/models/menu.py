from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


class MenuCategory(Base):
    __tablename__ = "menu_categories"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(String(1024))
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    items: Mapped[list["MenuItem"]] = relationship(
        back_populates="category", cascade="all, delete-orphan"
    )


class MenuItem(Base):
    __tablename__ = "menu_items"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    category_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("menu_categories.id", ondelete="SET NULL")
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(String(2048))
    price_cents: Mapped[int | None] = mapped_column(Integer)
    # high = from POS/structured source · medium = parsed from menu HTML · low = uncertain (photo/ambiguous)
    price_confidence: Mapped[str | None] = mapped_column(String(8))
    image_url: Mapped[str | None] = mapped_column(String(2048))

    # Tags include things like: "vegan", "vegetarian", "gluten-free", "jain",
    # "nut-free", "spicy:1".."spicy:5", "popular", "chef-special", "new"
    tags: Mapped[list[str]] = mapped_column(ARRAY(String), default=list, nullable=False)
    ingredients: Mapped[list[str]] = mapped_column(ARRAY(String), default=list, nullable=False)
    allergens: Mapped[list[str]] = mapped_column(ARRAY(String), default=list, nullable=False)

    is_available: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict, nullable=False)

    # Field-level provenance — which source filled each field on this item.
    provenance: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    # Path under backend/static/media/{tier}/... when the image is mirrored locally.
    image_path: Mapped[str | None] = mapped_column(String(512))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    category: Mapped["MenuCategory | None"] = relationship(back_populates="items")
