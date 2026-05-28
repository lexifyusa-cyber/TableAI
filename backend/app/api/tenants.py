"""Tenants listing — scoped by role.

- admin/employee: all tenants (up to 200)
- owner: only tenants they own (via tenant_owners)
- unauthenticated: empty list (so the public landing page is safe without a session)
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import CurrentUser, current_user_optional
from app.db import get_session
from app.models import Tenant
from app.models.tenant_owner import TenantOwner

router = APIRouter(prefix="/tenants", tags=["tenants"])


def _serialize(t: Tenant) -> dict:
    return {
        "id": str(t.id),
        "slug": t.slug,
        "name": t.name,
        "business_type": t.business_type.value,
        "status": t.status.value,
        "source_url": t.source_url,
        "brand": t.brand,
        "contact": t.contact,
        "hours": t.hours,
        "ai_config": t.ai_config,
        "pos_provider": t.pos_provider,
        "provenance": t.provenance or {},
        "created_at": t.created_at.isoformat(),
    }


@router.get("")
async def list_tenants(
    user: CurrentUser | None = Depends(current_user_optional),
    db: AsyncSession = Depends(get_session),
) -> list[dict]:
    if user is None:
        return []
    if user.role in ("admin", "employee"):
        res = await db.execute(select(Tenant).order_by(Tenant.created_at.desc()).limit(200))
        return [_serialize(t) for t in res.scalars().all()]
    # owner
    res = await db.execute(
        select(Tenant)
        .join(TenantOwner, TenantOwner.tenant_id == Tenant.id)
        .where(TenantOwner.user_id == user.user_id)
        .order_by(Tenant.created_at.desc())
    )
    return [_serialize(t) for t in res.scalars().all()]


@router.get("/{slug}")
async def get_tenant(slug: str, db: AsyncSession = Depends(get_session)) -> dict:
    # Kept open-by-slug because the public menu page uses this — branding
    # (name, colors, hours) is not sensitive.
    res = await db.execute(select(Tenant).where(Tenant.slug == slug))
    t = res.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail=f"Tenant '{slug}' not found")
    return _serialize(t)
