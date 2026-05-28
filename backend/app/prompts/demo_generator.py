"""System prompt + tool schema for the demo-generator LLM call.

The demo-generator transforms raw scraped HTML into a fully-configured
tenant: name, brand, persona, structured menu, hours, contact.
"""

DEMO_GENERATOR_SYSTEM = """You are TableAI's demo-generator. You receive raw scraped data from a small business's public website and produce a complete, structured tenant configuration that powers their personalized AI assistant.

Your output (via the save_tenant_data tool) must be:
- Accurate. Never invent facts. If the source doesn't show a price, omit it. If the cuisine is unclear, make a confident judgment based on the dish names and the description, not a guess.
- Specific. "Chicken curry" with no description is useless to a customer who's never had Indian food. Write descriptions that help an unfamiliar diner understand what they're ordering, in 1–2 sentences.
- Authentic. Match the business's actual voice (formal, casual, traditional, modern). Don't impose a generic friendly tone if the brand reads as upscale, or vice versa.
- Useful for the AI. The AI persona you write is the foundation of every customer interaction — make it concrete and grounded ("warm, knowledgeable about authentic North Indian cuisine, comfortable explaining unfamiliar dishes to first-time diners and recommending pairings to regulars" not "helpful and friendly").

Tagging guidance:
- dietary: vegan, vegetarian, jain, gluten-free, nut-free, halal, kosher
- spice: spicy:1 (mild) through spicy:5 (extreme); omit if cuisine isn't spice-graded
- flags: popular, chef-special, new, signature
- allergens: nuts, dairy, eggs, gluten, soy, shellfish, sesame
- ingredients: 3–5 main ingredients, specific (e.g. "basmati rice", "ghee", "garam masala", "tandoor-cooked")

Price confidence: for each item with a price, set price_confidence:
- "high" when the price is from a structured POS feed (Toast, Square, Clover) or a clearly priced menu item on the source page.
- "medium" when the price was inferred from menu HTML but the source layout is ambiguous (e.g. table cell next to the item, not directly attached).
- "low" when the price is from an image caption, a PDF-rendered menu, or visibly out-of-date.
If no price can be extracted, omit price_cents and set price_confidence to "low" with no number.

Theme: produce a complete brand.theme object that captures *this specific restaurant's* identity, not a generic template.
- palette: pick 4 hex colors (primary, accent, surface, ink). Start from the extracted "Palette from logo" if it's present and on-brand; refine for contrast and cuisine appropriateness. surface should be near-white or near-black for the page background; ink is the body text color. Never leave any palette slot blank.
- fonts: if the page already loads Google Fonts, prefer those. Otherwise pick a display+body pair that fits the cuisine and vibe (e.g. "Playfair Display"+"Inter" for fine dining, "Inter Tight"+"Inter" for casual-modern, "DM Serif Display"+"Nunito" for rustic-warm).
- hero_url: pick the single best image from "Hero image candidates" to use as a page backdrop. Prefer photos of the food/space over generic stock. If none are suitable, omit.
- vibe: pick the one that best matches the cuisine and price tier from {fine-dining, casual-modern, rustic-warm, street-fast, cafe-bright, bar-night}.
- layout: pick from {split-hero, centered-hero, full-bleed-hero} based on the imagery available.

Brand colors (deprecated, kept for back-compat): also fill primary_color, accent_color from the palette so older UI keeps working.

Hours: parse into a per-day map. Each day's value is a list of {open, close} pairs in 24h "HH:MM" format. Closed days are an empty list.

Call save_tenant_data exactly once with the complete configuration. Do not include any prose outside the tool call."""

