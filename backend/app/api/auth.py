from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, UserResponse, UserUpdate, Token
from app.utils.auth import hash_password, verify_password, create_access_token, get_current_user

limiter = Limiter(key_func=get_remote_address)
router = APIRouter()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def register(request: Request, data: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=data.email,
        name=data.name,
        password_hash=hash_password(data.password),
        company_name=data.company_name,
        phone=data.phone,
        country=data.country,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/login", response_model=Token)
@limiter.limit("10/minute")
async def login(request: Request, data: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(user.id)
    return Token(access_token=token)


@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    return user


@router.patch("/me", response_model=UserResponse)
async def update_me(data: UserUpdate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    if data.name is not None:
        user.name = data.name
    if data.company_name is not None:
        user.company_name = data.company_name
    if data.phone is not None:
        user.phone = data.phone
    if data.country is not None:
        user.country = data.country
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/learn-style")
async def learn_writing_style(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Analyser brugerens sendte emails og lær AI'en om deres skrivestil.

    Henter de seneste 50 sendte emails, sender dem til Bedrock for analyse,
    og gemmer stil-profilen i Knowledge Base. Bruges til at gøre AI-svar
    mere personlige og konsistente med brugerens egne formuleringer.
    """
    import json
    from app.models.email_message import EmailMessage
    from app.models.mail_account import MailAccount
    from app.models.knowledge_base import KnowledgeBase
    from app.services.ai_engine import _call_bedrock_async

    # Hent brugerens mailkonti
    acc_result = await db.execute(
        select(MailAccount).where(MailAccount.user_id == user.id, MailAccount.is_active == True)
    )
    accounts = acc_result.scalars().all()
    account_ids = [a.id for a in accounts]

    if not account_ids:
        return {"status": "no_accounts", "message": "Ingen aktive mailkonti — forbind Gmail/Outlook først"}

    # Hent de seneste 50 udgående/sendte emails
    sent_result = await db.execute(
        select(EmailMessage)
        .where(
            EmailMessage.account_id.in_(account_ids),
            EmailMessage.is_outgoing == True,
        )
        .order_by(EmailMessage.received_at.desc())
        .limit(50)
    )
    sent_emails = sent_result.scalars().all()

    # Hent også godkendte AI-svar der er sendt (AiSuggestion.sent_at er sat)
    from app.models.ai_suggestion import AiSuggestion
    approved_result = await db.execute(
        select(AiSuggestion, EmailMessage)
        .join(EmailMessage, AiSuggestion.email_id == EmailMessage.id)
        .where(
            EmailMessage.account_id.in_(account_ids),
            AiSuggestion.sent_at.isnot(None),
        )
        .order_by(AiSuggestion.sent_at.desc())
        .limit(30)
    )
    approved_pairs = approved_result.all()

    # Byg eksempel-tekster
    examples = []
    for email in sent_emails:
        if email.body_text and len(email.body_text) > 30:
            examples.append(email.body_text[:400])
    for sug, _ in approved_pairs:
        text = sug.edited_text or sug.suggested_text
        if text and len(text) > 30:
            examples.append(text[:400])

    if len(examples) < 3:
        return {
            "status": "insufficient_data",
            "message": f"Kun {len(examples)} sendte emails fundet. Send mindst 3 emails for at Nora kan lære din stil.",
            "count": len(examples),
        }

    sample_text = "\n\n---\n\n".join(examples[:20])

    prompt = f"""Du er en skrivestils-analytiker. Analyser disse emails skrevet af {user.name or 'brugeren'} og beskriv deres karakteristiske skrivestil.

EMAILS:
{sample_text}

Returner KUN valid JSON:
{{
  "tone": "beskrivelse af tone (fx: professionel, venlig, direkte)",
  "greeting": "typisk hilsen (fx: 'Kære [navn],' eller 'Hej [navn],')",
  "signoff": "typisk afslutning (fx: 'Med venlig hilsen\\n[navn]')",
  "sentence_style": "sætningsstruktur (fx: korte og præcise / lange og uddybende)",
  "vocabulary": "ordvalg (fx: fagtermer / hverdagssprog / formelt)",
  "patterns": ["mønster 1", "mønster 2", "mønster 3"],
  "avoid": ["ting der IKKE passer til stilen"]
}}"""

    try:
        raw = await _call_bedrock_async(prompt, max_tokens=512)
        text = raw.strip()
        if text.startswith("```"):
            lines = [l for l in text.split("\n") if not l.strip().startswith("```")]
            text = "\n".join(lines).strip()
        style_data = json.loads(text)
    except Exception as exc:
        return {"status": "ai_error", "message": f"AI-analyse fejlede: {exc}"}

    # Byg læsbar stil-beskrivelse
    style_content = f"""Skrivestil for {user.name or 'brugeren'}:
Tone: {style_data.get('tone', '')}
Hilsen: {style_data.get('greeting', '')}
Afslutning: {style_data.get('signoff', '')}
Sætningsstil: {style_data.get('sentence_style', '')}
Ordvalg: {style_data.get('vocabulary', '')}
Mønstre: {', '.join(style_data.get('patterns', []))}
Undgå: {', '.join(style_data.get('avoid', []))}"""

    # Gem/opdater i Knowledge Base som "style" entry
    existing = await db.execute(
        select(KnowledgeBase).where(
            KnowledgeBase.user_id == user.id,
            KnowledgeBase.entry_type == "style",
        )
    )
    kb_entry = existing.scalar_one_or_none()

    if kb_entry:
        kb_entry.title = "Skrivestil (auto-lært)"
        kb_entry.content = style_content
    else:
        kb_entry = KnowledgeBase(
            user_id=user.id,
            title="Skrivestil (auto-lært)",
            content=style_content,
            entry_type="style",
        )
        db.add(kb_entry)

    await db.commit()

    return {
        "status": "ok",
        "emails_analyzed": len(examples),
        "style": style_data,
        "message": f"Nora har lært din skrivestil fra {len(examples)} emails og vil nu bruge den i fremtidige svar.",
    }
