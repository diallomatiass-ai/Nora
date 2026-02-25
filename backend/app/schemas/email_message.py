from uuid import UUID
from datetime import datetime
from pydantic import BaseModel

from app.schemas.ai_suggestion import AiSuggestionResponse


class EmailMessageResponse(BaseModel):
    id: UUID
    account_id: UUID
    provider_id: str
    from_address: str
    from_name: str | None
    to_address: str
    subject: str | None
    body_text: str | None
    body_html: str | None
    received_at: datetime | None
    is_read: bool
    is_replied: bool
    is_outgoing: bool = False
    category: str | None
    urgency: str | None
    topic: str | None
    confidence: float | None
    processed: bool
    created_at: datetime
    suggestions: list[AiSuggestionResponse] = []

    model_config = {"from_attributes": True}


class EmailListResponse(BaseModel):
    id: UUID
    from_address: str
    from_name: str | None
    subject: str | None
    received_at: datetime | None
    is_read: bool
    is_replied: bool
    is_outgoing: bool = False
    category: str | None
    urgency: str | None
    topic: str | None
    has_suggestion: bool = False

    model_config = {"from_attributes": True}


class ComposeEmailRequest(BaseModel):
    to_address: str
    subject: str
    body: str
    account_id: UUID


class SentEmailResponse(BaseModel):
    id: UUID
    type: str  # 'compose' | 'reply'
    to_address: str
    subject: str | None
    body_preview: str | None
    sent_at: datetime | None
    original_email_id: UUID | None = None
