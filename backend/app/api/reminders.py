"""Reminders API — påmindelser om ulæste emails og overskredet deadlines."""

import logging
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import APIRouter, Depends

from app.database import get_db
from app.models.user import User
from app.utils.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/")
async def list_reminders(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Hent aktive påmindelser: ulæste high-priority emails + overskredet action items."""
    reminders = []

    # Ulæste high-priority emails ældre end 2 timer
    result = await db.execute(text("""
        SELECT e.id, e.subject, e.from_name, e.from_address, e.received_at
        FROM email_messages e
        JOIN mail_accounts a ON e.account_id = a.id
        WHERE a.user_id = :uid
          AND e.is_read = false
          AND e.urgency = 'high'
          AND e.received_at < NOW() - INTERVAL '2 hours'
        ORDER BY e.received_at ASC
        LIMIT 10
    """), {"uid": user.id})

    for row in result.fetchall():
        reminders.append({
            "id": f"email-{row.id}",
            "type": "unread_urgent",
            "title": row.subject or "(Intet emne)",
            "description": f"Fra {row.from_name or row.from_address} — ulæst high-priority email",
            "link": f"/inbox/{row.id}",
            "created_at": row.received_at.isoformat() if row.received_at else None,
        })

    # Overskredet action items
    try:
        ai_result = await db.execute(text("""
            SELECT id, action, customer_name, deadline FROM action_items
            WHERE user_id = :uid
              AND status = 'pending'
              AND deadline < NOW()
            ORDER BY deadline ASC
            LIMIT 5
        """), {"uid": user.id})

        for row in ai_result.fetchall():
            reminders.append({
                "id": f"task-{row.id}",
                "type": "overdue_task",
                "title": row.action,
                "description": f"Overskredet deadline{f' — {row.customer_name}' if row.customer_name else ''}",
                "link": "/customers",
                "created_at": row.deadline.isoformat() if row.deadline else None,
            })
    except Exception:
        pass  # action_items tabel eksisterer måske ikke endnu

    return reminders


@router.get("/count")
async def get_reminder_count(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Hent antal aktive påmindelser til sidebar-badge."""
    count = 0

    # Ulæste high-priority emails > 2 timer
    result = await db.execute(text("""
        SELECT COUNT(*) FROM email_messages e
        JOIN mail_accounts a ON e.account_id = a.id
        WHERE a.user_id = :uid
          AND e.is_read = false
          AND e.urgency = 'high'
          AND e.received_at < NOW() - INTERVAL '2 hours'
    """), {"uid": user.id})
    count += result.scalar() or 0

    # Overskredet action items
    try:
        ai_result = await db.execute(text("""
            SELECT COUNT(*) FROM action_items
            WHERE user_id = :uid AND status = 'pending' AND deadline < NOW()
        """), {"uid": user.id})
        count += ai_result.scalar() or 0
    except Exception:
        pass

    return {"count": int(count)}


@router.post("/{reminder_id}/dismiss")
async def dismiss_reminder(reminder_id: str, user: User = Depends(get_current_user)):
    """Afvis en påmindelse (client-side håndteret — denne endpoint er stub)."""
    return {"dismissed": reminder_id}
