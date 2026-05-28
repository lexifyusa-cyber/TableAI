"""Reject requests that didn't come through Cloudflare.

The Fly app is reachable both at `tableai.lumenatech.ai` (proxied through
Cloudflare, where CF Access enforces the email gate) and at
`tableai-dev.fly.dev` (Fly's default `*.fly.dev` hostname, which bypasses
Cloudflare entirely). Without this middleware, anyone who guesses the Fly
hostname gets past CF Access — leaving only the app's own auth as the gate.

This middleware closes that hole by inspecting `fly-client-ip` (the TCP
source IP Fly sees connecting to its edge). Requests whose source IP is
inside Cloudflare's published anycast range are allowed; everything else
gets 403. Direct hits to the fly.dev hostname connect from arbitrary
client IPs, so they fail the check — only traffic that went through CF
gets through.

`/health` is exempt so Fly's platform health probes (from the 6PN net,
not a CF anycast IP) can still mark the machine healthy. The endpoint
returns a static OK, so leaving it open leaks nothing.
"""
from __future__ import annotations

import ipaddress
import logging
from collections.abc import Awaitable, Callable

import httpx
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response

log = logging.getLogger(__name__)

# Snapshot of https://api.cloudflare.com/client/v4/ips (2026-05-28). Used as
# a fallback if the runtime refresh fails so the app doesn't lock itself out
# on a transient cloudflare.com outage at boot.
_FALLBACK_V4 = [
    "173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22", "103.31.4.0/22",
    "141.101.64.0/18", "108.162.192.0/18", "190.93.240.0/20", "188.114.96.0/20",
    "197.234.240.0/22", "198.41.128.0/17", "162.158.0.0/15", "104.16.0.0/13",
    "104.24.0.0/14", "172.64.0.0/13", "131.0.72.0/22",
]
_FALLBACK_V6 = [
    "2400:cb00::/32", "2606:4700::/32", "2803:f800::/32", "2405:b500::/32",
    "2405:8100::/32", "2a06:98c0::/29", "2c0f:f248::/32",
]

# Path prefixes the middleware lets through regardless of source IP.
_BYPASS_PREFIXES = ("/health",)


class CloudflareOnlyMiddleware(BaseHTTPMiddleware):
    """Block requests whose Fly-observed source IP isn't a Cloudflare anycast IP."""

    def __init__(self, app) -> None:
        super().__init__(app)
        self._networks: list[ipaddress._BaseNetwork] = [
            ipaddress.ip_network(c) for c in (*_FALLBACK_V4, *_FALLBACK_V6)
        ]
        try:
            self._refresh()
        except Exception as e:
            # Fallback list is the safety net for exactly this case.
            log.warning("cf_only: live IP list refresh failed (%s); using snapshot", e)

    def _refresh(self) -> None:
        r = httpx.get("https://api.cloudflare.com/client/v4/ips", timeout=5)
        r.raise_for_status()
        data = r.json()["result"]
        ranges = [*data["ipv4_cidrs"], *data["ipv6_cidrs"]]
        self._networks = [ipaddress.ip_network(c) for c in ranges]
        log.info("cf_only: loaded %d Cloudflare networks from live API", len(self._networks))

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        if any(request.url.path.startswith(p) for p in _BYPASS_PREFIXES):
            return await call_next(request)

        client_ip = request.headers.get("fly-client-ip")
        # Local dev (uvicorn straight) doesn't set fly-client-ip — let it through.
        if not client_ip:
            return await call_next(request)

        try:
            ip = ipaddress.ip_address(client_ip)
        except ValueError:
            return JSONResponse({"detail": "Forbidden"}, status_code=403)

        if any(ip in net for net in self._networks):
            return await call_next(request)

        log.info("cf_only: rejecting non-CF source %s for %s", client_ip, request.url.path)
        return JSONResponse({"detail": "Forbidden"}, status_code=403)
