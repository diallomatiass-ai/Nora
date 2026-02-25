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
        "check-action-items-daily": {
            "task": "app.tasks.worker.check_action_items",
            "schedule": crontab(hour=8, minute=0),
        },
        "check-email-reminders-morning": {
            "task": "app.tasks.worker.check_email_reminders",
            "schedule": crontab(hour=8, minute=0),
        },
        "check-email-reminders-afternoon": {
            "task": "app.tasks.worker.check_email_reminders",
            "schedule": crontab(hour=13, minute=0),
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

                email.processed = True
                await db.commit()
        finally:
            await engine.dispose()

    run_async(_process())


@celery_app.task(name="app.tasks.worker.send_call_confirmation_task")
def send_call_confirmation_task(call_id: str):
    from app.services.call_confirmation import send_call_confirmation

    async def _send():
        engine, session_factory = _make_session()
        try:
            async with session_factory() as db:
                await send_call_confirmation(call_id, db)
        finally:
            await engine.dispose()

    run_async(_send())


@celery_app.task(name="app.tasks.worker.extract_action_items_task")
def extract_action_items_task(call_id: str):
    from app.services.action_extraction import extract_action_items_from_call

    async def _extract():
        engine, session_factory = _make_session()
        try:
            async with session_factory() as db:
                await extract_action_items_from_call(call_id, db)
        finally:
            await engine.dispose()

    run_async(_extract())


@celery_app.task(name="app.tasks.worker.check_action_items")
def check_action_items():
    """Daglig check: marker overdue items."""
    from datetime import datetime, timezone
    from sqlalchemy import select
    from app.models.action_item import ActionItem

    async def _check():
        engine, session_factory = _make_session()
        try:
            async with session_factory() as db:
                now = datetime.now(timezone.utc)
                result = await db.execute(
                    select(ActionItem).where(
                        ActionItem.status == "pending",
                        ActionItem.deadline.isnot(None),
                        ActionItem.deadline < now,
                    )
                )
                overdue_items = result.scalars().all()
                for item in overdue_items:
                    item.status = "overdue"

                if overdue_items:
                    await db.commit()

        finally:
            await engine.dispose()

    run_async(_check())


@celery_app.task(name="app.tasks.worker.check_email_reminders")
def check_email_reminders():
    """Generér påmindelser for glemte/ubesvarede emails."""
    from datetime import datetime, timezone, timedelta
    from sqlalchemy import select, and_
    from app.models.email_message import EmailMessage
    from app.models.email_reminder import EmailReminder
    from app.models.mail_account import MailAccount

    async def _check():
        engine, session_factory = _make_session()
        try:
            async with session_factory() as db:
                now = datetime.now(timezone.utc)

                # Get all accounts grouped by user
                accounts_result = await db.execute(select(MailAccount))
                accounts = accounts_result.scalars().all()

                user_accounts: dict = {}
                for acc in accounts:
                    user_accounts.setdefault(acc.user_id, []).append(acc.id)

                for user_id, account_ids in user_accounts.items():
                    # 1) Forgotten: unread + >48h + high urgency
                    forgotten_result = await db.execute(
                        select(EmailMessage).where(
                            EmailMessage.account_id.in_(account_ids),
                            EmailMessage.is_read == False,
                            EmailMessage.received_at < now - timedelta(hours=48),
                            EmailMessage.urgency == "high",
                        )
                    )
                    for email in forgotten_result.scalars().all():
                        existing = await db.scalar(
                            select(EmailReminder.id).where(
                                EmailReminder.email_id == email.id,
                                EmailReminder.reminder_type == "forgotten",
                                EmailReminder.is_dismissed == False,
                            )
                        )
                        if not existing:
                            days = (now - email.received_at).days if email.received_at else 0
                            db.add(EmailReminder(
                                user_id=user_id,
                                email_id=email.id,
                                reminder_type="forgotten",
                                message=f"Du har en ulæst hastende email fra {email.from_name or email.from_address} ({days}d gammel)",
                            ))

                    # 2) Unanswered: read + not replied + >24h + not spam
                    unanswered_result = await db.execute(
                        select(EmailMessage).where(
                            EmailMessage.account_id.in_(account_ids),
                            EmailMessage.is_read == True,
                            EmailMessage.is_replied == False,
                            EmailMessage.received_at < now - timedelta(hours=24),
                            EmailMessage.category != "spam",
                        )
                    )
                    for email in unanswered_result.scalars().all():
                        existing = await db.scalar(
                            select(EmailReminder.id).where(
                                EmailReminder.email_id == email.id,
                                EmailReminder.reminder_type == "unanswered",
                                EmailReminder.is_dismissed == False,
                            )
                        )
                        if not existing:
                            subj = email.subject or "(intet emne)"
                            db.add(EmailReminder(
                                user_id=user_id,
                                email_id=email.id,
                                reminder_type="unanswered",
                                message=f"Email fra {email.from_name or email.from_address} om '{subj}' venter på svar",
                            ))

                    # 3) Follow-up: not replied + >72h + high/medium urgency
                    followup_result = await db.execute(
                        select(EmailMessage).where(
                            EmailMessage.account_id.in_(account_ids),
                            EmailMessage.is_replied == False,
                            EmailMessage.received_at < now - timedelta(hours=72),
                            EmailMessage.urgency.in_(["high", "medium"]),
                        )
                    )
                    for email in followup_result.scalars().all():
                        existing = await db.scalar(
                            select(EmailReminder.id).where(
                                EmailReminder.email_id == email.id,
                                EmailReminder.reminder_type == "follow_up",
                                EmailReminder.is_dismissed == False,
                            )
                        )
                        if not existing:
                            db.add(EmailReminder(
                                user_id=user_id,
                                email_id=email.id,
                                reminder_type="follow_up",
                                message=f"Overvej at følge op på email fra {email.from_name or email.from_address}",
                            ))

                await db.commit()
        finally:
            await engine.dispose()

    run_async(_check())
