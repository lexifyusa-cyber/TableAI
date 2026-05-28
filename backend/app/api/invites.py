"""Invite acceptance — callable by any authenticated user.

The user signs in via Supabase (magic link OR magic code OR password if they
already have one) and then POSTs here with the token they were emailed.
On success they are linked to the tenant and promoted to role="owner"
(unless already admin/employee).
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import CurrentUser, current_user
from app.db import get_session
from app.models.owner_invite import OwnerInvite
from app.models.profile import Profile
from app.models.tenant import Tenant
from app.models.tenant_owner import TenantOwner

router = APIRouter(prefix="/invites", tags=["invites"])


class AcceptInviteRequest(BaseModel):
    token: str | None = None
    code: str | None = None


class AcceptInviteResponse(BaseModel):
    tenant_slug: str
    tenant_name: str


@router.post("/accept", response_model=AcceptInviteResponse)
async def accept_invite(
    body: AcceptInviteRequest,
    user: CurrentUser = Depends(current_user),
    db: AsyncSession = Depends(get_session),
) -> AcceptInviteResponse:
    if not body.token and not body.code:
        raise HTTPException(status_code=400, detail="Must provide token or code")

    q = select(OwnerInvite)
    if body.token:
        q = q.where(OwnerInvite.token == body.token)
    else:
        q = q.where(OwnerInvite.code == (body.code or ""))
    inv = (await db.execute(q)).scalar_one_or_none()

    if not inv:
        raise HTTPException(status_code=404, detail="Invite not found")
    if inv.consumed_at is not None:
        raise HTTPException(status_code=410, detail="Invite already used")
    if inv.expires_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Invite expired")

    # Enforce email match (case-insensitive).
    if inv.email.lower() != user.email.lower():
        raise HTTPException(
            status_code=403,
            detail=f"Invite was issued for {inv.email}, but you're signed in as {user.email}.",
        )

    t = (await db.execute(select(Tenant).where(Tenant.id == inv.tenant_id))).scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Tenant no longer exists")

    # Promote to owner unless already admin/employee.
    p = (
        await db.execute(select(Profile).where(Profile.user_id == user.user_id))
    ).scalar_one_or_none()
    if p and p.role not in ("admin", "employee"):
        p.role = "owner"

    # Link owner → tenant (idempotent).
    await db.execute(
        pg_insert(TenantOwner)
        .values(user_id=user.user_id, tenant_id=inv.tenant_id)
        .on_conflict_do_nothing()
    )
    inv.consumed_at = datetime.now(timezone.utc)
    await db.commit()

    return AcceptInviteResponse(tenant_slug=t.slug, tenant_name=t.name)
