"""Gmail API client using raw REST API via httpx."""

import base64
import logging
import re
from datetime import datetime, timezone
from email.mime.text import MIMEText
from email.utils import parseaddr, parsedate_to_datetime

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.mail_account import MailAccount
from app.services.token_manager import get_valid_token

logger = logging.getLogger(__name__)

GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me"


def _get_header(headers: list[dict], name: str) -> str:
    """Extract a header value by name from Gmail API headers list."""
    for h in headers:
        if h.get("name", "").lower() == name.lower():
            return h.get("value", "")
    return ""


def _parse_from(raw: str) -> tuple[str, str]:
    """Parse 'Display Name <email>' into (name, address)."""
    name, addr = parseaddr(raw)
    return name or "", addr or raw


def _decode_body(data: str) -> str:
    """Decode Gmail base64url-encoded body data."""
    if not data:
        return ""
    # Gmail uses URL-safe base64 without padding
    padded = data + "=" * (4 - len(data) % 4)
    try:
        return base64.urlsafe_b64decode(padded).decode("utf-8", errors="replace")
    except Exception:
        return ""


def _extract_body(payload: dict) -> tuple[str, str]:
    """
    Walk the MIME tree and extract text/plain and text/html bodies.
    Returns (body_text, body_html).
    """
    text_body = ""
    html_body = ""

    mime_type = payload.get("mimeType", "")
    body_data = payload.get("body", {}).get("data", "")

    if mime_type == "text/plain" and body_data:
        text_body = _decode_body(body_data)
    elif mime_type == "text/html" and body_data:
        html_body = _decode_body(body_data)

    # Recurse into parts (multipart messages)
    for part in payload.get("parts", []):
        part_text, part_html = _extract_body(part)
        if part_text and not text_body:
            text_body = part_text
        if part_html and not html_body:
            html_body = part_html

    return text_body, html_body


def _parse_received_at(date_str: str) -> datetime | None:
    """Parse an RFC 2822 date string into a timezone-aware datetime."""
    if not date_str:
        return None
    try:
        dt = parsedate_to_datetime(date_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


def _parse_message(raw: dict) -> dict:
    """Parse a Gmail API message resource into a flat dict."""
    payload = raw.get("payload", {})
    headers = payload.get("headers", [])

    from_raw = _get_header(headers, "From")
    from_name, from_address = _parse_from(from_raw)
    to_raw = _get_header(headers, "To")
    _, to_address = _parse_from(to_raw)
    subject = _get_header(headers, "Subject")
    date_str = _get_header(headers, "Date")

    body_text, body_html = _extract_body(payload)

    return {
        "provider_id": raw["id"],
        "thread_id": raw.get("threadId"),
        "from_address": from_address,
        "from_name": from_name,
        "to_address": to_address or "",
        "subject": subject,
        "body_text": body_text,
        "body_html": body_html,
        "received_at": _parse_received_at(date_str),
    }


async def fetch_messages(
    account: MailAccount, db: AsyncSession
) -> list[dict]:
    """
    Fetch new messages from Gmail since the last sync cursor.

    The sync_cursor stores the latest historyId. On the first sync (no cursor),
    we fetch the most recent 50 messages. On subsequent syncs we use the
    history.list endpoint to get only new message IDs, then fetch each.

    Returns a list of parsed message dicts.
    """
    token = await get_valid_token(account, db)
    headers = {"Authorization": f"Bearer {token}"}
    results: list[dict] = []

    async with httpx.AsyncClient(timeout=30.0) as client:

        if account.sync_cursor:
            # ----- Incremental sync via history ----- #
            message_ids: list[str] = []
            next_page: str | None = None

            while True:
                params: dict = {
                    "startHistoryId": account.sync_cursor,
                    "historyTypes": "messageAdded",
                }
                if next_page:
                    params["pageToken"] = next_page

                resp = await client.get(
                    f"{GMAIL_API}/history", headers=headers, params=params
                )
                if resp.status_code == 404:
                    # historyId expired — fall back to full sync
                    account.sync_cursor = None
                    return await fetch_messages(account, db)
                resp.raise_for_status()
                data = resp.json()

                for record in data.get("history", []):
                    for added in record.get("messagesAdded", []):
                        msg_id = added.get("message", {}).get("id")
                        if msg_id and msg_id not in message_ids:
                            message_ids.append(msg_id)

                next_page = data.get("nextPageToken")
                if not next_page:
                    # Update cursor to the latest historyId
                    new_history_id = data.get("historyId")
                    if new_history_id:
                        account.sync_cursor = str(new_history_id)
                    break

            # Fetch full message details for each new ID
            for msg_id in message_ids:
                resp = await client.get(
                    f"{GMAIL_API}/messages/{msg_id}",
                    headers=headers,
                    params={"format": "full"},
                )
                if resp.status_code == 404:
                    continue  # message deleted between list and get
                resp.raise_for_status()
                results.append(_parse_message(resp.json()))

        else:
            # ----- Initial full sync — most recent 50 ----- #
            resp = await client.get(
                f"{GMAIL_API}/messages",
                headers=headers,
                params={"maxResults": 50, "labelIds": "INBOX"},
            )
            resp.raise_for_status()
            listing = resp.json()
            message_stubs = listing.get("messages", [])

            for stub in message_stubs:
                msg_id = stub["id"]
                resp = await client.get(
                    f"{GMAIL_API}/messages/{msg_id}",
                    headers=headers,
                    params={"format": "full"},
                )
                if resp.status_code == 404:
                    continue
                resp.raise_for_status()
                msg_data = resp.json()
                results.append(_parse_message(msg_data))

            # Set cursor to the profile's current historyId
            profile_resp = await client.get(
                f"{GMAIL_API}/profile", headers=headers
            )
            profile_resp.raise_for_status()
            account.sync_cursor = str(profile_resp.json().get("historyId", ""))

    await db.commit()
    logger.info(
        "Gmail fetch complete for %s — %d new messages",
        account.email_address,
        len(results),
    )
    return results


async def send_reply(
    account: MailAccount,
    db: AsyncSession,
    to: str,
    subject: str,
    body: str,
    thread_id: str | None = None,
) -> bool:
    """
    Send an email (or reply) via the Gmail API.

    If thread_id is provided, the message is threaded as a reply and the
    subject is prefixed with 'Re: ' if it isn't already.
    """
    token = await get_valid_token(account, db)

    # Build MIME message
    if thread_id and not subject.lower().startswith("re:"):
        subject = f"Re: {subject}"

    mime = MIMEText(body, "plain", "utf-8")
    mime["To"] = to
    mime["From"] = account.email_address
    mime["Subject"] = subject

    raw_bytes = base64.urlsafe_b64encode(mime.as_bytes()).decode("ascii")

    payload: dict = {"raw": raw_bytes}
    if thread_id:
        payload["threadId"] = thread_id

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{GMAIL_API}/messages/send",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        if resp.is_success:
            logger.info("Gmail: sent message to %s", to)
            return True

        logger.error(
            "Gmail send failed (%d): %s", resp.status_code, resp.text
        )
        return False


async def trash_message(account: MailAccount, db: AsyncSession, message_id: str) -> bool:
    """Flyt email til papirkurven (kan genoprettes). Ejeren valgte dette eksplicit."""
    token = await get_valid_token(account, db)
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"{GMAIL_API}/messages/{message_id}/trash",
            headers={"Authorization": f"Bearer {token}"},
        )
        if resp.is_success:
            logger.info("Gmail: message %s moved to trash by user", message_id)
            return True
        logger.error("Gmail trash failed (%d): %s", resp.status_code, resp.text)
        return False


