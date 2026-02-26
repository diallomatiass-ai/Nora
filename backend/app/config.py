from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://mailbot:changeme@postgres:5432/mailbot"

    # Redis
    redis_url: str = "redis://redis:6379/0"

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

    # Ollama
    ollama_base_url: str = "http://ollama:11434"
    ollama_model: str = "mistral:7b-instruct"
    ollama_embed_model: str = "nomic-embed-text"

    # ChromaDB
    chroma_host: str = "chromadb"
    chroma_port: int = 8000

    # Encryption
    encryption_key: str = ""

    # Mail sync
    mail_sync_interval_seconds: int = 60

    # Secretary webhook (service-to-service auth)
    secretary_webhook_key: str = ""

    # Ordrestyring.dk
    ordrestyring_api_key: str = ""
    ordrestyring_default_case_status: str = ""

    # Calendar OAuth2 redirect URIs
    google_calendar_redirect_uri: str = ""
    microsoft_calendar_redirect_uri: str = ""

    # Twilio (for SMS-bekræftelser fra backend)
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_phone_number: str = ""

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
