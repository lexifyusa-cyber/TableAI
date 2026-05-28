"""Anthropic provider — uses AsyncAnthropic SDK.

Supports prompt caching (cache_control on system blocks) and native tool use.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

from anthropic import AsyncAnthropic

from app.services.providers.base import ModelProvider, ProviderResponse


class AnthropicProvider(ModelProvider):
    kind = "anthropic"

    def __init__(self, api_key: str, base_url: str | None = None) -> None:
        if not api_key:
            raise RuntimeError(
                "Anthropic provider has no API key. Configure it in /admin/providers."
            )
        kwargs: dict[str, Any] = {"api_key": api_key}
        if base_url:
            kwargs["base_url"] = base_url.rstrip("/")
        self._client = AsyncAnthropic(**kwargs)

    async def stream_text(
        self,
        *,
        model: str,
        system: str | list[dict[str, Any]],
        messages: list[dict[str, Any]],
        max_tokens: int = 2048,
        temperature: float = 1.0,
    ) -> AsyncIterator[str]:
        async with self._client.messages.stream(
            model=model,
            system=system,
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
        ) as stream:
            async for chunk in stream.text_stream:
                yield chunk

    async def complete(
        self,
        *,
        model: str,
        system: str | list[dict[str, Any]],
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
        tool_choice: dict[str, Any] | None = None,
        max_tokens: int = 4096,
        temperature: float = 1.0,
    ) -> ProviderResponse:
        kwargs: dict[str, Any] = {
            "model": model,
            "system": system,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        if tools:
            kwargs["tools"] = tools
        if tool_choice:
            kwargs["tool_choice"] = tool_choice

        msg = await self._client.messages.create(**kwargs)

        text_parts: list[str] = []
        tool_calls: list[dict[str, Any]] = []
        for block in msg.content:
            bt = getattr(block, "type", None)
            if bt == "text":
                text_parts.append(block.text)
            elif bt == "tool_use":
                tool_calls.append(
                    {
                        "id": block.id,
                        "name": block.name,
                        "input": block.input,
                    }
                )

        usage = getattr(msg, "usage", None)
        return ProviderResponse(
            text="".join(text_parts),
            tool_calls=tool_calls,
            input_tokens=getattr(usage, "input_tokens", None) if usage else None,
            output_tokens=getattr(usage, "output_tokens", None) if usage else None,
            raw=msg,
        )
