"""Menu-aggregator scrape: hits menuwithprice.com, allmenus.com, menupages.com.
These sites specifically list chain restaurant menus with prices and are usually
crawlable with a plain HTTP get + light HTML parsing.

Discovery: DuckDuckGo search "site:menuwithprice.com {name}".
"""
from __future__ import annotations

import logging
import re

import httpx
from bs4 import BeautifulSoup
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import Tenant
from app.services.knowledge.store import upsert_knowledge_row
from app.services.web_search import web_search

log = logging.getLogger(__name__)
USER_AGENT = "Mozilla/5.0 (compatible; TableAI/0.1)"
AGGREGATORS = ["menuwithprice.com", "allmenus.com", "menupages.com"]


def _parse_aggregator_items(html: str) -> list[dict]:
    """Very tolerant: walks the page text for "Item name … $X.YY" patterns."""
    soup = BeautifulSoup(html, "html.parser")
    items: list[dict] = []
    # Items are typically in list-item / row blocks with item name and price
    for el in soup.find_all(["li", "tr", "div"]):
        text = " ".join(el.get_text(" ", strip=True).split())
        if not text or len(text) > 240:
            continue
        m = re.search(r"\$([0-9]+(?:\.[0-9]{2})?)", text)
        if not m:
            continue
        # Strip the price part from the name
        name = re.sub(r"\s*\$[0-9]+(?:\.[0-9]{2})?.*$", "", text).strip()
        if 2 < len(name) < 80:
            try:
                price_cents = int(round(float(m.group(1)) * 100))
            except ValueError:
                continue
            items.append({"name": name, "price_cents": price_cents})
    # de-dupe by name
    seen, dedup = set(), []
    for it in items:
        k = it["name"].lower()
        if k in seen:
            continue
        seen.add(k)
        dedup.append(it)
    return dedup[:200]


async def fetch_menu_aggregators(db: AsyncSession, tenant: Tenant) -> None:
    """Try each aggregator, write the first one that yields items."""
    addr = (tenant.contact or {}).get("address") or ""
    city = addr.split(",")[1].strip() if "," in addr else ""

    for site in AGGREGATORS:
        query = f"site:{site} {tenant.name}" + (f" {city}" if city else "")
        urls = await web_search(query, host_filter=[site])
        url = next((u for u in urls if site in u), None)
        if not url:
            continue
        try:
            async with httpx.AsyncClient(
                follow_redirects=True, timeout=15.0,
                headers={"User-Agent": USER_AGENT},
            ) as c:
                r = await c.get(url)
        except httpx.HTTPError:
            continue
        if r.status_code != 200:
            continue
        items = _parse_aggregator_items(r.text)
        if not items:
            continue
        await upsert_knowledge_row(
            db, tenant_id=tenant.id, bucket="menu", source=f"aggregator_{site.split('.')[0]}",
            data={"url": url, "items": items},
        )
        return  # first aggregator with items wins
