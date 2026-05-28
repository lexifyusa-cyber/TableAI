"""/api/me — returns the current caller's profile + accessible tenants.

Used by the frontend right after Supabase sign-in to decide routing
(admin/employee → /admin, owner → /dashboard) and to know which tenants
the owner can switch between.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import CurrentUser, current_user
from app.db import get_session
from app.models.tenant import Tenant
from app.models.tenant_owner import TenantOwner

router = APIRouter(tags=["me"])


class MeResponse(BaseModel):
    user_id: str
    email: str
    role: str
    display_name: str | None = None
    tenants: list[dict]  # [{slug, name, business_type}, ...]


@router.get("/me", response_model=MeResponse)
async def me(
    user: CurrentUser = Depends(current_user),
    db: AsyncSession = Depends(get_session),
) -> MeResponse:
    if user.role in ("admin", "employee"):
        rows = (
            await db.execute(select(Tenant).order_by(Tenant.created_at.desc()).limit(200))
        ).scalars().all()
    else:
        rows = (
            await db.execute(
                select(Tenant)
                .join(TenantOwner, TenantOwner.tenant_id == Tenant.id)
                .where(TenantOwner.user_id == user.user_id)
                .order_by(Tenant.created_at.desc())
            )
        ).scalars().all()

    return MeResponse(
        user_id=str(user.user_id),
        email=user.email,
        role=user.role,
        tenants=[
            {
                "slug": t.slug,
                "name": t.name,
                "business_type": t.business_type.value if hasattr(t.business_type, "value") else t.business_type,
            }
            for t in rows
        ],
    )
