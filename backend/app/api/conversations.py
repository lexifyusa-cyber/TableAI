from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.deps import CurrentUser, require_tenant_access
from app.db import get_session
from app.models.conversation import Conversation, Message, MessageRole
from app.models.tenant import Tenant

router = APIRouter(tags=["conversations"])


@router.get("/conversations")
async def list_conversations(
    tenant: str = Query(..., description="Tenant slug"),
    limit: int = Query(50, ge=1, le=200),
    access: tuple[CurrentUser, Tenant] = Depends(require_tenant_access("tenant")),
    db: AsyncSession = Depends(get_session),
) -> list[dict]:
    _, t = access

    # Subquery: message count + last message per conversation
    msg_count_sq = (
        select(
            Message.conversation_id.label("conv_id"),
            func.count(Message.id).label("msg_count"),
            func.max(Message.created_at).label("last_at"),
        )
        .group_by(Message.conversation_id)
        .subquery()
    )

    rows = (
        await db.execute(
            select(Conversation, msg_count_sq.c.msg_count, msg_count_sq.c.last_at)
            .outerjoin(msg_count_sq, msg_count_sq.c.conv_id == Conversation.id)
            .where(Conversation.tenant_id == t.id)
            .order_by(Conversation.created_at.desc())
            .limit(limit)
        )
    ).all()

    results: list[dict] = []
    for conv, msg_count, last_at in rows:
        preview = None
        if msg_count:
            last_msg = (
                await db.execute(
                    select(Message)
                    .where(Message.conversation_id == conv.id)
                    .where(Message.role == MessageRole.USER)
                    .order_by(Message.created_at.desc())
                    .limit(1)
                )
            ).scalar_one_or_none()
            if last_msg:
                preview = (last_msg.content or "")[:140]

        results.append(
            {
                "id": str(conv.id),
                "session_id": conv.session_id,
                "surface": conv.surface.value if hasattr(conv.surface, "value") else conv.surface,
                "table_number": conv.table_number,
                "created_at": conv.created_at.isoformat() if conv.created_at else None,
                "ended_at": conv.ended_at.isoformat() if conv.ended_at else None,
                "message_count": int(msg_count or 0),
                "last_message_at": last_at.isoformat() if last_at else None,
                "last_message_preview": preview,
            }
        )
    return results


@router.get("/conversations/{conv_id}/messages")
async def get_conversation_messages(
    conv_id: str,
    user: CurrentUser = Depends(__import__("app.auth.deps", fromlist=["current_user"]).current_user),
    db: AsyncSession = Depends(get_session),
) -> dict:
    try:
        cid = UUID(conv_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid conversation id")

    conv = (
        await db.execute(
            select(Conversation)
            .where(Conversation.id == cid)
            .options(selectinload(Conversation.messages))
        )
    ).scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Tenant-access check (owners only see their own tenant's conversations).
    if user.role not in ("admin", "employee"):
        from app.models.tenant_owner import TenantOwner
        link = (
            await db.execute(
                select(TenantOwner).where(
                    TenantOwner.user_id == user.user_id,
                    TenantOwner.tenant_id == conv.tenant_id,
                )
            )
        ).scalar_one_or_none()
        if not link:
            raise HTTPException(status_code=403, detail="No access to this conversation")

    messages = sorted(conv.messages, key=lambda m: m.created_at or 0)

    return {
        "id": str(conv.id),
        "tenant_id": str(conv.tenant_id),
        "surface": conv.surface.value if hasattr(conv.surface, "value") else conv.surface,
        "created_at": conv.created_at.isoformat() if conv.created_at else None,
        "messages": [
            {
                "id": str(m.id),
                "role": m.role.value if hasattr(m.role, "value") else m.role,
                "content": m.content or "",
                "created_at": m.created_at.isoformat() if m.created_at else None,
                "input_tokens": m.input_tokens,
                "output_tokens": m.output_tokens,
            }
            for m in messages
        ],
    }
