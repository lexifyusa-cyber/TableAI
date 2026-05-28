"""Admin-only integrations API — non-LLM external services (Google Maps, Yelp, …).

Keys live in app_settings under 'integrations.*' and are masked on read.
Separate from /api/admin/providers which is for LLM providers.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import CurrentUser, require_role
from app.db import get_session
from app.models.app_setting import AppSetting
from app.models.tenant import Tenant
from app.services.reputation_fetcher import ReputationError, refresh_reputation

router = APIRouter(tags=["integrations"])


def _mask(value: str) -> str:
    if not value:
        return ""
    if len(value) < 10:
        return "•" * len(value)
    return value[:6] + "•" * 8 + value[-4:]


class IntegrationsResponse(BaseModel):
    google_maps_api_key_masked: str
    google_maps_api_key_present: bool


class IntegrationsUpdate(BaseModel):
    google_maps_api_key: str | None = None


async def _get_setting(db: AsyncSession, key: str) -> str:
    row = (
        await db.execute(select(AppSetting).where(AppSetting.key == key))
    ).scalar_one_or_none()
    return row.value if row else ""


async def _set_setting(db: AsyncSession, key: str, value: str) -> None:
    stmt = pg_insert(AppSetting).values(key=key, value=value)
    stmt = stmt.on_conflict_do_update(
        index_elements=[AppSetting.key], set_={"value": stmt.excluded.value}
    )
    await db.execute(stmt)
    await db.commit()


@router.get("/admin/integrations", response_model=IntegrationsResponse)
async def get_integrations(
    _: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_session),
) -> IntegrationsResponse:
    gmaps = await _get_setting(db, "integrations.google_maps_api_key")
    return IntegrationsResponse(
        google_maps_api_key_masked=_mask(gmaps),
        google_maps_api_key_present=bool(gmaps),
    )


@router.patch("/admin/integrations", response_model=IntegrationsResponse)
async def update_integrations(
    body: IntegrationsUpdate,
    _: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_session),
) -> IntegrationsResponse:
    if body.google_maps_api_key is not None and body.google_maps_api_key.strip():
        await _set_setting(db, "integrations.google_maps_api_key", body.google_maps_api_key.strip())
    return await get_integrations(_, db)  # type: ignore[arg-type]


class RefreshResult(BaseModel):
    ok: bool
    detail: str
    rating: float | None = None
    review_count: int | None = None


@router.post("/admin/tenants/{slug}/refresh/reputation", response_model=RefreshResult)
async def refresh_tenant_reputation(
    slug: str,
    _: CurrentUser = Depends(require_role("admin", "employee")),
    db: AsyncSession = Depends(get_session),
) -> RefreshResult:
    t = (
        await db.execute(select(Tenant).where(Tenant.slug == slug))
    ).scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Tenant not found")
    try:
        payload = await refresh_reputation(db, t)
    except ReputationError as e:
        return RefreshResult(ok=False, detail=str(e))
    return RefreshResult(
        ok=True,
        detail=f"Pulled {len(payload.get('reviews') or [])} reviews from Google Places.",
        rating=payload.get("rating"),
        review_count=payload.get("review_count"),
    )
