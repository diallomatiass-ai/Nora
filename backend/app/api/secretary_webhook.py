"""
Webhook-endpoint til ekstern telefonisystem.
Modtager opkaldsdata og gemmer dem som SecretaryCall.
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.config import settings
from app.models.ai_secretary import AiSecretary
from app.models.secretary_call import SecretaryCall
from app.services.customer_matching import find_or_create_from_call

logger = logging.getLogger(__name__)

router = APIRouter()


class IncomingCallPayload(BaseModel):
    """
    Payload sendt fra eksternt telefonisystem (fx Twilio, 46elks, Flexfone).
    secretary_id identificerer hvilken AI Secretary opkaldet tilhører.
    """
    secretary_id: str
    caller_name: str | None = None
    caller_phone: str | None = None
    caller_address: str | None = None
    summary: str
    transcript: str | None = None
    required_fields_data: dict | None = None
    urgency: str = "medium"
    called_at: datetime | None = None


class CallWebhookResponse(BaseModel):
    call_id: str
    status: str
    customer_linked: bool


@router.post("/secretary-call", response_model=CallWebhookResponse, status_code=201)
async def receive_secretary_call(
    payload: IncomingCallPayload,
    x_webhook_secret: str | None = Header(None, alias="X-Webhook-Secret"),
    db: AsyncSession = Depends(get_db),
):
    """
    Modtag opkald fra eksternt telefonisystem.
    Verificér webhook-secret, find secretary, gem opkald og link til kunde.
    """
    # Verificér webhook secret hvis konfigureret
    webhook_secret = getattr(settings, "secretary_webhook_key", None)
    if webhook_secret and x_webhook_secret != webhook_secret:
        raise HTTPException(status_code=401, detail="Ugyldig webhook secret")

    # Find secretary
    try:
        import uuid as uuid_lib
        secretary_uuid = uuid_lib.UUID(payload.secretary_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Ugyldigt secretary_id format")

    result = await db.execute(
        select(AiSecretary).where(AiSecretary.id == secretary_uuid, AiSecretary.is_active == True)
    )
    secretary = result.scalar_one_or_none()
    if not secretary:
        raise HTTPException(status_code=404, detail="AI Secretary ikke fundet eller ikke aktiv")

    # Opret opkald
    call = SecretaryCall(
        secretary_id=secretary.id,
        caller_name=payload.caller_name,
        caller_phone=payload.caller_phone,
        caller_address=payload.caller_address,
        summary=payload.summary,
        transcript=payload.transcript,
        required_fields_data=payload.required_fields_data,
        urgency=payload.urgency,
        called_at=payload.called_at or datetime.now(timezone.utc),
    )
    db.add(call)
    await db.flush()

    # Auto-link til eksisterende eller ny kunde
    customer_linked = False
    try:
        customer = await find_or_create_from_call(
            payload.caller_name,
            payload.caller_phone,
            payload.caller_address,
            secretary.user_id,
            db,
        )
        call.customer_id = customer.id
        customer_linked = True
    except Exception:
        logger.exception("Kunne ikke linke opkald til kunde (secretary webhook)")

    await db.commit()
    await db.refresh(call)

    # Trigger asynkrone tasks
    try:
        from app.tasks.worker import send_call_confirmation_task
        send_call_confirmation_task.delay(str(call.id))
    except Exception:
        logger.debug("send_call_confirmation_task ikke tilgængelig")

    try:
        from app.tasks.worker import extract_action_items_task
        extract_action_items_task.delay(str(call.id))
    except Exception:
        logger.debug("extract_action_items_task ikke tilgængelig")

    logger.info("Secretary webhook: gemt opkald %s (customer_linked=%s)", call.id, customer_linked)

    return CallWebhookResponse(
        call_id=str(call.id),
        status="created",
        customer_linked=customer_linked,
    )
