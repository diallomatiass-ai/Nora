"""Microsoft Graph API mail client using httpx."""

import logging
from datetime import datetime, timezone

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.mail_account import MailAccount
from app.services.token_manager import get_valid_token

logger = logging.getLogger(__name__)

GRAPH_API = "https://graph.microsoft.com/v1.0"


def _parse_message(raw: dict) -> dict:
    """Parse a Microsoft Graph message resource into a flat dict."""
    from_obj = raw.get("from", {}).get("emailAddress", {})
    # To can have multiple recipients; take the first for the to_address field
    to_recipients = raw.get("toRecipients", [])
    to_addr = ""
    if to_recipients:
        to_addr = to_recipients[0].get("emailAddress", {}).get("address", "")

    # Parse received datetime — Graph returns ISO 8601 with trailing Z
    received_str = raw.get("receivedDateTime", "")
    received_at: datetime | None = None
    if received_str:
        try:
            received_at = datetime.fromisoformat(
                received_str.replace("Z", "+00:00")
            )
        except (ValueError, TypeError):
            received_at = None

    body = raw.get("body", {})
    content_type = body.get("contentType", "").lower()
    content = body.get("content", "")

    body_text = content if content_type == "text" else ""
    body_html = content if content_type == "html" else ""

    return {
        "provider_id": raw["id"],
        "thread_id": raw.get("conversationId"),
        "from_address": from_obj.get("address", ""),
        "from_name": from_obj.get("name", ""),
        "to_address": to_addr,
        "subject": raw.get("subject", ""),
        "body_text": body_text,
        "body_html": body_html,
        "received_at": received_at,
    }


async def fetch_messages(
    account: MailAccount, db: AsyncSession
) -> list[dict]:
    """
    Fetch new messages from Outlook/Graph API.

    The sync_cursor stores an ISO 8601 timestamp of the most recent message's
    receivedDateTime. On subsequent syncs we filter for messages received after
    that timestamp.  On the first sync we fetch the most recent 50 messages.

    Returns a list of parsed message dicts.
    """
    token = await get_valid_token(account, db)
    headers = {"Authorization": f"Bearer {token}"}
    results: list[dict] = []

    # We request both text and html bodies by preferring text, but Graph
    # always returns one contentType — we ask for both via $select.
    select_fields = (
        "id,conversationId,from,toRecipients,subject,body,"
        "receivedDateTime,isRead"
    )

    async with httpx.AsyncClient(timeout=30.0) as client:

        params: dict = {
            "$select": select_fields,
            "$orderby": "receivedDateTime desc",
            "$top": 50,
        }

        if account.sync_cursor:
            # Incremental: only messages newer than cursor
            params["$filter"] = (
                f"receivedDateTime gt {account.sync_cursor}"
            )
            params["$orderby"] = "receivedDateTime asc"

        url: str = f"{GRAPH_API}/me/messages"
        latest_dt: str | None = None

        while url:
            resp = await client.get(url, headers=headers, params=params)
            resp.raise_for_status()
            data = resp.json()

            for msg in data.get("value", []):
                parsed = _parse_message(msg)
                results.append(parsed)

                # Track the latest receivedDateTime for cursor update
                msg_dt = msg.get("receivedDateTime", "")
                if msg_dt and (latest_dt is None or msg_dt > latest_dt):
                    latest_dt = msg_dt

            # Follow @odata.nextLink for pagination
            url = data.get("@odata.nextLink", "")
            # Clear params on subsequent pages — nextLink contains them
            params = {}

        # Update sync cursor to the latest message timestamp
        if latest_dt:
            account.sync_cursor = latest_dt
        elif not account.sync_cursor and results:
            # First sync — set cursor to now so next sync only gets new mail
            account.sync_cursor = datetime.now(timezone.utc).isoformat()

    await db.commit()
    logger.info(
        "Outlook fetch complete for %s — %d new messages",
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
    Send an email via Microsoft Graph API /me/sendMail.

    If thread_id (conversationId) is provided, the subject is prefixed with
    'Re: ' to keep it in the same conversation thread.
    """
    token = await get_valid_token(account, db)

    if thread_id and not subject.lower().startswith("re:"):
        subject = f"Re: {subject}"

    payload = {
        "message": {
            "subject": subject,
            "body": {
                "contentType": "Text",
                "content": body,
            },
            "toRecipients": [
                {"emailAddress": {"address": to}}
            ],
        },
        "saveToSentItems": True,
    }

    # Include conversationId to thread the reply
    if thread_id:
        payload["message"]["conversationId"] = thread_id

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{GRAPH_API}/me/sendMail",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        if resp.is_success:
            logger.info("Outlook: sent message to %s", to)
            return True

        logger.error(
            "Outlook send failed (%d): %s", resp.status_code, resp.text
        )
        return False


async def trash_message(account: MailAccount, db: AsyncSession, message_id: str) -> bool:
    """Flyt email til Outlook Deleted Items. Ejeren valgte dette eksplicit."""
    token = await get_valid_token(account, db)
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"{GRAPH_API}/me/messages/{message_id}/move",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={"destinationId": "deleteditems"},
        )
        if resp.is_success:
            logger.info("Outlook: message %s moved to deleted items by user", message_id)
            return True
        logger.error("Outlook trash failed (%d): %s", resp.status_code, resp.text)
        return False


async def delete_message_permanent(account: MailAccount, db: AsyncSession, message_id: str) -> bool:
    """Slet email permanent via Outlook. Ejeren valgte dette eksplicit efter bekræftelse."""
    token = await get_valid_token(account, db)
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.delete(
            f"{GRAPH_API}/me/messages/{message_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        if resp.is_success or resp.status_code == 204:
            logger.info("Outlook: message %s permanently deleted by user", message_id)
            return True
        logger.error("Outlook delete failed (%d): %s", resp.status_code, resp.text)
        return False


async def move_message(account: MailAccount, db: AsyncSession, message_id: str, folder_id: str) -> bool:
    """Flyt email til en specifik Outlook-mappe. Ejeren valgte dette eksplicit.

    Kendte folder_ids: inbox, drafts, sentitems, deleteditems, junkemail,
    eller et bruger-defineret mappe-id fra Outlook.
    """
    token = await get_valid_token(account, db)
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"{GRAPH_API}/me/messages/{message_id}/move",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={"destinationId": folder_id},
        )
        if resp.is_success:
            logger.info("Outlook: message %s moved to %s by user", message_id, folder_id)
            return True
        logger.error("Outlook move failed (%d): %s", resp.status_code, resp.text)
        return False


async def list_folders(account: MailAccount, db: AsyncSession) -> list[dict]:
    """Hent brugerens Outlook-mapper til brug i move-dialog."""
    token = await get_valid_token(account, db)
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            f"{GRAPH_API}/me/mailFolders",
            headers={"Authorization": f"Bearer {token}"},
        )
        if resp.is_success:
            folders = resp.json().get("value", [])
            return [{"id": f["id"], "name": f["displayName"]} for f in folders]
        return []
