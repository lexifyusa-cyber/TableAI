"""Reputation bucket — formatting of cached Google Places / Yelp payloads.

Storage schema (data JSONB for bucket='reputation'):
{
  "place_id": "ChIJ...",
  "rating": 4.5,
  "review_count": 342,
  "price_level": 2,
  "popular_dishes": ["Butter Chicken", "Tandoori Chicken"],
  "reviews": [
    {"author": "Jane", "rating": 5, "text": "Amazing biryani...", "time": "2026-03-15"},
    ...
  ]
}
"""

from __future__ import annotations

from app.models.knowledge_source import KnowledgeSource


def format(row: KnowledgeSource | None) -> str | None:
    if not row or not row.data:
        return None

    # New convention: {public, private}. Fall back to flat old-shape rows for backward compat.
    d = row.data.get("public") or row.data
    rating = d.get("rating")
    count = d.get("review_count")
    if not rating and not count and not d.get("reviews"):
        return None

    lines = ["# Reputation & reviews"]
    if rating and count:
        lines.append(f"Rated {rating}★ from {count} reviews on Google.")
    elif rating:
        lines.append(f"Rated {rating}★ on Google.")

    if d.get("price_level") is not None:
        lines.append("Price level: " + "$" * (int(d["price_level"]) or 1))

    popular = d.get("popular_dishes") or []
    if popular:
        lines.append("Most-mentioned dishes in reviews: " + ", ".join(popular[:5]))

    reviews = d.get("reviews") or []
    if reviews:
        lines.append("\n## Recent review excerpts")
        for r in reviews[:5]:
            author = r.get("author", "A customer")
            stars = r.get("rating")
            stars_str = f" ({stars}★)" if stars else ""
            text = (r.get("text") or "").strip().replace("\n", " ")
            if text:
                if len(text) > 260:
                    text = text[:260] + "…"
                lines.append(f"- {author}{stars_str}: \"{text}\"")

    lines.append(
        "\nUse reviews to answer questions like 'what's popular?' or 'what do people think of X?' "
        "Cite specific review themes, not invented quotes."
    )
    return "\n".join(lines)
