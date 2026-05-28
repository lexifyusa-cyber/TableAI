"""Calendar bucket — seasonal + holiday awareness for the AI.

Reads from knowledge_sources with bucket='calendar' source='builtin'. The
builder populates this on demand (per-tenant); because it's derived from the
tenant's country + today's date, it rebuilds cheaply every time.
"""

from __future__ import annotations

from app.models.knowledge_source import KnowledgeSource


def format(row: KnowledgeSource | None) -> str | None:
    if not row or not row.data:
        return None
    # New convention: data has {public, private}. Chat only sees public.
    public = row.data.get("public") or row.data
    if not public:
        return None

    lines = ["# Time awareness"]
    lines.append(f"Today is {public.get('today')}. Current season: {public.get('season')}.")
    h = public.get("next_holiday")
    if h:
        emoji = f" {h.get('emoji')}" if h.get("emoji") else ""
        if h.get("days_away") == 0:
            lines.append(f"Today is {h['name']}{emoji}. Lean into it in recommendations.")
        elif h.get("days_away") == 1:
            lines.append(f"Tomorrow is {h['name']}{emoji}. Customers may be planning for it.")
        else:
            lines.append(f"In {h['days_away']} days: {h['name']}{emoji} ({h['date']}).")
        lines.append(
            "When it's relevant (celebration, gifting, menu pairing), reference this holiday "
            "naturally in your answer. Don't force it if the customer is asking something unrelated."
        )
    else:
        lines.append("No major holiday in the next 14 days.")
    return "\n".join(lines)
