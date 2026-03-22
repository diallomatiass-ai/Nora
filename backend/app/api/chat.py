"""
AI Command Chat — naturligt sprog til emails og kalender.
"""
import json
import logging
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
from sqlalchemy import select, delete as sql_delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.email_message import EmailMessage
from app.models.mail_account import MailAccount
from app.models.ai_suggestion import AiSuggestion
from app.models.calendar_event import CalendarEvent
from app.utils.auth import get_current_user
from app.models.user import User
from app.services.mail_gmail import send_reply
from app.services.ai_engine import generate_reply, _call_bedrock_async as _call_llm
from app.services.calendar_service import get_calendar_service

logger = logging.getLogger(__name__)
router = APIRouter()


class CommandRequest(BaseModel):
    message: str
    confirm: bool = False
    pending_action: dict | None = None


class CommandResponse(BaseModel):
    response: str
    actions_taken: list[str] = []
    requires_confirmation: bool = False
    pending_action: dict | None = None
    data: dict | None = None


# ---------------------------------------------------------------------------
# Kontekst-indsamling
# ---------------------------------------------------------------------------

async def _get_context(user: User, db: AsyncSession) -> dict:
    """Hent emails og kalender-events til AI-kontekst."""
    now = datetime.now(timezone.utc)

    accounts = (await db.execute(
        select(MailAccount).where(MailAccount.user_id == user.id)
    )).scalars().all()
    account_ids = [a.id for a in accounts]

    emails = []
    if account_ids:
        emails = (await db.execute(
            select(EmailMessage)
            .where(EmailMessage.account_id.in_(account_ids))
            .order_by(EmailMessage.received_at.desc())
            .limit(30)
        )).scalars().all()

    cal_events = (await db.execute(
        select(CalendarEvent)
        .where(
            CalendarEvent.user_id == user.id,
            CalendarEvent.start_time >= now,
        )
        .order_by(CalendarEvent.start_time.asc())
        .limit(10)
    )).scalars().all()

    return {
        "emails": emails,
        "cal_events": cal_events,
        "accounts": accounts,
    }


def _build_context_summary(ctx: dict) -> str:
    lines = []
    emails = ctx["emails"]
    unread = [e for e in emails if not e.is_read]
    lines.append(f"EMAILS: {len(emails)} i alt, {len(unread)} ulæste")
    for e in emails[:8]:
        status = "ULÆST" if not e.is_read else "læst"
        lines.append(f"  email:{str(e.id)[:8]} [{e.category or '?'}][{e.urgency or '?'}][{status}] '{e.subject or '?'}' fra {e.from_address}")

    lines.append(f"\nKALENDER (kommende): {len(ctx['cal_events'])} events")
    for ev in ctx["cal_events"][:6]:
        lines.append(f"  event:{str(ev.id)[:8]} '{ev.title}' {ev.start_time.strftime('%d/%m kl.%H:%M')}")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Intent parsing
# ---------------------------------------------------------------------------

async def _parse_intent(message: str, context_summary: str) -> dict:
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M")

    prompt = f"""Du er AI-assistent for en dansk virksomhed. Analyser kommandoen og returner KUN valid JSON.

DATO/TID NU: {now_str} UTC (dansk tid = UTC+1, dvs. tilføj 1 time)

TILGÆNGELIGE HANDLINGER:
Emails: search, summary, suggest, mark_read, generate_reply, delete, send
Kalender: create_calendar_event, list_calendar
Overblik: daily_brief
Samtale: chat

KONTEKST:
{context_summary}

BRUGERENS KOMMANDO: "{message}"

Returner JSON i dette format (udelad ikke felter, brug null for ubrugte):
{{
  "action": "en af handlingerne ovenfor",
  "description": "hvad du forstår kommandoen som",
  "filters": {{
    "category": null,
    "is_read": null,
    "from_address": null,
    "search_text": null,
    "urgency": null
  }},
  "reply_instructions": null,
  "send_to": null,
  "send_subject": null,
  "send_body": null,
  "calendar_title": null,
  "calendar_start": null,
  "calendar_end": null,
  "calendar_description": null
}}

REGLER FOR DATOER: Beregn ISO8601 dato ud fra DATO/TID NU.
- "i morgen kl 14" = {(datetime.now(timezone.utc) + timedelta(days=1)).strftime('%Y-%m-%d')}T13:00:00Z
- "på fredag" = næste fredag kl 09:00
- Kalenderevents varer 1 time medmindre andet er angivet

Svar KUN med JSON, ingen forklaringer."""

    try:
        raw = await _call_llm(prompt)
        raw = raw.strip()
        if "```" in raw:
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw.strip())
    except Exception as e:
        logger.warning("Intent parsing fejlede: %s", e)
        return {"action": "chat", "description": "Kunne ikke fortolke kommandoen", "filters": {}}


