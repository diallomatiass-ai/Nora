import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, UserResponse, UserUpdate, Token
from app.utils.auth import hash_password, verify_password, create_access_token, get_current_user
from app.services.email_service import send_verification_email, send_password_reset_email

limiter = Limiter(key_func=get_remote_address)
router = APIRouter()


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    password: str


class TwoFAVerifyRequest(BaseModel):
    code: str


class TwoFALoginRequest(BaseModel):
    temp_token: str
    code: str


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def register(request: Request, data: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    verify_token = secrets.token_urlsafe(32)
    user = User(
        email=data.email,
        name=data.name,
        password_hash=hash_password(data.password),
        company_name=data.company_name,
        phone=data.phone,
        country=data.country,
        email_verified=False,
        email_verify_token=verify_token,
        email_verify_expires=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    await send_verification_email(user.email, user.name, verify_token)
    return user


@router.post("/login")
@limiter.limit("10/minute")
async def login(request: Request, data: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.email_verified:
        raise HTTPException(status_code=403, detail="EMAIL_NOT_VERIFIED")

    # Hvis 2FA er aktiveret — returnér temp token
    if user.two_fa_enabled:
        temp = create_access_token(user.id, expires_minutes=5, scope="2fa")
        return {"requires_2fa": True, "temp_token": temp}

    token = create_access_token(user.id)
    return Token(access_token=token)


@router.post("/2fa/login", response_model=Token)
@limiter.limit("10/minute")
async def login_2fa(request: Request, data: TwoFALoginRequest, db: AsyncSession = Depends(get_db)):
    """Fuldfør login med TOTP-kode når 2FA er aktiveret."""
    from app.utils.auth import decode_token
    payload = decode_token(data.temp_token, scope="2fa")
    if not payload:
        raise HTTPException(status_code=401, detail="Ugyldigt eller udløbet 2FA-token")

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.two_fa_enabled or not user.two_fa_secret:
        raise HTTPException(status_code=401, detail="2FA ikke aktiveret")

    import pyotp
    totp = pyotp.TOTP(user.two_fa_secret)
    if not totp.verify(data.code, valid_window=1):
        raise HTTPException(status_code=401, detail="Forkert 2FA-kode")

    token = create_access_token(user.id)
    return Token(access_token=token)


@router.get("/verify-email")
async def verify_email(token: str, db: AsyncSession = Depends(get_db)):
    """Bekræft email via token fra email-link."""
    result = await db.execute(select(User).where(User.email_verify_token == token))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=400, detail="Ugyldigt verificerings-token")
    if user.email_verified:
        return {"status": "already_verified"}
    if user.email_verify_expires and user.email_verify_expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="TOKEN_EXPIRED")

    user.email_verified = True
    user.email_verify_token = None
    user.email_verify_expires = None
    await db.commit()
    return {"status": "verified"}


@router.post("/resend-verify")
@limiter.limit("3/minute")
async def resend_verify(request: Request, data: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Gensend verificerings-email."""
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    if not user or user.email_verified:
        # Returner altid OK — afslører ikke om email eksisterer
        return {"status": "sent"}

    token = secrets.token_urlsafe(32)
    user.email_verify_token = token
    user.email_verify_expires = datetime.now(timezone.utc) + timedelta(hours=24)
    await db.commit()
    await send_verification_email(user.email, user.name, token)
    return {"status": "sent"}


@router.post("/forgot-password")
@limiter.limit("3/minute")
async def forgot_password(request: Request, data: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Send password-reset email."""
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    # Returner altid OK — afslører ikke om email eksisterer
    if user:
        token = secrets.token_urlsafe(32)
        user.password_reset_token = token
        user.password_reset_expires = datetime.now(timezone.utc) + timedelta(hours=1)
        await db.commit()
        await send_password_reset_email(user.email, user.name, token)
    return {"status": "sent"}


@router.post("/reset-password")
@limiter.limit("5/minute")
async def reset_password(request: Request, data: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Nulstil adgangskode via reset-token."""
    result = await db.execute(select(User).where(User.password_reset_token == data.token))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=400, detail="Ugyldigt token")
    if user.password_reset_expires and user.password_reset_expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="TOKEN_EXPIRED")
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Adgangskoden skal være mindst 6 tegn")

    user.password_hash = hash_password(data.password)
    user.password_reset_token = None
    user.password_reset_expires = None
    await db.commit()
    return {"status": "reset"}


@router.post("/2fa/setup")
async def setup_2fa(user: User = Depends(get_current_user)):
    """Generer TOTP-hemmelighed og QR-kode til 2FA-opsætning."""
    import pyotp, qrcode, io, base64
    if user.two_fa_enabled:
        raise HTTPException(status_code=400, detail="2FA er allerede aktiveret")

    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(name=user.email, issuer_name="Nora")

    img = qrcode.make(uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    qr_b64 = base64.b64encode(buf.getvalue()).decode()

    return {"secret": secret, "qr_code": f"data:image/png;base64,{qr_b64}"}


@router.post("/2fa/enable")
async def enable_2fa(
    data: TwoFAVerifyRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Bekræft TOTP-kode og aktiver 2FA."""
    import pyotp
    # Secret sendes i request body under setup (ikke gemt endnu)
    raise HTTPException(status_code=400, detail="Send secret + code")


@router.post("/2fa/enable-confirm")
async def enable_2fa_confirm(
    data: dict,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Gem secret og aktiver 2FA efter bekræftet TOTP-kode."""
    import pyotp
    secret = data.get("secret", "")
    code = data.get("code", "")
    if not secret or not code:
        raise HTTPException(status_code=400, detail="secret og code er påkrævet")

    totp = pyotp.TOTP(secret)
    if not totp.verify(code, valid_window=1):
        raise HTTPException(status_code=400, detail="Forkert kode — prøv igen")

    user.two_fa_secret = secret
    user.two_fa_enabled = True
    await db.commit()
    return {"status": "enabled"}


@router.post("/2fa/disable")
async def disable_2fa(
    data: TwoFAVerifyRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Deaktiver 2FA efter bekræftelse af kode."""
    import pyotp
    if not user.two_fa_enabled or not user.two_fa_secret:
        raise HTTPException(status_code=400, detail="2FA er ikke aktiveret")

    totp = pyotp.TOTP(user.two_fa_secret)
    if not totp.verify(data.code, valid_window=1):
        raise HTTPException(status_code=401, detail="Forkert kode")

    user.two_fa_enabled = False
    user.two_fa_secret = None
    await db.commit()
    return {"status": "disabled"}


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
