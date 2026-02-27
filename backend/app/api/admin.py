import logging
from datetime import datetime, timezone, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.mail_account import MailAccount
from app.models.email_message import EmailMessage
from app.models.ai_suggestion import AiSuggestion
from app.utils.auth import get_current_user
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Admin-dependency — kun brugere med role == "admin" må kalde disse endpoints
# ---------------------------------------------------------------------------

async def get_admin_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Kun administratorer har adgang til dette endpoint",
        )
    return current_user


# ---------------------------------------------------------------------------
# Pydantic-skemaer
# ---------------------------------------------------------------------------

class UserRoleUpdate(BaseModel):
    role: str  # "user" eller "admin"


class UserListItem(BaseModel):
    id: str
    email: str
    name: str
    company_name: str | None
    role: str
    created_at: datetime
    email_count: int
    suggestion_count: int

    model_config = {"from_attributes": True}


class UserDetail(BaseModel):
    id: str
    email: str
    name: str
    company_name: str | None
    role: str
    created_at: datetime
    email_count: int
    suggestion_count: int
    approved_count: int
    rejected_count: int

    model_config = {"from_attributes": True}


class RecentEmailItem(BaseModel):
    id: str
    user_id: str
    user_email: str
    from_address: str
    from_name: str | None
    subject: str | None
    category: str | None
    urgency: str | None
    is_read: bool
    received_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# GET /api/admin/stats
# ---------------------------------------------------------------------------