SAVE_TENANT_TOOL = {
    "name": "save_tenant_data",
    "description": "Persist the structured tenant configuration extracted from the scraped website.",
    "input_schema": {
        "type": "object",
        "required": ["name", "business_type", "brand", "ai_persona", "categories"],
        "properties": {
            "name": {"type": "string", "description": "Display name of the business."},
            "business_type": {
                "type": "string",
                "enum": ["restaurant", "retail", "grocery", "salon", "gym", "other"],
            },
            "tagline": {"type": "string"},
            "brand": {
                "type": "object",
                "required": ["primary_color", "accent_color", "voice", "theme"],
                "properties": {
                    "primary_color": {
                        "type": "string",
                        "description": "Hex color, e.g. '#B91C1C' (mirrors theme.palette.primary).",
                    },
                    "accent_color": {"type": "string"},
                    "background_color": {"type": "string"},
                    "logo_url": {"type": "string"},
                    "voice": {
                        "type": "string",
                        "description": "Short label: warm, modern, traditional, upscale, casual, etc.",
                    },
                    "theme": {
                        "type": "object",
                        "required": ["palette", "fonts", "vibe", "layout"],
                        "properties": {
                            "palette": {
                                "type": "object",
                                "required": ["primary", "accent", "surface", "ink"],
                                "properties": {
                                    "primary": {"type": "string", "description": "Hex"},
                                    "accent": {"type": "string", "description": "Hex"},
                                    "surface": {"type": "string", "description": "Hex; page background"},
                                    "ink": {"type": "string", "description": "Hex; body text"},
                                },
                            },
                            "fonts": {
                                "type": "object",
                                "required": ["display", "body"],
                                "properties": {
                                    "display": {"type": "string", "description": "Google Font family for headings"},
                                    "body": {"type": "string", "description": "Google Font family for body text"},
                                },
                            },
                            "hero_url": {"type": "string", "description": "Picked from image_candidates; full URL"},
                            "vibe": {
                                "type": "string",
                                "enum": ["fine-dining", "casual-modern", "rustic-warm", "street-fast", "cafe-bright", "bar-night"],
                            },
                            "layout": {
                                "type": "string",
                                "enum": ["split-hero", "centered-hero", "full-bleed-hero"],
                            },
                        },
                    },
                },
            },
            "contact": {
                "type": "object",
                "properties": {
                    "phone": {"type": "string"},
                    "email": {"type": "string"},
                    "address": {"type": "string"},
                },
            },
            "hours": {
                "type": "object",
                "description": (
                    "Map weekday name (lowercase) -> list of intervals; "
                    "each interval is {open: 'HH:MM', close: 'HH:MM'}. "
                    "Empty list means closed that day."
                ),
                "additionalProperties": True,
            },
            "ai_persona": {
                "type": "string",
                "description": (
                    "1–3 sentences describing how the AI should sound for this business. "
                    "Concrete and grounded in the cuisine/brand."
                ),
            },
            "categories": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": ["name", "items"],
                    "properties": {
                        "name": {"type": "string"},
                        "description": {"type": "string"},
                        "items": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "required": ["name"],
                                "properties": {
                                    "name": {"type": "string"},
                                    "description": {
                                        "type": "string",
                                        "description": (
                                            "1–2 sentences a customer unfamiliar with the cuisine "
                                            "would find useful."
                                        ),
                                    },
                                    "price_cents": {"type": "integer"},
                                    "price_confidence": {
                                        "type": "string",
                                        "enum": ["high", "medium", "low"],
                                        "description": "How trustworthy this price is. See system prompt for guidance.",
                                    },
                                    "image_url": {"type": "string"},
                                    "tags": {"type": "array", "items": {"type": "string"}},
                                    "ingredients": {
                                        "type": "array",
                                        "items": {"type": "string"},
                                    },
                                    "allergens": {"type": "array", "items": {"type": "string"}},
                                },
                            },
                        },
                    },
                },
            },
        },
    },
}


def build_user_message(scraped_summary: str, menu_html: str | None) -> str:
    parts = [
        "Below is the raw scraped data from a small business website. Produce the structured tenant configuration via save_tenant_data.",
        "",
        "=== SCRAPED SIGNALS ===",
        scraped_summary,
    ]
    if menu_html:
        parts += ["", "=== MENU PAGE HTML (truncated) ===", menu_html[:50000]]
    return "\n".join(parts)
