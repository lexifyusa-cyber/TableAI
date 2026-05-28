"""Demo-generator orchestrator.

The "Niagara Falls" pipeline: take a business URL → produce a fully-configured
tenant ready to demo to the owner. This is the moat — it must be excellent.

Flow:
  1. Scrape the public site (services.scraper).
  2. Send scraped signals + menu HTML to Claude with a structured-output tool.
  3. Persist the structured tenant + menu to the database.
  4. Return the new Tenant.

Per the 'quality over cost' rule: we use the most capable model for this
one-shot extraction. A bad demo loses the deal; a few cents extra is irrelevant.
"""

from __future__ import annotations

import re

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    BusinessType,
    KnowledgeSource,
    MenuCategory,
    MenuItem,
    Tenant,
    TenantStatus,
)
from app.prompts.demo_generator import (
    DEMO_GENERATOR_SYSTEM,
    SAVE_TENANT_TOOL,
    build_user_message,
)
from app.services.llm import get_provider_for
from app.services.scraper import scrape
from app.services.enrichment import enrich_tenant

_SLUG_STRIP = re.compile(r"[^a-z0-9-]")
_DASHES = re.compile(r"-+")


def slugify(name: str) -> str:
    s = name.lower().strip().replace(" ", "-").replace("&", "and")
    s = _SLUG_STRIP.sub("", s)
    s = _DASHES.sub("-", s).strip("-")
    return s[:64] or "tenant"


async def _upsert_knowledge(
    db: AsyncSession, *, tenant_id, bucket: str, source: str, data: dict
) -> None:
    """Upsert a knowledge_sources row keyed by (tenant, bucket, source)."""
    stmt = pg_insert(KnowledgeSource).values(
        tenant_id=tenant_id, bucket=bucket, source=source, data=data
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=["tenant_id", "bucket", "source"],
        set_={"data": stmt.excluded.data, "fetched_at": func.now()},
    )
    await db.execute(stmt)


async def _replace_menu(db: AsyncSession, tenant: Tenant, tool_input: dict) -> None:
    """Delete and re-insert this tenant's menu categories + items from a tool_input.

    Shared between initial demo creation (after the tenant row exists) and refresh.
    """
    await db.execute(delete(MenuItem).where(MenuItem.tenant_id == tenant.id))
    await db.execute(delete(MenuCategory).where(MenuCategory.tenant_id == tenant.id))

    for cat_idx, cat in enumerate(tool_input.get("categories", []) or []):
        category = MenuCategory(
            tenant_id=tenant.id,
            name=cat["name"],
            description=cat.get("description"),
            sort_order=cat_idx,
        )
        db.add(category)
        await db.flush()

        for item_idx, item in enumerate(cat.get("items", []) or []):
            db.add(
                MenuItem(
                    tenant_id=tenant.id,
                    category_id=category.id,
                    name=item["name"],
                    description=item.get("description"),
                    price_cents=item.get("price_cents"),
                    price_confidence=item.get("price_confidence"),
                    image_url=item.get("image_url"),
                    tags=list(item.get("tags") or []),
                    ingredients=list(item.get("ingredients") or []),
                    allergens=list(item.get("allergens") or []),
                    sort_order=item_idx,
                )
            )


async def _slug_taken(db: AsyncSession, slug: str) -> bool:
    res = await db.execute(select(Tenant.id).where(Tenant.slug == slug))
    return res.scalar_one_or_none() is not None


async def _unique_slug(db: AsyncSession, base: str) -> str:
    candidate = base
    n = 2
    while await _slug_taken(db, candidate):
        candidate = f"{base}-{n}"
        n += 1
    return candidate





# ---- Strict validation + retry for the save_tenant_data tool call ---------


REQUIRED_TOP = ("name", "business_type", "brand", "ai_persona", "categories")
REQUIRED_BRAND = ("primary_color", "accent_color", "voice", "theme")


