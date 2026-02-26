"""
Calendar Service — Unified kalenderintegration for Google Calendar og Microsoft Graph.

Håndterer:
- Hent ledige tider (freebusy)
- Book aftaler (opret event)
- SMS-bekræftelse via Twilio
- CRUD sync til Google/Outlook (brugt af calendar.py API)
"""

import logging
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from twilio.rest import Client as TwilioClient

from app.config import settings
from app.models.ai_secretary import AiSecretary
from app.models.calendar_account import CalendarAccount
from app.models.mail_account import MailAccount
from app.models.calendar_event import CalendarEvent
from app.services.token_manager import get_valid_calendar_token, get_valid_token

logger = logging.getLogger(__name__)


@dataclass
class TimeSlot:
    date: str          # YYYY-MM-DD
    start_time: str    # HH:MM
    end_time: str      # HH:MM


@dataclass
class BookingResult:
    success: bool
    event_id: str | None
    message: str


# ── Default booking rules ──────────────────────────────────────────────

DEFAULT_BOOKING_RULES = {
    "enabled": False,
    "work_days": [0, 1, 2, 3, 4],
    "work_hours": {"start": "07:00", "end": "16:00"},
    "slot_duration_minutes": 60,
    "buffer_minutes": 30,
    "max_bookings_per_day": 5,
    "advance_booking_days": 14,
    "min_notice_hours": 2,
    "blocked_dates": [],
    "custom_slots": {},
}


# ══════════════════════════════════════════════════════════════════════════
# CalendarService — booking via AI Sekretær (freebusy + book)
# ══════════════════════════════════════════════════════════════════════════

