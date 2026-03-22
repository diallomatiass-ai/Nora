import asyncio

from celery import Celery
from celery.schedules import crontab

from app.config import settings

celery_app = Celery(
    "mailbot",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Europe/Copenhagen",
    beat_schedule={
        "sync-emails-periodic": {
            "task": "app.tasks.worker.sync_all_emails",
            "schedule": settings.mail_sync_interval_seconds,
        },
    },
)


def run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def _make_session():
    """Create a fresh async engine+session for each Celery task."""
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine, AsyncSession
    engine = create_async_engine(settings.database_url, echo=False)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    return engine, session_factory


@celery_app.task(name="app.tasks.worker.sync_all_emails")
def sync_all_emails():
    from app.services.mail_sync import sync_all_accounts

    async def _sync():
        engine, session_factory = _make_session()
        try:
            async with session_factory() as db:
                await sync_all_accounts(db)
        finally:
            await engine.dispose()

    run_async(_sync())


@celery_app.task(name="app.tasks.worker.process_single_email")
def process_single_email(email_id: str):
    from uuid import UUID
    from sqlalchemy import select
    from app.models.email_message import EmailMessage
    from app.models.mail_account import MailAccount
    from app.models.user import User
    from app.models.ai_suggestion import AiSuggestion
    from app.services.ai_engine import classify_email, generate_reply

    async def _process():
        engine, session_factory = _make_session()
        try:
            async with session_factory() as db:
                result = await db.execute(
                    select(EmailMessage).where(EmailMessage.id == UUID(email_id))
                )
                email = result.scalar_one_or_none()
                if not email or email.processed:
                    return

                # Classify
                classification = await classify_email(email.subject or "", email.body_text or "")
                email.category = classification.get("category")
                email.urgency = classification.get("urgency")
                email.topic = classification.get("topic")
                email.confidence = classification.get("confidence")
                email.ai_summary = classification.get("ai_summary")
                email.sentiment = classification.get("sentiment")

                # Get user for reply generation
                account_result = await db.execute(
                    select(MailAccount).where(MailAccount.id == email.account_id)
                )
                account = account_result.scalar_one()
                user_result = await db.execute(
                    select(User).where(User.id == account.user_id)
                )
                user = user_result.scalar_one()

                # Generate reply suggestion
                if email.category != "spam":
                    reply_text = await generate_reply(email, user, db)
                    suggestion = AiSuggestion(
                        email_id=email.id,
                        suggested_text=reply_text,
                    )
                    db.add(suggestion)

                # Opt-in: spejl Nora-kategori som Gmail-label
                if email.category and account.provider == "gmail" and getattr(account, 'nora_label_sync', False):
                    try:
                        from app.services.mail_gmail import apply_nora_label
                        label_id = await apply_nora_label(account, db, email.provider_id, email.category)
                        if label_id:
                            email.nora_label_id = label_id
                    except Exception as exc:
                        import logging as _logging
                        _logging.getLogger(__name__).warning("Nora label sync fejl: %s", exc)

                email.processed = True
                await db.commit()
        finally:
            await engine.dispose()

    run_async(_process())


