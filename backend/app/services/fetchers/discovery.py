"""Auto-discovers a tenant\'s delivery platform URLs via layered fallbacks.

Stored in `knowledge_sources` bucket=\"operational\" source=\"delivery_discovery\"
so subsequent fetcher runs don\'t repay the discovery cost.
"""
from __future__ import annotations

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.knowledge_source import KnowledgeSource
from app.models.tenant import Tenant
from app.services.knowledge.store import upsert_knowledge_row
from app.services.scraper import extract_delivery_links
from app.services.web_search import web_search, google_places_site_search

USER_AGENT = "Mozilla/5.0 (compatible; TableAI/0.1)"

PLATFORM_HOSTS = {
    "doordash": "doordash.com/store",
    "ubereats": "ubereats.com/store",
    "grubhub":  "grubhub.com/restaurant",
}


async def _fetch_homepage_html(url: str) -> str:
    try:
        async with httpx.AsyncClient(
            follow_redirects=True, timeout=15.0,
            headers={"User-Agent": USER_AGENT},
        ) as c:
            r = await c.get(url)
        return r.text if r.status_code == 200 else ""
    except httpx.HTTPError:
        return ""


async def _load_cached(db: AsyncSession, tenant: Tenant) -> dict[str, str]:
    row = (await db.execute(
        select(KnowledgeSource).where(
            KnowledgeSource.tenant_id == tenant.id,
            KnowledgeSource.bucket == "operational",
            KnowledgeSource.source == "delivery_discovery",
        )
    )).scalar_one_or_none()
    if row and isinstance(row.data, dict):
        return dict(row.data.get("urls") or {})
    return {}


async def discover_delivery_urls(db: AsyncSession, tenant: Tenant) -> dict[str, str]:
    """Returns {platform: url}. Cached, then scrape, then web search."""
    cached = await _load_cached(db, tenant)
    if cached:
        return cached

    found: dict[str, str] = {}

    # 1. Tenant homepage outbound links
    if tenant.source_url:
        html = await _fetch_homepage_html(tenant.source_url)
        if html:
            found.update(extract_delivery_links(html))

    # 2. Web search fallback for missing platforms
    name = tenant.name
    addr = (tenant.contact or {}).get("address") or ""
    city = addr.split(",")[1].strip() if "," in addr else ""

    for platform, host_substr in PLATFORM_HOSTS.items():
        if platform in found:
            continue
        host = host_substr.split("/")[0]
        query = f"site:{host} {name}" + (f" {city}" if city else "")

        # Try Google Places first (likely empty for site: queries, but cheap)
        urls = await google_places_site_search(db, query)
        match = next((u for u in urls if host_substr in u), None)
        if match:
            found[platform] = match
            continue

        # DuckDuckGo fallback
        urls = await web_search(query, host_filter=[host_substr])
        match = next((u for u in urls if host_substr in u), None)
        if match:
            found[platform] = match

    if found:
        await upsert_knowledge_row(
            db, tenant_id=tenant.id, bucket="operational", source="delivery_discovery",
            data={"urls": found},
        )

    return found
