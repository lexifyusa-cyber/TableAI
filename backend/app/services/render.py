"""Headless-browser page renderer.

Loads a URL in real Chromium, waits for network idle, returns the final DOM
and a full-page PNG. Used by vision_website / vision_delivery fetchers to
handle JS-heavy sites and pages with overlays.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

log = logging.getLogger(__name__)

VIEWPORT = {"width": 1280, "height": 1800}
NAV_TIMEOUT_MS = 25_000
NETWORK_IDLE_MS = 1500
SCREENSHOT_MAX_BYTES = 4_000_000  # 4MB cap


@dataclass(slots=True)
class RenderedPage:
    url: str
    final_url: str
    html: str
    screenshot_png: bytes


async def render_page(url: str, *, full_page: bool = True) -> RenderedPage:
    """Open `url` in headless Chromium, wait for it to settle, return DOM + PNG."""
    # Import inside function so a missing playwright install doesn\'t crash module-load.
    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        try:
            context = await browser.new_context(
                viewport=VIEWPORT,
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36",
            )
            page = await context.new_page()
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=NAV_TIMEOUT_MS)
                # network idle is best-effort; some sites poll forever
                try:
                    await page.wait_for_load_state("networkidle", timeout=NETWORK_IDLE_MS)
                except Exception:
                    pass
                html = await page.content()
                shot = await page.screenshot(full_page=full_page, type="png")
                if len(shot) > SCREENSHOT_MAX_BYTES:
                    # Re-screenshot at viewport only (likely OK for sites with infinite-scroll menus)
                    shot = await page.screenshot(full_page=False, type="png")
                final_url = page.url
            finally:
                await page.close()
                await context.close()
        finally:
            await browser.close()

    return RenderedPage(url=url, final_url=final_url, html=html, screenshot_png=shot)


async def render_sections(url: str, *, max_sections: int = 5) -> list[bytes]:
    """Open `url`, scroll through it in viewport-height chunks, return a list
    of PNG screenshots covering the full page.

    Used by vision fetchers to give the LLM the entire page in pieces — full-page
    screenshots are often too large for vision-model limits or truncated by
    Chromium when the content is unusually tall.
    """
    from playwright.async_api import async_playwright

    screenshots: list[bytes] = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        try:
            context = await browser.new_context(
                viewport=VIEWPORT,
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36",
            )
            page = await context.new_page()
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=NAV_TIMEOUT_MS)
                try:
                    await page.wait_for_load_state("networkidle", timeout=NETWORK_IDLE_MS)
                except Exception:
                    pass

                vh = VIEWPORT["height"]
                page_height = await page.evaluate("() => document.documentElement.scrollHeight || document.body.scrollHeight")
                if not isinstance(page_height, int) or page_height < vh:
                    page_height = vh

                # How many sections (cap at max_sections)
                n = min(max_sections, max(1, (page_height + vh - 1) // vh))

                for i in range(n):
                    await page.evaluate(f"() => window.scrollTo(0, {i * vh})")
                    await page.wait_for_timeout(400)  # let lazy content load
                    shot = await page.screenshot(full_page=False, type="png")
                    if len(shot) > 1_500_000:
                        # If still huge, drop quality by downscaling viewport — unlikely at 1280x1800
                        pass
                    screenshots.append(shot)
            finally:
                await page.close()
                await context.close()
        finally:
            await browser.close()

    return screenshots




STEALTH_INIT = """// Hide Playwright tells from the page.
Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3, 4, 5]});
Object.defineProperty(navigator, 'languages', {get: () => ['en-US', 'en']});
window.chrome = {runtime: {}};
"""


async def render_sections_stealth(url: str, *, max_sections: int = 5) -> list[bytes]:
    """Same as render_sections but with stealth init script + cookies pre-accepted.
    For delivery platforms (DoorDash etc.) that fingerprint headless Chromium.
    """
    from playwright.async_api import async_playwright

    screenshots: list[bytes] = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-blink-features=AutomationControlled",
            ],
        )
        try:
            context = await browser.new_context(
                viewport=VIEWPORT,
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36",
                locale="en-US",
                extra_http_headers={
                    "Accept-Language": "en-US,en;q=0.9",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                },
            )
            await context.add_init_script(STEALTH_INIT)
            page = await context.new_page()
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=NAV_TIMEOUT_MS)
                try:
                    await page.wait_for_load_state("networkidle", timeout=NETWORK_IDLE_MS * 2)
                except Exception:
                    pass
                # Some platforms show interstitial cookie/age banners — generously wait.
                await page.wait_for_timeout(2000)

                vh = VIEWPORT["height"]
                page_height = await page.evaluate(
                    "() => document.documentElement.scrollHeight || document.body.scrollHeight"
                )
                if not isinstance(page_height, int) or page_height < vh:
                    page_height = vh
                n = min(max_sections, max(1, (page_height + vh - 1) // vh))
                for i in range(n):
                    await page.evaluate(f"() => window.scrollTo(0, {i * vh})")
                    await page.wait_for_timeout(600)
                    shot = await page.screenshot(full_page=False, type="png")
                    screenshots.append(shot)
            finally:
                await page.close()
                await context.close()
        finally:
            await browser.close()
    return screenshots

