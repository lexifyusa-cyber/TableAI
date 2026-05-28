"""Business bucket — tenant identity, contact, hours, persona."""

from __future__ import annotations

from app.models.tenant import Tenant


def format(tenant: Tenant) -> str:
    lines = [f"# About {tenant.name}"]

    ai = tenant.ai_config or {}
    if ai.get("tagline"):
        lines.append(f"Tagline: {ai['tagline']}")
    if ai.get("persona"):
        lines.append(f"Persona / voice: {ai['persona']}")

    contact = tenant.contact or {}
    if contact.get("phone"):
        lines.append(f"Phone: {contact['phone']}")
    if contact.get("email"):
        lines.append(f"Email: {contact['email']}")
    if contact.get("address"):
        lines.append(f"Address: {contact['address']}")

    hours = tenant.hours or {}
    if hours:
        hrs = []
        for day, windows in hours.items():
            if not windows:
                continue
            frames = ", ".join(f"{w.get('open', '?')}–{w.get('close', '?')}" for w in windows)
            hrs.append(f"{day.capitalize()}: {frames}")
        if hrs:
            lines.append("Hours:\n  " + "\n  ".join(hrs))

    brand = tenant.brand or {}
    if brand.get("voice"):
        lines.append(f"Brand voice: {brand['voice']}")

    lines.append(
        "\nWhen answering, speak as a warm, helpful representative of this business. "
        "Be concise, never invent facts not listed in the menu or above."
    )
    return "\n".join(lines)
