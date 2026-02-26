import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel


class ContactPerson(BaseModel):
    name: str | None = None
    phone: str | None = None
    email: str | None = None


class IvrOption(BaseModel):
    key: str
    label: str
    action: str


class SecretaryCreate(BaseModel):
    business_name: str
    industry: str
    phone_number: str | None = None
    cvr_number: str | None = None
    contact_persons: list[ContactPerson] = []
    business_address: str | None = None
    business_email: str | None = None
    voice_id: str | None = None
    greeting_text: str | None = None
    system_prompt: str | None = None
    required_fields: list[str] = []
    knowledge_items: list[str] = []
    ivr_options: list[IvrOption] = []
    confirmation_enabled: bool = False
    confirmation_template: str | None = None
    response_deadline_hours: int = 24


class SecretaryUpdate(BaseModel):
    business_name: str | None = None
    industry: str | None = None
    phone_number: str | None = None
    cvr_number: str | None = None
    contact_persons: list[ContactPerson] | None = None
    business_address: str | None = None
    business_email: str | None = None
    voice_id: str | None = None
    greeting_text: str | None = None
    system_prompt: str | None = None
    required_fields: list[str] | None = None
    knowledge_items: list[str] | None = None
    ivr_options: list[IvrOption] | None = None
    is_active: bool | None = None
    confirmation_enabled: bool | None = None
    confirmation_template: str | None = None
    response_deadline_hours: int | None = None


class SecretaryResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    business_name: str
    industry: str
    phone_number: str | None
    cvr_number: str | None
    contact_persons: list[Any]
    business_address: str | None
    business_email: str | None
    voice_id: str | None
    greeting_text: str | None
    system_prompt: str | None
    required_fields: list[Any]
    knowledge_items: list[Any]
    ivr_options: list[Any]
    is_active: bool
    confirmation_enabled: bool
    confirmation_template: str | None
    response_deadline_hours: int
    created_at: datetime

    model_config = {"from_attributes": True}


class CallResponse(BaseModel):
    id: uuid.UUID
    secretary_id: uuid.UUID
    customer_id: uuid.UUID | None
    caller_name: str | None
    caller_phone: str | None
    caller_address: str | None
    summary: str
    transcript: str | None
    required_fields_data: dict | None
    urgency: str
    status: str
    notes: str | None
    called_at: datetime
    confirmation_sent_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class CallUpdateStatus(BaseModel):
    status: str | None = None
    notes: str | None = None
