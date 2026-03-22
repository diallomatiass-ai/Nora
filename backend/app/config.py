import logging
import warnings

from pydantic import field_validator
from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://mailbot:changeme@localhost:5432/mailbot"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # JWT
    secret_key: str = "changeme"
    access_token_expire_minutes: int = 60
    algorithm: str = "HS256"

    # Gmail OAuth2
    gmail_client_id: str = ""
    gmail_client_secret: str = ""
    gmail_redirect_uri: str = ""

    # Outlook OAuth2
    outlook_client_id: str = ""
    outlook_client_secret: str = ""
    outlook_tenant_id: str = "common"
    outlook_redirect_uri: str = ""

    # AWS Bedrock (Claude i EU — Frankfurt, eu-central-1)
    # Data forlader aldrig EU. Anthropic ser aldrig indholdet direkte.
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "eu-central-1"
    # Cross-region inference profile IDs (eu. prefix = EU data residency garanteret)
    bedrock_model: str = "eu.anthropic.claude-3-5-sonnet-20241022-v2:0"
    bedrock_fast_model: str = "eu.anthropic.claude-3-haiku-20240307-v1:0"

    # Ollama (kun embeddings — kører 100% lokalt, ingen data sendes nogen steder)
    ollama_base_url: str = "http://localhost:11434"
    ollama_embed_model: str = "nomic-embed-text"

    # ChromaDB
    chroma_host: str = "localhost"
    chroma_port: int = 8000

    # Encryption
    encryption_key: str = ""

    # Mail sync
    mail_sync_interval_seconds: int = 60

    # Observability
    sentry_dsn: str = ""
    sentry_environment: str = "development"
    sentry_traces_sample_rate: float = 0.1  # 10% af requests trackes i produktion
    log_level: str = "INFO"

    # Stripe
    stripe_secret_key: str = ""
    stripe_publishable_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_price_starter: str = ""
    stripe_price_pro: str = ""
    stripe_price_business: str = ""
    stripe_success_url: str = "http://localhost/billing?success=true"
    stripe_cancel_url: str = "http://localhost/billing?canceled=true"

    @field_validator("secret_key")
    @classmethod
    def warn_weak_secret(cls, v):
        if v in ("changeme", "secret", "password", ""):
            warnings.warn("SIKKERHEDSADVARSEL: secret_key er usikker! Sæt en stærk SECRET_KEY i .env")
        return v

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
