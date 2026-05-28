"""OpenAI-compatible provider.

Any service that speaks OpenAI's /v1/chat/completions schema works here:
OpenAI itself, Groq, Together, Fireworks, OpenRouter, DeepSeek, Ollama, vLLM, etc.

Quirks we handle:
- Anthropic-style system blocks (list of {type:text, text, cache_control?}) are
  flattened into one system message with cache_control removed.
- Anthropic-style tool definitions ({name, input_schema}) are translated to
  OpenAI function-call format ({type:function, function:{name, parameters}}).
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

from openai import AsyncOpenAI

from app.services.providers.base import ModelProvider, ProviderResponse


def _flatten_system(system: str | list[dict[str, Any]]) -> str:
    if isinstance(system, str):
        return system
    parts = []
    for block in system:
        if isinstance(block, dict) and block.get("type") == "text":
            parts.append(block.get("text", ""))
        elif isinstance(block, str):
            parts.append(block)
    return "\n\n".join(parts)


def _translate_messages(
    system: str, messages: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """Translate Anthropic-style content to OpenAI content.

    Plain text passes through. For multimodal content lists, we translate:
      - {type:'text', text:...}        → {type:'text', text:...}
      - {type:'image', source:base64}  → {type:'image_url', image_url:{url:'data:<mime>;base64,...'}}
      - {type:'image', source:url}     → {type:'image_url', image_url:{url:...}}
    """
    out: list[dict[str, Any]] = []
    if system:
        out.append({"role": "system", "content": system})
    for m in messages:
        role = m.get("role", "user")
        content = m.get("content", "")
        if isinstance(content, list):
            parts: list[dict[str, Any]] = []
            for c in content:
                if not isinstance(c, dict):
                    continue
                t = c.get("type")
                if t == "text":
                    text = c.get("text", "")
                    if text:
                        parts.append({"type": "text", "text": text})
                elif t == "image":
                    src = c.get("source") or {}
                    if src.get("type") == "base64":
                        media = src.get("media_type") or "image/png"
                        data = src.get("data") or ""
                        parts.append({"type": "image_url", "image_url": {"url": f"data:{media};base64,{data}"}})
                    elif src.get("type") == "url" and src.get("url"):
                        parts.append({"type": "image_url", "image_url": {"url": src["url"]}})
                elif t == "image_url":  # already OpenAI shape — pass through
                    parts.append(c)
            content = parts if parts else ""
        out.append({"role": role, "content": content})
    return out


def _translate_tools(tools: list[dict[str, Any]]) -> list[dict[str, Any]]:
    result = []
    for t in tools:
        if "function" in t:  # already in OpenAI format
            result.append(t)
            continue
        result.append(
            {
                "type": "function",
                "function": {
                    "name": t.get("name"),
                    "description": t.get("description", ""),
                    "parameters": t.get("input_schema", {"type": "object", "properties": {}}),
                },
            }
        )
    return result


class OpenAICompatibleProvider(ModelProvider):
    kind = "openai_compat"

    def __init__(self, api_key: str, base_url: str | None = None) -> None:
        if not api_key:
            raise RuntimeError(
                "OpenAI-compatible provider has no API key. Configure it in /admin/providers."
            )
        self._client = AsyncOpenAI(api_key=api_key, base_url=base_url or None)

    async def stream_text(
        self,
        *,
        model: str,
        system: str | list[dict[str, Any]],
        messages: list[dict[str, Any]],
        max_tokens: int = 2048,
        temperature: float = 1.0,
    ) -> AsyncIterator[str]:
        sys_text = _flatten_system(system)
        msgs = _translate_messages(sys_text, messages)
        stream = await self._client.chat.completions.create(
            model=model,
            messages=msgs,
            max_tokens=max_tokens,
            temperature=temperature,
            stream=True,
        )
        async for event in stream:
            choice = event.choices[0] if event.choices else None
            if not choice:
                continue
            delta = getattr(choice, "delta", None)
            chunk = getattr(delta, "content", None) if delta else None
            if chunk:
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
        sys_text = _flatten_system(system)
        msgs = _translate_messages(sys_text, messages)
        kwargs: dict[str, Any] = {
            "model": model,
            "messages": msgs,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        if tools:
            kwargs["tools"] = _translate_tools(tools)
        if tool_choice:
            # Anthropic-style {"type":"tool","name":"foo"} → OpenAI {"type":"function","function":{"name":"foo"}}
            if tool_choice.get("type") == "tool":
                kwargs["tool_choice"] = {
                    "type": "function",
                    "function": {"name": tool_choice.get("name")},
                }
            else:
                kwargs["tool_choice"] = tool_choice

        resp = await self._client.chat.completions.create(**kwargs)
        choice = resp.choices[0]
        text = choice.message.content or ""
        tool_calls: list[dict[str, Any]] = []
        raw_tool_calls = getattr(choice.message, "tool_calls", None) or []
        for tc in raw_tool_calls:
            fn = tc.function
            # Parse JSON arguments
            import json
            try:
                args = json.loads(fn.arguments or "{}")
            except Exception:
                args = {}
            tool_calls.append({"id": tc.id, "name": fn.name, "input": args})

        usage = getattr(resp, "usage", None)
        return ProviderResponse(
            text=text,
            tool_calls=tool_calls,
            input_tokens=getattr(usage, "prompt_tokens", None) if usage else None,
            output_tokens=getattr(usage, "completion_tokens", None) if usage else None,
            raw=resp,
        )
