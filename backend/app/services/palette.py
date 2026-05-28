"""Extract a small color palette from an image URL.

Uses Pillow (already installed). Best-effort: returns [] if the URL is unreachable,
the bytes aren't a parseable image, or quantization yields fewer than expected colors.
"""

from __future__ import annotations

import logging
from io import BytesIO

import httpx
from PIL import Image, UnidentifiedImageError

log = logging.getLogger(__name__)
UA = "TableAI-PaletteExtractor/0.1"


async def extract_palette(url: str, *, max_colors: int = 5) -> list[str]:
    """Return up to `max_colors` hex colors, ordered by frequency in the image.

    Returns [] for any failure. The caller decides how to map these onto
    primary/accent/surface/ink (typically: most-saturated -> primary,
    second-most -> accent, darkest -> ink, lightest -> surface).
    """
    try:
        async with httpx.AsyncClient(
            timeout=8.0, follow_redirects=True, headers={"User-Agent": UA}
        ) as client:
            r = await client.get(url)
            r.raise_for_status()
            content = r.content
    except (httpx.HTTPError, OSError) as e:
        log.warning("palette: fetch failed for %s — %s", url, e)
        return []

    try:
        img = Image.open(BytesIO(content)).convert("RGBA")
    except (UnidentifiedImageError, OSError) as e:
        log.warning("palette: not a parseable image: %s — %s", url, e)
        return []

    # Composite transparent pixels onto white so transparent logos don't bias dark.
    if img.mode == "RGBA":
        bg = Image.new("RGB", img.size, (255, 255, 255))
        bg.paste(img, mask=img.split()[3])
        img = bg
    else:
        img = img.convert("RGB")

    # Downscale to keep quantization fast and ignore JPEG noise.
    img.thumbnail((256, 256))

    try:
        q = img.quantize(colors=max_colors, method=Image.Quantize.MEDIANCUT)
    except ValueError:
        return []
    palette = q.getpalette() or []
    color_counts = q.getcolors() or []
    color_counts.sort(reverse=True)  # (count, index) — most frequent first

    out: list[str] = []
    for _count, idx in color_counts[:max_colors]:
        r_, g_, b_ = palette[idx * 3 : idx * 3 + 3]
        out.append(f"#{r_:02x}{g_:02x}{b_:02x}")
    return out
