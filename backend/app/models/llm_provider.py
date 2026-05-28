from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base


class LLMProvider(Base):
    """LLM provider config — admin-managed.

    `kind` selects the client implementation:
    - "anthropic" → AsyncAnthropic SDK (prompt caching, native tool use)
    - "openai_compat" → AsyncOpenAI with base_url + api_key
      (works for OpenAI, Groq, Together, Fireworks, OpenRouter, DeepSeek, Ollama, etc.)
    """

    __tablename__ = "llm_providers"
    __table_args__ = (
        CheckConstraint("kind IN ('anthropic','openai_compat')", name="llm_providers_kind_check"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    base_url: Mapped[str | None] = mapped_column(Text)
    api_key: Mapped[str] = mapped_column(Text, nullable=False, default="")
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
