"""TripAdvisor vision: discover the tenant\'s TA listing, render, vision-extract."""
from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import Tenant
from app.services.fetchers._vision_source import vision_extract_url
from app.services.web_search import web_search

SYSTEM = """You are reading screenshots of a TripAdvisor restaurant listing.
Extract: hours, address, phone if visible; and any menu items with prices in
the menu section. Use extract_menu_items once. If no prices are visible,
return an empty categories list."""


async def fetch_tripadvisor(db: AsyncSession, tenant: Tenant) -> None:
    addr = (tenant.contact or {}).get("address") or ""
    city = addr.split(",")[1].strip() if "," in addr else ""
    query = f"site:tripadvisor.com {tenant.name}" + (f" {city}" if city else "")
    urls = await web_search(query, host_filter=["tripadvisor.com"])
    url = next((u for u in urls if "tripadvisor.com" in u), None)
    if not url:
        return
    await vision_extract_url(
        db, tenant=tenant, url=url,
        bucket="reputation", source="tripadvisor_vision",
        system_prompt=SYSTEM, max_sections=3,
    )
