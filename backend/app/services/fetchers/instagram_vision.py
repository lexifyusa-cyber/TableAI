"""Instagram public profile: find via search, render profile page, vision-extract
any visible menu/specials/photos."""
from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import Tenant
from app.services.fetchers._vision_source import vision_extract_url
from app.services.web_search import web_search

SYSTEM = """You are reading a restaurant\'s public Instagram profile screenshot.
Extract: any menu items or specials visible in the recent posts grid, with name
and price if shown. Most posts are food photos — note any captions that include
prices. Ignore comments and "people you may know". Use extract_menu_items once."""


async def fetch_instagram(db: AsyncSession, tenant: Tenant) -> None:
    query = f"site:instagram.com {tenant.name}"
    urls = await web_search(query, host_filter=["instagram.com"])
    url = next((u for u in urls if "instagram.com" in u and not "/p/" in u), None)
    if not url:
        return
    await vision_extract_url(
        db, tenant=tenant, url=url,
        bucket="social", source="instagram_vision",
        system_prompt=SYSTEM, max_sections=2,
    )
