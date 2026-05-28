import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from app.middleware.cf_only import CloudflareOnlyMiddleware
from app.api import owner_edit as owner_edit_api
from app.api import (
    admin as admin_api,
    chat,
    conversations,
    demo,
    integrations as integrations_api,
    invites as invites_api,
    knowledge as knowledge_api,
    me as me_api,
    menu,
    metrics,
    tenant_settings as tenant_settings_api,
    tenants,
)
from app.config import get_settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    s = get_settings()
    logging.basicConfig(
        level=s.log_level,
        format="%(asctime)s %(levelname)s %(name)s :: %(message)s",
    )
    logging.info("TableAI starting (env=%s)", s.app_env)
    yield
    logging.info("TableAI shutting down")


def create_app() -> FastAPI:
    app = FastAPI(
        title="TableAI",
        description="Multi-tenant AI assistant SaaS for small businesses.",
        version="0.1.0",
        lifespan=lifespan,
    )

    # CORS — wide-open in dev; restrict per-tenant origin in production.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Reject anything that didn't enter through Cloudflare. Closes the
    # tableai-dev.fly.dev bypass that would otherwise sit outside CF Access.
    # Skipped automatically for /health (Fly's platform probes) and for
    # local dev (no fly-client-ip header).
    app.add_middleware(CloudflareOnlyMiddleware)

    app.include_router(demo.router, prefix="/api")
    app.include_router(owner_edit_api.router, prefix="/api")
    app.include_router(menu.router, prefix="/api")
    app.include_router(chat.router, prefix="/api")
    app.include_router(tenants.router, prefix="/api")
    app.include_router(conversations.router, prefix="/api")
    app.include_router(metrics.router, prefix="/api")
    app.include_router(me_api.router, prefix="/api")
    app.include_router(admin_api.router, prefix="/api")
    app.include_router(invites_api.router, prefix="/api")
    app.include_router(tenant_settings_api.router, prefix="/api")
    app.include_router(knowledge_api.router, prefix="/api")
    app.include_router(integrations_api.router, prefix="/api")

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()

# ---- Media (three-tier image store) ----------------------------------------
from pathlib import Path as _Path

_MEDIA_ROOT = _Path(__file__).resolve().parent.parent / "static" / "media"
for _tier in ("public", "private", "internal"):
    (_MEDIA_ROOT / _tier).mkdir(parents=True, exist_ok=True)

# Public tier: anyone can fetch. Private/internal served by auth-gated routes in api/media.py.
app.mount("/static/media/public", StaticFiles(directory=str(_MEDIA_ROOT / "public")), name="media-public")


# ---- Bundled SPA --------------------------------------------------------------
# When BUNDLED_FRONTEND_DIR is set (production / Fly image), FastAPI also
# serves the built Vite SPA from the same origin as /api. Hashed JS/CSS
# go through StaticFiles, and the catch-all falls back to index.html for
# client-side routes (react-router) so deep links survive a page reload.
# Mounted LAST so it does not shadow /api, /health, or /static/media.
import os as _os

from fastapi.responses import FileResponse as _FileResponse

_bundled = _os.environ.get("BUNDLED_FRONTEND_DIR")
if _bundled and _Path(_bundled).is_dir():
    _bundled_path = _Path(_bundled)
    _assets_dir = _bundled_path / "assets"
    if _assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=str(_assets_dir)), name="spa-assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def _spa_fallback(full_path: str) -> _FileResponse:
        candidate = _bundled_path / full_path
        if full_path and candidate.is_file():
            return _FileResponse(str(candidate))
        return _FileResponse(str(_bundled_path / "index.html"))

