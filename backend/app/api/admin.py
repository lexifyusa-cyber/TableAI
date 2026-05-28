"""Admin API — user management, LLM provider config, global model defaults, invites.

All endpoints require role admin OR employee; key-management endpoints require admin.
"""

from __future__ import annotations

import json
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import httpx
from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import CurrentUser, require_role
from app.services.demo_generator import refresh_menu
from app.services.enrichment import enrich_tenant
from app.db import get_session
from app.models.app_setting import AppSetting
from app.models.llm_provider import LLMProvider
from app.models.owner_invite import OwnerInvite
from app.models.profile import Profile
from app.models.tenant import Tenant
from app.models.tenant_owner import TenantOwner

router = APIRouter(prefix="/admin", tags=["admin"])


def _mask(value: str) -> str:
    if not value:
        return ""
    if len(value) < 10:
        return "•" * len(value)
    return value[:6] + "•" * 8 + value[-4:]


# ============================================================================
# Users
# ============================================================================


class ProfileOut(BaseModel):
    user_id: str
    email: str
    role: str
    display_name: str | None = None
    tenant_count: int = 0


class ProfileUpdate(BaseModel):
    role: str | None = None
    display_name: str | None = None


@router.get("/users", response_model=list[ProfileOut])
async def list_users(
    _: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_session),
) -> list[ProfileOut]:
    rows = (await db.execute(select(Profile).order_by(Profile.created_at.desc()))).scalars().all()
    out: list[ProfileOut] = []
    for p in rows:
        n = (
            await db.execute(
                select(TenantOwner).where(TenantOwner.user_id == p.user_id)
            )
        ).scalars().all()
        out.append(
            ProfileOut(
                user_id=str(p.user_id),
                email=p.email,
                role=p.role,
                display_name=p.display_name,
                tenant_count=len(n),
            )
        )
    return out


@router.patch("/users/{user_id}", response_model=ProfileOut)
async def update_user(
    user_id: str,
    body: ProfileUpdate,
    me: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_session),
) -> ProfileOut:
    try:
        uid = UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id")
    p = (await db.execute(select(Profile).where(Profile.user_id == uid))).scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="User not found")
    if body.role is not None:
        if body.role not in ("admin", "employee", "owner"):
            raise HTTPException(status_code=400, detail="Invalid role")
        if me.user_id == p.user_id and body.role != "admin":
            raise HTTPException(status_code=400, detail="Cannot demote yourself")
        p.role = body.role
    if body.display_name is not None:
        p.display_name = body.display_name
    await db.commit()
    return ProfileOut(
        user_id=str(p.user_id), email=p.email, role=p.role, display_name=p.display_name
    )


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    me: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_session),
) -> dict[str, bool]:
    try:
        uid = UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id")
    if me.user_id == uid:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    await db.execute(delete(Profile).where(Profile.user_id == uid))
    await db.commit()
    return {"ok": True}


# ============================================================================
# LLM Providers
# ============================================================================


class ProviderOut(BaseModel):
    id: str
    name: str
    kind: str
    base_url: str | None = None
    api_key_masked: str
    api_key_present: bool
    enabled: bool


class ProviderCreate(BaseModel):
    name: str
    kind: str  # "anthropic" | "openai_compat"
    base_url: str | None = None
    api_key: str
    enabled: bool = True


class ProviderUpdate(BaseModel):
    name: str | None = None
    base_url: str | None = None
    api_key: str | None = None
    enabled: bool | None = None


def _provider_out(p: LLMProvider) -> ProviderOut:
    return ProviderOut(
        id=str(p.id),
        name=p.name,
        kind=p.kind,
        base_url=p.base_url,
        api_key_masked=_mask(p.api_key),
        api_key_present=bool(p.api_key),
        enabled=p.enabled,
    )


@router.get("/providers", response_model=list[ProviderOut])
async def list_providers(
    _: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_session),
) -> list[ProviderOut]:
    rows = (await db.execute(select(LLMProvider).order_by(LLMProvider.created_at.asc()))).scalars().all()
    return [_provider_out(p) for p in rows]