@router.get("/stats")
async def admin_stats(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Systemstatistikker på tværs af alle brugere."""
    total_users = (
        await db.execute(select(func.count(User.id)))
    ).scalar() or 0

    total_emails = (
        await db.execute(select(func.count(EmailMessage.id)))
    ).scalar() or 0

    total_suggestions = (
        await db.execute(select(func.count(AiSuggestion.id)))
    ).scalar() or 0

    approved = (
        await db.execute(
            select(func.count(AiSuggestion.id)).where(AiSuggestion.status == "approved")
        )
    ).scalar() or 0

    rejected = (
        await db.execute(
            select(func.count(AiSuggestion.id)).where(AiSuggestion.status == "rejected")
        )
    ).scalar() or 0

    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    active_users_last_7_days = (
        await db.execute(
            select(func.count(func.distinct(MailAccount.user_id)))
            .join(EmailMessage, EmailMessage.account_id == MailAccount.id)
            .where(EmailMessage.created_at >= week_ago)
        )
    ).scalar() or 0

    approved_ratio = round(approved / total_suggestions, 3) if total_suggestions else 0.0
    rejected_ratio = round(rejected / total_suggestions, 3) if total_suggestions else 0.0

    return {
        "total_users": total_users,
        "total_emails": total_emails,
        "total_suggestions": total_suggestions,
        "approved": approved,
        "rejected": rejected,
        "approved_ratio": approved_ratio,
        "rejected_ratio": rejected_ratio,
        "active_users_last_7_days": active_users_last_7_days,
    }


# ---------------------------------------------------------------------------
# GET /api/admin/users
# ---------------------------------------------------------------------------

@router.get("/users", response_model=list[UserListItem])
async def list_users(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Liste alle brugere med aggregerede tællere."""
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    users = result.scalars().all()

    # Email-tæller pr. bruger via mail_accounts
    email_counts_result = await db.execute(
        select(MailAccount.user_id, func.count(EmailMessage.id))
        .join(EmailMessage, EmailMessage.account_id == MailAccount.id)
        .group_by(MailAccount.user_id)
    )
    email_counts = {str(row[0]): row[1] for row in email_counts_result.all()}

    # Suggestion-tæller pr. bruger via mail_accounts → email_messages
    sug_counts_result = await db.execute(
        select(MailAccount.user_id, func.count(AiSuggestion.id))
        .join(EmailMessage, EmailMessage.account_id == MailAccount.id)
        .join(AiSuggestion, AiSuggestion.email_id == EmailMessage.id)
        .group_by(MailAccount.user_id)
    )
    sug_counts = {str(row[0]): row[1] for row in sug_counts_result.all()}

    response = []
    for u in users:
        uid = str(u.id)
        response.append(UserListItem(
            id=uid,
            email=u.email,
            name=u.name,
            company_name=u.company_name,
            role=u.role,
            created_at=u.created_at,
            email_count=email_counts.get(uid, 0),
            suggestion_count=sug_counts.get(uid, 0),
        ))

    return response


# ---------------------------------------------------------------------------
# GET /api/admin/users/{user_id}
# ---------------------------------------------------------------------------

@router.get("/users/{user_id}", response_model=UserDetail)
async def get_user_detail(
    user_id: UUID,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Detaljer om én bruger inkl. godkendt/afvist fordeling."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Bruger ikke fundet")

    uid = str(user.id)

    email_count = (
        await db.execute(
            select(func.count(EmailMessage.id))
            .join(MailAccount, EmailMessage.account_id == MailAccount.id)
            .where(MailAccount.user_id == user.id)
        )
    ).scalar() or 0

    sug_base = (
        select(func.count(AiSuggestion.id))
        .join(EmailMessage, AiSuggestion.email_id == EmailMessage.id)
        .join(MailAccount, EmailMessage.account_id == MailAccount.id)
        .where(MailAccount.user_id == user.id)
    )

    suggestion_count = (await db.execute(sug_base)).scalar() or 0
    approved_count = (
        await db.execute(sug_base.where(AiSuggestion.status == "approved"))
    ).scalar() or 0
    rejected_count = (
        await db.execute(sug_base.where(AiSuggestion.status == "rejected"))
    ).scalar() or 0

    return UserDetail(
        id=uid,
        email=user.email,
        name=user.name,
        company_name=user.company_name,
        role=user.role,
        created_at=user.created_at,
        email_count=email_count,
        suggestion_count=suggestion_count,
        approved_count=approved_count,
        rejected_count=rejected_count,
    )


# ---------------------------------------------------------------------------
# PUT /api/admin/users/{user_id}/role
# ---------------------------------------------------------------------------

@router.put("/users/{user_id}/role")
async def update_user_role(
    user_id: UUID,
    data: UserRoleUpdate,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Skift en brugers rolle (user/admin)."""
    allowed_roles = {"user", "admin"}
    if data.role not in allowed_roles:
        raise HTTPException(
            status_code=400,
            detail=f"Ugyldig rolle. Tilladte værdier: {', '.join(allowed_roles)}",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Bruger ikke fundet")

    if user.id == admin.id:
        raise HTTPException(
            status_code=400,
            detail="Du kan ikke ændre din egen rolle",
        )

    old_role = user.role
    user.role = data.role
    await db.commit()

    logger.info("Admin %s ændrede rolle for bruger %s: %s → %s", admin.email, user.email, old_role, data.role)

    return {
        "id": str(user.id),
        "email": user.email,
        "role": user.role,
        "message": f"Rolle opdateret til '{data.role}'",
    }


# ---------------------------------------------------------------------------
# DELETE /api/admin/users/{user_id}
# ---------------------------------------------------------------------------

@router.delete("/users/{user_id}", status_code=204)
async def delete_user(
    user_id: UUID,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Slet en bruger og alle tilknyttede data (cascade)."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Bruger ikke fundet")

    if user.id == admin.id:
        raise HTTPException(
            status_code=400,
            detail="Du kan ikke slette din egen konto via admin-API'et",
        )

    logger.warning("Admin %s sletter bruger %s (%s)", admin.email, user.email, user.id)

    await db.delete(user)
    await db.commit()


# ---------------------------------------------------------------------------
# GET /api/admin/emails/recent
# ---------------------------------------------------------------------------

@router.get("/emails/recent", response_model=list[RecentEmailItem])
async def recent_emails(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Seneste 50 emails på tværs af alle brugere."""
    result = await db.execute(
        select(EmailMessage, MailAccount.user_id, User.email.label("user_email"))
        .join(MailAccount, EmailMessage.account_id == MailAccount.id)
        .join(User, MailAccount.user_id == User.id)
        .order_by(EmailMessage.received_at.desc().nullslast(), EmailMessage.created_at.desc())
        .limit(50)
    )
    rows = result.all()

    response = []
    for email, user_id, user_email in rows:
        response.append(RecentEmailItem(
            id=str(email.id),
            user_id=str(user_id),
            user_email=user_email,
            from_address=email.from_address,
            from_name=email.from_name,
            subject=email.subject,
            category=email.category,
            urgency=email.urgency,
            is_read=email.is_read,
            received_at=email.received_at,
            created_at=email.created_at,
        ))

    return response


# ---------------------------------------------------------------------------
# GET /api/admin/health
# ---------------------------------------------------------------------------

@router.get("/health")
async def admin_health(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """System health-check: database + Redis."""
    health = {
        "database": "unknown",
        "redis": "unknown",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    # Database ping
    try:
        from sqlalchemy import text
        await db.execute(text("SELECT 1"))
        health["database"] = "ok"
    except Exception as exc:
        logger.error("Admin health: DB ping fejlede: %s", exc)
        health["database"] = f"error: {exc}"

    # Redis ping
    try:
        import redis.asyncio as aioredis
        r = aioredis.from_url(settings.redis_url, socket_connect_timeout=2)
        await r.ping()
        await r.aclose()
        health["redis"] = "ok"
    except Exception as exc:
        logger.error("Admin health: Redis ping fejlede: %s", exc)
        health["redis"] = f"error: {exc}"

    overall_ok = all(v == "ok" for v in [health["database"], health["redis"]])
    health["status"] = "ok" if overall_ok else "degraded"

    return health
