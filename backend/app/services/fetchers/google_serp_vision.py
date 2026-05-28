"""Google SERP vision fetcher: screenshot the search results page for
"{name} {city} menu" — Google\'s right-side knowledge panel often shows a
"Popular dishes" section with photos and prices, which is otherwise impossible
to scrape.
"""
from __future__ import annotations

from urllib.parse import quote_plus

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import Tenant
from app.services.fetchers._vision_source import vision_extract_url

SYSTEM = """You are reading screenshots of a Google search results page for a
restaurant. Google often shows a \"Popular dishes\" panel (right side or in a
knowledge card) with dish names, prices, and photos.

EXTRACT every dish you can see with both a name AND a price. Convert prices to
integer cents (e.g. $9.95 -> 995). Ignore navigation, ads, news headlines,
review snippets, and "people also ask" boxes. Use extract_menu_items once."""


async def fetch_google_serp_vision(db: AsyncSession, tenant: Tenant) -> None:
    addr = (tenant.contact or {}).get("address") or ""
    city = addr.split(",")[1].strip() if "," in addr else ""
    query = f"{tenant.name} {city} menu prices".strip()
    url = f"https://www.google.com/search?q={quote_plus(query)}"
    await vision_extract_url(
        db, tenant=tenant, url=url,
        bucket="menu", source="google_serp_vision",
        system_prompt=SYSTEM, max_sections=2,
    )
