"""Find a restaurant\'s PDF menu via DuckDuckGo (filetype:pdf), render each
page to PNG using pypdfium2 (no system deps), then vision-OCR via Grok.

Many small restaurants post a single PDF menu file linked from their site, which
the text scraper cannot read but vision can.
"""
from __future__ import annotations

import base64
import logging

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import Tenant
from app.services.knowledge.store import upsert_knowledge_row
from app.services.llm import get_provider_for
from app.services.web_search import web_search

log = logging.getLogger(__name__)
USER_AGENT = "Mozilla/5.0 (compatible; TableAI/0.1)"

SYSTEM = """You are reading the pages of a restaurant\'s PDF menu. Extract every
item with name + price in cents. Group by visible categories. Ignore allergen
disclaimers, location addresses, and ordering instructions. Use extract_menu_items once."""

EXTRACT_TOOL = {
    "name": "extract_menu_items",
    "description": "Return every menu item visible in the PDF.",
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


async def fetch_pdf_menu(db: AsyncSession, tenant: Tenant) -> None:
    if not tenant.source_url:
        return

    # 1. Look for a PDF on the tenant\'s own domain first, then web search
    from urllib.parse import urlparse
    host = urlparse(tenant.source_url).hostname or ""
    queries = []
    if host:
        queries.append(f"site:{host} menu filetype:pdf")
    queries.append(f"{tenant.name} menu filetype:pdf")

    pdf_url = None
    for q in queries:
        urls = await web_search(q)
        match = next((u for u in urls if u.lower().endswith(".pdf")), None)
        if match:
            pdf_url = match
            break
    if not pdf_url:
        return

    # 2. Download the PDF
    try:
        async with httpx.AsyncClient(
            follow_redirects=True, timeout=20.0,
            headers={"User-Agent": USER_AGENT},
        ) as c:
            r = await c.get(pdf_url)
        if r.status_code != 200 or not r.content:
            return
        pdf_bytes = r.content[:20 * 1024 * 1024]  # 20MB cap
    except httpx.HTTPError:
        return

    # 3. Render each page to PNG using pypdfium2
    try:
        import pypdfium2 as pdfium
    except ImportError:
        log.warning("pdf_menu: pypdfium2 not installed; skipping")
        return

    try:
        pdf = pdfium.PdfDocument(pdf_bytes)
    except Exception as e:  # noqa: BLE001
        log.warning("pdf_menu: failed to parse %s: %s", pdf_url, e)
        return

    pages_png: list[bytes] = []
    n_pages = min(len(pdf), 5)
    for i in range(n_pages):
        page = pdf[i]
        pil = page.render(scale=2.0).to_pil()
        import io
        buf = io.BytesIO()
        pil.save(buf, format="PNG", optimize=True)
        pages_png.append(buf.getvalue())

    if not pages_png:
        return

    content_blocks: list[dict] = []
    for i, png in enumerate(pages_png):
        content_blocks.append({"type": "text", "text": f"PDF page {i+1} of {n_pages}:"})
        content_blocks.append({
            "type": "image",
            "source": {"type": "base64", "media_type": "image/png", "data": base64.b64encode(png).decode()},
        })

    try:
        provider, model = await get_provider_for("vision")
        response = await provider.complete(
            model=model,
            system=SYSTEM,
            messages=[{"role": "user", "content": content_blocks}],
            tools=[EXTRACT_TOOL],
            tool_choice={"type": "tool", "name": "extract_menu_items"},
            max_tokens=8192,
        )
    except Exception as e:  # noqa: BLE001
        log.warning("pdf_menu LLM failed for %s: %s", tenant.slug, e)
        return

    tool_input = None
    for tc in response.tool_calls:
        if tc.get("name") == "extract_menu_items":
            tool_input = dict(tc.get("input") or {})
            break
    if not tool_input:
        return

    await upsert_knowledge_row(
        db, tenant_id=tenant.id, bucket="menu", source="pdf_menu",
        data={"pdf_url": pdf_url, "page_count": n_pages, "extracted": tool_input},
    )
