"""
Booking Rules API — CRUD for håndværkerens booking-regler.

Alle endpoints bag get_current_user (JWT).
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.ai_secretary import AiSecretary
from app.schemas.booking import BookingRules, AvailabilityResponse, TimeSlotResponse
from app.services.calendar_service import CalendarService, DEFAULT_BOOKING_RULES
from app.utils.auth import get_current_user

router = APIRouter()
calendar_service = CalendarService()


async def _get_secretary(user: User, db: AsyncSession) -> AiSecretary:
    result = await db.execute(
        select(AiSecretary).where(AiSecretary.user_id == user.id)
    )
    secretary = result.scalar_one_or_none()
    if not secretary:
        raise HTTPException(status_code=404, detail="Ingen AI Sekretær konfigureret")
    return secretary


@router.get("", response_model=BookingRules)
async def get_booking_rules(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Hent booking-regler for brugerens AI Sekretær."""
    secretary = await _get_secretary(user, db)
    rules = {**DEFAULT_BOOKING_RULES, **(secretary.booking_rules or {})}
    return BookingRules(**rules)


@router.put("", response_model=BookingRules)
async def update_booking_rules(
    rules: BookingRules,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Opdater booking-regler."""
    secretary = await _get_secretary(user, db)
    secretary.booking_rules = rules.model_dump()
    await db.commit()
    return rules


@router.post("/blocked-dates", response_model=BookingRules)
async def add_blocked_date(
    date: str = Query(..., description="Dato i YYYY-MM-DD format"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Tilføj en blokeret dato."""
    secretary = await _get_secretary(user, db)
    rules = {**DEFAULT_BOOKING_RULES, **(secretary.booking_rules or {})}

    blocked = rules.get("blocked_dates", [])
    if date not in blocked:
        blocked.append(date)
        rules["blocked_dates"] = blocked

    secretary.booking_rules = rules
    await db.commit()
    return BookingRules(**rules)


@router.delete("/blocked-dates/{date}", response_model=BookingRules)
async def remove_blocked_date(
    date: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fjern en blokeret dato."""
    secretary = await _get_secretary(user, db)
    rules = {**DEFAULT_BOOKING_RULES, **(secretary.booking_rules or {})}

    blocked = rules.get("blocked_dates", [])
    if date in blocked:
        blocked.remove(date)
        rules["blocked_dates"] = blocked

    secretary.booking_rules = rules
    await db.commit()
    return BookingRules(**rules)


@router.get("/availability", response_model=AvailabilityResponse)
async def preview_availability(
    date_from: str = Query(..., alias="from", description="Start-dato YYYY-MM-DD"),
    date_to: str = Query(..., alias="to", description="Slut-dato YYYY-MM-DD"),
    preferred_time: str = Query("any", description="morning | afternoon | any"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Preview ledige tider baseret på kalender + booking-regler."""
    slots = await calendar_service.get_available_slots(
        user_id=str(user.id),
        date_from=date_from,
        date_to=date_to,
        preferred_time=preferred_time,
        db=db,
    )
    return AvailabilityResponse(
        slots=[
            TimeSlotResponse(date=s.date, start_time=s.start_time, end_time=s.end_time)
            for s in slots
        ]
    )