@router.post("/providers", response_model=ProviderOut)
async def create_provider(
    body: ProviderCreate,
    _: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_session),
) -> ProviderOut:
    if body.kind not in ("anthropic", "openai_compat"):
        raise HTTPException(status_code=400, detail="Invalid kind")
    p = LLMProvider(
        name=body.name.strip(),
        kind=body.kind,
        base_url=body.base_url.strip() if body.base_url else None,
        api_key=body.api_key.strip(),
        enabled=body.enabled,
    )
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return _provider_out(p)


@router.patch("/providers/{provider_id}", response_model=ProviderOut)
async def update_provider(
    provider_id: str,
    body: ProviderUpdate,
    _: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_session),
) -> ProviderOut:
    try:
        pid = UUID(provider_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid provider id")
    p = (await db.execute(select(LLMProvider).where(LLMProvider.id == pid))).scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Provider not found")
    if body.name is not None:
        p.name = body.name.strip()
    if body.base_url is not None:
        p.base_url = body.base_url.strip() or None
    if body.api_key is not None and body.api_key.strip():
        p.api_key = body.api_key.strip()
    if body.enabled is not None:
        p.enabled = body.enabled
    await db.commit()
    return _provider_out(p)


@router.delete("/providers/{provider_id}")
async def delete_provider(
    provider_id: str,
    _: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_session),
) -> dict[str, bool]:
    try:
        pid = UUID(provider_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid provider id")
    await db.execute(delete(LLMProvider).where(LLMProvider.id == pid))
    await db.commit()
    return {"ok": True}


class TestResult(BaseModel):
    ok: bool
    detail: str


@router.post("/providers/{provider_id}/test", response_model=TestResult)
async def test_provider(
    provider_id: str,
    _: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_session),
) -> TestResult:
    try:
        pid = UUID(provider_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid provider id")
    p = (await db.execute(select(LLMProvider).where(LLMProvider.id == pid))).scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Provider not found")
    if not p.api_key:
        return TestResult(ok=False, detail="No API key configured.")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            if p.kind == "anthropic":
                base = (p.base_url or "https://api.anthropic.com").rstrip("/")
                r = await client.get(
                    f"{base}/v1/models",
                    headers={"x-api-key": p.api_key, "anthropic-version": "2023-06-01"},
                )
            else:
                base = (p.base_url or "https://api.openai.com").rstrip("/")
                r = await client.get(
                    f"{base}/v1/models",
                    headers={"Authorization": f"Bearer {p.api_key}"},
                )
    except httpx.HTTPError as e:
        return TestResult(ok=False, detail=f"Network error: {e}")

    if r.status_code == 200:
        return TestResult(ok=True, detail=f"Verified ({p.kind}) — {r.status_code}")
    if r.status_code == 401:
        return TestResult(ok=False, detail="Unauthorized — key invalid.")
    return TestResult(ok=False, detail=f"Unexpected response: {r.status_code}")


# ============================================================================
# Global model config
# ============================================================================


class ModelConfigResponse(BaseModel):
    defaults: dict  # {chat:{kind,model}, demo_generation:{kind,model}, premium_chat:{kind,model}}
    allowed_models: dict  # {anthropic:[...], openai_compat:[...]}


class ModelConfigUpdate(BaseModel):
    defaults: dict | None = None
    allowed_models: dict | None = None


async def _load_json(db: AsyncSession, key: str) -> dict:
    row = (await db.execute(select(AppSetting).where(AppSetting.key == key))).scalar_one_or_none()
    if not row or not row.value:
        return {}
    try:
        return json.loads(row.value)
    except Exception:
        return {}


async def _save_json(db: AsyncSession, key: str, value: dict) -> None:
    stmt = pg_insert(AppSetting).values(key=key, value=json.dumps(value))
    stmt = stmt.on_conflict_do_update(
        index_elements=[AppSetting.key], set_={"value": stmt.excluded.value}
    )
    await db.execute(stmt)
    await db.commit()


@router.get("/model-config", response_model=ModelConfigResponse)
async def get_model_config(
    _: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_session),
) -> ModelConfigResponse:
    return ModelConfigResponse(
        defaults=await _load_json(db, "llm.defaults"),
        allowed_models=await _load_json(db, "llm.allowed_models"),
    )


