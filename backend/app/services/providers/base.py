"""Provider abstraction — one interface, many backends.

Callers write to this interface. Implementations live alongside:
- anthropic.py (Anthropic Messages API + prompt caching + native tool use)
- openai_compat.py (OpenAI Chat Completions — works for OpenAI, Groq,
  Together, Fireworks, OpenRouter, DeepSeek, Ollama, etc.)
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any, Protocol


@dataclass(slots=True)
class ProviderResponse:
    """Normalized shape returned by complete()."""

    text: str = ""
    tool_calls: list[dict[str, Any]] = field(default_factory=list)
    input_tokens: int | None = None
    output_tokens: int | None = None
    raw: Any = None  # original SDK response, for provider-specific callers that need it


class ModelProvider(Protocol):
    kind: str  # "anthropic" | "openai_compat"

    async def stream_text(
        self,
        *,
        model: str,
        system: str | list[dict[str, Any]],
        messages: list[dict[str, Any]],
        max_tokens: int = 2048,
        temperature: float = 1.0,
    ) -> AsyncIterator[str]: ...

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
    ) -> ProviderResponse: ...


def cached_block(text: str, *, anthropic_only: bool = True) -> dict[str, Any]:
    """Build a system prompt block with Anthropic-style ephemeral caching.

    For OpenAI-compat providers the cache_control field is dropped at render time.
    """
    block: dict[str, Any] = {"type": "text", "text": text}
    if anthropic_only:
        block["cache_control"] = {"type": "ephemeral"}
    return block