def _validate_save_tenant(ti: dict) -> list[str]:
    errs: list[str] = []
    for f in REQUIRED_TOP:
        if f not in ti or ti[f] in (None, "", [], {}):
            errs.append(f"missing required field: {f}")
    brand = ti.get("brand") or {}
    if isinstance(brand, dict):
        for f in REQUIRED_BRAND:
            if f not in brand or brand[f] in (None, "",):
                errs.append(f"missing required brand.{f}")
    cats = ti.get("categories") or []
    if isinstance(cats, list):
        for i, cat in enumerate(cats):
            if not isinstance(cat, dict):
                errs.append(f"categories[{i}] is not an object")
                continue
            if "name" not in cat or not cat["name"]:
                errs.append(f"missing categories[{i}].name")
            if "items" not in cat or not cat["items"]:
                errs.append(f"missing categories[{i}].items")
    return errs


def _extract_tool_input(response, tool_name: str) -> dict | None:
    for tc in response.tool_calls or []:
        if tc.get("name") == tool_name:
            return dict(tc.get("input") or {})
    return None


async def _call_with_retry(provider, *, model: str, system: str, user_text: str, max_retries: int = 2) -> dict:
    """Call save_tenant_data with strict validation. Up to `max_retries` corrective rounds."""
    messages: list[dict] = [{"role": "user", "content": user_text}]
    last_errors: list[str] = []
    for attempt in range(max_retries + 1):
        response = await provider.complete(
            model=model,
            system=system,
            messages=messages,
            tools=[SAVE_TENANT_TOOL],
            tool_choice={"type": "tool", "name": "save_tenant_data"},
            max_tokens=8192,
        )
        tool_input = _extract_tool_input(response, "save_tenant_data")
        if tool_input is None:
            last_errors = ["LLM did not call save_tenant_data"]
        else:
            last_errors = _validate_save_tenant(tool_input)
            if not last_errors:
                return tool_input  # success

        # Corrective turn — tell the model what was wrong and ask it to redo
        feedback = (
            "Your previous save_tenant_data call was invalid. "
            "Errors: " + "; ".join(last_errors) + ". "
            "Call save_tenant_data again with ALL required fields filled in. "
            "Do not omit any required field. If you cannot determine a field from the source, "
            "make a careful judgment from the page title, URL, and other clues — but never return null or omit a required field."
        )
        messages = messages + [
            {"role": "assistant", "content": "[incomplete tool call]"},
            {"role": "user", "content": feedback},
        ]
    raise RuntimeError(
        f"LLM failed to produce a valid save_tenant_data after {max_retries} retries. "
        f"Last errors: {last_errors}"
    )