class CalendarService:

    # ── Hent ledige tider ──────────────────────────────────────────────

    async def get_available_slots(
        self,
        user_id: str,
        date_from: str,
        date_to: str,
        preferred_time: str,
        db: AsyncSession,
    ) -> list[TimeSlot]:
        """Hent ledige tider fra brugerens kalender med booking rules filtrering."""

        # Hent calendar account
        result = await db.execute(
            select(CalendarAccount).where(
                CalendarAccount.user_id == user_id,
                CalendarAccount.is_active == True,
            )
        )
        account = result.scalar_one_or_none()
        if not account:
            logger.warning(f"Ingen aktiv kalenderkonto for user {user_id}")
            return []

        # Hent booking rules
        result = await db.execute(
            select(AiSecretary).where(AiSecretary.user_id == user_id)
        )
        secretary = result.scalar_one_or_none()
        rules = {**DEFAULT_BOOKING_RULES, **(secretary.booking_rules or {})} if secretary else DEFAULT_BOOKING_RULES

        # Hent gyldig token
        try:
            token = await get_valid_calendar_token(account, db)
        except Exception as e:
            logger.error(f"Kunne ikke hente calendar token: {e}")
            return []

        # Parse datoer
        dt_from = datetime.strptime(date_from, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        dt_to = datetime.strptime(date_to, "%Y-%m-%d").replace(
            hour=23, minute=59, second=59, tzinfo=timezone.utc
        )

        # Hent busy perioder fra kalender-API
        busy_periods = await self._fetch_busy_periods(account.provider, token, dt_from, dt_to)

        # Beregn ledige slots
        slots = self._calculate_available_slots(
            dt_from, dt_to, busy_periods, rules, preferred_time
        )

        return slots[:5]  # Max 5 slots

    # ── Book aftale ────────────────────────────────────────────────────

    async def book_appointment(
        self,
        user_id: str,
        slot: TimeSlot,
        customer_data: dict,
        description: str,
        db: AsyncSession,
        duration_minutes: int = 60,
    ) -> BookingResult:
        """Book en aftale i brugerens kalender."""

        # Hent calendar account
        result = await db.execute(
            select(CalendarAccount).where(
                CalendarAccount.user_id == user_id,
                CalendarAccount.is_active == True,
            )
        )
        account = result.scalar_one_or_none()
        if not account:
            return BookingResult(success=False, event_id=None, message="Ingen kalenderkonto forbundet")

        try:
            token = await get_valid_calendar_token(account, db)
        except Exception as e:
            logger.error(f"Token fejl ved booking: {e}")
            return BookingResult(success=False, event_id=None, message="Kalender-adgang fejlede")

        # Dobbelttjek at slot stadig er ledig
        start_dt = datetime.strptime(f"{slot.date} {slot.start_time}", "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc)
        end_dt = start_dt + timedelta(minutes=duration_minutes)

        busy = await self._fetch_busy_periods(account.provider, token, start_dt, end_dt)
        if busy:
            return BookingResult(success=False, event_id=None, message="Tidspunktet er ikke længere ledigt")

        # Opret event
        customer_name = customer_data.get("customer_name", "Ukendt kunde")
        customer_phone = customer_data.get("customer_phone", "")
        customer_address = customer_data.get("customer_address", "")

        title = f"Ny kunde: {customer_name} - {description[:50]}"
        body = (
            f"Kunde: {customer_name}\n"
            f"Telefon: {customer_phone}\n"
            f"Adresse: {customer_address}\n"
            f"Opgave: {description}"
        )

        try:
            event_id = await self._create_event(
                account.provider, token, title, body,
                customer_address, start_dt, end_dt,
            )
        except Exception as e:
            logger.error(f"Kunne ikke oprette kalender-event: {e}")
            return BookingResult(success=False, event_id=None, message="Kunne ikke oprette aftale i kalenderen")

        # Hent firmanavn til SMS
        result = await db.execute(select(AiSecretary).where(AiSecretary.user_id == user_id))
        secretary = result.scalar_one_or_none()
        business_name = secretary.business_name if secretary else "firmaet"

        # Send SMS-bekræftelser
        await self._send_booking_sms(
            customer_phone=customer_phone,
            customer_name=customer_name,
            business_name=business_name,
            owner_phone=self._get_owner_phone(secretary),
            date_str=slot.date,
            time_str=slot.start_time,
        )

        return BookingResult(
            success=True,
            event_id=event_id,
            message=f"Aftale booket: {slot.date} kl. {slot.start_time}",
        )

    # ── Interne hjælpefunktioner ───────────────────────────────────────

    async def _fetch_busy_periods(
        self, provider: str, token: str, dt_from: datetime, dt_to: datetime
    ) -> list[tuple[datetime, datetime]]:
        """Hent optagne perioder fra Google/Microsoft kalender."""
        if provider == "google":
            return await self._google_freebusy(token, dt_from, dt_to)
        elif provider == "microsoft":
            return await self._microsoft_freebusy(token, dt_from, dt_to)
        return []

    async def _google_freebusy(
        self, token: str, dt_from: datetime, dt_to: datetime
    ) -> list[tuple[datetime, datetime]]:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                "https://www.googleapis.com/calendar/v3/freeBusy",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "timeMin": dt_from.isoformat(),
                    "timeMax": dt_to.isoformat(),
                    "items": [{"id": "primary"}],
                },
            )
            if resp.status_code != 200:
                logger.error(f"Google freeBusy fejl: {resp.status_code} {resp.text}")
                return []
            data = resp.json()

        busy = []
        for period in data.get("calendars", {}).get("primary", {}).get("busy", []):
            start = datetime.fromisoformat(period["start"].replace("Z", "+00:00"))
            end = datetime.fromisoformat(period["end"].replace("Z", "+00:00"))
            busy.append((start, end))
        return busy

    async def _microsoft_freebusy(
        self, token: str, dt_from: datetime, dt_to: datetime
    ) -> list[tuple[datetime, datetime]]:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                "https://graph.microsoft.com/v1.0/me/calendar/getSchedule",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                json={
                    "schedules": ["me"],
                    "startTime": {
                        "dateTime": dt_from.strftime("%Y-%m-%dT%H:%M:%S"),
                        "timeZone": "UTC",
                    },
                    "endTime": {
                        "dateTime": dt_to.strftime("%Y-%m-%dT%H:%M:%S"),
                        "timeZone": "UTC",
                    },
                    "availabilityViewInterval": 30,
                },
            )
            if resp.status_code != 200:
                logger.error(f"Microsoft schedule fejl: {resp.status_code} {resp.text}")
                return []
            data = resp.json()

        busy = []
        for schedule in data.get("value", []):
            for item in schedule.get("scheduleItems", []):
                if item.get("status") in ("busy", "tentative", "oof"):
                    start = datetime.fromisoformat(item["start"]["dateTime"]).replace(tzinfo=timezone.utc)
                    end = datetime.fromisoformat(item["end"]["dateTime"]).replace(tzinfo=timezone.utc)
                    busy.append((start, end))
        return busy

    async def _create_event(
        self, provider: str, token: str,
        title: str, body: str, location: str,
        start_dt: datetime, end_dt: datetime,
    ) -> str:
        """Opret event i kalender, returner event_id."""
        if provider == "google":
            return await self._google_create_event(token, title, body, location, start_dt, end_dt)
        elif provider == "microsoft":
            return await self._microsoft_create_event(token, title, body, location, start_dt, end_dt)
        raise ValueError(f"Unknown provider: {provider}")

    async def _google_create_event(
        self, token: str, title: str, body: str, location: str,
        start_dt: datetime, end_dt: datetime,
    ) -> str:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                "https://www.googleapis.com/calendar/v3/calendars/primary/events",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "summary": title,
                    "description": body,
                    "location": location,
                    "start": {"dateTime": start_dt.isoformat(), "timeZone": "Europe/Copenhagen"},
                    "end": {"dateTime": end_dt.isoformat(), "timeZone": "Europe/Copenhagen"},
                    "reminders": {
                        "useDefault": False,
                        "overrides": [{"method": "popup", "minutes": 30}],
                    },
                },
            )
            resp.raise_for_status()
            return resp.json().get("id", "")

    async def _microsoft_create_event(
        self, token: str, title: str, body: str, location: str,
        start_dt: datetime, end_dt: datetime,
    ) -> str:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                "https://graph.microsoft.com/v1.0/me/events",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                json={
                    "subject": title,
                    "body": {"contentType": "text", "content": body},
                    "location": {"displayName": location},
                    "start": {
                        "dateTime": start_dt.strftime("%Y-%m-%dT%H:%M:%S"),
                        "timeZone": "Europe/Copenhagen",
                    },
                    "end": {
                        "dateTime": end_dt.strftime("%Y-%m-%dT%H:%M:%S"),
                        "timeZone": "Europe/Copenhagen",
                    },
                    "reminderMinutesBeforeStart": 30,
                },
            )
            resp.raise_for_status()
            return resp.json().get("id", "")

    def _calculate_available_slots(
        self,
        dt_from: datetime,
        dt_to: datetime,
        busy_periods: list[tuple[datetime, datetime]],
        rules: dict,
        preferred_time: str,
    ) -> list[TimeSlot]:
        """Beregn ledige slots baseret på booking rules og busy perioder."""
        work_days = rules.get("work_days", [0, 1, 2, 3, 4])
        work_hours = rules.get("work_hours", {"start": "07:00", "end": "16:00"})
        slot_duration = rules.get("slot_duration_minutes", 60)
        buffer = rules.get("buffer_minutes", 30)
        max_per_day = rules.get("max_bookings_per_day", 5)
        min_notice_hours = rules.get("min_notice_hours", 2)
        blocked_dates = set(rules.get("blocked_dates", []))
        custom_slots = rules.get("custom_slots", {})

        work_start_h, work_start_m = map(int, work_hours["start"].split(":"))
        work_end_h, work_end_m = map(int, work_hours["end"].split(":"))

        now = datetime.now(timezone.utc)
        min_start = now + timedelta(hours=min_notice_hours)

        slots = []
        current_date = dt_from.date()
        end_date = dt_to.date()

        while current_date <= end_date:
            date_str = current_date.strftime("%Y-%m-%d")

            if date_str in blocked_dates:
                current_date += timedelta(days=1)
                continue

            if current_date.weekday() not in work_days:
                current_date += timedelta(days=1)
                continue

            if date_str in custom_slots:
                custom = custom_slots[date_str]
                day_start_h, day_start_m = map(int, custom["start"].split(":"))
                day_end_h, day_end_m = map(int, custom["end"].split(":"))
            else:
                day_start_h, day_start_m = work_start_h, work_start_m
                day_end_h, day_end_m = work_end_h, work_end_m

            day_bookings = 0
            for bs, be in busy_periods:
                if bs.date() == current_date:
                    day_bookings += 1

            slot_start = datetime(
                current_date.year, current_date.month, current_date.day,
                day_start_h, day_start_m, tzinfo=timezone.utc,
            )
            day_end = datetime(
                current_date.year, current_date.month, current_date.day,
                day_end_h, day_end_m, tzinfo=timezone.utc,
            )

            while slot_start + timedelta(minutes=slot_duration) <= day_end:
                slot_end = slot_start + timedelta(minutes=slot_duration)

                if slot_start < min_start:
                    slot_start = slot_start + timedelta(minutes=slot_duration + buffer)
                    continue

                if day_bookings >= max_per_day:
                    break

                is_busy = False
                for bs, be in busy_periods:
                    buffered_start = bs - timedelta(minutes=buffer)
                    buffered_end = be + timedelta(minutes=buffer)
                    if slot_start < buffered_end and slot_end > buffered_start:
                        is_busy = True
                        break

                if not is_busy:
                    if preferred_time == "morning" and slot_start.hour >= 12:
                        slot_start += timedelta(minutes=slot_duration + buffer)
                        continue
                    elif preferred_time == "afternoon" and slot_start.hour < 12:
                        slot_start += timedelta(minutes=slot_duration + buffer)
                        continue

                    slots.append(TimeSlot(
                        date=date_str,
                        start_time=slot_start.strftime("%H:%M"),
                        end_time=slot_end.strftime("%H:%M"),
                    ))

                slot_start += timedelta(minutes=slot_duration + buffer)

            current_date += timedelta(days=1)

        return slots

    @staticmethod
    def _get_owner_phone(secretary: AiSecretary | None) -> str:
        if not secretary:
            return ""
        contacts = secretary.contact_persons or []
        if contacts:
            return contacts[0].get("phone", "")
        return ""

    async def _send_booking_sms(
        self,
        customer_phone: str,
        customer_name: str,
        business_name: str,
        owner_phone: str,
        date_str: str,
        time_str: str,
    ):
        """Send SMS-bekræftelse til kunde og håndværker."""
        if not settings.twilio_account_sid or not settings.twilio_auth_token:
            logger.warning("Twilio ikke konfigureret — SMS-bekræftelse springes over")
            return

        try:
            client = TwilioClient(settings.twilio_account_sid, settings.twilio_auth_token)
            from_number = settings.twilio_phone_number

            if customer_phone:
                client.messages.create(
                    body=(
                        f"Din aftale med {business_name} er bekræftet: "
                        f"{date_str} kl. {time_str}. "
                        f"Vi glæder os til at hjælpe dig!"
                    ),
                    from_=from_number,
                    to=customer_phone,
                )
                logger.info(f"Booking SMS sendt til kunde: {customer_phone}")

            if owner_phone:
                client.messages.create(
                    body=(
                        f"Ny aftale booket: {customer_name} ({customer_phone}), "
                        f"{date_str} kl. {time_str}."
                    ),
                    from_=from_number,
                    to=owner_phone,
                )
                logger.info(f"Booking SMS sendt til ejer: {owner_phone}")

        except Exception as e:
            logger.error(f"SMS-bekræftelse fejlede: {e}")


