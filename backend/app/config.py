from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=("../.env", ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_env: str = "development"
    app_base_domain: str = "localhost:8000"
    log_level: str = "INFO"

    database_url: str = Field(
        default="postgresql+asyncpg://tableai:tableai@localhost:5433/tableai"
    )

    anthropic_api_key: str = Field(default="")

    # Per the "quality over cost" rule for TableAI:
    # - Demo generation is one-shot and high-stakes -> Opus 4.7
    # - Customer chat is high-volume and latency-sensitive -> Sonnet 4.6 (still top-tier)
    # - Premium chat for hard queries (allergen safety, complex pairings) -> Opus 4.7
    model_demo_generation: str = "claude-opus-4-7"
    model_customer_chat: str = "claude-sonnet-4-6"
    model_premium_chat: str = "claude-opus-4-7"

    toast_client_id: str = ""
    toast_client_secret: str = ""
    toast_api_base: str = "https://ws-api.toasttab.com"

    square_access_token: str = ""
    square_env: str = "sandbox"

    # Supabase — used to verify caller JWTs on protected backend routes.
    supabase_url: str = "https://klveqamyzzyvhmbvhmcp.supabase.co"
    supabase_anon_key: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
