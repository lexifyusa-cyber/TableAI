from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_session
from app.models import MenuCategory, Tenant

router = APIRouter(prefix="/menu", tags=["menu"])


def _serialize_item(item) -> dict:
    return {
        "id": str(item.id),
        "name": item.name,
        "description": item.description,
        "price_cents": item.price_cents,
        "image_url": item.image_url,
        "tags": list(item.tags or []),
        "ingredients": list(item.ingredients or []),
        "allergens": list(item.allergens or []),
        "is_available": item.is_available,
    }


@router.get("")
async def get_menu(
    tenant: str = Query(..., description="Tenant slug"),
    db: AsyncSession = Depends(get_session),
) -> dict:
    t_res = await db.execute(select(Tenant).where(Tenant.slug == tenant))
    t = t_res.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail=f"Tenant '{tenant}' not found")

    cat_res = await db.execute(
        select(MenuCategory)
        .where(MenuCategory.tenant_id == t.id)
        .options(selectinload(MenuCategory.items))
        .order_by(MenuCategory.sort_order)
    )
    categories = cat_res.scalars().all()

    return {
        "tenant": {
            "id": str(t.id),
            "slug": t.slug,
            "name": t.name,
            "business_type": t.business_type.value,
            "brand": t.brand,
            "contact": t.contact,
            "hours": t.hours,
            "ai_persona": (t.ai_config or {}).get("persona", ""),
            "tagline": (t.ai_config or {}).get("tagline", ""),
            "provenance": t.provenance or {},
        },
        "categories": [
            {
                "id": str(c.id),
                "name": c.name,
                "description": c.description,
                "items": [
                    _serialize_item(i)
                    for i in sorted(c.items, key=lambda x: x.sort_order)
                ],
            }
            for c in categories
        ],
    }
