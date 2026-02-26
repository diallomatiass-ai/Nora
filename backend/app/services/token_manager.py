from datetime import datetime, timezone

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.mail_account import MailAccount
from app.models.calendar_account import CalendarAccount
from app.utils.encryption import encrypt_token, decrypt_token


async def refresh_gmail_token(account: MailAccount, db: AsyncSession) -> str:
    refresh_token = decrypt_token(account.encrypted_refresh_token)
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": settings.gmail_client_id,
                "client_secret": settings.gmail_client_secret,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            },
        )
        resp.raise_for_status()
        data = resp.json()

    account.encrypted_access_token = encrypt_token(data["access_token"])
    if "refresh_token" in data:
        account.encrypted_refresh_token = encrypt_token(data["refresh_token"])
    account.token_expires_at = datetime.fromtimestamp(
        datetime.now(timezone.utc).timestamp() + data.get("expires_in", 3600),
        tz=timezone.utc,
    )
    await db.commit()
    return data["access_token"]


async def refresh_outlook_token(account: MailAccount, db: AsyncSession) -> str:
    refresh_token = decrypt_token(account.encrypted_refresh_token)
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://login.microsoftonline.com/{settings.outlook_tenant_id}/oauth2/v2.0/token",
            data={
                "client_id": settings.outlook_client_id,
                "client_secret": settings.outlook_client_secret,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
                "scope": "https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send offline_access",
            },
        )
        resp.raise_for_status()
        data = resp.json()

    account.encrypted_access_token = encrypt_token(data["access_token"])
    account.encrypted_refresh_token = encrypt_token(data["refresh_token"])
    account.token_expires_at = datetime.fromtimestamp(
        datetime.now(timezone.utc).timestamp() + data.get("expires_in", 3600),
        tz=timezone.utc,
    )
    await db.commit()
    return data["access_token"]


async def get_valid_token(account: MailAccount, db: AsyncSession) -> str:
    now = datetime.now(timezone.utc)
    if account.token_expires_at and account.token_expires_at > now:
        return decrypt_token(account.encrypted_access_token)

    if account.provider == "gmail":
        return await refresh_gmail_token(account, db)
    elif account.provider == "outlook":
        return await refresh_outlook_token(account, db)
    raise ValueError(f"Unknown provider: {account.provider}")


# ── Calendar Token Management ─────────────────────────────────────────


async def refresh_google_calendar_token(account: CalendarAccount, db: AsyncSession) -> str:
    refresh_token = decrypt_token(account.encrypted_refresh_token)
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": settings.gmail_client_id,
                "client_secret": settings.gmail_client_secret,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            },
        )
        resp.raise_for_status()
        data = resp.json()

    account.encrypted_access_token = encrypt_token(data["access_token"])
    if "refresh_token" in data:
        account.encrypted_refresh_token = encrypt_token(data["refresh_token"])
    account.token_expires_at = datetime.fromtimestamp(
        datetime.now(timezone.utc).timestamp() + data.get("expires_in", 3600),
        tz=timezone.utc,
    )
    await db.commit()
    return data["access_token"]


async def refresh_microsoft_calendar_token(account: CalendarAccount, db: AsyncSession) -> str:
    refresh_token = decrypt_token(account.encrypted_refresh_token)
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://login.microsoftonline.com/{settings.outlook_tenant_id}/oauth2/v2.0/token",
            data={
                "client_id": settings.outlook_client_id,
                "client_secret": settings.outlook_client_secret,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
                "scope": "https://graph.microsoft.com/Calendars.ReadWrite offline_access",
            },
        )
        resp.raise_for_status()
        data = resp.json()

    account.encrypted_access_token = encrypt_token(data["access_token"])
    account.encrypted_refresh_token = encrypt_token(data["refresh_token"])
    account.token_expires_at = datetime.fromtimestamp(
        datetime.now(timezone.utc).timestamp() + data.get("expires_in", 3600),
        tz=timezone.utc,
    )
    await db.commit()
    return data["access_token"]


async def get_valid_calendar_token(account: CalendarAccount, db: AsyncSession) -> str:
    now = datetime.now(timezone.utc)
    if account.token_expires_at and account.token_expires_at > now:
        return decrypt_token(account.encrypted_access_token)

    if account.provider == "google":
        return await refresh_google_calendar_token(account, db)
    elif account.provider == "microsoft":
        return await refresh_microsoft_calendar_token(account, db)
    raise ValueError(f"Unknown calendar provider: {account.provider}")
