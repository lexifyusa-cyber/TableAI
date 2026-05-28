"""Vision-OCR fetcher: when the menu page is image-only, send it to a
vision-capable model and extract structured items.

Requires a vision-capable provider (Anthropic Claude with image input, or
OpenAI gpt-4o-style). Uses the existing `get_provider_for("vision")`
which returns whatever is configured globally.

Best-effort: no-ops if no menu_html-via-image was detected during scraping.
"""
from __future__ import annotations

import base64

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import Tenant
from app.services.knowledge.store import upsert_knowledge_row

VISION_SYSTEM = """You are reading a restaurant menu image. Extract every visible
item with its name, price, and category if shown. Return via the
extract_menu_items tool. Do NOT invent items or prices."""

EXTRACT_TOOL = {
    "name": "extract_menu_items",
    "description": "Return the items visible in the menu image.",
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
                                    "price_cents": {"type": "integer"},
                                    "description": {"type": "string"},
                                },
                            },
                        },
                    },
                },
            }
        },
    },
}


async def fetch_vision_ocr(db: AsyncSession, tenant: Tenant) -> None:
    """Stub: needs a separate path to identify the menu image URL.

    Future wiring: scraper flags `menu_is_image=true` + sets `menu_image_url`
    in the business/website row; this fetcher reads that and runs OCR.

    For now: no-op unless `tenant.metadata_.menu_image_url` is set manually.
    """
    # Read menu_image_url from the business/website knowledge_sources row.
    from sqlalchemy import select
    from app.models.knowledge_source import KnowledgeSource
    row = (await db.execute(
        select(KnowledgeSource).where(
            KnowledgeSource.tenant_id == tenant.id,
            KnowledgeSource.bucket == "business",
            KnowledgeSource.source == "website",
        )
    )).scalar_one_or_none()
    if not row or not isinstance(row.data, dict):
        return
    if not row.data.get("menu_is_image"):
        return
    img_url = row.data.get("menu_image_url")
    if not img_url:
        return
    if not img_url:
        return

    # Download the image
    try:
        async with httpx.AsyncClient(timeout=20.0) as c:
            r = await c.get(img_url)
        if r.status_code != 200:
            return
        b64 = base64.b64encode(r.content).decode()
        mime = r.headers.get("content-type") or "image/jpeg"
    except httpx.HTTPError:
        return

    # Send to vision-capable provider via the existing abstraction.
    from app.services.llm import get_provider_for
    provider, model = await get_provider_for("vision")

    image_block = {
        "type": "image",
        "source": {"type": "base64", "media_type": mime, "data": b64},
    }
    response = await provider.complete(
        model=model,
        system=VISION_SYSTEM,
        messages=[{"role": "user", "content": [image_block]}],
        tools=[EXTRACT_TOOL],
        tool_choice={"type": "tool", "name": "extract_menu_items"},
        max_tokens=4096,
    )
    tool_input: dict | None = None
    for tc in response.tool_calls:
        if tc.get("name") == "extract_menu_items":
            tool_input = dict(tc.get("input") or {})
            break
    if tool_input is None:
        return

    await upsert_knowledge_row(
        db,
        tenant_id=tenant.id,
        bucket="menu",
        source="vision_ocr",
        data={"image_url": img_url, "extracted": tool_input},
    )
