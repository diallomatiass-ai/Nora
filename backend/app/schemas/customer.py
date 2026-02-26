import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel


class CustomerCreate(BaseModel):
    name: str
    phone: str | None = None
    email: str | None = None
    address_street: str | None = None
    address_zip: str | None = None
    address_city: str | None = None
    source: str | None = None
    tags: list[str] = []
    estimated_value: float | None = None
    notes: str | None = None


class CustomerUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    email: str | None = None
    address_street: str | None = None
    address_zip: str | None = None
    address_city: str | None = None
    source: str | None = None
    status: str | None = None
    tags: list[str] | None = None
    estimated_value: float | None = None
    notes: str | None = None
    external_id: str | None = None


class CustomerResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    phone: str | None
    email: str | None
    address_street: str | None
    address_zip: str | None
    address_city: str | None
    source: str | None
    status: str
    tags: list[Any]
    estimated_value: float | None
    notes: str | None
    external_id: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class CustomerListResponse(BaseModel):
    id: uuid.UUID
    name: str
    phone: str | None
    email: str | None
    source: str | None
    status: str
    tags: list[Any]
    estimated_value: float | None
    email_count: int = 0
    call_count: int = 0
    action_item_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class TimelineItem(BaseModel):
    type: str
    id: uuid.UUID
    timestamp: datetime
    summary: str
    details: dict[str, Any] = {}
