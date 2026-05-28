from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base


class AppSetting(Base):
    """Key-value store for runtime-configurable settings.

    Secrets (API keys) live here rather than in env so the owner can rotate
    them from the settings UI without redeploying. Values are stored as plain
    text — anyone with DB access can read them, which matches the trust
    boundary: Postgres is already co-located with the app.
    """

    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(128), primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False, default="")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
