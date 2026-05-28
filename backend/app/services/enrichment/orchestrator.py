"""Coordinator: runs source fetchers concurrently (each with its OWN session
so SQLAlchemy doesn\'t deadlock), then merges canonical fields on the caller\'s
session.
"""
from __future__ import annotations

import asyncio
import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import SessionLocal
from app.models.tenant import Tenant
from app.services.enrichment.merge import merge_to_canonical
from app.services.enrichment.sources import EnrichmentSpec, all_specs

log = logging.getLogger(__name__)

# Some fetchers also mutate the Tenant row (e.g. discovery cached on
# tenant.metadata_). They run with their own session, so we re-read the tenant
# at merge time from the caller\'s session.


async def _run_one(spec: EnrichmentSpec, tenant_id: UUID, tenant_slug: str) -> tuple[str, dict]:
    """Open a fresh session per source and let it commit independently."""
    try:
        async with SessionLocal() as db:
            t = (await db.execute(select(Tenant).where(Tenant.id == tenant_id))).scalar_one()
            await spec.fetch_fn(db, t)
            await db.commit()
        log.info("enrichment[%s] ok for tenant=%s", spec.name, tenant_slug)
        return spec.name, {"ok": True}
    except Exception as e:  # noqa: BLE001
        log.warning("enrichment[%s] failed for tenant=%s: %s", spec.name, tenant_slug, e)
        return spec.name, {"ok": False, "error": str(e)[:300]}


async def enrich_tenant(
    db: AsyncSession,
    tenant: Tenant,
    *,
    specs: list[EnrichmentSpec] | None = None,
) -> dict:
    """Run all specs in parallel (each with its own session), then merge canonical."""
    specs = specs if specs is not None else all_specs()
    tenant_id = tenant.id
    tenant_slug = tenant.slug

    # Throttle so we don\'t open 12 Playwright contexts at once.
    sem = asyncio.Semaphore(4)

    async def guarded(spec: EnrichmentSpec) -> tuple[str, dict]:
        async with sem:
            return await _run_one(spec, tenant_id, tenant_slug)

    results = await asyncio.gather(*(guarded(s) for s in specs), return_exceptions=False)
    sources_summary = dict(results)

    # Re-read tenant in the caller\'s session (fetchers may have updated rows).
    await db.refresh(tenant)
    merge_summary = await merge_to_canonical(db, tenant)
    await db.commit()
    return {"sources": sources_summary, "merge": merge_summary}
