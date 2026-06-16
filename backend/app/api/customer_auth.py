"""Customer-facing auth endpoints.

Customers authenticate via Supabase magic link (OTP) and then call
POST /api/customer/join to create or link their account to a specific tenant.
This is separate from the staff auth system — customer identity lives in
the `customers` table, not `profiles`.
"""

from __future__ import annotations

from uuid import UUID, uuid4, uuid5, NAMESPACE_DNS

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.supabase import verify_token
from app.config import get_settings
from app.db import get_session
from app.models.customer import Customer
from app.models.tenant import Tenant

router = APIRouter(prefix="/customer", tags=["customer"])


async def _resolve_auth_user_id(request: Request) -> tuple[UUID | None, str | None]:
    """Return (auth_user_id, email) from Bearer token or dev-mode headers.

    Does NOT touch the profiles table — customers are stored in customers only.
    """
    auth = request.headers.get("Authorization") or ""
    if auth.lower().startswith("bearer "):
        token = auth.split(" ", 1)[1].strip()
        supa_user = await verify_token(token)
        if supa_user and "id" in supa_user:
            return UUID(supa_user["id"]), supa_user.get("email")
        return None, None

    s = get_settings()
    if s.app_env == "development" and request.headers.get("x-dev-auth") == "1":
        email = request.headers.get("x-dev-email", "").strip()
        if email:
            user_id = uuid5(NAMESPACE_DNS, f"tableai-dev:{email.lower()}")
            return user_id, email

    return None, None


class JoinRequest(BaseModel):
    tenant: str
    display_name: str | None = None


class CustomerProfile(BaseModel):
    customer_id: str
    tenant: str
    email: str | None = None
    display_name: str | None = None


@router.post("/join", response_model=CustomerProfile)
async def customer_join(
    req: JoinRequest,
    request: Request,
    db: AsyncSession = Depends(get_session),
) -> CustomerProfile:
    """Create or link a customer account for a specific tenant.

    Called after Supabase sign-in. If the user already has a customers row for
    this tenant it is returned; if not, one is created. Pre-existing anonymous
    customers matching the email are linked to the auth user on first login.
    """
    t = (
        await db.execute(select(Tenant).where(Tenant.slug == req.tenant))
    ).scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail=f"Tenant '{req.tenant}' not found")

    auth_user_id, email = await _resolve_auth_user_id(request)

    if auth_user_id:
        # Return existing record linked to this auth user + tenant.
        existing = (
            await db.execute(
                select(Customer).where(
                    Customer.auth_user_id == auth_user_id,
                    Customer.tenant_id == t.id,
                )
            )
        ).scalar_one_or_none()
        if existing:
            return CustomerProfile(
                customer_id=str(existing.id),
                tenant=req.tenant,
                email=existing.email,
                display_name=existing.display_name,
            )

        # Claim a pre-existing anonymous row that matches by email.
        if email:
            by_email = (
                await db.execute(
                    select(Customer).where(
                        Customer.email == email,
                        Customer.tenant_id == t.id,
                        Customer.auth_user_id.is_(None),
                    )
                )
            ).scalar_one_or_none()
            if by_email:
                by_email.auth_user_id = auth_user_id
                if req.display_name and not by_email.display_name:
                    by_email.display_name = req.display_name
                await db.commit()
                return CustomerProfile(
                    customer_id=str(by_email.id),
                    tenant=req.tenant,
                    email=by_email.email,
                    display_name=by_email.display_name,
                )

    # Create a new customer record.
    customer = Customer(
        id=uuid4(),
        tenant_id=t.id,
        auth_user_id=auth_user_id,
        email=email,
        display_name=req.display_name,
    )
    db.add(customer)
    await db.commit()

    return CustomerProfile(
        customer_id=str(customer.id),
        tenant=req.tenant,
        email=customer.email,
        display_name=customer.display_name,
    )


@router.get("/me", response_model=CustomerProfile)
async def customer_me(
    tenant: str,
    request: Request,
    db: AsyncSession = Depends(get_session),
) -> CustomerProfile:
    """Return the customer profile for the authenticated user + tenant."""
    auth_user_id, _ = await _resolve_auth_user_id(request)
    if not auth_user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    t = (
        await db.execute(select(Tenant).where(Tenant.slug == tenant))
    ).scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail=f"Tenant '{tenant}' not found")

    customer = (
        await db.execute(
            select(Customer).where(
                Customer.auth_user_id == auth_user_id,
                Customer.tenant_id == t.id,
            )
        )
    ).scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="No customer account for this tenant")

    return CustomerProfile(
        customer_id=str(customer.id),
        tenant=tenant,
        email=customer.email,
        display_name=customer.display_name,
    )
