"""DoorDash / UberEats consumer menu scrape.

These platforms expose public consumer-facing menu pages with names, prices, and
photos. They actively block scrapers (403 / captcha) and use heavy JS for some
data, so this fetcher is best-effort: it tries a polite GET, parses what it
can, and writes a knowledge_sources row with `{error: "..."}` if blocked.

For chains that the customer is unlikely to be on DoorDash yet, this fetcher
will simply find nothing — that\'s OK, the orchestrator catches errors.
"""
from __future__ import annotations

import re
from typing import Any

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import Tenant
from app.services.knowledge.store import upsert_knowledge_row

USER_AGENT = "Mozilla/5.0 (compatible; TableAI/0.1; +https://tableai.app)"


async def _try_fetch(url: str) -> tuple[int, str]:
    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=15.0,
            headers={"User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.9"},
        ) as c:
            r = await c.get(url)
        return r.status_code, r.text[:200_000]
    except httpx.HTTPError as e:
        return 0, f"network_error: {e}"


def _parse_doordash(html: str) -> list[dict[str, Any]]:
    """Very tolerant extractor: pulls item-shaped JSON snippets from the page.

    DoorDash injects state into <script id="__NEXT_DATA__"> as JSON. When this
    succeeds, we can pull names/prices/imageURLs. When the structure changes,
    we just return [] and let the merge step skip us.
    """
    items: list[dict[str, Any]] = []
    m = re.search(
        r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>',
        html,
        flags=re.DOTALL,
    )
    if not m:
        return items
    raw = m.group(1).strip()
    # Walk the JSON for any dicts that look like menu items.
    import json
    try:
        data = json.loads(raw)
    except Exception:
        return items
    stack = [data]
    seen = 0
    while stack and seen < 10_000:
        node = stack.pop()
        seen += 1
        if isinstance(node, dict):
            if (
                isinstance(node.get("name"), str)
                and isinstance(node.get("price"), (int, str))
            ):
                price = node["price"]
                try:
                    price_cents = (
                        int(price) if isinstance(price, int)
                        else int(round(float(str(price).replace("$", "").replace(",", "")) * 100))
                    )
                except Exception:
                    price_cents = None
                items.append({
                    "name": node["name"],
                    "price_cents": price_cents,
                    "image_url": node.get("imageUrl") or node.get("imageURL"),
                    "description": node.get("description"),
                })
            stack.extend(node.values())
        elif isinstance(node, list):
            stack.extend(node)
    return items


async def fetch_doordash(db: AsyncSession, tenant: Tenant) -> None:
    """Auto-discover the tenant\'s DoorDash consumer URL and try to scrape it."""
    from app.services.fetchers.discovery import discover_delivery_urls

    delivery_urls = await discover_delivery_urls(db, tenant)
    url = delivery_urls.get("doordash")
    if not url:
        return  # nothing to scrape

    status, body = await _try_fetch(url)
    if status != 200:
        await upsert_knowledge_row(
            db, tenant_id=tenant.id, bucket="menu", source="doordash_consumer",
            data={"url": url, "error": f"http {status}", "items": []},
        )
        return

    items = _parse_doordash(body)
    await upsert_knowledge_row(
        db, tenant_id=tenant.id, bucket="menu", source="doordash_consumer",
        data={"url": url, "items": items},
    )

