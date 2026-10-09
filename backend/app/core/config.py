from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings, read from environment variables (and `.env` in development)."""

    # backend/.env is found no matter which directory the server is started from.
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[2] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Fireflies Clone API"
    api_prefix: str = "/api/v1"
    database_url: str = "sqlite:///./app.db"
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:3000"]
    seed_on_startup: bool = True
    # No authentication: every request acts as this fictional workspace user.
    default_user_name: str = "Alex Morgan"
    default_user_email: str = "alex.morgan@acme.example"
    # Optional Groq LLM (free tier) for meeting notes and AskFred. Empty key = built-in fallback.
    groq_api_key: str = ""
    groq_model: str = "openai/gpt-oss-120b"
    groq_timeout_seconds: float = 30.0

    @field_validator("cors_origins", mode="before")
    @classmethod
    def split_origins(cls, value: object) -> object:
        # Accept "a,b,c" from the environment as well as a real list.
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
