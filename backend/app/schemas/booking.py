from pydantic import BaseModel


class BookingRules(BaseModel):
    enabled: bool = False
    work_days: list[int] = [0, 1, 2, 3, 4]
    work_hours: dict = {"start": "07:00", "end": "16:00"}
    slot_duration_minutes: int = 60
    buffer_minutes: int = 30
    max_bookings_per_day: int = 5
    advance_booking_days: int = 14
    min_notice_hours: int = 2
    blocked_dates: list[str] = []
    custom_slots: dict = {}


class TimeSlotResponse(BaseModel):
    date: str
    start_time: str
    end_time: str


class AvailabilityResponse(BaseModel):
    slots: list[TimeSlotResponse]
