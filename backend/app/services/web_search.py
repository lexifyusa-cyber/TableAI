"""Layered web search helpers.

Discovery cascade (in order):
1. duckduckgo_html_search — fast, no key, but DDG sometimes blocks/empties.
2. playwright_google_search — slow (~3s) but reliable: real Chrome session against google.com.
3. google_places_site_search — uses Places API key; mostly useless for site: queries.

Each returns list[str] of candidate URLs.
"""
from __future__ import annotations

import html as _h
import json
import logging
import re
from typing import Iterable
from urllib.parse import urlparse, parse_qs, unquote, quote_plus

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.app_setting import AppSetting

log = logging.getLogger(__name__)
PLACES_SEARCH = "https://places.googleapis.com/v1/places:searchText"


async def _google_key(db: AsyncSession) -> str | None:
    row = (await db.execute(
        select(AppSetting).where(AppSetting.key == "integrations.google_maps_api_key")
    )).scalar_one_or_none()
    return row.value if row and row.value else None


async def google_places_site_search(db: AsyncSession, query: str) -> list[str]:
    api_key = await _google_key(db)
    if not api_key:
        return []
    try:
        async with httpx.AsyncClient(timeout=8.0) as c:
            r = await c.post(
                PLACES_SEARCH,
                headers={
                    "Content-Type": "application/json",
                    "X-Goog-Api-Key": api_key,
                    "X-Goog-FieldMask": "places.websiteUri",
                },
                content=json.dumps({"textQuery": query, "maxResultCount": 3}),
            )
        if r.status_code != 200:
            return []
        return [p.get("websiteUri") for p in (r.json().get("places") or []) if p.get("websiteUri")]
    except httpx.HTTPError:
        return []


async def duckduckgo_html_search(query: str, host_filter: Iterable[str] = ()) -> list[str]:
    """Try DDG HTML endpoint. Returns empty list if DDG rate-limits us."""
    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=10.0,
            headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml",
                "Accept-Language": "en-US,en;q=0.9",
            },
        ) as c:
            r = await c.post("https://html.duckduckgo.com/html/", data={"q": query})
    except httpx.HTTPError:
        return []
    if r.status_code != 200 or "result__url" not in r.text:
        return []
    body = r.text
    hrefs = re.findall(r'href="(https?://[^"]+)"', body)
    out: list[str] = []
    for href in hrefs:
        u = urlparse(href)
        if u.netloc.endswith("duckduckgo.com") and u.path.startswith("/l/"):
            qs = parse_qs(u.query)
            if "uddg" in qs:
                target = _h.unescape(unquote(qs["uddg"][0]))
                if not host_filter or any(h in target for h in host_filter):
                    out.append(target)
        elif not host_filter or any(h in href for h in host_filter):
            out.append(_h.unescape(href))
    seen, dedup = set(), []
    for u in out:
        if u not in seen:
            seen.add(u)
            dedup.append(u)
    return dedup[:10]


async def playwright_google_search(query: str, host_filter: Iterable[str] = ()) -> list[str]:
    """Fallback: open google.com in real Chrome, parse search-result hrefs.

    Reliable but slow (~3-4s per query). Used when DDG returns nothing.
    """
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        return []

    urls: list[str] = []
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-blink-features=AutomationControlled"],
            )
            try:
                context = await browser.new_context(
                    viewport={"width": 1280, "height": 1024},
                    user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36",
                    locale="en-US",
                    extra_http_headers={"Accept-Language": "en-US,en;q=0.9"},
                )
                await context.add_init_script(
                    "Object.defineProperty(navigator, 'webdriver', {get: () => undefined});"
                )
                page = await context.new_page()
                try:
                    google_url = f"https://www.google.com/search?q={quote_plus(query)}&hl=en&gl=us"
                    await page.goto(google_url, wait_until="domcontentloaded", timeout=20_000)
                    try:
                        await page.wait_for_load_state("networkidle", timeout=2000)
                    except Exception:
                        pass

                    # Pull all <a> hrefs from result divs (Google\'s result containers carry the link wrapped in a div with role="link" or in an <a> directly under #search)
                    raw_hrefs = await page.eval_on_selector_all(
                        "a", "els => els.map(e => e.href).filter(h => h)"
                    )
                    seen = set()
                    for h in raw_hrefs:
                        # Skip Google internal URLs (settings, cache, etc.)
                        if any(skip in h for skip in (
                            "google.com/", "youtube.com/", "googleadservices",
                            "googleusercontent", "accounts.google", "/url?q=",
                        )):
                            # /url?q= wraps actual destination
                            u = urlparse(h)
                            if u.path == "/url":
                                qs = parse_qs(u.query)
                                target = (qs.get("q") or qs.get("url") or [None])[0]
                                if target:
                                    target = _h.unescape(unquote(target))
                                    if target not in seen and not any(g in target for g in ("google.com", "youtube.com", "googleusercontent")):
                                        seen.add(target)
                                        urls.append(target)
                            continue
                        if h in seen:
                            continue
                        seen.add(h)
                        urls.append(_h.unescape(h))
                finally:
                    await page.close()
                    await context.close()
            finally:
                await browser.close()
    except Exception as e:  # noqa: BLE001
        log.warning("playwright_google_search failed for %r: %s", query, e)
        return []

    if host_filter:
        urls = [u for u in urls if any(host in u for host in host_filter)]
    return urls[:10]


async def web_search(query: str, host_filter: Iterable[str] = ()) -> list[str]:
    """Top-level: DDG → Playwright fallback."""
    urls = await duckduckgo_html_search(query, host_filter=host_filter)
    if urls:
        return urls
    log.info("DDG empty for %r; falling back to Playwright Google search", query)
    return await playwright_google_search(query, host_filter=host_filter)
