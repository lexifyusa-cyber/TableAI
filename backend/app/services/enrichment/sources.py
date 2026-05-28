"""Registry of enrichment sources.

Each fetcher is a callable `(db, tenant) -> None` that writes its own
`knowledge_sources` row and any `media_assets` rows. The orchestrator just
runs them in order; merge_to_canonical picks per-field winners based on the
priority lists below.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Awaitable, Callable

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import Tenant

# Fetcher signature
Fetcher = Callable[[AsyncSession, Tenant], Awaitable[None]]


@dataclass(slots=True)
class EnrichmentSpec:
    """One source the orchestrator can run for a tenant."""
    name: str                # human-friendly: "google_places_business"
    bucket: str              # knowledge_sources.bucket
    source: str              # knowledge_sources.source (must match fetcher writes)
    fetch_fn: Fetcher        # async function that does the work
    cost_class: str = "free" # "free" | "api_cheap" | "api_expensive" | "vision"


# ---------- Field-level priority per canonical destination -----------------
# Higher = preferred. Manual owner edits are always at the top.
TENANT_FIELD_PRIORITY: dict[str, list[str]] = {
    # canonical path -> ordered list of (bucket, source) pairs to try
    "hours":            ["manual_owner_input", "website", "google_places_business", "yelp_business"],
    "contact.address":  ["manual_owner_input", "website", "google_places_business", "yelp_business"],
    "contact.phone":    ["manual_owner_input", "website", "google_places_business", "yelp_business"],
    "contact.email":    ["manual_owner_input", "website"],
    "brand.theme.hero_url": ["manual_owner_input", "website", "google_places_photo", "yelp_photo"],
    "tagline":          ["manual_owner_input", "website", "google_places_business"],
}

ITEM_FIELD_PRIORITY: dict[str, list[str]] = {
    "price_cents":  ["manual_owner_input", "website", "doordash_consumer", "ubereats_consumer"],
    "image_url":    ["manual_owner_input", "website", "doordash_consumer", "google_places_photo", "yelp_photo"],
    "image_path":   ["manual_owner_input", "website", "doordash_consumer", "google_places_photo", "yelp_photo"],
    "description":  ["manual_owner_input", "website", "doordash_consumer", "ubereats_consumer"],
}


def all_specs() -> list[EnrichmentSpec]:
    """Return the default spec list applied at demo generation time."""
    # Imported lazily so test code can stub sources without triggering API setup at import-time.
    from app.services.fetchers.google_business import fetch_google_business
    from app.services.fetchers.google_photos import fetch_google_photos
    from app.services.fetchers.website_extras import fetch_website_extras
    from app.services.fetchers.delivery import fetch_doordash
    from app.services.fetchers.vision_ocr import fetch_vision_ocr
    from app.services.fetchers.yelp import fetch_yelp
    from app.services.fetchers.vision_website import fetch_vision_website
    from app.services.fetchers.vision_delivery import fetch_vision_delivery
    from app.services.fetchers.google_serp_vision import fetch_google_serp_vision
    from app.services.fetchers.menu_aggregators import fetch_menu_aggregators
    from app.services.fetchers.pdf_menu import fetch_pdf_menu
    from app.services.fetchers.tripadvisor_vision import fetch_tripadvisor
    from app.services.fetchers.instagram_vision import fetch_instagram

    return [
        EnrichmentSpec(
            name="website_extras",
            bucket="business",
            source="website",
            fetch_fn=fetch_website_extras,
            cost_class="free",
        ),
        EnrichmentSpec(
            name="google_places_business",
            bucket="business",
            source="google_places_business",
            fetch_fn=fetch_google_business,
            cost_class="api_cheap",
        ),
        EnrichmentSpec(
            name="google_places_photo",
            bucket="social",
            source="google_places_photo",
            fetch_fn=fetch_google_photos,
            cost_class="api_cheap",
        ),
        EnrichmentSpec(
            name="doordash_consumer",
            bucket="menu",
            source="doordash_consumer",
            fetch_fn=fetch_doordash,
            cost_class="free",
        ),
        EnrichmentSpec(
            name="vision_ocr",
            bucket="menu",
            source="vision_ocr",
            fetch_fn=fetch_vision_ocr,
            cost_class="vision",
        ),
        EnrichmentSpec(
            name="yelp_business",
            bucket="business",
            source="yelp_business",
            fetch_fn=fetch_yelp,
            cost_class="api_cheap",
        ),
        EnrichmentSpec(
            name="vision_website",
            bucket="menu",
            source="vision_website",
            fetch_fn=fetch_vision_website,
            cost_class="vision",
        ),
        EnrichmentSpec(name="vision_delivery", bucket="menu", source="vision_delivery", fetch_fn=fetch_vision_delivery, cost_class="vision"),
        EnrichmentSpec(name="menu_aggregators", bucket="menu", source="aggregator_menuwithprice", fetch_fn=fetch_menu_aggregators, cost_class="free"),
        EnrichmentSpec(name="pdf_menu", bucket="menu", source="pdf_menu", fetch_fn=fetch_pdf_menu, cost_class="vision"),
        EnrichmentSpec(name="google_serp_vision", bucket="menu", source="google_serp_vision", fetch_fn=fetch_google_serp_vision, cost_class="vision"),
        EnrichmentSpec(name="tripadvisor", bucket="reputation", source="tripadvisor_vision", fetch_fn=fetch_tripadvisor, cost_class="vision"),
        EnrichmentSpec(name="instagram", bucket="social", source="instagram_vision", fetch_fn=fetch_instagram, cost_class="vision"),
    ]
