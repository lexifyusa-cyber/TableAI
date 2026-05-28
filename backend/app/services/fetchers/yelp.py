"""Yelp Fusion fetcher: business + hours + photos.

Reads `integrations.yelp_api_key` from app_settings. No-ops if not configured.
"""
from __future__ import annotations

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.app_setting import AppSetting
from app.models.tenant import Tenant
from app.services.knowledge.store import upsert_knowledge_row

YELP_SEARCH = "https://api.yelp.com/v3/businesses/search"
YELP_DETAILS = "https://api.yelp.com/v3/businesses/{id}"


class YelpError(RuntimeError):
    pass


async def _get_api_key(db: AsyncSession) -> str:
    row = (
        await db.execute(
            select(AppSetting).where(AppSetting.key == "integrations.yelp_api_key")
        )
    ).scalar_one_or_none()
    if not row or not row.value:
        raise YelpError("Yelp API key not configured. Add it at /admin/integrations.")
    return row.value


_DAY_MAP = {0: "monday", 1: "tuesday", 2: "wednesday", 3: "thursday", 4: "friday", 5: "saturday", 6: "sunday"}


def _convert_yelp_hours(hours_block: list | None) -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = {d: [] for d in [
        "monday","tuesday","wednesday","thursday","friday","saturday","sunday"
    ]}
    if not hours_block or not isinstance(hours_block, list):
        return out
    open_arr = (hours_block[0] or {}).get("open") or []
    for p in open_arr:
        day = _DAY_MAP.get(p.get("day"))
        s, e = p.get("start"), p.get("end")
        if not day or not s or not e or len(s) != 4 or len(e) != 4:
            continue
        out[day].append({"open": f"{s[:2]}:{s[2:]}", "close": f"{e[:2]}:{e[2:]}"})
    return out


async def fetch_yelp(db: AsyncSession, tenant: Tenant) -> None:
    api_key = await _get_api_key(db)
    headers = {"Authorization": f"Bearer {api_key}"}

    # 1. Search by name + address (or phone)
    params: dict[str, str] = {"term": tenant.name, "limit": "1"}
    addr = (tenant.contact or {}).get("address") if tenant.contact else None
    if addr:
        params["location"] = addr
    else:
        params["location"] = "United States"

    async with httpx.AsyncClient(timeout=10.0, headers=headers) as c:
        r = await c.get(YELP_SEARCH, params=params)
        if r.status_code != 200:
            raise YelpError(f"Yelp search failed: {r.status_code}")
        businesses = (r.json().get("businesses") or [])
        if not businesses:
            return
        biz_id = businesses[0]["id"]

        # 2. Details (includes hours, photos, rating, reviews)
        r2 = await c.get(YELP_DETAILS.format(id=biz_id))
        if r2.status_code != 200:
            raise YelpError(f"Yelp details failed: {r2.status_code}")
        d = r2.json()

    payload = {
        "yelp_id": biz_id,
        "name": d.get("name"),
        "url": d.get("url"),
        "rating": d.get("rating"),
        "review_count": d.get("review_count"),
        "photos": d.get("photos") or [],
        "hours": _convert_yelp_hours(d.get("hours")),
        "contact": {
            "address": ", ".join((d.get("location") or {}).get("display_address") or []),
            "phone": d.get("display_phone") or d.get("phone"),
        },
    }
    await upsert_knowledge_row(
        db,
        tenant_id=tenant.id,
        bucket="business",
        source="yelp_business",
        data=payload,
    )

    # Reputation row (rating + reviews summary; reviews API would be a separate paid call).
    await upsert_knowledge_row(
        db,
        tenant_id=tenant.id,
        bucket="reputation",
        source="yelp_fusion",
        data={
            "public": {
                "yelp_url": d.get("url"),
                "rating": d.get("rating"),
                "review_count": d.get("review_count"),
            },
            "private": {"yelp_id": biz_id},
        },
    )
