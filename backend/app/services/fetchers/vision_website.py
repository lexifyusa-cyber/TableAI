"""vision_website fetcher: render the tenant\'s homepage + menu page in a
real browser, screenshot, send to vision model for menu extraction.

Only runs if the existing text-scraped menu returned <5 items OR the menu page
was image-heavy. The cheaper sources should have already filled in usable text.
"""
from __future__ import annotations

import base64
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.knowledge_source import KnowledgeSource
from app.models.tenant import Tenant
from app.services.knowledge.store import upsert_knowledge_row
from app.services.llm import get_provider_for
from app.services.render import render_page, render_sections

log = logging.getLogger(__name__)

VISION_SYSTEM = """You are reading screenshots of a restaurant\'s menu page.
The images are stacked from top to bottom of the page (image 1 = top, last = bottom).

EXTRACT MENU ITEMS. Strict rules:
- An item must have BOTH a visible name AND a visible price (e.g. "$8.95", "12.00").
- Ignore allergen reference tables, ingredient lists, nutrition charts, "build your own" lists,
  or any section that lists raw ingredients (proteins, sauces, toppings) without prices.
- Ignore navigation, footer, FAQ, and contact sections.
- Group items by category if categories are visible (e.g. "Burritos", "Sides", "Drinks").
- Price must be in integer CENTS (e.g. $8.95 → 895).
- If unsure whether something is a real menu item, OMIT it.

Use the extract_menu_items tool exactly once."""

EXTRACT_TOOL = {
    "name": "extract_menu_items",
    "description": "Return all items visible in the screenshot.",
    "input_schema": {
        "type": "object",
        "properties": {
            "categories": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "items": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "name": {"type": "string"},
                                    "description": {"type": "string"},
                                    "price_cents": {"type": "integer"},
                                },
                            },
                        },
                    },
                },
            }
        },
    },
}


async def _existing_menu_item_count(db: AsyncSession, tenant: Tenant) -> int:
    """Count menu items already filled with prices on the canonical tables."""
    row = (await db.execute(
        select(KnowledgeSource).where(
            KnowledgeSource.tenant_id == tenant.id,
            KnowledgeSource.bucket == "menu",
        )
    )).scalars().all()
    return len(row) * 0  # placeholder; the gating below uses a different signal


async def fetch_vision_website(db: AsyncSession, tenant: Tenant) -> None:
    """Render tenant.source_url + first menu link, OCR via vision."""
    if not tenant.source_url:
        return

    # Cheap gating: if we already have a menu/site_menu row with a healthy item count, skip.
    site_menu = (await db.execute(
        select(KnowledgeSource).where(
            KnowledgeSource.tenant_id == tenant.id,
            KnowledgeSource.bucket == "menu",
            KnowledgeSource.source == "site_menu",
        )
    )).scalar_one_or_none()
    if site_menu and isinstance(site_menu.data, dict):
        cats = (site_menu.data.get("extracted") or {}).get("categories") or []
        item_count = sum(len(c.get("items") or []) for c in cats)
        priced = sum(1 for c in cats for it in (c.get("items") or []) if it.get("price_cents"))
        if item_count >= 5 and priced >= max(1, item_count // 4):
            return  # we already have a reasonable menu with at least some prices

    # Try the menu page first (where menu items actually live); fall back to homepage.
    from app.services.scraper import fetch_html, parse_site
    target_url = tenant.source_url
    try:
        homepage_html = await fetch_html(tenant.source_url, timeout=15.0)
        site = parse_site(tenant.source_url, homepage_html)
        if site.menu_links:
            target_url = site.menu_links[0]
    except Exception:
        pass

    try:
        sections = await render_sections(target_url, max_sections=5)
    except Exception as e:  # noqa: BLE001
        log.warning("vision_website render failed for %s: %s", tenant.slug, e)
        return

    if not sections:
        return

    content_blocks: list[dict] = []
    for i, png in enumerate(sections):
        content_blocks.append({"type": "text", "text": f"Screenshot {i+1} of {len(sections)} (from top to bottom):"})
        content_blocks.append({
            "type": "image",
            "source": {"type": "base64", "media_type": "image/png", "data": base64.b64encode(png).decode()},
        })

    provider, model = await get_provider_for("vision")
    response = await provider.complete(
        model=model,
        system=VISION_SYSTEM,
        messages=[{"role": "user", "content": content_blocks}],
        tools=[EXTRACT_TOOL],
        tool_choice={"type": "tool", "name": "extract_menu_items"},
        max_tokens=8192,
    )
    tool_input = None
    for tc in response.tool_calls:
        if tc.get("name") == "extract_menu_items":
            tool_input = dict(tc.get("input") or {})
            break
    if tool_input is None:
        return

    await upsert_knowledge_row(
        db, tenant_id=tenant.id, bucket="menu", source="vision_website",
        data={"rendered_url": target_url, "section_count": len(sections), "extracted": tool_input},
    )
