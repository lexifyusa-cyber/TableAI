from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import CurrentUser, require_tenant_access
from app.db import get_session
from app.models.conversation import Conversation, Message
from app.models.tenant import Tenant

router = APIRouter(tags=["metrics"])


@router.get("/metrics")
async def get_metrics(
    tenant: str = Query(..., description="Tenant slug"),
    access: tuple[CurrentUser, Tenant] = Depends(require_tenant_access("tenant")),
    db: AsyncSession = Depends(get_session),
) -> dict:
    _, t = access

    now = datetime.now(timezone.utc)
    window_7 = now - timedelta(days=7)
    window_30 = now - timedelta(days=30)

    conv_7 = (
        await db.execute(
            select(func.count(Conversation.id))
            .where(Conversation.tenant_id == t.id)
            .where(Conversation.created_at >= window_7)
        )
    ).scalar_one() or 0

    conv_30 = (
        await db.execute(
            select(func.count(Conversation.id))
            .where(Conversation.tenant_id == t.id)
            .where(Conversation.created_at >= window_30)
        )
    ).scalar_one() or 0

    msg_7 = (
        await db.execute(
            select(func.count(Message.id))
            .join(Conversation, Message.conversation_id == Conversation.id)
            .where(Conversation.tenant_id == t.id)
            .where(Message.created_at >= window_7)
        )
    ).scalar_one() or 0

    msg_30 = (
        await db.execute(
            select(func.count(Message.id))
            .join(Conversation, Message.conversation_id == Conversation.id)
            .where(Conversation.tenant_id == t.id)
            .where(Message.created_at >= window_30)
        )
    ).scalar_one() or 0

    avg = (msg_30 / conv_30) if conv_30 else 0

    # Daily buckets for last 14 days
    daily_rows = (
        await db.execute(
            select(
                func.date_trunc("day", Conversation.created_at).label("day"),
                func.count(func.distinct(Conversation.id)).label("convs"),
                func.count(Message.id).label("msgs"),
            )
            .outerjoin(Message, Message.conversation_id == Conversation.id)
            .where(Conversation.tenant_id == t.id)
            .where(Conversation.created_at >= now - timedelta(days=14))
            .group_by("day")
            .order_by("day")
        )
    ).all()

    # Fill missing days
    by_day: dict[str, dict] = {}
    for day, convs, msgs in daily_rows:
        key = day.date().isoformat() if day else None
        if key:
            by_day[key] = {"conversations": int(convs or 0), "messages": int(msgs or 0)}

    daily: list[dict] = []
    for i in range(13, -1, -1):
        d = (now - timedelta(days=i)).date().isoformat()
        entry = by_day.get(d, {"conversations": 0, "messages": 0})
        daily.append({"date": d, **entry})

    return {
        "tenant": tenant,
        "conversations_7d": int(conv_7),
        "conversations_30d": int(conv_30),
        "messages_7d": int(msg_7),
        "messages_30d": int(msg_30),
        "avg_messages_per_conversation": round(avg, 2),
        "daily": daily,
    }
