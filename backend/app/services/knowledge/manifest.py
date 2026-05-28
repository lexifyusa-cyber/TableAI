"""Knowledge manifest — assembles per-bucket context + exposes bucket status."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.knowledge_source import KnowledgeSource
from app.models.tenant import Tenant
from app.services.knowledge.providers import (
    business as business_bucket,
    calendar as calendar_bucket,
    menu as menu_bucket,
    reputation as reputation_bucket,
)
from app.services.timeline import build_timeline_payload, current_or_upcoming

BUCKET_KINDS = [
    "menu",
    "business",
    "reputation",
    "social",
    "operational",
    "local",
    "customer",
    "calendar",
]


@dataclass(slots=True)
class BucketStatus:
    kind: str
    active: bool
    source: str | None = None
    fetched_at: str | None = None
    summary: str | None = None
    unlock_hint: str | None = None


class KnowledgeManifest:
    def __init__(self, tenant: Tenant, db: AsyncSession) -> None:
        self.tenant = tenant
        self.db = db

    async def _load_sources(self) -> dict[str, KnowledgeSource]:
        rows = (
            await self.db.execute(
                select(KnowledgeSource).where(KnowledgeSource.tenant_id == self.tenant.id)
            )
        ).scalars().all()
        # Most recent per bucket wins if multiple sources.
        by_bucket: dict[str, KnowledgeSource] = {}
        for r in rows:
            existing = by_bucket.get(r.bucket)
            if not existing or (r.fetched_at and existing.fetched_at and r.fetched_at > existing.fetched_at):
                by_bucket[r.bucket] = r
        return by_bucket

    async def build_system_blocks(self, *, include: list[str] | None = None) -> list[dict[str, Any]]:
        """Return a list of Anthropic-style system blocks, one per active bucket.

        Blocks are ordered: business, menu, reputation, social, operational, local, customer.
        (Business first so the AI knows who it's speaking for; menu next since it's the
        largest block; reputation/social add flavor.)
        """
        include_set = set(include or BUCKET_KINDS)
        sources = await self._load_sources()
        blocks: list[dict[str, Any]] = []

        order = [
            "business",
            "menu",
            "reputation",
            "calendar",
            "social",
            "operational",
            "local",
            "customer",
        ]
        for kind in order:
            if kind not in include_set:
                continue

            text: str | None = None
            cache = False

            if kind == "business":
                text = business_bucket.format(self.tenant)
            elif kind == "menu":
                text = await menu_bucket.format(self.tenant, self.db)
                cache = True  # menu block is the big one — keep it warm
            elif kind == "reputation":
                row = sources.get("reputation")
                text = reputation_bucket.format(row) if row else None
            elif kind == "calendar":
                # Derived per-request from tenant country + today's date.
                # Not stored in knowledge_sources; built on the fly.
                payload = build_timeline_payload(self.tenant.country_code)
                synthetic_row = type(
                    "SyntheticRow", (), {"data": payload, "fetched_at": None}
                )()
                text = calendar_bucket.format(synthetic_row)  # type: ignore[arg-type]

            if text:
                block: dict[str, Any] = {"type": "text", "text": text}
                if cache:
                    block["cache_control"] = {"type": "ephemeral"}
                blocks.append(block)

        return blocks

    async def status(self) -> list[BucketStatus]:
        """Per-bucket status for the dashboard card."""
        sources = await self._load_sources()
        out: list[BucketStatus] = []

        # Buckets that don't need a knowledge_sources row — read from tenant/menu directly.
        business_active = bool(self.tenant.brand or self.tenant.contact or self.tenant.hours or self.tenant.ai_config)
        out.append(
            BucketStatus(
                kind="business",
                active=business_active,
                source="website",
                summary=self.tenant.name,
            )
        )

        menu_summary = await menu_bucket.summary(self.tenant, self.db)
        out.append(
            BucketStatus(
                kind="menu",
                active=menu_summary["item_count"] > 0,
                source="website",
                summary=f"{menu_summary['item_count']} items across {menu_summary['category_count']} categories"
                if menu_summary["item_count"]
                else None,
                unlock_hint=None if menu_summary["item_count"] else "Run the demo generator",
            )
        )

        # Buckets that live in knowledge_sources.
        for kind, hint in [
            ("reputation", "Connect Google Places (admin → integrations)"),
            ("social", "Connect Instagram (coming soon)"),
            ("operational", "Connect POS (post-signup)"),
            ("local", "Coming soon"),
            ("customer", "Populates automatically as customers chat"),
        ]:
            row = sources.get(kind)
            if row:
                summary = None
                if kind == "reputation":
                    d = row.data.get("public") or row.data
                    r = d.get("rating")
                    c = d.get("review_count")
                    summary = f"{r}★ · {c} reviews" if r and c else None
                out.append(
                    BucketStatus(
                        kind=kind,
                        active=True,
                        source=row.source,
                        fetched_at=row.fetched_at.isoformat() if row.fetched_at else None,
                        summary=summary,
                    )
                )
            else:
                out.append(BucketStatus(kind=kind, active=False, unlock_hint=hint))

        # Calendar bucket — always active (derived from country + today).
        h = current_or_upcoming(self.tenant.country_code)
        if h:
            cal_summary = (
                f"Today: {h.name}"
                if h.days_away == 0
                else f"{h.name} in {h.days_away}d"
            )
            if h.emoji:
                cal_summary = f"{h.emoji} {cal_summary}"
        else:
            cal_summary = "No holidays in the next 14 days"
        out.append(
            BucketStatus(
                kind="calendar",
                active=True,
                source="builtin",
                summary=cal_summary,
                unlock_hint=None if self.tenant.country_code else "Set country to enable country-specific holidays",
            )
        )

        return out
