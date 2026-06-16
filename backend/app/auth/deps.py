"""FastAPI dependencies for authn + role-based authz.

Usage:
    from app.auth.deps import CurrentUser, require_role, require_tenant_access

    @router.get("/admin/users")
    async def list_users(user: CurrentUser = Depends(require_role("admin"))):
        ...

    @router.get("/conversations")
    async def list_convos(
        tenant: str,
        user: CurrentUser = Depends(require_tenant_access()),
    ):
        ...
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated
from uuid import UUID, uuid5, NAMESPACE_DNS

from fastapi import Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.auth.supabase import verify_token
from app.db import get_session
from app.models.profile import Profile
from app.models.tenant import Tenant
from app.models.tenant_owner import TenantOwner


@dataclass(slots=True)
class CurrentUser:
    user_id: UUID
    email: str
    role: str  # "admin" | "employee" | "owner"


def _extract_bearer(request: Request) -> str | None:
    auth = request.headers.get("Authorization") or request.headers.get("authorization")
    if not auth or not auth.lower().startswith("bearer "):
        return None
    return auth.split(" ", 1)[1].strip()


async def current_user_optional(
    request: Request, db: AsyncSession = Depends(get_session)
) -> CurrentUser | None:
    """Returns the current user if the request carries a valid bearer token,
    None otherwise. Used by endpoints that allow both anonymous and authed access
    (e.g. public customer chat)."""
    token = _extract_bearer(request)
    if not token:
        s = get_settings()
        if s.app_env == "development" and request.headers.get("x-dev-auth") == "1":
            email = (request.headers.get("x-dev-email") or "").strip()
            if not email:
                return None
            role = (request.headers.get("x-dev-role") or "owner").strip().lower()
            if role not in ("admin", "employee", "owner"):
                role = "owner"
            user_id = uuid5(NAMESPACE_DNS, f"tableai-dev:{email.lower()}")
            profile = (
                await db.execute(select(Profile).where(Profile.user_id == user_id))
            ).scalar_one_or_none()
            if profile:
                if profile.email != email or profile.role != role:
                    profile.email = email
                    profile.role = role
                    await db.commit()
                return CurrentUser(user_id=profile.user_id, email=profile.email, role=profile.role)
            new_profile = Profile(user_id=user_id, email=email, role=role, display_name=None)
            db.add(new_profile)
            await db.commit()
            return CurrentUser(user_id=user_id, email=email, role=role)
        return None
    supa_user = await verify_token(token)
    if not supa_user or "id" not in supa_user:
        return None
    user_id = UUID(supa_user["id"])

    profile = (
        await db.execute(select(Profile).where(Profile.user_id == user_id))
    ).scalar_one_or_none()

    if profile:
        return CurrentUser(user_id=profile.user_id, email=profile.email, role=profile.role)

    # Auto-provision a profile on first login as an 'owner' with no tenants.
    # Admin/employee promotion happens separately via /api/admin/users.
    email = supa_user.get("email") or f"{user_id}@unknown"
    new_profile = Profile(user_id=user_id, email=email, role="owner", display_name=None)
    db.add(new_profile)
    await db.commit()
    return CurrentUser(user_id=user_id, email=email, role="owner")


async def current_user(
    request: Request, db: AsyncSession = Depends(get_session)
) -> CurrentUser:
    """Requires a valid bearer token. 401 otherwise."""
    u = await current_user_optional(request, db)
    if not u:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    return u


def require_role(*roles: str):
    """Dependency factory: require the caller's role to be in `roles`."""

    async def _dep(user: CurrentUser = Depends(current_user)) -> CurrentUser:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user.role}' not permitted (need one of {list(roles)})",
            )
        return user

    return _dep


def require_tenant_access(tenant_param: str = "tenant"):
    """Dependency factory: ensure the caller can access the tenant named in
    query param ``tenant_param`` (default 'tenant').

    Admin and employee bypass the owner-link check. Owners must have a row in
    `tenant_owners` for that tenant.
    """

    async def _dep(
        request: Request,
        user: CurrentUser = Depends(current_user),
        db: AsyncSession = Depends(get_session),
    ) -> tuple[CurrentUser, Tenant]:
        slug = request.query_params.get(tenant_param)
        if not slug:
            # Also accept path params (for /conversations/{id} style endpoints)
            slug = request.path_params.get(tenant_param)
        if not slug:
            raise HTTPException(status_code=400, detail=f"Missing '{tenant_param}' parameter")

        t = (
            await db.execute(select(Tenant).where(Tenant.slug == slug))
        ).scalar_one_or_none()
        if not t:
            raise HTTPException(status_code=404, detail=f"Tenant '{slug}' not found")

        if user.role in ("admin", "employee"):
            return user, t

        link = (
            await db.execute(
                select(TenantOwner).where(
                    TenantOwner.user_id == user.user_id,
                    TenantOwner.tenant_id == t.id,
                )
            )
        ).scalar_one_or_none()
        if not link:
            raise HTTPException(status_code=403, detail="No access to this tenant")

        return user, t

    return _dep


AuthedUser = Annotated[CurrentUser, Depends(current_user)]
MaybeUser = Annotated[CurrentUser | None, Depends(current_user_optional)]
_ = Query  # re-exported for convenience