def _filter_emails(filters: dict, emails: list) -> list:
    results = emails
    if filters.get("category"):
        results = [e for e in results if e.category == filters["category"]]
    if filters.get("is_read") is not None:
        results = [e for e in results if e.is_read == filters["is_read"]]
    if filters.get("from_address"):
        term = filters["from_address"].lower()
        results = [e for e in results if term in (e.from_address or "").lower()]
    if filters.get("search_text"):
        term = filters["search_text"].lower()
        results = [e for e in results if
                   term in (e.subject or "").lower() or
                   term in (e.body_text or "").lower() or
                   term in (e.from_address or "").lower()]
    if filters.get("urgency"):
        results = [e for e in results if e.urgency == filters["urgency"]]
    return results


# ---------------------------------------------------------------------------
# Hoved-endpoint
# ---------------------------------------------------------------------------

@router.post("", response_model=CommandResponse)
@limiter.limit("10/minute")
async def command(
    request: Request,
    req: CommandRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ctx = await _get_context(user, db)
    emails = ctx["emails"]
    now = datetime.now(timezone.utc)

    # -----------------------------------------------------------------------
    # Bekræftelse af afventende handling
    # -----------------------------------------------------------------------
    if req.confirm and req.pending_action:
        action = req.pending_action.get("action")

        if action == "delete":
            email_ids = req.pending_action.get("email_ids", [])
            await db.execute(sql_delete(AiSuggestion).where(
                AiSuggestion.email_id.in_([uuid.UUID(i) for i in email_ids])
            ))
            await db.execute(sql_delete(EmailMessage).where(
                EmailMessage.id.in_([uuid.UUID(i) for i in email_ids])
            ))
            await db.commit()
            return CommandResponse(
                response=f"Slettede {len(email_ids)} email(s).",
                actions_taken=[f"Slettede {len(email_ids)} emails"]
            )

        if action == "send":
            send_data = req.pending_action.get("send_data", {})
            account = ctx["accounts"][0] if ctx["accounts"] else None
            if not account:
                return CommandResponse(response="Ingen aktiv mailkonto. Forbind Gmail under Indstillinger.")
            success = await send_reply(
                account=account, db=db,
                to=send_data.get("to", ""),
                subject=send_data.get("subject", ""),
                body=send_data.get("body", ""),
            )
            if success:
                return CommandResponse(response=f"Email sendt til {send_data.get('to')}.", actions_taken=["Email sendt"])
            return CommandResponse(response="Afsendelse mislykkedes.")

        if action == "create_calendar_event":
            ev_data = req.pending_action.get("event_data", {})
            try:
                start = datetime.fromisoformat(ev_data["start_time"].replace("Z", "+00:00"))
                end = datetime.fromisoformat(ev_data["end_time"].replace("Z", "+00:00"))
            except Exception:
                return CommandResponse(response="Kunne ikke fortolke dato/tid. Prøv igen med et præcist tidspunkt.")

            cal_event = CalendarEvent(
                user_id=user.id,
                title=ev_data["title"],
                description=ev_data.get("description"),
                start_time=start,
                end_time=end,
                event_type="manual",
            )
            db.add(cal_event)
            await db.commit()
            await db.refresh(cal_event)

            account = ctx["accounts"][0] if ctx["accounts"] else None
            if account:
                try:
                    svc = get_calendar_service(account, db)
                    ext_id = await svc.create_event(cal_event)
                    if ext_id:
                        cal_event.external_event_id = ext_id
                        cal_event.provider = account.provider
                        cal_event.account_id = account.id
                        await db.commit()
                except Exception:
                    pass

            synced = " (synkroniseret til kalender)" if cal_event.external_event_id else ""
            return CommandResponse(
                response=f"Aftale oprettet{synced}:\n📅 **{cal_event.title}**\n🕐 {start.strftime('%d/%m/%Y kl. %H:%M')} – {end.strftime('%H:%M')}",
                actions_taken=[f"Kalenderaftale oprettet: {cal_event.title}"]
            )

    # -----------------------------------------------------------------------
    # Ny kommando: byg kontekst og fortolk intent
    # -----------------------------------------------------------------------
    context_summary = _build_context_summary(ctx)
    intent = await _parse_intent(req.message, context_summary)
    action = intent.get("action", "chat")
    filters = intent.get("filters") or {}

    # -----------------------------------------------------------------------
    # DAILY BRIEF
    # -----------------------------------------------------------------------
    if action == "daily_brief":
        today_events = [ev for ev in ctx["cal_events"] if ev.start_time.date() == now.date()]
        unread_emails = [e for e in emails if not e.is_read]
        high_emails = [e for e in emails if e.urgency == "high" and not e.is_read]

        lines = [f"**Dagsoverblik — {now.strftime('%A %d. %B').capitalize()}**\n"]

        if today_events:
            lines.append(f"📅 **Dagens aftaler ({len(today_events)}):**")
            for ev in today_events:
                lines.append(f"  • {ev.start_time.strftime('%H:%M')} {ev.title}")

        if high_emails:
            lines.append(f"\n⚡ **Hasteemails ulæst ({len(high_emails)}):**")
            for e in high_emails[:3]:
                lines.append(f"  • '{e.subject or '?'}' fra {e.from_address}")

        if not any([today_events, high_emails]):
            lines.append("Alt er i orden — ingen hasteemails eller aftaler i dag. ✅")

        lines.append(f"\n📊 {len(unread_emails)} ulæste emails · {len(ctx['cal_events'])} kommende aftaler")

        return CommandResponse(
            response="\n".join(lines),
            data={"today_events": len(today_events), "unread": len(unread_emails)}
        )

    # -----------------------------------------------------------------------
    # LIST CALENDAR
    # -----------------------------------------------------------------------
    if action == "list_calendar":
        if not ctx["cal_events"]:
            return CommandResponse(response="Ingen kommende kalenderaftaler.")
        lines = [f"**Kommende aftaler ({len(ctx['cal_events'])}):**\n"]
        for ev in ctx["cal_events"][:8]:
            lines.append(f"📅 **{ev.start_time.strftime('%d/%m kl. %H:%M')}** — {ev.title}")
            if ev.description:
                lines.append(f"   _{ev.description[:60]}_")
        return CommandResponse(response="\n".join(lines))

    # -----------------------------------------------------------------------
    # CREATE CALENDAR EVENT
    # -----------------------------------------------------------------------
    if action == "create_calendar_event":
        title = intent.get("calendar_title")
        start_raw = intent.get("calendar_start")
        end_raw = intent.get("calendar_end")

        if not title or not start_raw:
            return CommandResponse(response="Angiv titel og tidspunkt. Eksempel: \"Book møde med Henrik tirsdag kl. 10\"")

        try:
            start = datetime.fromisoformat(str(start_raw).replace("Z", "+00:00"))
            end = datetime.fromisoformat(str(end_raw).replace("Z", "+00:00")) if end_raw else start + timedelta(hours=1)
        except Exception:
            return CommandResponse(response="Kunne ikke fortolke dato/tid. Prøv med format: \"tirsdag kl. 10\"")

        desc = intent.get("calendar_description")
        preview = f"📅 **{title}**\n🕐 {start.strftime('%d/%m/%Y kl. %H:%M')} – {end.strftime('%H:%M')}"
        if desc:
            preview += f"\n📝 {desc}"

        return CommandResponse(
            response=f"Skal jeg oprette denne aftale?\n\n{preview}",
            requires_confirmation=True,
            pending_action={
                "action": "create_calendar_event",
                "event_data": {
                    "title": title,
                    "start_time": start.isoformat(),
                    "end_time": end.isoformat(),
                    "description": desc,
                }
            }
        )

    # -----------------------------------------------------------------------
    # EMAIL: SEARCH / SUMMARY
    # -----------------------------------------------------------------------
    if action in ("search", "summary"):
        filtered = _filter_emails(filters, emails)
        if not filtered:
            return CommandResponse(response="Ingen emails matcher din søgning.")
        lines = [f"**{len(filtered)} email(s) fundet:**\n"]
        for e in filtered[:8]:
            status = "📬" if not e.is_read else "📭"
            urgency = {"high": "🔴", "medium": "🟡", "low": "🟢"}.get(e.urgency or "", "⚪")
            lines.append(f"{status}{urgency} **{e.subject or '(ingen emne)'}**")
            lines.append(f"   Fra: {e.from_address} — {e.received_at.strftime('%d/%m %H:%M') if e.received_at else ''}")
        return CommandResponse(response="\n".join(lines))

    # -----------------------------------------------------------------------
    # EMAIL: MARK READ
    # -----------------------------------------------------------------------
    if action == "mark_read":
        filtered = _filter_emails(filters, [e for e in emails if not e.is_read])
        if not filtered:
            return CommandResponse(response="Ingen ulæste emails matcher.")
        for e in filtered[:20]:
            e.is_read = True
        await db.commit()
        return CommandResponse(
            response=f"Markerede {min(len(filtered), 20)} email(s) som læste.",
            actions_taken=[f"Markerede {min(len(filtered), 20)} emails som læste"]
        )

    # -----------------------------------------------------------------------
    # EMAIL: DELETE
    # -----------------------------------------------------------------------
    if action == "delete":
        filtered = _filter_emails(filters, emails)
        if not filtered:
            return CommandResponse(response="Ingen emails matcher.")
        email_ids = [str(e.id) for e in filtered[:20]]
        preview_lines = [f"  • {e.subject or '?'} fra {e.from_address}" for e in filtered[:5]]
        if len(filtered) > 5:
            preview_lines.append(f"  ... og {len(filtered) - 5} til")
        return CommandResponse(
            response=f"Skal jeg slette {len(email_ids)} email(s)?\n\n" + "\n".join(preview_lines),
            requires_confirmation=True,
            pending_action={"action": "delete", "email_ids": email_ids}
        )

    # -----------------------------------------------------------------------
    # EMAIL: GENERATE REPLY / SUGGEST
    # -----------------------------------------------------------------------
    if action in ("generate_reply", "suggest"):
        filtered = _filter_emails(filters, emails)
        if not filtered:
            return CommandResponse(response="Ingen emails matcher.")
        email = filtered[0]
        instructions = intent.get("reply_instructions") or "Svar høfligt og professionelt"
        try:
            suggestion = await generate_reply(email, instructions, db)
            return CommandResponse(
                response=f"**Svarforslag til '{email.subject or '?'}':**\n\n{suggestion}",
                data={"email_id": str(email.id)}
            )
        except Exception as e:
            logger.error("generate_reply fejlede: %s", e)
            return CommandResponse(response="Kunne ikke generere svarforslag.")

    # -----------------------------------------------------------------------
    # EMAIL: SEND
    # -----------------------------------------------------------------------
    if action == "send":
        to = intent.get("send_to")
        subject = intent.get("send_subject", "")
        body = intent.get("send_body", "")
        if not to or not body:
            return CommandResponse(response="Angiv modtager og besked. Eksempel: \"Send email til kunde@firma.dk: Hej, tak for din henvendelse...\"")

        return CommandResponse(
            response=f"Skal jeg sende denne email?\n\n**Til:** {to}\n**Emne:** {subject}\n\n{body[:200]}{'...' if len(body) > 200 else ''}",
            requires_confirmation=True,
            pending_action={"action": "send", "send_data": {"to": to, "subject": subject, "body": body}}
        )

    # -----------------------------------------------------------------------
    # CHAT — generel samtale med AI
    # -----------------------------------------------------------------------
    context_summary = _build_context_summary(ctx)
    try:
        system = (
            "Du er en hjælpsom AI-assistent for en dansk virksomhed. "
            "Du har adgang til brugerens emails og kalender. "
            "Svar kortfattet og på dansk."
        )
        response_text = await _call_llm(
            f"KONTEKST:\n{context_summary}\n\nBRUGERENS BESKED: {req.message}",
            system=system,
        )
        return CommandResponse(response=response_text)
    except Exception as e:
        logger.error("Chat fejlede: %s", e)
        return CommandResponse(response="Beklager, der opstod en fejl. Prøv igen.")