async def delete_message_permanent(account: MailAccount, db: AsyncSession, message_id: str) -> bool:
    """Slet email permanent (kan IKKE genoprettes). Ejeren valgte dette eksplicit efter bekræftelse."""
    token = await get_valid_token(account, db)
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.delete(
            f"{GMAIL_API}/messages/{message_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        if resp.is_success or resp.status_code == 204:
            logger.info("Gmail: message %s permanently deleted by user", message_id)
            return True
        logger.error("Gmail delete failed (%d): %s", resp.status_code, resp.text)
        return False


async def move_message(account: MailAccount, db: AsyncSession, message_id: str, label_id: str) -> bool:
    """Flyt email til en Gmail-mappe (label). Ejeren valgte dette eksplicit.

    Almindelige label_ids: INBOX, SPAM, TRASH, STARRED, UNREAD, SENT,
    eller en bruger-defineret label-id fra Gmail.
    """
    token = await get_valid_token(account, db)
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"{GMAIL_API}/messages/{message_id}/modify",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={"addLabelIds": [label_id], "removeLabelIds": ["INBOX"]},
        )
        if resp.is_success:
            logger.info("Gmail: message %s moved to label %s by user", message_id, label_id)
            return True
        logger.error("Gmail move failed (%d): %s", resp.status_code, resp.text)
        return False


async def apply_nora_label(account: MailAccount, db: AsyncSession, message_id: str, category: str) -> str | None:
    """Opret og/eller anvend Nora-kategori-label i Gmail (opt-in).

    Returnerer label_id hvis succesfuldt, None ved fejl.
    Opretter labelet 'Nora/{category}' hvis det ikke eksisterer.
    """
    token = await get_valid_token(account, db)
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    label_name = f"Nora/{category.capitalize()}"

    async with httpx.AsyncClient(timeout=15.0) as client:
        # Hent eksisterende labels
        resp = await client.get(
            f"{GMAIL_API}/labels",
            headers={"Authorization": f"Bearer {token}"},
        )
        if not resp.is_success:
            return None

        existing = resp.json().get("labels", [])
        label_id = next((l["id"] for l in existing if l.get("name") == label_name), None)

        # Opret label hvis det ikke findes
        if not label_id:
            create_resp = await client.post(
                f"{GMAIL_API}/labels",
                headers=headers,
                json={
                    "name": label_name,
                    "labelListVisibility": "labelShow",
                    "messageListVisibility": "show",
                },
            )
            if not create_resp.is_success:
                return None
            label_id = create_resp.json().get("id")

        if not label_id:
            return None

        # Anvend label på beskeden
        mod_resp = await client.post(
            f"{GMAIL_API}/messages/{message_id}/modify",
            headers=headers,
            json={"addLabelIds": [label_id]},
        )
        if mod_resp.is_success:
            logger.info("Gmail: Nora-label '%s' sat på besked %s", label_name, message_id)
            return label_id
        return None


async def list_labels(account: MailAccount, db: AsyncSession) -> list[dict]:
    """Hent brugerens Gmail-labels (mapper) til brug i move-dialog."""
    token = await get_valid_token(account, db)
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            f"{GMAIL_API}/labels",
            headers={"Authorization": f"Bearer {token}"},
        )
        if resp.is_success:
            labels = resp.json().get("labels", [])
            return [
                {"id": l["id"], "name": l["name"], "type": l.get("type", "user")}
                for l in labels
                if l.get("type") == "user" or l["id"] in ("INBOX", "STARRED", "SENT", "TRASH", "SPAM")
            ]
        return []