async def generate_demo(
    db: AsyncSession,
    *,
    url: str,
    slug_hint: str | None = None,
) -> Tenant:
    """Scrape a business URL and create a fully-configured demo tenant.

    Raises RuntimeError if the LLM call fails or returns malformed output.
    """
    site = await scrape(url)
    provider, model = await get_provider_for("demo_generation")

    tool_input = await _call_with_retry(
        provider,
        model=model,
        system=DEMO_GENERATOR_SYSTEM,
        user_text=build_user_message(site.short_summary(), site.menu_html),
        max_retries=2,
    )

    name = (tool_input.get("name") or "").strip()
    if not name:
        # Fall back to scraped site title if the LLM didn't produce one
        name = (site.title or "Restaurant").strip()
    business_type_str = tool_input.get("business_type", "restaurant")
    try:
        business_type = BusinessType(business_type_str)
    except ValueError:
        business_type = BusinessType.OTHER

    base_slug = slug_hint or slugify(name)
    slug = await _unique_slug(db, base_slug)

    brand = tool_input.get("brand") or {}
    if not brand.get("logo_url") and site.logo_url:
        brand["logo_url"] = site.logo_url

    tenant = Tenant(
        slug=slug,
        name=name,
        business_type=business_type,
        source_url=url,
        brand=brand,
        contact=tool_input.get("contact") or {},
        hours=tool_input.get("hours") or {},
        ai_config={
            "persona": tool_input.get("ai_persona", ""),
            "tagline": tool_input.get("tagline", ""),
        },
        pos_provider=site.pos_indicator,
        status=TenantStatus.DEMO,
    )
    db.add(tenant)
    await db.flush()  # assigns tenant.id

    await _replace_menu(db, tenant, tool_input)

    # Cache the raw scrape signals + the LLM tool input into knowledge_sources.
    # business bucket = homepage snapshot, menu bucket = extracted tool input.
    # Used downstream by the dashboard and the menu-refresh endpoint.
    await _upsert_knowledge(
        db,
        tenant_id=tenant.id,
        bucket="business",
        source="website",
        data={
            "url": url,
            "summary": site.short_summary(),
            "logo_url": site.logo_url,
            "pos_indicator": site.pos_indicator,
            "menu_is_image": site.menu_is_image,
            "menu_image_url": site.menu_image_url,
        },
    )
    await _upsert_knowledge(
        db,
        tenant_id=tenant.id,
        bucket="menu",
        source="site_menu",
        data={
            "url": url,
            "extracted": {"categories": tool_input.get("categories") or []},
        },
    )

    await db.commit()
    await db.refresh(tenant)

    # Run enrichment orchestrator: fill missing fields from external sources.
    # Best-effort: errors are logged but don't fail demo generation.
    try:
        await enrich_tenant(db, tenant)
        await db.refresh(tenant)
    except Exception as e:  # noqa: BLE001
        import logging; logging.getLogger(__name__).warning('enrichment failed: %s', e)

    return tenant



async def refresh_menu(db: AsyncSession, tenant: Tenant) -> dict:
    """Re-scrape this tenant's source URL and replace its menu in-place.

    Leaves the Tenant row (brand, persona, hours, contact) untouched.
    Updates the knowledge_sources cache rows. Returns a small summary dict.
    """
    if not tenant.source_url:
        raise RuntimeError("Tenant has no source_url to refresh from.")

    site = await scrape(tenant.source_url)
    provider, model = await get_provider_for("demo_generation")

    response = await provider.complete(
        model=model,
        system=DEMO_GENERATOR_SYSTEM,
        messages=[
            {
                "role": "user",
                "content": build_user_message(site.short_summary(), site.menu_html),
            }
        ],
        tools=[SAVE_TENANT_TOOL],
        tool_choice={"type": "tool", "name": "save_tenant_data"},
        max_tokens=8192,
    )

    tool_input: dict | None = None
    for tc in response.tool_calls:
        if tc.get("name") == "save_tenant_data":
            tool_input = dict(tc.get("input") or {})
            break
    if tool_input is None:
        raise RuntimeError("LLM did not call save_tenant_data; menu refresh aborted.")

    await _replace_menu(db, tenant, tool_input)

    # Merge new brand (palette/theme/fonts) into the tenant.
    # Leaves persona/voice/tagline untouched — those are part of ai_config, not brand.
    new_brand = tool_input.get("brand") or {}
    if new_brand:
        merged = dict(tenant.brand or {})
        merged.update(new_brand)
        tenant.brand = merged

    await _upsert_knowledge(
        db,
        tenant_id=tenant.id,
        bucket="business",
        source="website",
        data={
            "url": tenant.source_url,
            "summary": site.short_summary(),
            "logo_url": site.logo_url,
            "pos_indicator": site.pos_indicator,
        },
    )
    await _upsert_knowledge(
        db,
        tenant_id=tenant.id,
        bucket="menu",
        source="site_menu",
        data={
            "url": tenant.source_url,
            "extracted": {"categories": tool_input.get("categories") or []},
        },
    )

    await db.commit()
    categories = tool_input.get("categories") or []
    item_count = sum(len(c.get("items") or []) for c in categories)
    return {
        "category_count": len(categories),
        "item_count": item_count,
        "source_url": tenant.source_url,
    }
