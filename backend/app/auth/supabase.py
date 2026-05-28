"""Supabase JWT verification.

Rather than reimplementing JWKS fetch + signature validation (which requires
the project's JWT secret or signing keys), we delegate to Supabase itself by
calling GET /auth/v1/user with the Bearer token. Supabase validates and
returns the user if the token is good, 401 if not.

Results are cached in-process for 60s keyed by the token to avoid a round-trip
on every request within a short window.
"""

from __future__ import annotations

import time
from typing import Any

import httpx

from app.config import get_settings

_cache: dict[str, tuple[float, dict[str, Any] | None]] = {}
_CACHE_TTL_SEC = 60.0


async def verify_token(token: str) -> dict[str, Any] | None:
    """Returns the Supabase user object if the token is valid; None otherwise."""
    if not token:
        return None

    now = time.time()
    cached = _cache.get(token)
    if cached and (now - cached[0]) < _CACHE_TTL_SEC:
        return cached[1]

    s = get_settings()
    url = s.supabase_url.rstrip("/") + "/auth/v1/user"
    if not s.supabase_url or not s.supabase_anon_key:
        return None

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(
                url,
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": s.supabase_anon_key,
                },
            )
    except httpx.HTTPError:
        return None

    user = r.json() if r.status_code == 200 else None
    _cache[token] = (now, user)
    # Opportunistic pruning — keep cache under 256 entries.
    if len(_cache) > 256:
        for k in list(_cache.keys())[:128]:
            _cache.pop(k, None)
    return user