@router.patch("/model-config", response_model=ModelConfigResponse)
async def update_model_config(
    body: ModelConfigUpdate,
    _: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_session),
) -> ModelConfigResponse:
    if body.defaults is not None:
        await _save_json(db, "llm.defaults", body.defaults)
    if body.allowed_models is not None:
        await _save_json(db, "llm.allowed_models", body.allowed_models)
    return await get_model_config(_, db)  # type: ignore[arg-type]


# ============================================================================
# Invites
# ============================================================================


class InviteCreate(BaseModel):
    email: EmailStr
    note: str | None = None


class InviteOut(BaseModel):
    token: str
    code: str
    tenant_slug: str
    email: str
    expires_at: str


@router.post("/tenants/{slug}/invite", response_model=InviteOut)
async def create_invite(
    slug: str,
    body: InviteCreate,
    me: CurrentUser = Depends(require_role("admin", "employee")),
    db: AsyncSession = Depends(get_session),
) -> InviteOut:
    t = (await db.execute(select(Tenant).where(Tenant.slug == slug))).scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Tenant not found")

    token = secrets.token_urlsafe(24)
    code = f"{secrets.randbelow(1_000_000):06d}"
    expires = datetime.now(timezone.utc) + timedelta(days=7)

    inv = OwnerInvite(
        token=token,
        code=code,
        tenant_id=t.id,
        email=body.email,
        created_by=me.user_id,
        expires_at=expires,
        note=body.note,
    )
    db.add(inv)
    await db.commit()

    return InviteOut(
        token=token,
        code=code,
        tenant_slug=slug,
        email=body.email,
        expires_at=expires.isoformat(),
    )


@router.get("/tenants/{slug}/invites", response_model=list[InviteOut])
async def list_invites(
    slug: str,
    _: CurrentUser = Depends(require_role("admin", "employee")),
    db: AsyncSession = Depends(get_session),
) -> list[InviteOut]:
    t = (await db.execute(select(Tenant).where(Tenant.slug == slug))).scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Tenant not found")
    rows = (
        await db.execute(
            select(OwnerInvite)
            .where(OwnerInvite.tenant_id == t.id, OwnerInvite.consumed_at.is_(None))
            .order_by(OwnerInvite.created_at.desc())
            .limit(50)
        )
    ).scalars().all()
    return [
        InviteOut(
            token=r.token,
            code=r.code,
            tenant_slug=slug,
            email=r.email,
            expires_at=r.expires_at.isoformat(),
        )
        for r in rows
    ]


# ============================================================================
# Tenants (admin view)
# ============================================================================


@router.get("/tenants")
async def admin_list_tenants(
    _: CurrentUser = Depends(require_role("admin", "employee")),
    db: AsyncSession = Depends(get_session),
) -> list[dict]:
    rows = (
        await db.execute(select(Tenant).order_by(Tenant.created_at.desc()).limit(500))
    ).scalars().all()
    out = []
    for t in rows:
        owners = (
            await db.execute(
                select(Profile)
                .join(TenantOwner, TenantOwner.user_id == Profile.user_id)
                .where(TenantOwner.tenant_id == t.id)
            )
        ).scalars().all()
        out.append(
            {
                "id": str(t.id),
                "slug": t.slug,
                "name": t.name,
                "business_type": t.business_type.value if hasattr(t.business_type, "value") else t.business_type,
                "status": t.status.value if hasattr(t.status, "value") else t.status,
                "source_url": t.source_url,
                "created_at": t.created_at.isoformat() if t.created_at else None,
                "owners": [{"user_id": str(o.user_id), "email": o.email, "display_name": o.display_name} for o in owners],
            }
        )
    return out



# ============================================================================
# Per-tenant data refresh
# ============================================================================


class RefreshResult(BaseModel):
    ok: bool
    bucket: str
    category_count: int | None = None
    item_count: int | None = None
    source_url: str | None = None
    detail: str | None = None


