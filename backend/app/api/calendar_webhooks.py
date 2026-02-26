"""
Calendar OAuth2 endpoints — Google Calendar & Microsoft Calendar.

Følger nøjagtigt samme pattern som webhooks.py (Gmail/Outlook mail connect).
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.models.calendar_account import CalendarAccount
from app.utils.auth import get_current_user
from app.utils.encryption import encrypt_token

router = APIRouter()


def _get_base_url(request: Request) -> str:
    proto = request.headers.get("x-forwarded-proto", "http")
    host = request.headers.get("x-forwarded-host") or request.headers.get("host", "localhost")
    return f"{proto}://{host}"


# ── Schemas ────────────────────────────────────────────────────────────

class CalendarAccountResponse(BaseModel):
    id: UUID
    provider: str
    calendar_email: str
    is_active: bool

    model_config = {"from_attributes": True}


# ── Google Calendar ────────────────────────────────────────────────────

@router.get("/google/connect")
async def google_calendar_connect(request: Request, user: User = Depends(get_current_user)):
    """Return Google Calendar OAuth2 authorization URL."""
    base = _get_base_url(request)
    redirect_uri = settings.google_calendar_redirect_uri or f"{base}/api/calendar/google/callback"

    scopes = (
        "https://www.googleapis.com/auth/calendar.events "
        "https://www.googleapis.com/auth/calendar.readonly"
    )
    url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={settings.gmail_client_id}&"
        f"redirect_uri={redirect_uri}&"
        f"response_type=code&"
        f"scope={scopes}&"
        f"access_type=offline&"
        f"prompt=consent&"
        f"state={user.id}"
    )
    return {"auth_url": url}


@router.get("/google/callback")
async def google_calendar_callback(
    code: str, state: str, request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Handle Google Calendar OAuth2 callback."""
    import httpx
    from datetime import datetime, timezone

    base = _get_base_url(request)
    redirect_uri = settings.google_calendar_redirect_uri or f"{base}/api/calendar/google/callback"

    # Exchange code for tokens
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": settings.gmail_client_id,
                "client_secret": settings.gmail_client_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": redirect_uri,
            },
        )
        if resp.status_code != 200:
            return RedirectResponse(f"{base}/settings?error=google_calendar_token_failed")
        tokens = resp.json()

    # Get calendar email from Google userinfo
    async with httpx.AsyncClient() as client:
        profile_resp = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
        profile = profile_resp.json()

    user_id = state
    calendar_email = profile.get("email", "")
    expires_at = datetime.fromtimestamp(
        datetime.now(timezone.utc).timestamp() + tokens.get("expires_in", 3600),
        tz=timezone.utc,
    )

    # Upsert calendar account
    existing = await db.execute(
        select(CalendarAccount).where(
            CalendarAccount.user_id == UUID(user_id),
            CalendarAccount.provider == "google",
            CalendarAccount.calendar_email == calendar_email,
        )
    )
    account = existing.scalar_one_or_none()

    if account:
        account.encrypted_access_token = encrypt_token(tokens["access_token"])
        account.encrypted_refresh_token = encrypt_token(tokens.get("refresh_token", ""))
        account.token_expires_at = expires_at
        account.is_active = True
    else:
        account = CalendarAccount(
            user_id=user_id,
            provider="google",
            calendar_email=calendar_email,
            encrypted_access_token=encrypt_token(tokens["access_token"]),
            encrypted_refresh_token=encrypt_token(tokens.get("refresh_token", "")),
            token_expires_at=expires_at,
        )
        db.add(account)

    await db.commit()
    return RedirectResponse(f"{base}/settings?connected=google_calendar")


# ── Microsoft Calendar ─────────────────────────────────────────────────

@router.get("/microsoft/connect")
async def microsoft_calendar_connect(request: Request, user: User = Depends(get_current_user)):
    """Return Microsoft Calendar OAuth2 authorization URL."""
    base = _get_base_url(request)
    redirect_uri = settings.microsoft_calendar_redirect_uri or f"{base}/api/calendar/microsoft/callback"

    scopes = "https://graph.microsoft.com/Calendars.ReadWrite offline_access"
    url = (
        f"https://login.microsoftonline.com/{settings.outlook_tenant_id}/oauth2/v2.0/authorize?"
        f"client_id={settings.outlook_client_id}&"
        f"redirect_uri={redirect_uri}&"
        f"response_type=code&"
        f"scope={scopes}&"
        f"state={user.id}"
    )
    return {"auth_url": url}


@router.get("/microsoft/callback")
async def microsoft_calendar_callback(
    code: str, state: str, request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Handle Microsoft Calendar OAuth2 callback."""
    import httpx
    from datetime import datetime, timezone

    base = _get_base_url(request)
    redirect_uri = settings.microsoft_calendar_redirect_uri or f"{base}/api/calendar/microsoft/callback"

    # Exchange code for tokens
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://login.microsoftonline.com/{settings.outlook_tenant_id}/oauth2/v2.0/token",
            data={
                "client_id": settings.outlook_client_id,
                "client_secret": settings.outlook_client_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": redirect_uri,
                "scope": "https://graph.microsoft.com/Calendars.ReadWrite offline_access",
            },
        )
        if resp.status_code != 200:
            return RedirectResponse(f"{base}/settings?error=microsoft_calendar_token_failed")
        tokens = resp.json()

    # Get user email from Graph
    async with httpx.AsyncClient() as client:
        me_resp = await client.get(
            "https://graph.microsoft.com/v1.0/me",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
        me = me_resp.json()

    user_id = state
    calendar_email = me.get("mail") or me.get("userPrincipalName", "")
    expires_at = datetime.fromtimestamp(
        datetime.now(timezone.utc).timestamp() + tokens.get("expires_in", 3600),
        tz=timezone.utc,
    )

    # Upsert calendar account
    existing = await db.execute(
        select(CalendarAccount).where(
            CalendarAccount.user_id == UUID(user_id),
            CalendarAccount.provider == "microsoft",
            CalendarAccount.calendar_email == calendar_email,
        )
    )
    account = existing.scalar_one_or_none()

    if account:
        account.encrypted_access_token = encrypt_token(tokens["access_token"])
        account.encrypted_refresh_token = encrypt_token(tokens["refresh_token"])
        account.token_expires_at = expires_at
        account.is_active = True
    else:
        account = CalendarAccount(
            user_id=user_id,
            provider="microsoft",
            calendar_email=calendar_email,
            encrypted_access_token=encrypt_token(tokens["access_token"]),
            encrypted_refresh_token=encrypt_token(tokens["refresh_token"]),
            token_expires_at=expires_at,
        )
        db.add(account)

    await db.commit()
    return RedirectResponse(f"{base}/settings?connected=microsoft_calendar")


# ── Konti-håndtering ───────────────────────────────────────────────────

@router.get("/accounts", response_model=list[CalendarAccountResponse])
async def list_calendar_accounts(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List brugerens kalenderkonto(er)."""
    result = await db.execute(
        select(CalendarAccount).where(CalendarAccount.user_id == user.id)
    )
    return result.scalars().all()


@router.delete("/accounts/{account_id}", status_code=204)
async def disconnect_calendar_account(
    account_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fjern en kalenderkonto."""
    result = await db.execute(
        select(CalendarAccount).where(
            CalendarAccount.id == UUID(account_id),
            CalendarAccount.user_id == user.id,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Calendar account not found")

    await db.delete(account)
    await db.commit()
