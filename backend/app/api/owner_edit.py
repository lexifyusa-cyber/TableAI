"""Owner-edit-via-LLM endpoints (auth: tenant access required)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import CurrentUser, require_tenant_access
from app.db import get_session
from app.models.tenant import Tenant
from app.services.owner_edit import EditProposal, apply_edits, propose_edits

router = APIRouter(prefix="/owner/edit", tags=["owner-edit"])


class ProposeIn(BaseModel):
    tenant: str
    text: str


class ProposeOut(BaseModel):
    tenant_fields: dict
    item_edits: list[dict]
    notes: str | None = None


@router.post("/propose", response_model=ProposeOut)
async def propose(
    body: ProposeIn,
    access: tuple[CurrentUser, Tenant] = Depends(require_tenant_access("tenant")),
    db: AsyncSession = Depends(get_session),
) -> ProposeOut:
    _, t = access
    try:
        proposal = await propose_edits(db, t, body.text)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    return ProposeOut(
        tenant_fields=proposal.tenant_fields,
        item_edits=proposal.item_edits,
        notes=proposal.notes,
    )


class ApplyIn(BaseModel):
    tenant: str
    tenant_fields: dict = {}
    item_edits: list[dict] = []
    notes: str | None = None


class ApplyOut(BaseModel):
    tenant_changes: dict
    item_changes: list[dict]
    notes: str | None = None


@router.post("/apply", response_model=ApplyOut)
async def apply(
    body: ApplyIn,
    access: tuple[CurrentUser, Tenant] = Depends(require_tenant_access("tenant")),
    db: AsyncSession = Depends(get_session),
) -> ApplyOut:
    _, t = access
    proposal = EditProposal(
        tenant_fields=body.tenant_fields,
        item_edits=body.item_edits,
        notes=body.notes,
    )
    result = await apply_edits(db, t, proposal)
    return ApplyOut(**result)
