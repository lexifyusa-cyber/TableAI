from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, HttpUrl
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.services.demo_generator import generate_demo

router = APIRouter(prefix="/demo", tags=["demo"])


class GenerateDemoIn(BaseModel):
    url: HttpUrl = Field(..., description="Public business URL to scrape and onboard.")
    slug: str | None = Field(
        default=None,
        description="Optional slug override (e.g. 'gif'). Auto-derived from name if omitted.",
    )


class GenerateDemoOut(BaseModel):
    tenant_id: str
    slug: str
    name: str
    business_type: str
    pos_provider: str | None
    menu_url: str
    chat_endpoint: str


@router.post("/generate", response_model=GenerateDemoOut)
async def generate(req: GenerateDemoIn, db: AsyncSession = Depends(get_session)) -> GenerateDemoOut:
    try:
        tenant = await generate_demo(db, url=str(req.url), slug_hint=req.slug)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    return GenerateDemoOut(
        tenant_id=str(tenant.id),
        slug=tenant.slug,
        name=tenant.name,
        business_type=tenant.business_type.value,
        pos_provider=tenant.pos_provider,
        menu_url=f"/api/menu?tenant={tenant.slug}",
        chat_endpoint=f"/api/chat (POST tenant={tenant.slug})",
    )