@router.post("/tenants/{slug}/refresh/{bucket}", response_model=RefreshResult)
async def refresh_bucket(
    slug: str,
    bucket: str,
    _: CurrentUser = Depends(require_role("admin", "employee")),
    db: AsyncSession = Depends(get_session),
) -> RefreshResult:
    """Re-fetch and replace one knowledge bucket for a tenant.

    Currently only `menu` is implemented; other buckets respond 400 until their
    source writers land (toast/square/google_reviews/...).
    """
    t = (await db.execute(select(Tenant).where(Tenant.slug == slug))).scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail=f"Tenant '{slug}' not found")

    if bucket != "menu":
        raise HTTPException(
            status_code=400,
            detail=f"Refresh for bucket '{bucket}' not implemented yet.",
        )

    try:
        summary = await refresh_menu(db, t)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    return RefreshResult(
        ok=True,
        bucket=bucket,
        category_count=summary["category_count"],
        item_count=summary["item_count"],
        source_url=summary["source_url"],
    )

# ============================================================================
# Multi-source enrichment orchestrator
# ============================================================================


class EnrichmentRunResult(BaseModel):
    tenant: str
    sources: dict
    merge: dict


@router.post("/tenants/{slug}/enrich/run", response_model=EnrichmentRunResult)
async def run_enrichment(
    slug: str,
    _: CurrentUser = Depends(require_role("admin", "employee")),
    db: AsyncSession = Depends(get_session),
) -> EnrichmentRunResult:
    """Run all enrichment sources on an existing tenant. Useful for backfilling
    hours/contact/photos on tenants generated before the framework was wired."""
    t = (
        await db.execute(select(Tenant).where(Tenant.slug == slug))
    ).scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail=f"Tenant '{slug}' not found")

    summary = await enrich_tenant(db, t)
    await db.refresh(t)
    return EnrichmentRunResult(tenant=slug, sources=summary.get("sources", {}), merge=summary.get("merge", {}))


class EnrichStatusEntry(BaseModel):
    source: str
    bucket: str
    fetched_at: str | None = None
    has_data: bool = False
    summary: str | None = None


class EnrichStatusResponse(BaseModel):
    tenant: str
    sources: list[EnrichStatusEntry]


@router.get("/tenants/{slug}/enrich/status", response_model=EnrichStatusResponse)
async def enrichment_status(
    slug: str,
    _: CurrentUser = Depends(require_role("admin", "employee")),
    db: AsyncSession = Depends(get_session),
) -> EnrichStatusResponse:
    """List every knowledge_sources + media_assets summary for a tenant."""
    from app.models.knowledge_source import KnowledgeSource

    t = (await db.execute(select(Tenant).where(Tenant.slug == slug))).scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail=f"Tenant '{slug}' not found")

    rows = (await db.execute(
        select(KnowledgeSource).where(KnowledgeSource.tenant_id == t.id).order_by(KnowledgeSource.bucket, KnowledgeSource.source)
    )).scalars().all()
    entries: list[EnrichStatusEntry] = []
    for r in rows:
        d = r.data or {}
        summary = None
        if r.bucket == "menu" and isinstance(d.get("extracted"), dict):
            cats = d["extracted"].get("categories") or []
            n = sum(len(c.get("items") or []) for c in cats)
            summary = f"{n} items extracted"
        elif r.bucket == "menu" and isinstance(d.get("items"), list):
            summary = f"{len(d['items'])} items"
        elif r.bucket == "business":
            keys = list(d.keys())[:4]
            summary = f"keys: {', '.join(keys)}"
        elif r.bucket == "social":
            if isinstance(d.get("photos"), list):
                summary = f"{len(d['photos'])} photos"
        elif r.bucket == "reputation":
            pub = d.get("public") or d
            summary = f"rating {pub.get('rating', '?')}, {pub.get('review_count', '?')} reviews"
        elif r.bucket == "operational":
            if isinstance(d.get("urls"), dict):
                summary = ", ".join(d["urls"].keys())
        entries.append(EnrichStatusEntry(
            source=r.source,
            bucket=r.bucket,
            fetched_at=r.fetched_at.isoformat() if r.fetched_at else None,
            has_data=bool(d and not d.get("error")),
            summary=summary,
        ))
    return EnrichStatusResponse(tenant=slug, sources=entries)

