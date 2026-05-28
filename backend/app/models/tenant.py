import enum
from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Enum, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base


class TenantStatus(str, enum.Enum):
    DEMO = "demo"          # auto-generated, owner has not signed up
    PENDING = "pending"    # owner signed up, payment not yet active
    ACTIVE = "active"      # paying customer
    ARCHIVED = "archived"  # churned or demo rejected


class BusinessType(str, enum.Enum):
    RESTAURANT = "restaurant"
    RETAIL = "retail"
    GROCERY = "grocery"
    SALON = "salon"
    GYM = "gym"
    OTHER = "other"


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    slug: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    business_type: Mapped[BusinessType] = mapped_column(
        Enum(BusinessType, name="business_type", values_callable=lambda x: [e.value for e in x]),
        default=BusinessType.RESTAURANT,
        nullable=False,
    )

    source_url: Mapped[str | None] = mapped_column(String(2048))

    # JSONB blobs for flexibility — schema evolves per business type
    brand: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    contact: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    hours: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    ai_config: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    pos_provider: Mapped[str | None] = mapped_column(String(32))
    pos_config: Mapped[dict | None] = mapped_column(JSONB)

    # Per-tenant LLM model override. Shape: {task_name: {kind, model}}.
    # Falls back to global llm.defaults when unset for a task.
    model_config: Mapped[dict | None] = mapped_column(JSONB)

    # ISO 3166-1 alpha-2 ("US", "IN", "MX", …). Drives holiday/timeline awareness.
    country_code: Mapped[str | None] = mapped_column(String(2))
    # Free-form: {cuisine, primary_markets[], relevant_holidays[], …}
    cultural_context: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    # Field-level provenance: which source filled each field.
    # Shape: {"hours": {"source": "google_places_business", "fetched_at": "..."}, ...}
    provenance: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    status: Mapped[TenantStatus] = mapped_column(
        Enum(TenantStatus, name="tenant_status", values_callable=lambda x: [e.value for e in x]),
        default=TenantStatus.DEMO,
        index=True,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    def __repr__(self) -> str:
        return f"<Tenant {self.slug} ({self.status.value})>"
