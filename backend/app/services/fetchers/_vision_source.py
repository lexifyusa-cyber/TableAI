"""Generic discovery-render-vision pattern shared by all the
2026-era external menu sources. Each concrete fetcher just supplies:
  - a discover_fn(name, addr) -> url | None
  - a vision system prompt
  - what to do with the extracted tool_input

Reuses Playwright stealth render + Grok vision provider.
"""
from __future__ import annotations

import base64
import logging
from typing import Any, Awaitable, Callable

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import Tenant
from app.services.knowledge.store import upsert_knowledge_row
from app.services.llm import get_provider_for
from app.services.render import render_sections_stealth

log = logging.getLogger(__name__)

DEFAULT_EXTRACT_TOOL = {
    "name": "extract_menu_items",
    "description": "Return all items visible in the screenshot(s).",
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
                                    "image_url": {"type": "string"},
                                },
                            },
                        },
                    },
                },
            }
        },
    },
}


async def vision_extract_url(
    db: AsyncSession,
    *,
    tenant: Tenant,
    url: str,
    bucket: str,
    source: str,
    system_prompt: str,
    extract_tool: dict[str, Any] = DEFAULT_EXTRACT_TOOL,
    max_sections: int = 5,
) -> None:
    """Render `url`, send screenshots to vision model, store extracted items in
    knowledge_sources[bucket/source]. Best-effort: failures are logged + no-op.
    """
    try:
        shots = await render_sections_stealth(url, max_sections=max_sections)
    except Exception as e:  # noqa: BLE001
        log.warning("vision_source[%s] render failed for %s: %s", source, tenant.slug, e)
        return
    if not shots:
        return

    content_blocks: list[dict] = []
    for i, png in enumerate(shots):
        content_blocks.append({"type": "text", "text": f"Screenshot {i+1} of {len(shots)}:"})
        content_blocks.append({
            "type": "image",
            "source": {"type": "base64", "media_type": "image/png", "data": base64.b64encode(png).decode()},
        })

    try:
        provider, model = await get_provider_for("vision")
        response = await provider.complete(
            model=model,
            system=system_prompt,
            messages=[{"role": "user", "content": content_blocks}],
            tools=[extract_tool],
            tool_choice={"type": "tool", "name": extract_tool["name"]},
            max_tokens=8192,
        )
    except Exception as e:  # noqa: BLE001
        log.warning("vision_source[%s] LLM call failed for %s: %s", source, tenant.slug, e)
        return

    tool_input = None
    for tc in response.tool_calls:
        if tc.get("name") == extract_tool["name"]:
            tool_input = dict(tc.get("input") or {})
            break
    if not tool_input:
        return

    await upsert_knowledge_row(
        db, tenant_id=tenant.id, bucket=bucket, source=source,
        data={"rendered_url": url, "section_count": len(shots), "extracted": tool_input},
    )
