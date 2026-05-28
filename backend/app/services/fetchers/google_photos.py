"""Google Places photos fetcher: pulls photo[] from Places Details and
downloads top N to the public media tier.

Builds on the cached `place_id` written by google_business fetcher to avoid
re-running the Text Search call.
"""
from __future__ import annotations

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.app_setting import AppSetting
from app.models.knowledge_source import KnowledgeSource
from app.models.tenant import Tenant
from app.services.knowledge.store import upsert_knowledge_row
from app.services.media import download_and_cache

PLACES_DETAILS = "https://places.googleapis.com/v1/places/{place_id}"
PHOTO_FIELDS = "id,photos"

MAX_PHOTOS = 6


class GooglePhotosError(RuntimeError):
    pass


async def _get_api_key(db: AsyncSession) -> str:
    row = (
        await db.execute(
            select(AppSetting).where(AppSetting.key == "integrations.google_maps_api_key")
        )
    ).scalar_one_or_none()
    if not row or not row.value:
        raise GooglePhotosError("Google Maps API key not configured.")
    return row.value


async def _get_place_id(db: AsyncSession, tenant: Tenant) -> str | None:
    rows = (
        await db.execute(
            select(KnowledgeSource).where(
                KnowledgeSource.tenant_id == tenant.id,
                KnowledgeSource.source.in_(["google_places_business", "google_places"]),
            )
        )
    ).scalars().all()
    for row in rows:
        data = row.data or {}
        pid = data.get("place_id") or (data.get("private") or {}).get("place_id")
        if pid:
            return pid
    return None


async def fetch_google_photos(db: AsyncSession, tenant: Tenant) -> None:
    api_key = await _get_api_key(db)
    place_id = await _get_place_id(db, tenant)
    if not place_id:
        return  # let google_business run first

    async with httpx.AsyncClient(timeout=10.0) as c:
        r = await c.get(
            PLACES_DETAILS.format(place_id=place_id),
            headers={"X-Goog-Api-Key": api_key, "X-Goog-FieldMask": PHOTO_FIELDS},
        )
    if r.status_code != 200:
        raise GooglePhotosError(f"Places details (photos) failed: {r.status_code}")

    photos = (r.json().get("photos") or [])[:MAX_PHOTOS]
    refs: list[dict] = []
    for p in photos:
        photo_name = p.get("name")  # e.g. "places/{place_id}/photos/{photo_id}"
        if not photo_name:
            continue
        # Places Photo media URL: GET /v1/{name}/media?key=...&maxWidthPx=1600
        media_url = f"https://places.googleapis.com/v1/{photo_name}/media?key={api_key}&maxWidthPx=1600"
        try:
            ref = await download_and_cache(
                db,
                url=media_url,
                source="google_places_photo",
                tenant_id=tenant.id,
                tenant_slug=tenant.slug,
                classification="hero",
            )
            refs.append({
                "tier": ref.tier,
                "relative_path": ref.relative_path,
                "mime": ref.mime,
                "bytes": ref.bytes,
            })
        except Exception as e:  # noqa: BLE001 — single-photo failure shouldn\'t kill the batch
            refs.append({"error": str(e)[:120]})

    await upsert_knowledge_row(
        db,
        tenant_id=tenant.id,
        bucket="social",
        source="google_places_photo",
        data={"photos": refs, "place_id": place_id},
    )
