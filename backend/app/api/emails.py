from datetime import datetime, timezone, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User
from app.models.mail_account import MailAccount
from app.models.email_message import EmailMessage
from app.models.ai_suggestion import AiSuggestion
from app.schemas.email_message import EmailMessageResponse, EmailListResponse
from app.utils.auth import get_current_user

router = APIRouter()


@router.get("/", response_model=list[EmailListResponse])
async def list_emails(
    category: str | None = None,
    urgency: str | None = None,
    is_read: bool | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Get user's account IDs
    accounts_result = await db.execute(
        select(MailAccount.id).where(MailAccount.user_id == user.id)
    )
    account_ids = [row[0] for row in accounts_result.all()]
    if not account_ids:
        return []

    # Eagerly load suggestions to check has_suggestion
    query_with_sug = (
        select(EmailMessage)
        .options(selectinload(EmailMessage.suggestions))
        .where(EmailMessage.account_id.in_(account_ids))
        .order_by(EmailMessage.received_at.desc())
    )
    if category:
        query_with_sug = query_with_sug.where(EmailMessage.category == category)
    if urgency:
        query_with_sug = query_with_sug.where(EmailMessage.urgency == urgency)
    if is_read is not None:
        query_with_sug = query_with_sug.where(EmailMessage.is_read == is_read)
    query_with_sug = query_with_sug.offset(skip).limit(limit)

    result = await db.execute(query_with_sug)
    emails = result.scalars().unique().all()

    response = []
    for email in emails:
        item = EmailListResponse.model_validate(email)
        item.has_suggestion = len(email.suggestions) > 0
        response.append(item)

    return response


@router.get("/{email_id}", response_model=EmailMessageResponse)
async def get_email(
    email_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    accounts_result = await db.execute(
        select(MailAccount.id).where(MailAccount.user_id == user.id)
    )
    account_ids = [row[0] for row in accounts_result.all()]

    result = await db.execute(
        select(EmailMessage)
        .options(selectinload(EmailMessage.suggestions))
        .where(EmailMessage.id == email_id, EmailMessage.account_id.in_(account_ids))
    )
    email = result.scalar_one_or_none()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")

    # Mark as read
    if not email.is_read:
        email.is_read = True
        await db.commit()

    return email


@router.get("/stats/summary")
async def email_stats(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    accounts_result = await db.execute(
        select(MailAccount.id).where(MailAccount.user_id == user.id)
    )
    account_ids = [row[0] for row in accounts_result.all()]
    if not account_ids:
        return {"total": 0, "unread": 0, "categories": {}, "urgency": {}}

    base = select(func.count()).where(EmailMessage.account_id.in_(account_ids))

    total = (await db.execute(base)).scalar()
    unread = (await db.execute(base.where(EmailMessage.is_read == False))).scalar()

    cat_result = await db.execute(
        select(EmailMessage.category, func.count())
        .where(EmailMessage.account_id.in_(account_ids), EmailMessage.category.isnot(None))
        .group_by(EmailMessage.category)
    )
    categories = {row[0]: row[1] for row in cat_result.all()}

    urg_result = await db.execute(
        select(EmailMessage.urgency, func.count())
        .where(EmailMessage.account_id.in_(account_ids), EmailMessage.urgency.isnot(None))
        .group_by(EmailMessage.urgency)
    )
    urgency = {row[0]: row[1] for row in urg_result.all()}

    return {"total": total, "unread": unread, "categories": categories, "urgency": urgency}


@router.get("/dashboard/summary")
async def dashboard_summary(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    accounts_result = await db.execute(
        select(MailAccount.id).where(MailAccount.user_id == user.id)
    )
    account_ids = [row[0] for row in accounts_result.all()]
    if not account_ids:
        return {
            "unread": 0, "high_priority": 0, "pending_suggestions": 0,
            "week_total": 0, "top_urgent": [], "user_name": user.name,
        }

    base = select(func.count()).where(EmailMessage.account_id.in_(account_ids))
    unread = (await db.execute(base.where(EmailMessage.is_read == False))).scalar()
    high_priority = (await db.execute(base.where(EmailMessage.urgency == "high"))).scalar()

    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    week_total = (await db.execute(
        base.where(EmailMessage.received_at >= week_ago)
    )).scalar()

    pending_sug = (await db.execute(
        select(func.count(AiSuggestion.id))
        .join(EmailMessage, AiSuggestion.email_id == EmailMessage.id)
        .where(EmailMessage.account_id.in_(account_ids), AiSuggestion.status == "pending")
    )).scalar()

    top_result = await db.execute(
        select(EmailMessage)
        .where(
            EmailMessage.account_id.in_(account_ids),
            EmailMessage.is_read == False,
        )
        .order_by(
            case(
                (EmailMessage.urgency == "high", 0),
                (EmailMessage.urgency == "medium", 1),
                else_=2,
            ),
            EmailMessage.received_at.desc(),
        )
    )
    top_emails = top_result.scalars().all()

    return {
        "user_name": user.name,
        "unread": unread,
        "high_priority": high_priority,
        "pending_suggestions": pending_sug,
        "week_total": week_total,
        "top_urgent": [
            {
                "id": str(e.id),
                "subject": e.subject or "(intet emne)",
                "from_address": e.from_address,
                "from_name": e.from_name,
                "urgency": e.urgency,
                "category": e.category,
                "received_at": e.received_at.isoformat() if e.received_at else None,
            }
            for e in top_emails
        ],
    }


@router.post("/{email_id}/generate-suggestion")
async def generate_suggestion(
    email_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    accounts_result = await db.execute(
        select(MailAccount.id).where(MailAccount.user_id == user.id)
    )
    account_ids = [row[0] for row in accounts_result.all()]

    result = await db.execute(
        select(EmailMessage)
        .where(EmailMessage.id == email_id, EmailMessage.account_id.in_(account_ids))
    )
    email = result.scalar_one_or_none()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")

    from app.services.ai_engine import generate_reply
    reply_text = await generate_reply(email, user, db)

    suggestion = AiSuggestion(
        email_id=email.id,
        suggested_text=reply_text,
        status="pending",
    )
    db.add(suggestion)
    email.processed = True
    await db.commit()
    await db.refresh(suggestion)
    return suggestion
