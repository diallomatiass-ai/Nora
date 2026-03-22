import asyncio
import os
import time
import logging
from contextlib import asynccontextmanager

# ── Observability initialiseres FØRST — før alt andet ─────────────────────────
from app.logging_config import setup_logging, init_sentry
setup_logging()
init_sentry()
# ──────────────────────────────────────────────────────────────────────────────

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text

from app.config import settings
from app.database import engine, Base
from app.api.auth import router as auth_router
from app.api.emails import router as emails_router
from app.api.suggestions import router as suggestions_router
from app.api.templates import router as templates_router
from app.api.knowledge import router as knowledge_router
from app.api.webhooks import router as webhooks_router
from app.api.chat import router as chat_router
from app.api.calendar import router as calendar_router
from app.api.calendar_webhooks import router as calendar_webhooks_router
from app.api.admin import router as admin_router
from app.api.ws import router as ws_router
from app.api.billing import router as billing_router
from app.api.meetings import router as meetings_router
from app.api.action_items import router as action_items_router
from app.api.reminders import router as reminders_router
from app.api.categories import router as categories_router
from app.api.customers import router as customers_router
from app.api.booking_rules import router as booking_rules_router
import app.models  # noqa: F401

logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])


async def ensure_columns(engine):
    """Tilføj manglende kolonner og indexes til eksisterende tabeller."""
    stmts = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255) UNIQUE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255) UNIQUE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS plan VARCHAR(50) DEFAULT 'free'",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'free'",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ",
        "CREATE INDEX IF NOT EXISTS idx_email_user_received ON email_messages (account_id, received_at DESC)",
        "CREATE INDEX IF NOT EXISTS idx_email_category ON email_messages (account_id, category)",
        "CREATE INDEX IF NOT EXISTS idx_email_is_read ON email_messages (account_id, is_read)",
        "CREATE INDEX IF NOT EXISTS idx_suggestions_email ON ai_suggestions (email_id, status)",
        "CREATE INDEX IF NOT EXISTS idx_mail_accounts_user ON mail_accounts (user_id, is_active)",
        """CREATE INDEX IF NOT EXISTS idx_email_fulltext ON email_messages
           USING gin(to_tsvector('danish', coalesce(subject,'') || ' ' || coalesce(body_text,'')))""",
        "CREATE INDEX IF NOT EXISTS idx_meeting_notes_user ON meeting_notes (user_id, created_at DESC)",
        # Email ejer-handlinger
        "ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS is_trashed BOOLEAN DEFAULT FALSE",
        "ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT FALSE",
        "ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS folder_id VARCHAR(255)",
        "ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS folder_name VARCHAR(255)",
        # AI opsummering og sentiment
        "ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS ai_summary TEXT",
        "ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS sentiment VARCHAR(20)",
        "ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS nora_label_id VARCHAR(255)",
        "ALTER TABLE mail_accounts ADD COLUMN IF NOT EXISTS nora_label_sync BOOLEAN DEFAULT FALSE",
    ]
    async with engine.begin() as conn:
        for stmt in stmts:
            try:
                await conn.execute(text(stmt))
            except Exception:
                pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Nora backend starter op — env=%s", settings.sentry_environment)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await ensure_columns(engine)

    from app.api.ws import redis_listener
    ws_task = asyncio.create_task(redis_listener())

    logger.info("Nora backend klar")
    yield

    ws_task.cancel()
    try:
        await ws_task
    except asyncio.CancelledError:
        pass
    await engine.dispose()
    logger.info("Nora backend lukket ned")


app = FastAPI(
    title="Nora - AI Mailassistent",
    description="GDPR-venlig AI-mailbot til danske SMV'er. Data forbliver i EU (AWS Bedrock Frankfurt).",
    version="2.1.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost", "http://localhost:3000", os.getenv("FRONTEND_URL", "http://localhost")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request logging middleware ────────────────────────────────────────────────

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000

    # Log kun API-kald (ikke statiske filer)
    if request.url.path.startswith("/api"):
        level = logging.WARNING if response.status_code >= 400 else logging.DEBUG
        logger.log(level, "%s %s → %d (%.0fms)",
                   request.method, request.url.path, response.status_code, duration_ms)

    return response


# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(auth_router,              prefix="/api/auth",          tags=["auth"])
app.include_router(emails_router,            prefix="/api/emails",        tags=["emails"])
app.include_router(suggestions_router,       prefix="/api/suggestions",   tags=["suggestions"])
app.include_router(templates_router,         prefix="/api/templates",     tags=["templates"])
app.include_router(knowledge_router,         prefix="/api/knowledge",     tags=["knowledge"])
app.include_router(webhooks_router,          prefix="/api/webhooks",      tags=["webhooks"])
app.include_router(chat_router,              prefix="/api/chat",          tags=["chat"])
app.include_router(calendar_router,          prefix="/api/calendar",      tags=["calendar"])
app.include_router(calendar_webhooks_router, prefix="/api/calendar/oauth",tags=["calendar-oauth"])
app.include_router(admin_router,             prefix="/api/admin",         tags=["admin"])
app.include_router(ws_router,                prefix="/api",               tags=["websocket"])
app.include_router(billing_router,           prefix="/api/billing",       tags=["billing"])
app.include_router(meetings_router,          prefix="/api/meetings",      tags=["meetings"])
app.include_router(action_items_router,      prefix="/api/action-items",  tags=["action-items"])
app.include_router(reminders_router,         prefix="/api/reminders",     tags=["reminders"])
app.include_router(categories_router,        prefix="/api/categories",    tags=["categories"])
app.include_router(customers_router,         prefix="/api/customers",     tags=["customers"])
app.include_router(booking_rules_router,     prefix="/api/booking-rules", tags=["booking-rules"])


# ── Health endpoint ───────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    """Fuld health check — tjekker database, Redis og konfiguration."""
    checks: dict[str, str] = {}
    ok = True

    # Database
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error: {e}"
        ok = False

    # Redis
    try:
        import redis.asyncio as aioredis
        r = aioredis.from_url(settings.redis_url)
        await r.ping()
        await r.aclose()
        checks["redis"] = "ok"
    except Exception as e:
        checks["redis"] = f"error: {e}"
        ok = False

    # AWS Bedrock konfigureret
    checks["bedrock"] = "configured" if settings.aws_access_key_id else "not_configured (using IAM role)"
    checks["sentry"] = "active" if settings.sentry_dsn else "disabled"
    checks["stripe"] = "configured" if settings.stripe_secret_key else "not_configured"

    return {
        "status": "ok" if ok else "degraded",
        "version": "2.1.0",
        "environment": settings.sentry_environment,
        "checks": checks,
    }
