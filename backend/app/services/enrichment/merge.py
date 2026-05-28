"""Walks the `knowledge_sources` rows for a tenant and writes the canonical
tenant + menu_item fields using the field-level priority lists in sources.py.

Provenance: for each field touched, records `{source, fetched_at}` in the
respective table\'s `provenance` JSONB column.
"""
from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.knowledge_source import KnowledgeSource
from app.models.menu import MenuItem
from app.models.tenant import Tenant
from app.services.enrichment.sources import ITEM_FIELD_PRIORITY, TENANT_FIELD_PRIORITY


def _get_path(d: dict, path: str) -> Any:
    """Read a dotted path from a dict — e.g. \"contact.address\"."""
    cur: Any = d
    for part in path.split("."):
        if not isinstance(cur, dict):
            return None
        cur = cur.get(part)
        if cur in (None, "", [], {}):
            return None
    return cur


def _set_path(d: dict, path: str, value: Any) -> None:
    parts = path.split(".")
    cur = d
    for p in parts[:-1]:
        if p not in cur or not isinstance(cur[p], dict):
            cur[p] = {}
        cur = cur[p]
    cur[parts[-1]] = value


# Canonical destinations for tenant fields. Maps the priority-list key to where
# the value actually lives on the Tenant row.
TENANT_DEST = {
    "hours":                ("hours", None),               # tenant.hours
    "contact.address":      ("contact", "address"),
    "contact.phone":        ("contact", "phone"),
    "contact.email":        ("contact", "email"),
    "brand.theme.hero_url": ("brand", "theme.hero_url"),
    "tagline":              ("ai_config", "tagline"),
}


async def merge_to_canonical(db: AsyncSession, tenant: Tenant) -> dict:
    """Walk priorities and write the canonical Tenant + MenuItem columns.

    Returns a small summary of which fields were touched.
    """
    rows = (
        await db.execute(
            select(KnowledgeSource).where(KnowledgeSource.tenant_id == tenant.id)
        )
    ).scalars().all()
    by_source: dict[str, KnowledgeSource] = {r.source: r for r in rows}

    touched_tenant: dict[str, str] = {}

    # ---- tenant-level merge -----------------------------------------------
    provenance = dict(tenant.provenance or {})
    for field, priority in TENANT_FIELD_PRIORITY.items():
        for src_name in priority:
            row = by_source.get(src_name)
            if row is None:
                continue
            data = row.data or {}
            value = _get_path(data, field)
            if value in (None, "", [], {}):
                continue

            # write into the canonical destination on tenant
            container_attr, inner_path = TENANT_DEST[field]
            if inner_path is None:
                # whole-field replacement (e.g. tenant.hours)
                setattr(tenant, container_attr, value)
            else:
                # nested write into a JSONB column
                container = dict(getattr(tenant, container_attr) or {})
                _set_path(container, inner_path, value)
                setattr(tenant, container_attr, container)

            provenance[field] = {
                "source": src_name,
                "fetched_at": row.fetched_at.isoformat() if row.fetched_at else None,
            }
            touched_tenant[field] = src_name
            break  # first winner takes it
    tenant.provenance = provenance

    # ---- item-level merge -------------------------------------------------
    # Sources that provide menu items: each row\'s data has `items: [{name, price_cents, image_url, ...}]`
    item_sources = ["manual_owner_input", "website", "doordash_consumer", "ubereats_consumer", "aggregator_menuwithprice", "aggregator_allmenus", "aggregator_menupages", "pdf_menu", "google_serp_vision", "vision_delivery", "vision_website", "vision_ocr"]
    item_rows: dict[str, list[dict]] = {}
    for src in item_sources:
        row = by_source.get(src)
        if row and isinstance(row.data, dict):
            # support both flat {items:[...]} and {extracted:{categories:[{items:[...]}]}}
            items: list[dict] = []
            if isinstance(row.data.get("items"), list):
                items = row.data["items"]
            elif isinstance(row.data.get("extracted"), dict):
                for cat in row.data["extracted"].get("categories", []):
                    items.extend(cat.get("items", []) or [])
            item_rows[src] = items

    items_touched = 0
    if item_rows:
        # Load this tenant\'s items
        existing_items = (
            await db.execute(select(MenuItem).where(MenuItem.tenant_id == tenant.id))
        ).scalars().all()
        for item in existing_items:
            iprov = dict(item.provenance or {})
            name_lc = (item.name or "").strip().lower()
            for field, priority in ITEM_FIELD_PRIORITY.items():
                if getattr(item, field, None) not in (None, "", [], {}):
                    continue  # already populated; keep existing (lower-priority sources don\'t override)
                for src_name in priority:
                    src_items = item_rows.get(src_name) or []
                    match = next(
                        (
                            it for it in src_items
                            if isinstance(it, dict) and (it.get("name") or "").strip().lower() == name_lc
                        ),
                        None,
                    )
                    if match is None:
                        continue
                    val = match.get(field)
                    if val in (None, "", [], {}):
                        continue
                    setattr(item, field, val)
                    iprov[field] = {"source": src_name}
                    items_touched += 1
                    break
            item.provenance = iprov

    return {"tenant_fields": touched_tenant, "items_filled_count": items_touched}
