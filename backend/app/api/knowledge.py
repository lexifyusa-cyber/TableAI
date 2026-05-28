"""Knowledge manifest + per-bucket detail endpoints.

Accessible by anyone with tenant access (owner + staff). Read-only from this module.

Public vs private:
- Owners see public + private for their own tenants (e.g. negative reviews go in private).
- Staff (admin/employee) see everything for any tenant.
- Unauthenticated customer chat only consumes the `public` side (enforced in the manifest).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import CurrentUser, require_role, require_tenant_access
from app.db import get_session
from app.models.knowledge_source import KnowledgeSource
from app.models.tenant import Tenant
from app.services.knowledge import KnowledgeManifest
from app.services.timeline import build_timeline_payload

router = APIRouter(tags=["knowledge"])


class BucketEntry(BaseModel):
    kind: str
    active: bool
    source: str | None = None
    fetched_at: str | None = None
    summary: str | None = None
    unlock_hint: str | None = None


class KnowledgeResponse(BaseModel):
    tenant: str
    buckets: list[BucketEntry]


@router.get("/tenant/knowledge", response_model=KnowledgeResponse)
async def get_knowledge(
    tenant: str = Query(...),
    access: tuple[CurrentUser, Tenant] = Depends(require_tenant_access("tenant")),
    db: AsyncSession = Depends(get_session),
) -> KnowledgeResponse:
    _, t = access
    manifest = KnowledgeManifest(t, db)
    buckets = await manifest.status()
    return KnowledgeResponse(
        tenant=t.slug,
        buckets=[
            BucketEntry(
                kind=b.kind,
                active=b.active,
                source=b.source,
                fetched_at=b.fetched_at,
                summary=b.summary,
                unlock_hint=b.unlock_hint,
            )
            for b in buckets
        ],
    )


class BucketDetailResponse(BaseModel):
    kind: str
    public: dict | list | None = None
    private: dict | list | None = None
    source: str | None = None
    fetched_at: str | None = None


@router.get("/tenant/timeline")
async def public_timeline(
    tenant: str = Query(...),
    db: AsyncSession = Depends(get_session),
) -> dict:
    """Public endpoint — returns only the public calendar payload.

    Used by the customer-facing chat page to render the seasonal banner without
    requiring auth. Safe because holidays + current date are public knowledge.
    """
    t = (
        await db.execute(select(Tenant).where(Tenant.slug == tenant))
    ).scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail=f"Tenant '{tenant}' not found")
    payload = build_timeline_payload(t.country_code)
    return {"tenant": tenant, "public": payload.get("public")}


@router.get("/tenant/knowledge/{kind}", response_model=BucketDetailResponse)
async def get_bucket_detail(
    kind: str,
    tenant: str = Query(...),
    access: tuple[CurrentUser, Tenant] = Depends(require_tenant_access("tenant")),
    db: AsyncSession = Depends(get_session),
) -> BucketDetailResponse:
    user, t = access

    # Derived buckets — computed on the fly, not stored in knowledge_sources.
    if kind == "calendar":
        payload = build_timeline_payload(t.country_code)
        return BucketDetailResponse(
            kind="calendar",
            public=payload.get("public"),
            private=payload.get("private"),
            source="builtin",
        )

    if kind == "business":
        public = {
            "name": t.name,
            "brand": t.brand or {},
            "contact": t.contact or {},
            "hours": t.hours or {},
            "tagline": (t.ai_config or {}).get("tagline"),
            "ai_persona": (t.ai_config or {}).get("persona"),
            "country_code": t.country_code,
        }
        private = {
            "source_url": t.source_url,
            "pos_provider": t.pos_provider,
            "cultural_context": t.cultural_context or {},
            "status": t.status.value if hasattr(t.status, "value") else t.status,
        }
        return BucketDetailResponse(kind="business", public=public, private=private, source="website")

    if kind == "menu":
        from app.services.knowledge.providers import menu as menu_bucket
        text = await menu_bucket.format(t, db)
        summary = await menu_bucket.summary(t, db)
        return BucketDetailResponse(
            kind="menu",
            public={
                "item_count": summary["item_count"],
                "category_count": summary["category_count"],
                "preview_text": text,
            },
            source="website",
        )

    # knowledge_sources-backed buckets
    row = (
        await db.execute(
            select(KnowledgeSource)
            .where(
                KnowledgeSource.tenant_id == t.id,
                KnowledgeSource.bucket == kind,
            )
            .order_by(KnowledgeSource.fetched_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()

    if not row:
        return BucketDetailResponse(kind=kind)

    data = row.data or {}
    public = data.get("public") if isinstance(data, dict) and "public" in data else data
    private = data.get("private") if isinstance(data, dict) else None

    return BucketDetailResponse(
        kind=kind,
        public=public,
        private=private,
        source=row.source,
        fetched_at=row.fetched_at.isoformat() if row.fetched_at else None,
    )


class CulturalContextUpdate(BaseModel):
    country_code: str | None = None
    cultural_context: dict | None = None


@router.patch("/admin/tenants/{slug}/cultural")
async def update_cultural(
    slug: str,
    body: CulturalContextUpdate,
    _: CurrentUser = Depends(require_role("admin", "employee")),
    db: AsyncSession = Depends(get_session),
) -> dict:
    """Admin/employee only — set country + cultural context for timeline awareness."""
    t = (
        await db.execute(select(Tenant).where(Tenant.slug == slug))
    ).scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Tenant not found")

    if body.country_code is not None:
        cc = body.country_code.strip().upper()
        if cc and (len(cc) != 2 or not cc.isalpha()):
            raise HTTPException(status_code=400, detail="country_code must be ISO-3166-1 alpha-2")
        t.country_code = cc or None
    if body.cultural_context is not None:
        t.cultural_context = body.cultural_context

    await db.commit()
    return {
        "slug": slug,
        "country_code": t.country_code,
        "cultural_context": t.cultural_context,
    }
