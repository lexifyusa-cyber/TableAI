"""Knowledge buckets — the AI's organized view of what it knows about a tenant.

Instead of stuffing every data source into one big prompt, each bucket
contributes its own cached block. The AI sees them as separate "sections"
in the system prompt, the owner dashboard shows per-bucket status, and new
data sources plug into existing buckets instead of requiring chat.py edits.

Public API:
    from app.services.knowledge import KnowledgeManifest
    manifest = KnowledgeManifest(tenant, db)
    blocks = await manifest.build_system_blocks(include=["menu", "business", "reputation"])
    status = await manifest.status()   # for dashboard
"""

from app.services.knowledge.manifest import KnowledgeManifest, BucketStatus, BUCKET_KINDS

__all__ = ["KnowledgeManifest", "BucketStatus", "BUCKET_KINDS"]
