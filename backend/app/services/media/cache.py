"""download_and_cache(): mirror a remote image into one of the three tiers."""
from __future__ import annotations

import hashlib
import mimetypes
from dataclasses import dataclass
from pathlib import Path
from uuid import UUID, uuid4

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.media_asset import MediaAsset
from app.services.media.classifier import Tier, classification_for, source_to_tier

# Where downloaded files live on disk. main.py mounts /static/media/public from
# this same root.
MEDIA_ROOT = Path(__file__).resolve().parents[3] / "static" / "media"

ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MIME_TO_EXT = {
    "image/jpeg": ".jpg",
    "image/png":  ".png",
    "image/webp": ".webp",
    "image/gif":  ".gif",
}
MAX_BYTES = 5 * 1024 * 1024  # 5 MB
HTTP_TIMEOUT = 20.0
USER_AGENT = "TableAI-MediaCache/0.1 (+https://tableai.app)"


@dataclass(slots=True)
class MediaRef:
    tier: Tier
    relative_path: str  # under MEDIA_ROOT/{tier}/
    sha256: str
    mime: str
    bytes: int


class MediaCacheError(RuntimeError):
    pass


def _ensure_dirs() -> None:
    for tier in ("public", "private", "internal"):
        (MEDIA_ROOT / tier).mkdir(parents=True, exist_ok=True)


async def download_and_cache(
    db: AsyncSession,
    *,
    url: str,
    source: str,
    tenant_id: UUID | None,
    tenant_slug: str | None,
    classification: str | None = None,
) -> MediaRef:
    """Fetch `url`, store under static/media/{tier}/{slug?}/{classification}/{hash}.{ext}.

    Idempotent: if a media_assets row already exists with the same sha256, returns
    the existing MediaRef without re-downloading.
    """
    tier = source_to_tier(source)
    cls = classification or classification_for(source)
    _ensure_dirs()

    async with httpx.AsyncClient(
        follow_redirects=True,
        timeout=HTTP_TIMEOUT,
        headers={"User-Agent": USER_AGENT},
    ) as client:
        try:
            r = await client.get(url)
        except httpx.HTTPError as e:
            raise MediaCacheError(f"fetch failed: {e}") from e
    if r.status_code != 200:
        raise MediaCacheError(f"non-200 status {r.status_code} for {url}")
    body = r.content
    if len(body) > MAX_BYTES:
        raise MediaCacheError(f"image too large ({len(body)} > {MAX_BYTES})")

    mime = (r.headers.get("content-type") or "").split(";")[0].strip().lower()
    if mime not in ALLOWED_MIME:
        guessed, _ = mimetypes.guess_type(url)
        if guessed in ALLOWED_MIME:
            mime = guessed
        else:
            raise MediaCacheError(f"unsupported mime {mime!r} for {url}")

    sha = hashlib.sha256(body).hexdigest()
    ext = MIME_TO_EXT.get(mime, ".bin")

    # Path: {tier}/{slug?}/{classification}/{sha}{ext}
    parts = [tier]
    if tier != "internal" and tenant_slug:
        parts.append(tenant_slug)
    parts.append(cls)
    parts.append(f"{sha}{ext}")
    relative = "/".join(parts)
    abs_path = MEDIA_ROOT / relative
    abs_path.parent.mkdir(parents=True, exist_ok=True)

    if not abs_path.exists():
        abs_path.write_bytes(body)

    # Insert media_assets row (idempotent via UNIQUE (tier, relative_path))
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    stmt = pg_insert(MediaAsset).values(
        id=uuid4(),
        tenant_id=tenant_id,
        tier=tier,
        classification=cls,
        relative_path=relative,
        source=source,
        source_url=url,
        sha256=sha,
        mime=mime,
        bytes=len(body),
    )
    stmt = stmt.on_conflict_do_nothing(index_elements=["tier", "relative_path"])
    await db.execute(stmt)

    return MediaRef(tier=tier, relative_path=relative, sha256=sha, mime=mime, bytes=len(body))


def public_url_for(ref: MediaRef) -> str:
    """Public URL path for a public MediaRef (served by StaticFiles)."""
    if ref.tier != "public":
        raise ValueError("public_url_for only valid for tier=public")
    return f"/static/media/public/{ref.relative_path.split('/', 1)[1]}" if "/" in ref.relative_path else f"/static/media/{ref.relative_path}"
