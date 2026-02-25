from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User
from app.models.email_reminder import EmailReminder
from app.models.email_message import EmailMessage
from app.utils.auth import get_current_user

router = APIRouter()


class ReminderResponse(BaseModel):
    id: UUID
    email_id: UUID
    reminder_type: str
    message: str | None
    created_at: str
    # Email info
    email_subject: str | None = None
    email_from_name: str | None = None
    email_from_address: str | None = None
    email_urgency: str | None = None


@router.get("/")
async def list_reminders(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ReminderResponse]:
    result = await db.execute(
        select(EmailReminder, EmailMessage)
        .join(EmailMessage, EmailReminder.email_id == EmailMessage.id)
        .where(
            EmailReminder.user_id == user.id,
            EmailReminder.is_dismissed == False,
        )
        .order_by(EmailReminder.created_at.desc())
    )

    items = []
    for reminder, email in result.all():
        items.append(ReminderResponse(
            id=reminder.id,
            email_id=reminder.email_id,
            reminder_type=reminder.reminder_type,
            message=reminder.message,
            created_at=reminder.created_at.isoformat(),
            email_subject=email.subject,
            email_from_name=email.from_name,
            email_from_address=email.from_address,
            email_urgency=email.urgency,
        ))
    return items


@router.post("/{reminder_id}/dismiss")
async def dismiss_reminder(
    reminder_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(EmailReminder).where(
            EmailReminder.id == reminder_id,
            EmailReminder.user_id == user.id,
        )
    )
    reminder = result.scalar_one_or_none()
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")

    reminder.is_dismissed = True
    await db.commit()
    return {"status": "dismissed"}


@router.get("/count")
async def reminder_count(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    count = await db.scalar(
        select(func.count(EmailReminder.id)).where(
            EmailReminder.user_id == user.id,
            EmailReminder.is_dismissed == False,
        )
    )
    return {"count": count or 0}
