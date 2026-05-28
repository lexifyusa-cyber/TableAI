"""Restaurant / SMB website scraper.

Pulls structured signals from a public website to seed the demo-generator.
Best-effort: returns whatever it can extract; the LLM normalizes the rest.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup

USER_AGENT = "TableAI-Crawler/0.1 (+https://tableai.app)"
PHONE_RE = re.compile(r"\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}")
EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")


@dataclass
class ScrapedSite:
    url: str
    title: str | None = None
    description: str | None = None
    logo_url: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    pos_indicator: str | None = None  # "toast" | "square" | "clover" | "doordash" | None
    menu_links: list[str] = field(default_factory=list)
    image_urls: list[str] = field(default_factory=list)
    main_text: str = ""
    menu_html: str | None = None  # populated when we follow a menu link or POS page
    menu_is_image: bool = False  # heuristic: menu page is largely a single image with little text
    menu_image_url: str | None = None  # first big image on the menu page (used by vision_ocr)

    # Theme signals — feed these to the LLM so it can pick a vibe and refine the palette.
    google_fonts: list[str] = field(default_factory=list)
    image_candidates: list[str] = field(default_factory=list)  # top hero-y images
    palette_hex: list[str] = field(default_factory=list)       # extracted from logo

    def short_summary(self) -> str:
        """Compact representation suitable for stuffing into an LLM prompt."""
        parts = [
            f"URL: {self.url}",
            f"Title: {self.title or '(none)'}",
            f"Description: {self.description or '(none)'}",
            f"Phone: {self.phone or '(none)'}",
            f"Email: {self.email or '(none)'}",
            f"Address: {self.address or '(none)'}",
            f"POS detected: {self.pos_indicator or '(none)'}",
            f"Logo URL: {self.logo_url or '(none)'}",
            f"Menu links found: {self.menu_links[:5]}",
            f"Google Fonts on page: {self.google_fonts or '(none)'}",
            f"Palette from logo: {self.palette_hex or '(none)'}",
            f"Hero image candidates: {self.image_candidates[:5]}",
        ]
        return "\n".join(parts)


async def fetch_html(url: str, *, timeout: float = 30.0) -> str:
    async with httpx.AsyncClient(
        follow_redirects=True,
        timeout=timeout,
        headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"},
    ) as client:
        r = await client.get(url)
        r.raise_for_status()
        return r.text


def _detect_google_fonts(html: str) -> list[str]:
    """Return Google Font family names referenced by the page."""
    families: set[str] = set()
    # Both css and css2 endpoints; family=… and additional &family=…
    for m in re.finditer(r"fonts\.googleapis\.com/css2?\?(?:[^\"\\'>]+&)*family=([^\"\\'>&]+)", html):
        raw = m.group(1)
        name = raw.split(":")[0].replace("+", " ").strip()
        if name and len(name) < 64:
            families.add(name)
    # Catch additional &family=… occurrences after the first.
    for m in re.finditer(r"[?&]family=([^\"\\'>&]+)", html):
        raw = m.group(1)
        name = raw.split(":")[0].replace("+", " ").strip()
        if name and len(name) < 64:
            families.add(name)
    return sorted(families)


def _detect_pos(html: str) -> str | None:
    h = html.lower()
    if "toasttab.com" in h or "toast-pos" in h:
        return "toast"
    if "squareup.com" in h or "square-online" in h:
        return "square"
    if "clover.com" in h:
        return "clover"
    if "doordash.com" in h or "ubereats.com" in h or "grubhub.com" in h:
        return "delivery_marketplace"
    return None


def _extract_address(soup: BeautifulSoup) -> str | None:
    # Schema.org JSON-LD often has full address
    for script in soup.find_all("script", type="application/ld+json"):
        text = script.string or ""
        if '"address"' in text:
            m = re.search(r'"streetAddress"\s*:\s*"([^"]+)"', text)
            city = re.search(r'"addressLocality"\s*:\s*"([^"]+)"', text)
            region = re.search(r'"addressRegion"\s*:\s*"([^"]+)"', text)
            zip_ = re.search(r'"postalCode"\s*:\s*"([^"]+)"', text)
            if m:
                bits = [m.group(1)]
                if city:
                    bits.append(city.group(1))
                if region and zip_:
                    bits.append(f"{region.group(1)} {zip_.group(1)}")
                elif region:
                    bits.append(region.group(1))
                return ", ".join(bits)
    # Fallback: <address> tag
    addr = soup.find("address")
    if addr:
        return addr.get_text(separator=" ", strip=True)
    return None


def parse_site(url: str, html: str) -> ScrapedSite:
    soup = BeautifulSoup(html, "lxml")
    site = ScrapedSite(url=url)

    if soup.title and soup.title.string:
        site.title = soup.title.string.strip()

    desc = soup.find("meta", attrs={"name": "description"})
    if desc and desc.get("content"):
        site.description = desc["content"].strip()
    if not site.description:
        og = soup.find("meta", attrs={"property": "og:description"})
        if og and og.get("content"):
            site.description = og["content"].strip()

    og_img = soup.find("meta", attrs={"property": "og:image"})
    if og_img and og_img.get("content"):
        site.logo_url = urljoin(url, og_img["content"])
    if not site.logo_url:
        for img in soup.find_all("img"):
            src = (img.get("src") or "").lower()
            alt = (img.get("alt") or "").lower()
            if "logo" in src or "logo" in alt:
                site.logo_url = urljoin(url, img.get("src"))
                break

    text = soup.get_text(separator=" ", strip=True)
    site.main_text = text[:8000]

    if (m := PHONE_RE.search(text)):
        site.phone = m.group()
    if (m := EMAIL_RE.search(text)):
        site.email = m.group()

    site.address = _extract_address(soup)
    site.pos_indicator = _detect_pos(html)

    base_host = urlparse(url).netloc
    seen: set[str] = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        link_text = a.get_text(strip=True).lower()
        if "menu" in link_text or "/menu" in href.lower() or "order" in link_text:
            full = urljoin(url, href)
            host = urlparse(full).netloc
            if full not in seen and full != url and (host == base_host or "toasttab" in host):
                seen.add(full)
                site.menu_links.append(full)

    site.image_urls = [
        urljoin(url, img["src"])
        for img in soup.find_all("img")
        if img.get("src") and not img["src"].startswith("data:")
    ][:25]

    # Theme signals
    site.google_fonts = _detect_google_fonts(html)

    # Image candidates for hero: og:image first, then large/non-logo imgs.
    candidates: list[str] = []
    if site.logo_url:
        # Don't reuse the logo as a hero candidate
        skip = {site.logo_url}
    else:
        skip = set()
    og_img_tag = soup.find("meta", attrs={"property": "og:image"})
    if og_img_tag and og_img_tag.get("content"):
        og_full = urljoin(url, og_img_tag["content"])
        if og_full not in skip:
            candidates.append(og_full)
            skip.add(og_full)
    twitter_img = soup.find("meta", attrs={"name": "twitter:image"})
    if twitter_img and twitter_img.get("content"):
        tw_full = urljoin(url, twitter_img["content"])
        if tw_full not in skip:
            candidates.append(tw_full)
            skip.add(tw_full)
    # Rank remaining <img> by reported width when available.
    sized: list[tuple[int, str]] = []
    for img in soup.find_all("img"):
        src = img.get("src") or ""
        if not src or src.startswith("data:"):
            continue
        full = urljoin(url, src)
        if full in skip:
            continue
        skip.add(full)
        try:
            w = int(img.get("width") or 0)
        except ValueError:
            w = 0
        sized.append((w, full))
    sized.sort(key=lambda p: p[0], reverse=True)
    for _w, u in sized:
        candidates.append(u)
        if len(candidates) >= 5:
            break
    site.image_candidates = candidates[:5]

    return site


async def scrape(url: str) -> ScrapedSite:
    html = await fetch_html(url)
    site = parse_site(url, html)

    # Try to follow the first menu link to grab actual menu HTML for the LLM.
    if site.menu_links:
        try:
            menu_html = await fetch_html(site.menu_links[0])
            site.menu_html = menu_html[:60000]  # cap; LLM has its own context limit

            # Heuristic: if the menu page is dominated by <img> with very little
            # menu-relevant text, flag for vision OCR. Restaurant menus that are
            # PDFs-rendered-as-img or single hi-res JPG hit this.
            text_only = _re.sub(r"<[^>]+>", " ", menu_html)
            menu_keywords = sum(text_only.lower().count(w) for w in (
                "appetizer", "entree", "burger", "salad", "pizza", "pasta", "soup",
                "dessert", "drink", "menu item", "price", "$",
            ))
            big_img = _re.search(r'<img[^>]+(?:width|src)="[^"]*(?:menu|food)[^"]*"', menu_html, _re.IGNORECASE)
            if menu_keywords < 8 and big_img:
                site.menu_is_image = True
                # Pull the first plausible menu image URL
                m = _re.search(r'<img[^>]+src="([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"', menu_html, _re.IGNORECASE)
                if m:
                    from urllib.parse import urljoin as _uj
                    site.menu_image_url = _uj(site.menu_links[0], m.group(1))
        except httpx.HTTPError:
            pass

    # Extract a palette from the logo (best-effort, deferred import to keep cold-start fast).
    if site.logo_url:
        from app.services.palette import extract_palette
        site.palette_hex = await extract_palette(site.logo_url, max_colors=5)

    return site


# ---------------------------------------------------------------------------
# JSON-LD parser + multi-page crawl (used by demo-gen alongside `scrape()`).
# ---------------------------------------------------------------------------

import json as _json
import re as _re

_DAY_NAME_TO_KEY = {
    "monday": "monday", "tuesday": "tuesday", "wednesday": "wednesday",
    "thursday": "thursday", "friday": "friday", "saturday": "saturday", "sunday": "sunday",
    "mo": "monday", "tu": "tuesday", "we": "wednesday",
    "th": "thursday", "fr": "friday", "sa": "saturday", "su": "sunday",
}


def parse_jsonld(html: str) -> list[dict]:
    """Extract all JSON-LD <script> blobs from HTML; return as list of dicts.

    Handles arrays and @graph collections by flattening.
    """
    out: list[dict] = []
    for m in _re.finditer(
        r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        html,
        flags=_re.DOTALL | _re.IGNORECASE,
    ):
        raw = m.group(1).strip()
        if not raw:
            continue
        try:
            obj = _json.loads(raw)
        except Exception:
            continue
        if isinstance(obj, list):
            for o in obj:
                if isinstance(o, dict):
                    out.append(o)
        elif isinstance(obj, dict):
            graph = obj.get("@graph")
            if isinstance(graph, list):
                for o in graph:
                    if isinstance(o, dict):
                        out.append(o)
            else:
                out.append(obj)
    return out


def jsonld_extract_hours(blocks: list[dict]) -> dict[str, list[dict]]:
    """Pull hours from schema.org openingHoursSpecification / openingHours strings.

    Returns TableAI hours shape: {weekday: [{open, close}, ...]}.
    """
    out: dict[str, list[dict]] = {d: [] for d in [
        "monday","tuesday","wednesday","thursday","friday","saturday","sunday"
    ]}
    for b in blocks:
        spec = b.get("openingHoursSpecification")
        if isinstance(spec, dict):
            specs = [spec]
        elif isinstance(spec, list):
            specs = [s for s in spec if isinstance(s, dict)]
        else:
            specs = []
        for sp in specs:
            day_of_week = sp.get("dayOfWeek")
            opens = sp.get("opens") or sp.get("openTime")
            closes = sp.get("closes") or sp.get("closeTime")
            if not opens or not closes:
                continue
            days = day_of_week if isinstance(day_of_week, list) else [day_of_week]
            for d in days:
                if not isinstance(d, str):
                    continue
                key = d.lower().split("/")[-1].split("#")[-1].strip()
                day = _DAY_NAME_TO_KEY.get(key[:3], _DAY_NAME_TO_KEY.get(key))
                if not day:
                    continue
                # Normalize HH:MM
                op = opens[:5] if len(opens) >= 5 else opens
                cl = closes[:5] if len(closes) >= 5 else closes
                if {"open": op, "close": cl} not in out[day]:
                    out[day].append({"open": op, "close": cl})
    return out


def jsonld_extract_contact(blocks: list[dict]) -> dict:
    """Pull restaurant/business contact info from JSON-LD."""
    out: dict[str, str] = {}
    for b in blocks:
        t = b.get("@type")
        types = t if isinstance(t, list) else [t]
        if not any(tt in ("Restaurant", "FoodEstablishment", "LocalBusiness", "Organization")
                   for tt in types if isinstance(tt, str)):
            continue
        addr = b.get("address")
        if isinstance(addr, dict):
            parts = [
                addr.get("streetAddress"),
                addr.get("addressLocality"),
                addr.get("addressRegion"),
                addr.get("postalCode"),
            ]
            joined = ", ".join(p for p in parts if p)
            if joined and "address" not in out:
                out["address"] = joined
        if isinstance(addr, str) and addr and "address" not in out:
            out["address"] = addr
        if b.get("telephone") and "phone" not in out:
            out["phone"] = str(b["telephone"])
        if b.get("email") and "email" not in out:
            out["email"] = str(b["email"])
        if b.get("url") and "website" not in out:
            out["website"] = str(b["url"])
    return out


async def scrape_extra_pages(url: str, base_site: ScrapedSite) -> dict:
    """Follow up to 3 additional links (about/contact/locations) and merge JSON-LD findings.

    Returns a small dict with `hours`, `contact`, and `extra_text` collected.
    Best-effort: errors per page are swallowed.
    """
    from urllib.parse import urljoin as _urljoin

    extras = {"hours": {}, "contact": {}, "extra_text": ""}
    # Pick links from base_site.main_text? We didn\'t store links separately; reuse menu_links list
    # plus a small re-parse for about/contact/locations URLs.
    candidates: list[str] = []
    try:
        html = await fetch_html(url, timeout=15.0)
    except Exception:
        html = ""
    if html:
        for m in _re.finditer(
            r'href=["\']([^"\']+)["\'][^>]*>([^<]{0,80})',
            html,
            flags=_re.IGNORECASE,
        ):
            href, label = m.group(1), m.group(2).lower()
            if any(k in label for k in ("contact", "about", "location", "find us", "hours")):
                full = _urljoin(url, href)
                if full not in candidates and full.startswith("http"):
                    candidates.append(full)
            if len(candidates) >= 3:
                break

    blocks_all: list[dict] = []
    text_chunks: list[str] = []
    for link in candidates[:3]:
        try:
            page_html = await fetch_html(link, timeout=10.0)
        except Exception:
            continue
        blocks_all.extend(parse_jsonld(page_html))
        # collect a tiny text excerpt for the LLM to use
        text_chunks.append(page_html[:4000])

    # Also try JSON-LD on the homepage itself
    if html:
        blocks_all.extend(parse_jsonld(html))

    if blocks_all:
        hrs = jsonld_extract_hours(blocks_all)
        if any(hrs.values()):
            extras["hours"] = hrs
        contact = jsonld_extract_contact(blocks_all)
        if contact:
            extras["contact"] = contact
    extras["extra_text"] = "\n\n".join(text_chunks)[:8000]
    return extras
_DELIVERY_PATTERNS = [
    ("doordash",  r"https?://(?:www\.)?doordash\.com/store/[A-Za-z0-9_\-./]+"),
    ("ubereats",  r"https?://(?:www\.)?ubereats\.com/store/[A-Za-z0-9_\-./]+"),
    ("grubhub",   r"https?://(?:www\.)?grubhub\.com/restaurant/[A-Za-z0-9_\-./]+"),
    ("postmates", r"https?://(?:www\.)?postmates\.com/store/[A-Za-z0-9_\-./]+"),
    ("toast",     r"https?://(?:www\.)?toasttab\.com/[A-Za-z0-9_\-./]+"),
]


def extract_delivery_links(html: str) -> dict:
    """Find outbound delivery-platform URLs in homepage HTML.

    Returns {platform: url} with the first match per platform. URLs are
    HTML-unescaped (e.g. &#39; → \') so they\'re valid for HTTP fetch.
    """
    import html as _h
    out = {}
    for name, pat in _DELIVERY_PATTERNS:
        if name in out:
            continue
        m = _re.search(pat, html, flags=_re.IGNORECASE)
        if m:
            url = _h.unescape(m.group(0).rstrip(".,);"))
            out[name] = url
    return out

