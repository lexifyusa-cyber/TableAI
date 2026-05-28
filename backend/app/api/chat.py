"""Customer-facing chat endpoint.

Server-Sent Events stream. The system prompt is assembled from knowledge
buckets (menu, business, reputation, …) so new data sources plug in here
without endpoint edits.
"""

from __future__ import annotations

import json
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import SessionLocal, get_session
from app.models import (
    Conversation,
    ConversationSurface,
    Message,
    MessageRole,
    Tenant,
)
from app.services.knowledge import KnowledgeManifest
from app.services.llm import get_provider_for

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    tenant: str = Field(..., description="Tenant slug")
    message: str
    session_id: str | None = None
    conversation_id: str | None = None
    surface: str = "qr"


@router.post("")
async def chat(req: ChatRequest, db: AsyncSession = Depends(get_session)) -> StreamingResponse:
    t = (
        await db.execute(select(Tenant).where(Tenant.slug == req.tenant))
    ).scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail=f"Tenant '{req.tenant}' not found")

    # Assemble system prompt from active knowledge buckets.
    manifest = KnowledgeManifest(t, db)
    system_blocks = await manifest.build_system_blocks(
        include=["business", "menu", "reputation"]
    )
    if not system_blocks:
        system_blocks = [
            {
                "type": "text",
                "text": f"You are speaking for {t.name}. We have no detailed data yet — be honest if asked specifics.",
            }
        ]

    # Load or create the conversation.
    conv: Conversation | None = None
    if req.conversation_id:
        conv = (
            await db.execute(
                select(Conversation).where(Conversation.id == UUID(req.conversation_id))
            )
        ).scalar_one_or_none()
        if not conv or conv.tenant_id != t.id:
            raise HTTPException(status_code=404, detail="Conversation not found")
    if not conv:
        try:
            surface_enum = ConversationSurface(req.surface)
        except ValueError:
            surface_enum = ConversationSurface.QR
        conv = Conversation(
            tenant_id=t.id,
            session_id=req.session_id or str(uuid4()),
            surface=surface_enum,
        )
        db.add(conv)
        await db.flush()

    prior = (
        await db.execute(
            select(Message).where(Message.conversation_id == conv.id).order_by(Message.created_at)
        )
    ).scalars().all()

    history = [
        {"role": m.role.value, "content": m.content}
        for m in prior
        if m.role in (MessageRole.USER, MessageRole.ASSISTANT)
    ]
    history.append({"role": "user", "content": req.message})

    db.add(Message(conversation_id=conv.id, role=MessageRole.USER, content=req.message))
    await db.commit()

    # Capture primitives — the request session is about to close before the stream runs.
    conv_id = conv.id
    tenant_id_for_resolver = t.id
    provider, chat_model = await get_provider_for("chat", tenant_id=tenant_id_for_resolver)

    async def event_stream():
        full_text = ""
        try:
            async for chunk in provider.stream_text(
                model=chat_model,
                system=system_blocks,
                messages=history,
                max_tokens=2048,
            ):
                full_text += chunk
                yield (
                    "data: "
                    + json.dumps({"text": chunk, "conversation_id": str(conv_id)})
                    + "\n\n"
                )
        except Exception as e:  # noqa: BLE001
            yield "data: " + json.dumps({"error": str(e)}) + "\n\n"
            return

        async with SessionLocal() as new_db:
            new_db.add(
                Message(
                    conversation_id=conv_id,
                    role=MessageRole.ASSISTANT,
                    content=full_text,
                    model=chat_model,
                )
            )
            await new_db.commit()

        yield "data: " + json.dumps({"done": True, "conversation_id": str(conv_id)}) + "\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
