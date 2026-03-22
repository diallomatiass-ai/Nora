"""Struktureret logging + Sentry integration for Nora backend."""

import logging
import sys
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
from sentry_sdk.integrations.redis import RedisIntegration
from sentry_sdk.integrations.celery import CeleryIntegration
from sentry_sdk.integrations.logging import LoggingIntegration

from app.config import settings


def init_sentry() -> None:
    """Initialiser Sentry — disabled automatisk hvis DSN ikke er sat."""
    if not settings.sentry_dsn:
        logging.getLogger(__name__).info("Sentry er ikke konfigureret (SENTRY_DSN mangler) — fejlrapportering deaktiveret")
        return

    sentry_logging = LoggingIntegration(
        level=logging.WARNING,       # Fang WARNING og derover som breadcrumbs
        event_level=logging.ERROR,   # Send ERROR og derover som Sentry events
    )

    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.sentry_environment,
        traces_sample_rate=settings.sentry_traces_sample_rate,
        profiles_sample_rate=0.05,  # CPU profiling på 5% af requests

        integrations=[
            FastApiIntegration(transaction_style="endpoint"),
            SqlalchemyIntegration(),
            RedisIntegration(),
            CeleryIntegration(),
            sentry_logging,
        ],

        # Filtrer sensitive data fra
        before_send=_scrub_sensitive_data,

        # Ignorer forventede fejl
        ignore_errors=[
            KeyboardInterrupt,
        ],
    )

    logging.getLogger(__name__).info(
        "Sentry aktiveret: env=%s traces=%.0f%%",
        settings.sentry_environment,
        settings.sentry_traces_sample_rate * 100,
    )


def _scrub_sensitive_data(event, hint):
    """Fjern passwords, tokens og email-indhold fra Sentry events."""
    SENSITIVE_KEYS = {
        "password", "token", "access_token", "secret", "authorization",
        "body_text", "body_html", "encryption_key", "aws_secret_access_key",
    }

    def scrub(obj):
        if isinstance(obj, dict):
            return {
                k: "[REDACTED]" if k.lower() in SENSITIVE_KEYS else scrub(v)
                for k, v in obj.items()
            }
        if isinstance(obj, list):
            return [scrub(i) for i in obj]
        return obj

    if "request" in event:
        event["request"] = scrub(event["request"])
    if "extra" in event:
        event["extra"] = scrub(event["extra"])

    return event


def set_sentry_user(user_id: str, email: str) -> None:
    """Sæt bruger-context på Sentry scope — bruges i auth middleware."""
    sentry_sdk.set_user({"id": user_id, "email": email})


def capture_exception(exc: Exception, context: dict | None = None) -> None:
    """Fang en exception manuelt med ekstra context."""
    with sentry_sdk.push_scope() as scope:
        if context:
            for k, v in context.items():
                scope.set_extra(k, v)
        sentry_sdk.capture_exception(exc)


def setup_logging() -> None:
    """Opsæt struktureret logging til stdout."""
    log_level = getattr(logging, settings.log_level.upper(), logging.INFO)

    # JSON-lignende format til produktion, læsbart format til udvikling
    if settings.sentry_environment == "production":
        fmt = '{"time":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","msg":"%(message)s"}'
    else:
        fmt = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"

    logging.basicConfig(
        level=log_level,
        format=fmt,
        datefmt="%Y-%m-%dT%H:%M:%S",
        stream=sys.stdout,
        force=True,
    )

    # Dæmp støjende tredjeparts-libraries
    for noisy in ["httpx", "httpcore", "uvicorn.access", "boto3", "botocore", "urllib3"]:
        logging.getLogger(noisy).setLevel(logging.WARNING)

    logging.getLogger(__name__).info("Logging initialiseret: level=%s", settings.log_level)