# ══════════════════════════════════════════════════════════════════════════
# CRUD Calendar Services — brugt af calendar.py API (CalendarEvent sync)
# ══════════════════════════════════════════════════════════════════════════

def _google_event_body(event: CalendarEvent) -> dict:
    """Byg Google Calendar API request body."""
    return {
        "summary": event.title,
        "description": event.description or "",
        "start": {
            "dateTime": event.start_time.isoformat(),
            "timeZone": "Europe/Copenhagen",
        },
        "end": {
            "dateTime": event.end_time.isoformat(),
            "timeZone": "Europe/Copenhagen",
        },
    }


def _outlook_event_body(event: CalendarEvent) -> dict:
    """Byg Microsoft Graph API request body."""
    return {
        "subject": event.title,
        "body": {
            "contentType": "text",
            "content": event.description or "",
        },
        "start": {
            "dateTime": event.start_time.strftime("%Y-%m-%dT%H:%M:%S"),
            "timeZone": "Romance Standard Time",
        },
        "end": {
            "dateTime": event.end_time.strftime("%Y-%m-%dT%H:%M:%S"),
            "timeZone": "Romance Standard Time",
        },
    }


class GoogleCalendarService:
    """Google Calendar API v3 klient."""

    BASE_URL = "https://www.googleapis.com/calendar/v3"
    CALENDAR_ID = "primary"

    def __init__(self, account: MailAccount, db):
        self.account = account
        self.db = db

    async def _get_headers(self) -> dict:
        token = await get_valid_token(self.account, self.db)
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    async def create_event(self, event: CalendarEvent) -> str | None:
        try:
            headers = await self._get_headers()
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    f"{self.BASE_URL}/calendars/{self.CALENDAR_ID}/events",
                    headers=headers, json=_google_event_body(event), timeout=15,
                )
                if resp.status_code in (200, 201):
                    return resp.json().get("id")
                logger.warning("Google Calendar create fejlede: %s %s", resp.status_code, resp.text)
        except Exception as e:
            logger.error("Google Calendar create exception: %s", e)
        return None

    async def update_event(self, external_id: str, event: CalendarEvent) -> bool:
        try:
            headers = await self._get_headers()
            async with httpx.AsyncClient() as client:
                resp = await client.put(
                    f"{self.BASE_URL}/calendars/{self.CALENDAR_ID}/events/{external_id}",
                    headers=headers, json=_google_event_body(event), timeout=15,
                )
                return resp.status_code == 200
        except Exception as e:
            logger.error("Google Calendar update exception: %s", e)
        return False

    async def delete_event(self, external_id: str) -> bool:
        try:
            headers = await self._get_headers()
            async with httpx.AsyncClient() as client:
                resp = await client.delete(
                    f"{self.BASE_URL}/calendars/{self.CALENDAR_ID}/events/{external_id}",
                    headers=headers, timeout=15,
                )
                return resp.status_code in (200, 204)
        except Exception as e:
            logger.error("Google Calendar delete exception: %s", e)
        return False

    async def list_events(self, start: datetime, end: datetime) -> list[dict]:
        try:
            headers = await self._get_headers()
            params = {
                "timeMin": start.isoformat(),
                "timeMax": end.isoformat(),
                "singleEvents": "true",
                "orderBy": "startTime",
            }
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"{self.BASE_URL}/calendars/{self.CALENDAR_ID}/events",
                    headers=headers, params=params, timeout=15,
                )
                if resp.status_code == 200:
                    return resp.json().get("items", [])
        except Exception as e:
            logger.error("Google Calendar list exception: %s", e)
        return []


