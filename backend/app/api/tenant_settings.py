"""Per-tenant settings.

Who can edit what:
- **brand, contact, hours, ai_config, pos_config, name** → anyone with tenant access
  (owner + admin + employee).
- **model_config_override** → admin + employee ONLY. Owners can read it but cannot
  change it — model selection stays a platform decision so TableAI controls quality
  and cost across the fleet.

NEVER exposes platform-wide Anthropic/OpenAI keys.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import CurrentUser, require_tenant_access
from app.db import get_session
from app.models.tenant import Tenant

router = APIRouter(prefix="/tenant/settings", tags=["tenant-settings"])


class TenantSettingsResponse(BaseModel):
    slug: str
    name: str
    brand: dict
    contact: dict
    hours: dict
    ai_config: dict
    pos_provider: str | None
    pos_config: dict | None
    model_config_override: dict | None


class TenantSettingsUpdate(BaseModel):
    name: str | None = None
    brand: dict | None = None
    contact: dict | None = None
    hours: dict | None = None
    ai_config: dict | None = None
    pos_config: dict | None = None
    model_config_override: dict | None = None


def _out(t: Tenant) -> TenantSettingsResponse:
    return TenantSettingsResponse(
        slug=t.slug,
        name=t.name,
        brand=t.brand or {},
        contact=t.contact or {},
        hours=t.hours or {},
        ai_config=t.ai_config or {},
        pos_provider=t.pos_provider,
        pos_config=t.pos_config,
        model_config_override=t.model_config,
    )


@router.get("", response_model=TenantSettingsResponse)
async def get_tenant_settings(
    tenant: str = Query(...),
    access: tuple[CurrentUser, Tenant] = Depends(require_tenant_access("tenant")),
    db: AsyncSession = Depends(get_session),
) -> TenantSettingsResponse:
    _, t = access
    return _out(t)


@router.patch("", response_model=TenantSettingsResponse)
async def update_tenant_settings(
    body: TenantSettingsUpdate,
    tenant: str = Query(...),
    access: tuple[CurrentUser, Tenant] = Depends(require_tenant_access("tenant")),
    db: AsyncSession = Depends(get_session),
) -> TenantSettingsResponse:
    user, t = access
    if body.name is not None:
        t.name = body.name.strip() or t.name
    if body.brand is not None:
        t.brand = body.brand
    if body.contact is not None:
        t.contact = body.contact
    if body.hours is not None:
        t.hours = body.hours
    if body.ai_config is not None:
        t.ai_config = body.ai_config
    if body.pos_config is not None:
        t.pos_config = body.pos_config
    if body.model_config_override is not None:
        if user.role not in ("admin", "employee"):
            raise HTTPException(
                status_code=403,
                detail="Only TableAI staff can change the AI model for a tenant.",
            )
        cleaned = {k: v for k, v in (body.model_config_override or {}).items() if v}
        t.model_config = cleaned or None
    await db.commit()
    await db.refresh(t)
    return _out(t)
