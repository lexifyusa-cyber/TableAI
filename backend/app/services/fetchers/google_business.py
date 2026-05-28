"""Google Places business-info fetcher: writes hours + address + phone
into the `business/google_places_business` knowledge_sources row.

Reuses the Place ID discovery cached on the existing reputation row (avoids a
second text-search round-trip when the tenant already had reputation enriched).
"""
from __future__ import annotations

import json
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.app_setting import AppSetting
from app.models.knowledge_source import KnowledgeSource
from app.models.tenant import Tenant
from app.services.knowledge.store import upsert_knowledge_row

PLACES_SEARCH = "https://places.googleapis.com/v1/places:searchText"
PLACES_DETAILS = "https://places.googleapis.com/v1/places/{place_id}"

SEARCH_FIELDS = "places.id,places.displayName,places.formattedAddress"
DETAILS_FIELDS = (
    "id,displayName,formattedAddress,internationalPhoneNumber,nationalPhoneNumber,"
    "websiteUri,regularOpeningHours,currentOpeningHours,editorialSummary"
)


class GoogleBusinessError(RuntimeError):
    pass


async def _get_api_key(db: AsyncSession) -> str:
    row = (
        await db.execute(
            select(AppSetting).where(AppSetting.key == "integrations.google_maps_api_key")
        )
    ).scalar_one_or_none()
    if not row or not row.value:
        raise GoogleBusinessError(
            "Google Maps API key not configured. Add it at /admin/integrations."
        )
    return row.value


async def _find_place_id(api_key: str, name: str, address: str | None) -> str | None:
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
        raise GoogleBusinessError(f"Places search failed: {r.status_code} {r.text[:200]}")
    places = (r.json().get("places") or [])
    return places[0]["id"] if places else None


async def _fetch_details(api_key: str, place_id: str) -> dict:
    async with httpx.AsyncClient(timeout=10.0) as c:
        r = await c.get(
            PLACES_DETAILS.format(place_id=place_id),
            headers={
                "X-Goog-Api-Key": api_key,
                "X-Goog-FieldMask": DETAILS_FIELDS,
            },
        )
    if r.status_code != 200:
        raise GoogleBusinessError(f"Places details failed: {r.status_code} {r.text[:200]}")
    return r.json()


# Day index used by the Places API: 0=Sunday, 1=Monday, ... 6=Saturday
_DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]


def _format_time(t: dict[str, Any] | None) -> str | None:
    if not t:
        return None
    h = t.get("hour")
    m = t.get("minute") or 0
    if h is None:
        return None
    return f"{int(h):02d}:{int(m):02d}"


def _convert_places_hours(places_hours: dict | None) -> dict[str, list[dict]]:
    """Convert Places API `regularOpeningHours.periods[]` to TableAI hours shape.

    Output:
      {
        "monday":    [{"open": "11:00", "close": "22:00"}],
        "tuesday":   [...],
        ...
        "wednesday": []        # explicit closed
      }
    """
    out: dict[str, list[dict]] = {d: [] for d in _DAY_NAMES}
    if not places_hours:
        return out
    periods = places_hours.get("periods") or []
    for p in periods:
        op = p.get("open") or {}
        cl = p.get("close") or {}
        day_idx = op.get("day")
        if day_idx is None or not 0 <= day_idx <= 6:
            continue
        open_t = _format_time(op)
        close_t = _format_time(cl) if cl else None
        if not open_t:
            continue
        # 24-hour places sometimes omit close
        out[_DAY_NAMES[day_idx]].append({"open": open_t, "close": close_t or "23:59"})
    return out


async def fetch_google_business(db: AsyncSession, tenant: Tenant) -> None:
    """Hit Google Places, write business/google_places_business row with normalized payload."""
    api_key = await _get_api_key(db)

    # Look up cached place_id from any existing Google row for this tenant.
    cached = (
        await db.execute(
            select(KnowledgeSource).where(
                KnowledgeSource.tenant_id == tenant.id,
                KnowledgeSource.source.in_(["google_places", "google_places_business"]),
            )
        )
    ).scalars().all()
    place_id: str | None = None
    for row in cached:
        data = row.data or {}
        # Existing reputation row has place_id under `private`
        candidate = (data.get("private") or {}).get("place_id") or data.get("place_id")
        if candidate:
            place_id = candidate
            break

    if not place_id:
        addr = (tenant.contact or {}).get("address") if tenant.contact else None
        place_id = await _find_place_id(api_key, tenant.name, addr)
    if not place_id:
        raise GoogleBusinessError(f"no Google Places match for {tenant.name!r}")

    details = await _fetch_details(api_key, place_id)

    payload = {
        # Normalized shape that merge_to_canonical knows how to read.
        "hours": _convert_places_hours(details.get("regularOpeningHours")),
        "contact": {
            "address": details.get("formattedAddress"),
            "phone": details.get("internationalPhoneNumber") or details.get("nationalPhoneNumber"),
            "website": details.get("websiteUri"),
        },
        "tagline": (details.get("editorialSummary") or {}).get("text"),
        # Keep raw bits for future use & debugging
        "place_id": place_id,
        "display_name": (details.get("displayName") or {}).get("text"),
        "_raw_hours": details.get("regularOpeningHours"),
    }

    await upsert_knowledge_row(
        db,
        tenant_id=tenant.id,
        bucket="business",
        source="google_places_business",
        data=payload,
    )