class OutlookCalendarService:
    """Microsoft Graph Calendar API klient."""

    BASE_URL = "https://graph.microsoft.com/v1.0/me/events"

    def __init__(self, account: MailAccount, db):
        self.account = account
        self.db = db

    async def _get_headers(self) -> dict:
        token = await get_valid_token(self.account, self.db)
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    async def create_event(self, event: CalendarEvent) -> str | None:
        try:
            headers = await self._get_headers()
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    self.BASE_URL, headers=headers,
                    json=_outlook_event_body(event), timeout=15,
                )
                if resp.status_code == 201:
                    return resp.json().get("id")
                logger.warning("Outlook Calendar create fejlede: %s %s", resp.status_code, resp.text)
        except Exception as e:
            logger.error("Outlook Calendar create exception: %s", e)
        return None

    async def update_event(self, external_id: str, event: CalendarEvent) -> bool:
        try:
            headers = await self._get_headers()
            async with httpx.AsyncClient() as client:
                resp = await client.patch(
                    f"{self.BASE_URL}/{external_id}",
                    headers=headers, json=_outlook_event_body(event), timeout=15,
                )
                return resp.status_code == 200
        except Exception as e:
            logger.error("Outlook Calendar update exception: %s", e)
        return False

    async def delete_event(self, external_id: str) -> bool:
        try:
            headers = await self._get_headers()
            async with httpx.AsyncClient() as client:
                resp = await client.delete(
                    f"{self.BASE_URL}/{external_id}",
                    headers=headers, timeout=15,
                )
                return resp.status_code == 204
        except Exception as e:
            logger.error("Outlook Calendar delete exception: %s", e)
        return False

    async def list_events(self, start: datetime, end: datetime) -> list[dict]:
        try:
            headers = await self._get_headers()
            params = {
                "$filter": f"start/dateTime ge '{start.strftime('%Y-%m-%dT%H:%M:%S')}' and end/dateTime le '{end.strftime('%Y-%m-%dT%H:%M:%S')}'",
                "$orderby": "start/dateTime",
                "$select": "id,subject,body,start,end",
            }
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    self.BASE_URL, headers=headers, params=params, timeout=15,
                )
                if resp.status_code == 200:
                    return resp.json().get("value", [])
        except Exception as e:
            logger.error("Outlook Calendar list exception: %s", e)
        return []


def get_calendar_service(account: MailAccount, db):
    """Factory: returnér rigtig service baseret på provider."""
    if account.provider == "gmail":
        return GoogleCalendarService(account, db)
    elif account.provider == "outlook":
        return OutlookCalendarService(account, db)
    raise ValueError(f"Ukendt provider: {account.provider}")
