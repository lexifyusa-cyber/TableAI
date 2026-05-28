"""LLM resolver — picks the right provider + model for a given task and tenant.

Call sites should not instantiate providers directly; go through:

    provider, model = await get_provider_for("chat", tenant_id=t.id)
    async for chunk in provider.stream_text(model=model, system=..., messages=...):
        ...

Model-config resolution order:
1. Per-tenant override on `tenants.model_config` (if set and the named provider is enabled).
2. Global default from `app_settings.llm.defaults` for the task.
3. Hard-coded fallback: first enabled provider, model "claude-sonnet-4-6" or "gpt-4o-mini".
"""

from __future__ import annotations

import json
from typing import Any, Literal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import SessionLocal
from app.models.app_setting import AppSetting
from app.models.llm_provider import LLMProvider
from app.models.tenant import Tenant
from app.services.providers.anthropic import AnthropicProvider
from app.services.providers.base import ModelProvider, cached_block  # re-export
from app.services.providers.openai_compat import OpenAICompatibleProvider

Task = Literal["chat", "demo_generation", "premium_chat", "vision"]

__all__ = ["get_provider_for", "cached_block"]


async def _load_json_setting(db: AsyncSession, key: str) -> dict[str, Any] | None:
    row = (await db.execute(select(AppSetting).where(AppSetting.key == key))).scalar_one_or_none()
    if not row or not row.value:
        return None
    try:
        return json.loads(row.value)
    except Exception:
        return None


async def _resolve_provider_for_kind(db: AsyncSession, kind: str) -> LLMProvider | None:
    row = (
        await db.execute(
            select(LLMProvider)
            .where(LLMProvider.kind == kind, LLMProvider.enabled == True)  # noqa: E712
            .order_by(LLMProvider.created_at.asc())
            .limit(1)
        )
    ).scalar_one_or_none()
    return row


def _instantiate(provider: LLMProvider) -> ModelProvider:
    if provider.kind == "anthropic":
        return AnthropicProvider(api_key=provider.api_key, base_url=provider.base_url)
    if provider.kind == "openai_compat":
        return OpenAICompatibleProvider(api_key=provider.api_key, base_url=provider.base_url)
    raise RuntimeError(f"Unknown provider kind: {provider.kind}")


async def get_provider_for(
    task: Task,
    *,
    tenant_id: UUID | None = None,
) -> tuple[ModelProvider, str]:
    """Resolve (provider_instance, model_name) for a task + tenant."""
    async with SessionLocal() as db:
        # 1. Per-tenant override
        override_kind: str | None = None
        override_model: str | None = None
        if tenant_id is not None:
            t = (await db.execute(select(Tenant).where(Tenant.id == tenant_id))).scalar_one_or_none()
            if t and t.model_config:
                entry = (t.model_config or {}).get(task)
                if entry and isinstance(entry, dict):
                    override_kind = entry.get("kind")
                    override_model = entry.get("model")

        # 2. Global default
        if not override_kind or not override_model:
            defaults = (await _load_json_setting(db, "llm.defaults")) or {}
            entry = defaults.get(task) or {}
            override_kind = override_kind or entry.get("kind")
            override_model = override_model or entry.get("model")

        # 3. Hard-coded fallback
        if not override_kind:
            override_kind = "anthropic"
        if not override_model:
            override_model = (
                "claude-sonnet-4-6" if override_kind == "anthropic" else "gpt-4o-mini"
            )

        provider_row = await _resolve_provider_for_kind(db, override_kind)
        if not provider_row:
            raise RuntimeError(
                f"No enabled LLM provider of kind '{override_kind}' is configured. "
                "Add one at /admin/providers."
            )

        return _instantiate(provider_row), override_model
