"""Deterministic source -> tier mapping for the three-tier media store.

PUBLIC   = anyone (customer-facing menu/chat)
PRIVATE  = tenant owner + TableAI staff
INTERNAL = TableAI staff only

If you add a new image source, add it to SOURCE_TIER. Unknown sources raise
rather than silently defaulting — keeps tier classification auditable.
"""
from __future__ import annotations

from typing import Literal

Tier = Literal["public", "private", "internal"]

SOURCE_TIER: dict[str, Tier] = {
    # External sources we mirror (data was already public on the originating web property)
    "website":             "public",
    "google_places_photo": "public",
    "doordash_consumer":   "public",
    "ubereats_consumer":   "public",
    "yelp_photo":          "public",

    # Owner-initiated uploads
    "owner_upload":        "private",

    # Tenant-only intel derived from scraping (e.g. negative review screenshot)
    "review_screenshot":   "private",

    # TableAI ops
    "scrape_diagnostic":   "internal",
    "vision_ocr_debug":    "internal",
    "training_sample":     "internal",
    "moderation_artifact": "internal",
}


def source_to_tier(source: str) -> Tier:
    """Return the tier for a given image source.

    Raises KeyError if the source isn\'t mapped — by design, force explicit
    classification at code-write time rather than guess at runtime.
    """
    try:
        return SOURCE_TIER[source]
    except KeyError as e:
        raise KeyError(
            f"Image source {source!r} is not classified. "
            "Add it to SOURCE_TIER in app/services/media/classifier.py."
        ) from e


# Reasonable default classifications (used when the caller doesn\'t override).
_DEFAULT_CLASSIFICATION = {
    "website":             "hero",
    "google_places_photo": "hero",
    "doordash_consumer":   "menu_item",
    "ubereats_consumer":   "menu_item",
    "yelp_photo":          "hero",
    "owner_upload":        "owner_upload",
    "review_screenshot":   "review_screenshot",
    "scrape_diagnostic":   "scrape_diagnostic",
    "vision_ocr_debug":    "vision_ocr_debug",
    "training_sample":     "training_sample",
    "moderation_artifact": "moderation_artifact",
}


def classification_for(source: str) -> str:
    return _DEFAULT_CLASSIFICATION.get(source, "misc")
