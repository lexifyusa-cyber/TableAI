"""Menu bucket — available dishes, prices, tags, allergens."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.menu import MenuCategory, MenuItem
from app.models.tenant import Tenant


def _format_cents(cents: int | None) -> str:
    if cents is None:
        return ""
    return f"${cents / 100:.2f}"


async def format(tenant: Tenant, db: AsyncSession) -> str | None:
    res = await db.execute(
        select(MenuCategory)
        .where(MenuCategory.tenant_id == tenant.id)
        .options(selectinload(MenuCategory.items))
        .order_by(MenuCategory.sort_order)
    )
    cats = res.scalars().all()
    if not cats:
        return None

    lines: list[str] = ["# Menu"]
    for c in cats:
        available = [i for i in c.items if i.is_available]
        if not available:
            continue
        lines.append(f"\n## {c.name}")
        if c.description:
            lines.append(f"_{c.description}_")
        for item in available:
            bits = [f"- **{item.name}**"]
            if item.price_cents is not None:
                bits.append(_format_cents(item.price_cents))
            lines.append(" — ".join(bits))
            if item.description:
                lines.append(f"  {item.description}")
            extras: list[str] = []
            if item.tags:
                extras.append("tags: " + ", ".join(item.tags))
            if item.allergens:
                extras.append("allergens: " + ", ".join(item.allergens))
            if item.ingredients:
                extras.append("ingredients: " + ", ".join(item.ingredients[:10]))
            if extras:
                lines.append("  " + " | ".join(extras))

    return "\n".join(lines) if len(lines) > 1 else None


async def summary(tenant: Tenant, db: AsyncSession) -> dict:
    item_count = (
        await db.execute(
            select(func.count(MenuItem.id)).where(MenuItem.tenant_id == tenant.id)
        )
    ).scalar_one()
    cat_count = (
        await db.execute(
            select(func.count(MenuCategory.id)).where(MenuCategory.tenant_id == tenant.id)
        )
    ).scalar_one()
    return {"item_count": int(item_count or 0), "category_count": int(cat_count or 0)}
