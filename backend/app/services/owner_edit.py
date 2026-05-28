"""Natural-language edits to a tenant via LLM.

Owner types: "Change the burrito price to $9.95 and fix the address to 250 Park Ave"
We send the tenant snapshot + owner text to an LLM with a forced apply_edits
tool. Returns a structured diff; owner confirms; we apply.

Applied edits pin source=manual_owner_input with top priority, so future
re-enrichment never reverts them.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.menu import MenuCategory, MenuItem
from app.models.tenant import Tenant
from app.services.knowledge.store import upsert_knowledge_row
from app.services.llm import get_provider_for

SYSTEM_PROMPT = """You are a careful editor for restaurant data. The owner will describe
changes to their TableAI tenant in plain English. Read the current snapshot,
identify exactly which fields they want changed, and emit a single apply_edits
tool call.

RULES:
- Only change fields the owner explicitly mentions. Do NOT infer changes.
- Prices: convert plain-English dollar amounts to integer cents (e.g. "$9.95" -> 995).
- Item matching: when the owner refers to an item by name, find the closest existing item by name (case-insensitive). If multiple candidates match, prefer exact match; if still ambiguous, include both in your apply_edits with a note.
- If the owner asks to remove a tag, use tags_remove. If they want to add a tag, use tags_add. Never replace the whole tag list unless explicitly told.
- If the owner asks for something the tool cannot represent, omit it (don\'t hallucinate fields).
- Always emit exactly one apply_edits tool call.
"""

APPLY_EDITS_TOOL = {
    "name": "apply_edits",
    "description": "Apply field-level edits to a tenant\'s data based on the owner\'s request.",
    "input_schema": {
        "type": "object",
        "properties": {
            "tenant_fields": {
                "type": "object",
                "description": "Tenant-level fields to set. Omit keys you aren\'t changing.",
                "properties": {
                    "name": {"type": "string"},
                    "tagline": {"type": "string"},
                    "contact": {
                        "type": "object",
                        "properties": {
                            "address": {"type": "string"},
                            "phone": {"type": "string"},
                            "email": {"type": "string"},
                            "website": {"type": "string"},
                        },
                    },
                    "hours": {
                        "type": "object",
                        "description": "Weekday-lowercase -> list of {open: HH:MM, close: HH:MM} intervals. Empty list means closed.",
                    },
                },
            },
            "item_edits": {
                "type": "array",
                "description": "Per-item edits. `match.name` is required; `set` lists fields to update.",
                "items": {
                    "type": "object",
                    "required": ["match", "set"],
                    "properties": {
                        "match": {
                            "type": "object",
                            "properties": {"name": {"type": "string"}},
                        },
                        "set": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string"},
                                "description": {"type": "string"},
                                "price_cents": {"type": "integer"},
                                "image_url": {"type": "string"},
                                "tags_add": {"type": "array", "items": {"type": "string"}},
                                "tags_remove": {"type": "array", "items": {"type": "string"}},
                                "is_available": {"type": "boolean"},
                            },
                        },
                    },
                },
            },
            "notes": {
                "type": "string",
                "description": "Optional caveats for the human reviewer (e.g. ambiguity, items not found).",
            },
        },
    },
}


@dataclass(slots=True)
class EditProposal:
    """LLM-proposed edits, pending owner confirmation."""
    tenant_fields: dict[str, Any]
    item_edits: list[dict[str, Any]]
    notes: str | None


def _summarize_tenant_for_llm(tenant: Tenant, items: list[MenuItem]) -> str:
    """Compact snapshot the LLM uses to ground its edits."""
    items_brief = [
        {
            "id": str(it.id),
            "name": it.name,
            "price_cents": it.price_cents,
            "tags": it.tags,
            "is_available": it.is_available,
        }
        for it in items
    ]
    snapshot = {
        "name": tenant.name,
        "slug": tenant.slug,
        "tagline": (tenant.ai_config or {}).get("tagline"),
        "contact": tenant.contact or {},
        "hours": tenant.hours or {},
        "items": items_brief,
    }
    return json.dumps(snapshot, indent=2)


async def propose_edits(db: AsyncSession, tenant: Tenant, owner_text: str) -> EditProposal:
    """Ask the LLM to translate owner_text into structured field operations."""
    items = (
        await db.execute(select(MenuItem).where(MenuItem.tenant_id == tenant.id))
    ).scalars().all()

    snapshot = _summarize_tenant_for_llm(tenant, items)
    user_message = (
        f"Current tenant snapshot:\n\n```json\n{snapshot}\n```\n\n"
        f"Owner\'s request:\n\n{owner_text}"
    )

    provider, model = await get_provider_for("demo_generation")
    response = await provider.complete(
        model=model,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
        tools=[APPLY_EDITS_TOOL],
        tool_choice={"type": "tool", "name": "apply_edits"},
        max_tokens=2048,
    )

    tool_input: dict | None = None
    for tc in response.tool_calls:
        if tc.get("name") == "apply_edits":
            tool_input = dict(tc.get("input") or {})
            break
    if tool_input is None:
        raise RuntimeError("LLM did not produce an apply_edits call; cannot propose edits.")

    return EditProposal(
        tenant_fields=tool_input.get("tenant_fields") or {},
        item_edits=tool_input.get("item_edits") or [],
        notes=tool_input.get("notes"),
    )


async def apply_edits(db: AsyncSession, tenant: Tenant, proposal: EditProposal) -> dict:
    """Apply the LLM-proposed edits. Returns a small summary of changes made."""
    changes_tenant: dict[str, Any] = {}
    changes_items: list[dict[str, Any]] = []

    # ---- Tenant-level edits ----------------------------------------------
    tf = proposal.tenant_fields or {}
    if "name" in tf and isinstance(tf["name"], str) and tf["name"].strip():
        tenant.name = tf["name"].strip()
        changes_tenant["name"] = tenant.name

    if "tagline" in tf and isinstance(tf["tagline"], str):
        cfg = dict(tenant.ai_config or {})
        cfg["tagline"] = tf["tagline"]
        tenant.ai_config = cfg
        changes_tenant["tagline"] = tf["tagline"]

    if "contact" in tf and isinstance(tf["contact"], dict):
        merged_contact = dict(tenant.contact or {})
        for k, v in tf["contact"].items():
            if v in (None, ""):
                continue
            merged_contact[k] = v
            changes_tenant[f"contact.{k}"] = v
        tenant.contact = merged_contact

    if "hours" in tf and isinstance(tf["hours"], dict):
        tenant.hours = tf["hours"]
        changes_tenant["hours"] = tf["hours"]

    # Record tenant-level provenance for every changed field as manual_owner_input.
    provenance = dict(tenant.provenance or {})
    for k in changes_tenant.keys():
        provenance[k] = {"source": "manual_owner_input"}
    tenant.provenance = provenance

    # ---- Item-level edits -------------------------------------------------
    items_by_name = {}
    items = (
        await db.execute(select(MenuItem).where(MenuItem.tenant_id == tenant.id))
    ).scalars().all()
    for it in items:
        items_by_name[(it.name or "").strip().lower()] = it

    for ie in proposal.item_edits:
        match = ie.get("match") or {}
        target = items_by_name.get((match.get("name") or "").strip().lower())
        if target is None:
            changes_items.append({"match": match, "status": "not_found"})
            continue
        s = ie.get("set") or {}
        applied: dict[str, Any] = {}
        if "name" in s and isinstance(s["name"], str) and s["name"].strip():
            target.name = s["name"].strip()
            applied["name"] = target.name
        if "description" in s and isinstance(s["description"], str):
            target.description = s["description"]
            applied["description"] = s["description"]
        if "price_cents" in s and isinstance(s["price_cents"], int):
            target.price_cents = s["price_cents"]
            target.price_confidence = "high"
            applied["price_cents"] = s["price_cents"]
        if "image_url" in s and isinstance(s["image_url"], str) and s["image_url"].strip():
            target.image_url = s["image_url"].strip()
            applied["image_url"] = s["image_url"]
        if "is_available" in s and isinstance(s["is_available"], bool):
            target.is_available = s["is_available"]
            applied["is_available"] = s["is_available"]
        # Tags
        tags_add = s.get("tags_add") or []
        tags_remove = s.get("tags_remove") or []
        if tags_add or tags_remove:
            new_tags = [t for t in (target.tags or []) if t not in set(tags_remove)]
            for t in tags_add:
                if t not in new_tags:
                    new_tags.append(t)
            target.tags = new_tags
            applied["tags"] = new_tags
        # Provenance
        if applied:
            iprov = dict(target.provenance or {})
            for k in applied.keys():
                iprov[k] = {"source": "manual_owner_input"}
            target.provenance = iprov
        changes_items.append({
            "item_id": str(target.id),
            "item_name": target.name,
            "applied": applied,
        })

    # Also write a knowledge_sources audit row so re-enrichment knows owner pinned these.
    await upsert_knowledge_row(
        db,
        tenant_id=tenant.id,
        bucket="business",
        source="manual_owner_input",
        data={
            "tenant_changes": changes_tenant,
            "item_changes": changes_items,
            "raw_proposal": {
                "tenant_fields": proposal.tenant_fields,
                "item_edits": proposal.item_edits,
                "notes": proposal.notes,
            },
        },
    )

    await db.commit()
    return {
        "tenant_changes": changes_tenant,
        "item_changes": changes_items,
        "notes": proposal.notes,
    }
