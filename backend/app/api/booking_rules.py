"""Booking Rules API — tilgængelighed og bookingindstillinger."""

import logging
from typing import Optional
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.utils.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Default rules ─────────────────────────────────────────────────────────────

DEFAULT_RULES = {
    "enabled": False,
    "work_days": [1, 2, 3, 4, 5],  # Man-Fre
    "work_hours": {"start": "09:00", "end": "17:00"},
    "slot_duration_minutes": 60,
    "buffer_minutes": 15,
    "max_bookings_per_day": 8,
    "advance_booking_days": 30,
    "min_notice_hours": 24,
    "blocked_dates": [],
    "custom_slots": {},
}


# ── Schemas ───────────────────────────────────────────────────────────────────

class WorkHours(BaseModel):
    start: str
    end: str


class BookingRulesUpdate(BaseModel):
    enabled: Optional[bool] = None
    work_days: Optional[list[int]] = None
    work_hours: Optional[WorkHours] = None
    slot_duration_minutes: Optional[int] = None
    buffer_minutes: Optional[int] = None
    max_bookings_per_day: Optional[int] = None
    advance_booking_days: Optional[int] = None
    min_notice_hours: Optional[int] = None
    blocked_dates: Optional[list[str]] = None
    custom_slots: Optional[dict] = None


class BlockedDate(BaseModel):
    date: str


# ── Ensure table ──────────────────────────────────────────────────────────────

async def _ensure_table(db: AsyncSession) -> None:
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS booking_rules (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
            rules JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    await db.commit()


async def _get_or_create_rules(db: AsyncSession, user_id) -> dict:
    await _ensure_table(db)
    import json
    r = await db.execute(
        text("SELECT rules FROM booking_rules WHERE user_id = :uid"),
        {"uid": user_id}
    )
    row = r.fetchone()
    if not row:
        rules = DEFAULT_RULES.copy()
        await db.execute(text("""
            INSERT INTO booking_rules (user_id, rules) VALUES (:uid, cast(:rules as jsonb))
        """), {"uid": user_id, "rules": json.dumps(rules)})
        await db.commit()
        return rules
    return dict(row.rules) if row.rules else DEFAULT_RULES.copy()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("")
async def get_booking_rules(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await _get_or_create_rules(db, user.id)


@router.put("")
async def update_booking_rules(
    data: BookingRulesUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    import json
    rules = await _get_or_create_rules(db, user.id)

    if data.enabled is not None:
        rules["enabled"] = data.enabled
    if data.work_days is not None:
        rules["work_days"] = data.work_days
    if data.work_hours is not None:
        rules["work_hours"] = data.work_hours.model_dump()
    if data.slot_duration_minutes is not None:
        rules["slot_duration_minutes"] = data.slot_duration_minutes
    if data.buffer_minutes is not None:
        rules["buffer_minutes"] = data.buffer_minutes
    if data.max_bookings_per_day is not None:
        rules["max_bookings_per_day"] = data.max_bookings_per_day
    if data.advance_booking_days is not None:
        rules["advance_booking_days"] = data.advance_booking_days
    if data.min_notice_hours is not None:
        rules["min_notice_hours"] = data.min_notice_hours
    if data.blocked_dates is not None:
        rules["blocked_dates"] = data.blocked_dates
    if data.custom_slots is not None:
        rules["custom_slots"] = data.custom_slots

    await db.execute(text("""
        UPDATE booking_rules SET rules = cast(:rules as jsonb), updated_at = NOW()
        WHERE user_id = :uid
    """), {"rules": json.dumps(rules), "uid": user.id})
    await db.commit()
    return rules


@router.post("/blocked-dates")
async def add_blocked_date(
    data: BlockedDate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    import json
    rules = await _get_or_create_rules(db, user.id)
    blocked = rules.get("blocked_dates", [])
    if data.date not in blocked:
        blocked.append(data.date)
        blocked.sort()
    rules["blocked_dates"] = blocked

    await db.execute(text("""
        UPDATE booking_rules SET rules = cast(:rules as jsonb), updated_at = NOW()
        WHERE user_id = :uid
    """), {"rules": json.dumps(rules), "uid": user.id})
    await db.commit()
    return rules


@router.delete("/blocked-dates/{date_str}")
async def remove_blocked_date(
    date_str: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    import json
    rules = await _get_or_create_rules(db, user.id)
    blocked = [d for d in rules.get("blocked_dates", []) if d != date_str]
    rules["blocked_dates"] = blocked

    await db.execute(text("""
        UPDATE booking_rules SET rules = cast(:rules as jsonb), updated_at = NOW()
        WHERE user_id = :uid
    """), {"rules": json.dumps(rules), "uid": user.id})
    await db.commit()
    return rules


@router.get("/availability")
async def get_availability(
    from_: str = "",
    to: str = "",
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Returnér ledige slots i et datointerval."""
    from datetime import datetime, timedelta

    rules = await _get_or_create_rules(db, user.id)

    if not rules.get("enabled"):
        return {"enabled": False, "slots": []}

    try:
        from_date = datetime.strptime(from_, "%Y-%m-%d").date() if from_ else date.today()
        to_date = datetime.strptime(to, "%Y-%m-%d").date() if to else (date.today() + timedelta(days=7))
    except ValueError:
        raise HTTPException(status_code=400, detail="Ugyldigt datoformat — brug YYYY-MM-DD")

    work_days = rules.get("work_days", [1, 2, 3, 4, 5])
    blocked = set(rules.get("blocked_dates", []))
    work_hours = rules.get("work_hours", {"start": "09:00", "end": "17:00"})
    slot_min = rules.get("slot_duration_minutes", 60)
    buffer_min = rules.get("buffer_minutes", 15)

    slots = []
    current = from_date
    while current <= to_date:
        # isoweekday: 1=man, 7=søn
        if current.isoweekday() in work_days and current.isoformat() not in blocked:
            start_h, start_m = map(int, work_hours["start"].split(":"))
            end_h, end_m = map(int, work_hours["end"].split(":"))
            slot_start = datetime(current.year, current.month, current.day, start_h, start_m)
            end_dt = datetime(current.year, current.month, current.day, end_h, end_m)

            while slot_start + timedelta(minutes=slot_min) <= end_dt:
                slots.append({
                    "start": slot_start.isoformat(),
                    "end": (slot_start + timedelta(minutes=slot_min)).isoformat(),
                })
                slot_start += timedelta(minutes=slot_min + buffer_min)

        current += timedelta(days=1)

    return {"enabled": True, "slots": slots}
