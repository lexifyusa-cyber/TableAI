"""Shared idempotent upsert for the `knowledge_sources` cache table.

All fetchers (demo_generator, reputation, google_business, doordash, vision_ocr,
yelp, owner_edit) write through this single helper so the on-conflict semantics
and timestamp behavior are consistent.
"""
from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.knowledge_source import KnowledgeSource


async def upsert_knowledge_row(
    db: AsyncSession,
    *,
    tenant_id: UUID,
    bucket: str,
    source: str,
    data: dict[str, Any],
) -> None:
    """Insert-or-update a knowledge_sources row keyed by (tenant_id, bucket, source).

    Always updates `data` and bumps `fetched_at = now()`. Does NOT commit — the
    caller is responsible for transaction boundaries.
    """
    stmt = pg_insert(KnowledgeSource).values(
        tenant_id=tenant_id, bucket=bucket, source=source, data=data
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=["tenant_id", "bucket", "source"],
        set_={"data": stmt.excluded.data, "fetched_at": func.now()},
    )
    await db.execute(stmt)
