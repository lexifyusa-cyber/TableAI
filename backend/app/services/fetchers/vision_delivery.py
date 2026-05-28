"""vision_delivery fetcher: render an auto-discovered DoorDash/UberEats URL
in a real browser, screenshot, vision-extract items.

A real Chromium session looks like a customer to delivery platforms, bypassing
some of the bot-blocking the plain-httpx scraper hits.
"""
from __future__ import annotations

import base64
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.knowledge_source import KnowledgeSource
from app.models.tenant import Tenant
from app.services.fetchers.discovery import discover_delivery_urls
from app.services.knowledge.store import upsert_knowledge_row
from app.services.llm import get_provider_for
from app.services.render import render_page, render_sections, render_sections_stealth

log = logging.getLogger(__name__)

VISION_SYSTEM = """You are reading screenshots of a delivery app\'s menu page
(DoorDash / UberEats / GrubHub). The images are stacked from top to bottom.

EXTRACT MENU ITEMS. Strict rules:
- An item must have BOTH a name AND a price.
- Ignore search bars, filters, headers, footer, and category-jump menus.
- Convert prices to integer cents ($8.95 → 895).
- Group by category if visible.
- If unsure, OMIT.

Use extract_menu_items exactly once."""

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


async def fetch_vision_delivery(db: AsyncSession, tenant: Tenant) -> None:
    urls = await discover_delivery_urls(db, tenant)
    url = urls.get("doordash") or urls.get("ubereats") or urls.get("grubhub")
    if not url:
        return

    try:
        sections = await render_sections_stealth(url, max_sections=5)
    except Exception as e:  # noqa: BLE001
        log.warning("vision_delivery render failed for %s: %s", tenant.slug, e)
        return
    if not sections:
        return

    content_blocks: list[dict] = []
    for i, png in enumerate(sections):
        content_blocks.append({"type": "text", "text": f"Screenshot {i+1} of {len(sections)}:"})
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
        db, tenant_id=tenant.id, bucket="menu", source="vision_delivery",
        data={"rendered_url": url, "section_count": len(sections), "extracted": tool_input},
    )
