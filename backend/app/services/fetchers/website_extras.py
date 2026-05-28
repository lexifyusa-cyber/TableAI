"""Website-extras fetcher: re-scrapes the source URL, follows about/contact/locations,
extracts JSON-LD, and writes business/website_extras knowledge_sources row.

No API key needed; entirely from the tenant\'s own site.
"""
from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import Tenant
from app.services.knowledge.store import upsert_knowledge_row
from app.services.scraper import scrape, scrape_extra_pages


async def fetch_website_extras(db: AsyncSession, tenant: Tenant) -> None:
    if not tenant.source_url:
        return
    site = await scrape(tenant.source_url)
    extras = await scrape_extra_pages(tenant.source_url, site)

    payload = {
        "url": tenant.source_url,
        "hours": extras.get("hours") or {},
        "contact": extras.get("contact") or {},
        "extra_text_excerpt": (extras.get("extra_text") or "")[:4000],
    }
    # Only write if we actually found something
    if not (payload["hours"] or payload["contact"]):
        return
    await upsert_knowledge_row(
        db,
        tenant_id=tenant.id,
        bucket="business",
        source="website",
        data=payload,
    )
