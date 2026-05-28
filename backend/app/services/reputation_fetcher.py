"""Google Places public-read integration — fills the reputation bucket.

Uses the Places API v1 (Text Search → Place Details). Requires a Google Maps
API key stored in app_settings under 'integrations.google_maps_api_key'.

We cache the discovered place_id on the knowledge_sources row so subsequent
refreshes skip the text-search round-trip.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from uuid import UUID

import httpx
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.app_setting import AppSetting
from app.models.knowledge_source import KnowledgeSource
from app.models.tenant import Tenant

PLACES_SEARCH = "https://places.googleapis.com/v1/places:searchText"
PLACES_DETAILS = "https://places.googleapis.com/v1/places/{place_id}"

SEARCH_FIELDS = "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount"
DETAILS_FIELDS = (
    "id,displayName,formattedAddress,rating,userRatingCount,priceLevel,"
    "reviews,editorialSummary,currentOpeningHours,regularOpeningHours"
)


class ReputationError(RuntimeError):
    pass


async def _get_api_key(db: AsyncSession) -> str:
    row = (
        await db.execute(
            select(AppSetting).where(AppSetting.key == "integrations.google_maps_api_key")
        )
    ).scalar_one_or_none()
    if not row or not row.value:
        raise ReputationError(
            "Google Maps API key not configured. Add it at /admin/integrations."
        )
    return row.value


async def _find_place_id(
    api_key: str, name: str, address: str | None
) -> str | None:
    query = f"{name} {address}" if address else name
    async with httpx.AsyncClient(timeout=10.0) as c:
        r = await c.post(
            PLACES_SEARCH,
            headers={
                "Content-Type": "application/json",
                "X-Goog-Api-Key": api_key,
                "X-Goog-FieldMask": SEARCH_FIELDS,
            },
            content=json.dumps({"textQuery": query, "maxResultCount": 1}),
        )
    if r.status_code != 200:
        raise ReputationError(f"Places search failed: {r.status_code} {r.text[:200]}")
    data = r.json()
    places = data.get("places") or []
    return places[0]["id"] if places else None


async def _fetch_place_details(api_key: str, place_id: str) -> dict:
    async with httpx.AsyncClient(timeout=10.0) as c:
        r = await c.get(
            PLACES_DETAILS.format(place_id=place_id),
            headers={
                "X-Goog-Api-Key": api_key,
                "X-Goog-FieldMask": DETAILS_FIELDS,
            },
        )
    if r.status_code != 200:
        raise ReputationError(f"Places details failed: {r.status_code} {r.text[:200]}")
    return r.json()


def _shape_reputation_payload(existing_place_id: str | None, details: dict) -> dict:
    """Shape payload with public (customer-safe) and private (owner-only) splits.

    Public: headline rating, positive review snippets, top-dish hints.
    Private: individual negative reviews (so owner can triage), raw place_id,
    detailed review metadata.
    """
    all_reviews = []
    for rv in details.get("reviews") or []:
        all_reviews.append(
            {
                "author": (rv.get("authorAttribution") or {}).get("displayName") or "A customer",
                "rating": rv.get("rating"),
                "text": (rv.get("text") or {}).get("text") or "",
                "time": rv.get("publishTime"),
            }
        )

    price_level_str = details.get("priceLevel") or ""
    price_level = None
    for i, level in enumerate(
        ["PRICE_LEVEL_FREE", "PRICE_LEVEL_INEXPENSIVE", "PRICE_LEVEL_MODERATE",
         "PRICE_LEVEL_EXPENSIVE", "PRICE_LEVEL_VERY_EXPENSIVE"]
    ):
        if price_level_str == level:
            price_level = i
            break

    positive = [r for r in all_reviews if (r.get("rating") or 0) >= 4]
    negative = [r for r in all_reviews if (r.get("rating") or 0) <= 3]

    public = {
        "display_name": (details.get("displayName") or {}).get("text"),
        "formatted_address": details.get("formattedAddress"),
        "rating": details.get("rating"),
        "review_count": details.get("userRatingCount"),
        "price_level": price_level,
        "editorial_summary": (details.get("editorialSummary") or {}).get("text"),
        "reviews": positive[:5],   # only positives reach customer-facing chat
    }
    private = {
        "place_id": details.get("id") or existing_place_id,
        "negative_reviews": negative,
        "all_reviews_count": len(all_reviews),
    }
    return {"public": public, "private": private}


async def refresh_reputation(db: AsyncSession, tenant: Tenant) -> dict:
    """Fetch Google Places data for a tenant and upsert the knowledge_sources row.

    Returns the payload that got stored.
    """
    api_key = await _get_api_key(db)

    # Check if we already have a cached place_id.
    existing = (
        await db.execute(
            select(KnowledgeSource).where(
                KnowledgeSource.tenant_id == tenant.id,
                KnowledgeSource.bucket == "reputation",
                KnowledgeSource.source == "google_places",
            )
        )
    ).scalar_one_or_none()
    place_id: str | None = (existing.data or {}).get("place_id") if existing else None

    # Read cached place_id from the private side if already populated with new shape.
    if existing and not place_id:
        place_id = ((existing.data or {}).get("private") or {}).get("place_id")

    if not place_id:
        name = tenant.name
        address = (tenant.contact or {}).get("address") if tenant.contact else None
        place_id = await _find_place_id(api_key, name, address)
        if not place_id:
            raise ReputationError(f"No Google Places match found for '{tenant.name}'.")

    details = await _fetch_place_details(api_key, place_id)
    payload = _shape_reputation_payload(place_id, details)

    stmt = pg_insert(KnowledgeSource).values(
        tenant_id=tenant.id,
        bucket="reputation",
        source="google_places",
        data=payload,
        fetched_at=datetime.now(timezone.utc),
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=["tenant_id", "bucket", "source"],
        set_={"data": stmt.excluded.data, "fetched_at": stmt.excluded.fetched_at},
    )
    await db.execute(stmt)
    await db.commit()
    return payload
