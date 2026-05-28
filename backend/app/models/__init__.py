from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


from app.models.app_setting import AppSetting  # noqa: E402, F401
from app.models.knowledge_source import KnowledgeSource  # noqa: E402, F401
from app.models.conversation import (  # noqa: E402, F401
    Conversation,
    ConversationSurface,
    Message,
    MessageRole,
)
from app.models.customer import Customer  # noqa: E402, F401
from app.models.llm_provider import LLMProvider  # noqa: E402, F401
from app.models.media_asset import MediaAsset  # noqa: F401
from app.models.menu import MenuCategory, MenuItem  # noqa: E402, F401
from app.models.owner_invite import OwnerInvite  # noqa: E402, F401
from app.models.profile import Profile  # noqa: E402, F401
from app.models.tenant import BusinessType, Tenant, TenantStatus  # noqa: E402, F401
from app.models.tenant_owner import TenantOwner  # noqa: E402, F401
