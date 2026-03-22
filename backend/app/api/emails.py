import logging
from datetime import datetime, timezone, timedelta
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
from pydantic import BaseModel
from sqlalchemy import select, func, case, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User
from app.models.mail_account import MailAccount
from app.models.email_message import EmailMessage
from app.models.ai_suggestion import AiSuggestion
from app.schemas.email_message import (
    EmailMessageResponse, EmailListResponse,
    ComposeEmailRequest, SentEmailResponse,
)
from app.utils.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()


async def _get_account_ids(user: User, db) -> list:
    result = await db.execute(
        select(MailAccount.id).where(MailAccount.user_id == user.id)
    )
    return [row[0] for row in result.all()]


@router.get("/", response_model=list[EmailListResponse])
async def list_emails(
    category: str | None = None,
    urgency: str | None = None,
    is_read: bool | None = None,
    search: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    account_ids = await _get_account_ids(user, db)
    if not account_ids:
        return []

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
    if search:
        term = f"%{search}%"
        query_with_sug = query_with_sug.where(
            or_(
                EmailMessage.from_address.ilike(term),
                EmailMessage.from_name.ilike(term),
                EmailMessage.subject.ilike(term),
                EmailMessage.body_text.ilike(term),
            )
        )
    query_with_sug = query_with_sug.offset(skip).limit(limit)

    result = await db.execute(query_with_sug)
    emails = result.scalars().unique().all()

    response = []
    for email in emails:
        item = EmailListResponse.model_validate(email)
        item.has_suggestion = len(email.suggestions) > 0
        response.append(item)

    return response


# --- Static routes BEFORE /{email_id} ---

class AiDraftRequest(BaseModel):
    to_address: str | None = None
    subject: str | None = None
    instructions: str  # e.g. "Skriv et tilbud på tagarbejde til 45.000 kr"
    tones: list[str] | None = None  # e.g. ["professionel", "venlig"]


@router.post("/compose/ai-draft")
@limiter.limit("10/minute")
async def generate_compose_draft(
    request: Request,
    data: AiDraftRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Use AI to draft a new email based on instructions."""
    from app.services.ai_engine import _call_bedrock_async as _call_ollama_generate
    from sqlalchemy import select
    from app.models.template import Template
    from app.models.knowledge_base import KnowledgeBase

    # Fetch user's knowledge base for context
    kb_result = await db.execute(
        select(KnowledgeBase).where(KnowledgeBase.user_id == user.id).limit(5)
    )
    kb_entries = kb_result.scalars().all()
    kb_context = "\n".join(
        f"- {entry.title}: {entry.content[:200]}" for entry in kb_entries
    ) if kb_entries else "Ingen videnbase tilgængelig."

    # Fetch relevant templates
    tmpl_result = await db.execute(
        select(Template).where(Template.user_id == user.id)
        .order_by(Template.usage_count.desc()).limit(3)
    )
    templates = tmpl_result.scalars().all()
    tmpl_context = "\n".join(
        f"- {t.name}: {t.body[:150]}" for t in templates
    ) if templates else ""

    # Build tone instruction
    tone_labels = {
        "professionel": "professionel",
        "venlig": "venlig og imødekommende",
        "uformel": "uformel og afslappet",
        "formel": "formel og korrekt",
        "direkte": "direkte og uden omsvøb",
        "jargon": "med fagsprog/branchetermer",
    }
    if data.tones:
        tone_parts = [tone_labels.get(t, t) for t in data.tones]
        tone_instruction = f"Tonen skal være: {', '.join(tone_parts)}."
    else:
        tone_instruction = "Vær professionel, venlig og direkte."

    prompt = f"""Du er en email-assistent for en dansk håndværkervirksomhed.
Brugerens navn: {user.name or 'Ukendt'}
Virksomhedsinfo:
{kb_context}

{f"Relevante skabeloner:{chr(10)}{tmpl_context}" if tmpl_context else ""}

Brugeren vil skrive en ny email med følgende instruktioner:
"{data.instructions}"

{f"Modtager: {data.to_address}" if data.to_address else ""}
{f"Emne: {data.subject}" if data.subject else ""}

Skriv emailen på dansk. {tone_instruction}
Returner KUN selve email-teksten (ingen emne-linje, ingen "Med venlig hilsen" medmindre det passer).
Hvis der ikke er angivet et emne, foreslå også et passende emne i formatet:
EMNE: [foreslået emne]
---
[email-teksten]"""

    try:
        raw = await _call_ollama_generate(prompt)
        result_text = raw.strip()

        suggested_subject = None
        suggested_body = result_text

        # Parse out subject if present
        if result_text.startswith("EMNE:"):
            lines = result_text.split("\n", 1)
            first_line = lines[0]
            suggested_subject = first_line.replace("EMNE:", "").strip()
            if len(lines) > 1:
                rest = lines[1].strip()
                if rest.startswith("---"):
                    rest = rest[3:].strip()
                suggested_body = rest
        elif "\nEMNE:" in result_text:
            pass  # keep as is
        # Also handle --- separator
        elif "---" in result_text:
            parts = result_text.split("---", 1)
            first = parts[0].strip()
            if first.upper().startswith("EMNE:"):
                suggested_subject = first.replace("EMNE:", "").replace("Emne:", "").strip()
                suggested_body = parts[1].strip()

        return {
            "subject": suggested_subject,
            "body": suggested_body,
        }
    except Exception as exc:
        logger.error("AI draft generation failed: %s", exc)
        raise HTTPException(status_code=500, detail="AI-generering fejlede")


@router.post("/compose")
async def compose_email(
    data: ComposeEmailRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a new email (not a reply)."""
    # Verify account belongs to user
    result = await db.execute(
        select(MailAccount).where(
            MailAccount.id == data.account_id,
            MailAccount.user_id == user.id,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    # Send via provider
    if account.provider == "gmail":
        from app.services.mail_gmail import send_reply
    elif account.provider == "outlook":
        from app.services.mail_outlook import send_reply
    else:
        raise HTTPException(status_code=400, detail="Unknown provider")

    success = await send_reply(account, db, data.to_address, data.subject, data.body, None)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to send email")

    # Store outgoing email
    now = datetime.now(timezone.utc)
    email_msg = EmailMessage(
        account_id=account.id,
        provider_id=f"compose-{uuid4()}",
        from_address=account.email_address,
        from_name=user.name,
        to_address=data.to_address,
        subject=data.subject,
        body_text=data.body,
        is_read=True,
        is_replied=False,
        processed=True,
        is_outgoing=True,
        received_at=now,
    )
    db.add(email_msg)

    await db.commit()
    await db.refresh(email_msg)
    return {"id": str(email_msg.id), "status": "sent"}


@router.get("/sent", response_model=list[SentEmailResponse])
async def list_sent_emails(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all sent emails: composed + AI replies."""
    account_ids = await _get_account_ids(user, db)
    if not account_ids:
        return []

    sent_items: list[SentEmailResponse] = []

    # 1) Composed outgoing emails
    result = await db.execute(
        select(EmailMessage)
        .where(
            EmailMessage.account_id.in_(account_ids),
            EmailMessage.is_outgoing == True,
        )
        .order_by(EmailMessage.received_at.desc())
    )
    for email in result.scalars().all():
        sent_items.append(SentEmailResponse(
            id=email.id,
            type="compose",
            to_address=email.to_address,
            subject=email.subject,
            body_preview=(email.body_text or "")[:120],
            sent_at=email.received_at or email.created_at,
            original_email_id=None,
        ))

    # 2) AI suggestions that were sent
    sug_result = await db.execute(
        select(AiSuggestion, EmailMessage)
        .join(EmailMessage, AiSuggestion.email_id == EmailMessage.id)
        .where(
            EmailMessage.account_id.in_(account_ids),
            AiSuggestion.sent_at.isnot(None),
        )
    )
    for sug, email in sug_result.all():
        text = sug.edited_text or sug.suggested_text or ""
        sent_items.append(SentEmailResponse(
            id=sug.id,
            type="reply",
            to_address=email.from_address,
            subject=f"Re: {email.subject}" if email.subject else "Re:",
            body_preview=text[:120],
            sent_at=sug.sent_at,
            original_email_id=email.id,
        ))

    # Sort combined by sent_at desc
    sent_items.sort(key=lambda x: x.sent_at or datetime.min.replace(tzinfo=timezone.utc), reverse=True)

    return sent_items[skip:skip + limit]


@router.get("/{email_id}/thread", response_model=list[EmailListResponse])
async def get_email_thread(
    email_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all emails in the same thread."""
    account_ids = await _get_account_ids(user, db)

    # Get the email's thread_id
    result = await db.execute(
        select(EmailMessage).where(
            EmailMessage.id == email_id,
            EmailMessage.account_id.in_(account_ids),
        )
    )
    email = result.scalar_one_or_none()
    if not email or not email.thread_id:
        return []

    # Get all emails with same thread_id
    result = await db.execute(
        select(EmailMessage)
        .options(selectinload(EmailMessage.suggestions))
        .where(
            EmailMessage.thread_id == email.thread_id,
            EmailMessage.account_id.in_(account_ids),
        )
        .order_by(EmailMessage.received_at.asc())
    )
    emails = result.scalars().unique().all()

    response = []
    for e in emails:
        item = EmailListResponse.model_validate(e)
        item.has_suggestion = len(e.suggestions) > 0
        response.append(item)
    return response


@router.get("/{email_id}/thread-summary")
@limiter.limit("20/minute")
async def get_thread_summary(
    request: Request,
    email_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generer en AI-opsummering af hele email-tråden."""
    account_ids = await _get_account_ids(user, db)

    result = await db.execute(
        select(EmailMessage).where(
            EmailMessage.id == email_id,
            EmailMessage.account_id.in_(account_ids),
        )
    )
    email = result.scalar_one_or_none()
    if not email:
        raise HTTPException(status_code=404, detail="Email ikke fundet")

    # Hent tråden
    thread_emails = []
    if email.thread_id:
        thread_result = await db.execute(
            select(EmailMessage)
            .where(
                EmailMessage.thread_id == email.thread_id,
                EmailMessage.account_id.in_(account_ids),
            )
            .order_by(EmailMessage.received_at.asc())
        )
        thread_emails = thread_result.scalars().all()

    if not thread_emails:
        thread_emails = [email]

    # Byg tråd-tekst til AI
    thread_text = ""
    for i, e in enumerate(thread_emails, 1):
        sender = e.from_name or e.from_address
        date_str = e.received_at.strftime("%d/%m kl. %H:%M") if e.received_at else ""
        thread_text += f"\n--- Besked {i} ({sender}, {date_str}) ---\n"
        thread_text += (e.body_text or "")[:800]

    from app.services.ai_engine import _call_bedrock_async
    prompt = f"""Du er en email-assistent. Opsummer denne email-tråd på dansk.

TRÅD ({len(thread_emails)} beskeder):
{thread_text}

Returner KUN valid JSON:
{{
  "summary": "2-3 sætninger der forklarer hvad tråden handler om og hvad status er",
  "key_points": ["punkt 1", "punkt 2"],
  "action_needed": true/false,
  "action": "hvad skal der gøres (eller null)"
}}"""

    try:
        raw = await _call_bedrock_async(prompt, max_tokens=512)
        text = raw.strip()
        if text.startswith("```"):
            lines = [l for l in text.split("\n") if not l.strip().startswith("```")]
            text = "\n".join(lines).strip()
        import json
        data = json.loads(text)
        return {
            "thread_length": len(thread_emails),
            "summary": data.get("summary", ""),
            "key_points": data.get("key_points", []),
            "action_needed": data.get("action_needed", False),
            "action": data.get("action"),
        }
    except Exception as exc:
        logger.error("Tråd-opsummering fejlede: %s", exc)
        raise HTTPException(status_code=500, detail="Kunne ikke generere tråd-opsummering")


@router.get("/{email_id}/customer-history")
async def get_email_customer_history(
    email_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returnér kundehistorik for afsenderens email-adresse."""
    from sqlalchemy import text

    # Find email
    accounts_result = await db.execute(
        select(MailAccount.id).where(MailAccount.user_id == user.id)
    )
    account_ids = [row[0] for row in accounts_result.all()]
    result = await db.execute(
        select(EmailMessage.from_address, EmailMessage.from_name)
        .where(EmailMessage.id == email_id, EmailMessage.account_id.in_(account_ids))
    )
    row = result.first()
    if not row:
        return {"customer": None, "emails": [], "action_items": []}

    from_address = row.from_address

    # Find matchende kunde
    try:
        cust = await db.execute(
            text("SELECT id, name, status, estimated_value FROM customers WHERE user_id = :uid AND email ILIKE :email LIMIT 1"),
            {"uid": user.id, "email": from_address}
        )
        customer_row = cust.fetchone()
        customer = {
            "id": str(customer_row.id),
            "name": customer_row.name,
            "status": customer_row.status,
            "estimated_value": float(customer_row.estimated_value) if customer_row.estimated_value else None,
        } if customer_row else None
    except Exception:
        customer = None

    # Tidligere emails fra samme afsender
    prev_emails = await db.execute(
        select(EmailMessage.id, EmailMessage.subject, EmailMessage.received_at, EmailMessage.category)
        .where(
            EmailMessage.from_address == from_address,
            EmailMessage.account_id.in_(account_ids),
            EmailMessage.id != email_id,
        )
        .order_by(EmailMessage.received_at.desc())
        .limit(10)
    )
    emails = [
        {
            "id": str(e.id),
            "subject": e.subject,
            "received_at": e.received_at.isoformat() if e.received_at else None,
            "category": e.category,
        }
        for e in prev_emails.all()
    ]

    return {"customer": customer, "emails": emails, "action_items": []}


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

    # Onboarding-checklist
    from app.models.knowledge_base import KnowledgeBase

    has_mail_account = len(account_ids) > 0
    has_knowledge = bool((await db.execute(
        select(func.count()).where(KnowledgeBase.user_id == user.id)
    )).scalar())
    has_emails = week_total > 0
    has_subscription = user.plan != "free" if hasattr(user, "plan") else False

    onboarding = {
        "completed": all([has_mail_account, has_knowledge, has_emails]),
        "steps": [
            {"id": "mail_account", "label": "Forbind mailkonto",      "done": has_mail_account},
            {"id": "knowledge",    "label": "Tilføj videnbase",        "done": has_knowledge},
            {"id": "first_email",  "label": "Første email modtaget",   "done": has_emails},
            {"id": "subscription", "label": "Opgrader abonnement",     "done": has_subscription},
        ],
    }

    # Emails per kategori
    cat_result = await db.execute(
        select(EmailMessage.category, func.count().label("cnt"))
        .where(EmailMessage.account_id.in_(account_ids), EmailMessage.category.isnot(None))
        .group_by(EmailMessage.category)
    )
    by_category = {row.category: row.cnt for row in cat_result.all()}

    return {
        "user_name": user.name,
        "unread": unread,
        "high_priority": high_priority,
        "pending_suggestions": pending_sug,
        "week_total": week_total,
        "by_category": by_category,
        "onboarding": onboarding,
        "top_urgent": [
            {
                "id": str(e.id),
                "subject": e.subject or "(intet emne)",
                "from_address": e.from_address,
                "from_name": e.from_name,
                "urgency": e.urgency,
                "category": e.category,
                "ai_summary": e.ai_summary,
                "sentiment": e.sentiment,
                "received_at": e.received_at.isoformat() if e.received_at else None,
            }
            for e in top_emails
        ],
    }


@router.post("/{email_id}/generate-suggestion")
@limiter.limit("10/minute")
async def generate_suggestion(
    request: Request,
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


# ── Ejer-handlinger: slet, flyt, papirkurv ───────────────────────────────────
# Al sletning og flytning kræver eksplicit bruger-handling.
# AI initierer ALDRIG disse handlinger.

class TrashRequest(BaseModel):
    permanent: bool = False  # False = papirkurv (kan genoprettes). True KUN tilladt for emails i papirkurven.


class MoveRequest(BaseModel):
    folder_id: str  # Gmail label-id eller Outlook folder-id
    folder_name: str | None = None  # Til display i audit log


async def _get_email_and_account(email_id: UUID, user: User, db: AsyncSession):
    """Hent email og tilhørende mailkonto — verificer ejerskab."""
    account_ids = await _get_account_ids(user, db)
    result = await db.execute(
        select(EmailMessage)
        .where(EmailMessage.id == email_id, EmailMessage.account_id.in_(account_ids))
    )
    email = result.scalar_one_or_none()
    if not email:
        raise HTTPException(status_code=404, detail="Email ikke fundet")

    acc_result = await db.execute(
        select(MailAccount).where(MailAccount.id == email.account_id)
    )
    account = acc_result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Mailkonto ikke fundet")

    return email, account


async def _audit_log(db: AsyncSession, user_id, email_id, action: str, detail: str):
    """Gem handling i audit log — hvad ejeren gjorde og hvornår."""
    from sqlalchemy import text
    try:
        await db.execute(text("""
            CREATE TABLE IF NOT EXISTS email_audit_log (
                id SERIAL PRIMARY KEY,
                user_id UUID NOT NULL,
                email_id UUID,
                action VARCHAR(100) NOT NULL,
                detail TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        """))
        await db.execute(text("""
            INSERT INTO email_audit_log (user_id, email_id, action, detail)
            VALUES (:uid, :eid, :action, :detail)
        """), {"uid": user_id, "eid": email_id, "action": action, "detail": detail})
    except Exception as e:
        logger.warning("Audit log fejl (ikke kritisk): %s", e)


@router.post("/{email_id}/trash")
async def trash_email(
    email_id: UUID,
    data: TrashRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Flyt email til papirkurven (standard) eller slet permanent fra papirkurven.

    SIKKERHEDSREGEL: Permanent sletning er KUN tilladt for emails der allerede
    ligger i papirkurven (is_trashed=True). En email i indbakken kan aldrig
    permanent-slettes direkte — den skal i papirkurven først.

    Dette er en EJER-handling — AI initierer aldrig sletning.
    """
    email, account = await _get_email_and_account(email_id, user, db)

    # SIKKERHED: Bloker permanent sletning fra indbakken
    if data.permanent and not getattr(email, 'is_trashed', False):
        raise HTTPException(
            status_code=400,
            detail="Sikkerhedsspærre: Permanent sletning kræver at emailen først flyttes til papirkurven. "
                   "Kald /trash uden permanent=true først."
        )

    # Emails uden provider_id er kun lokale (seed-data etc.)
    if not email.provider_id or email.provider_id.startswith("msg_") or email.provider_id.startswith("compose-"):
        # Kun i Noras database — marker som slettet lokalt
        email.is_trashed = data.permanent  # permanent = slet-flag, ellers blot "trashed"
        if data.permanent:
            await db.delete(email)
        await db.commit()
        await _audit_log(db, user.id, email_id, "local_delete",
                         f"Slettet lokalt: {email.subject}")
        return {"deleted": True, "method": "local"}

    provider = account.provider  # "gmail" eller "outlook"
    success = False

    if data.permanent:
        # Permanent sletning — kun fra papirkurv
        if provider == "gmail":
            from app.services.mail_gmail import delete_message_permanent
            success = await delete_message_permanent(account, db, email.provider_id)
        else:
            from app.services.mail_outlook import delete_message_permanent
            success = await delete_message_permanent(account, db, email.provider_id)
        action = "permanent_delete"
        detail = f"Permanent slettet fra papirkurv ({provider}): {email.subject}"
    else:
        # Flyt til papirkurv (kan altid fortrydes i Gmail/Outlook)
        if provider == "gmail":
            from app.services.mail_gmail import trash_message
            success = await trash_message(account, db, email.provider_id)
        else:
            from app.services.mail_outlook import trash_message
            success = await trash_message(account, db, email.provider_id)
        action = "trash"
        detail = f"Sendt til papirkurv ({provider}): {email.subject}"

    if success:
        if data.permanent:
            await db.delete(email)
        else:
            email.is_trashed = True
        await db.commit()
        await _audit_log(db, user.id, email_id, action, detail)
        return {"deleted": data.permanent, "trashed": not data.permanent, "provider": provider}

    raise HTTPException(status_code=502, detail=f"Kunne ikke slette email via {provider} API")


@router.post("/{email_id}/move")
async def move_email(
    email_id: UUID,
    data: MoveRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Flyt email til en mappe/label. Ejeren valgte dette eksplicit.

    Gmail: brug label-id (INBOX, STARRED, eller bruger-label-id)
    Outlook: brug folder-id (inbox, drafts, deleteditems, eller bruger-mappe-id)
    """
    email, account = await _get_email_and_account(email_id, user, db)

    if not email.provider_id or email.provider_id.startswith("msg_") or email.provider_id.startswith("compose-"):
        raise HTTPException(status_code=400, detail="Denne email eksisterer kun lokalt og kan ikke flyttes via mail-API")

    provider = account.provider
    if provider == "gmail":
        from app.services.mail_gmail import move_message
        success = await move_message(account, db, email.provider_id, data.folder_id)
    else:
        from app.services.mail_outlook import move_message
        success = await move_message(account, db, email.provider_id, data.folder_id)

    if success:
        await _audit_log(
            db, user.id, email_id, "move",
            f"Flyttet til '{data.folder_name or data.folder_id}' ({provider}): {email.subject}"
        )
        return {"moved": True, "folder": data.folder_id, "provider": provider}

    raise HTTPException(status_code=502, detail=f"Kunne ikke flytte email via {provider} API")


@router.get("/audit-log")
async def get_audit_log(
    limit: int = Query(50, ge=1, le=200),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Hent audit log — hvad ejeren har gjort med emails."""
    from sqlalchemy import text
    try:
        result = await db.execute(text("""
            SELECT action, detail, created_at FROM email_audit_log
            WHERE user_id = :uid ORDER BY created_at DESC LIMIT :lim
        """), {"uid": user.id, "lim": limit})
        return [
            {"action": r.action, "detail": r.detail, "created_at": r.created_at.isoformat()}
            for r in result.fetchall()
        ]
    except Exception:
        return []


@router.get("/labels")
async def list_email_labels(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Hent tilgængelige mapper/labels fra brugerens mailkonti."""
    accounts_result = await db.execute(
        select(MailAccount).where(MailAccount.user_id == user.id, MailAccount.is_active == True)
    )
    accounts = accounts_result.scalars().all()

    all_labels = []
    for account in accounts:
        try:
            if account.provider == "gmail":
                from app.services.mail_gmail import list_labels
                labels = await list_labels(account, db)
            else:
                from app.services.mail_outlook import list_folders
                labels = await list_folders(account, db)
            for label in labels:
                label["account_id"] = str(account.id)
                label["provider"] = account.provider
            all_labels.extend(labels)
        except Exception as e:
            logger.warning("Kunne ikke hente labels for konto %s: %s", account.id, e)

    return all_labels
