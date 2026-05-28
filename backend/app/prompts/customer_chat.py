"""System prompt builder for customer-facing chat.

Two-block system: persona (small, per-tenant, cacheable separately) +
menu context (larger, cached aggressively since identical across all
customers of a tenant for the menu's lifetime).
"""

from __future__ import annotations


def build_persona_block(
    *,
    business_name: str,
    business_type: str,
    address: str | None,
    today_hours: str | None,
    ai_persona: str,
) -> str:
    address_line = f"Located at {address}." if address else ""
    hours_line = f"Hours today: {today_hours}." if today_hours else ""
    return f"""You are the AI host for {business_name}, a {business_type}. {address_line} {hours_line}

Persona — speak in this voice and stay in character:
{ai_persona}

You help customers:
- Browse the menu and find items that match their dietary needs (vegan, allergies, etc.)
- Get recommendations based on what's popular, the chef's specials, or their preferences
- Understand unfamiliar dishes (especially for cuisines they may not know well)
- Decide on portions and pairings

Rules — important:
- Only recommend items that appear in the menu context below. NEVER invent dishes, ingredients, or prices.
- Prices in the menu are in cents — show them as dollars with two decimals (e.g. 1295 -> $12.95).
- Allergens: surface tagged allergens proactively when relevant. If you're not sure whether a dish is safe for a specific allergy, say so honestly: "I'd recommend asking your server to confirm" — never guarantee allergen-free unless the item is explicitly tagged that way.
- Stay on topic. If asked something outside food/the menu, redirect warmly: "I'm here to help you with the menu — what would you like to know?"
- Be warm but concise. Customers want to order, not chat at length.
""".strip()


def build_menu_block(menu_text: str) -> str:
    return f"""=== MENU (use this exclusively for recommendations) ===

{menu_text}

=== END MENU ==="""


def render_menu_for_prompt(categories: list[dict]) -> str:
    """Render structured menu data as a compact prompt block.

    Each category and item is laid out in a way the model can scan quickly.
    """
    lines: list[str] = []
    for cat in categories:
        lines.append(f"\n## {cat['name']}")
        if cat.get("description"):
            lines.append(f"_{cat['description']}_")
        for item in cat.get("items", []):
            price = ""
            if item.get("price_cents") is not None:
                price = f" — ${item['price_cents'] / 100:.2f}"
            tags = item.get("tags") or []
            tag_str = f"  [{', '.join(tags)}]" if tags else ""
            lines.append(f"- **{item['name']}**{price}{tag_str}")
            if item.get("description"):
                lines.append(f"  {item['description']}")
            allergens = item.get("allergens") or []
            if allergens:
                lines.append(f"  Allergens: {', '.join(allergens)}")
    return "\n".join(lines).strip()
