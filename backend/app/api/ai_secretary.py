import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.ai_secretary import AiSecretary
from app.models.secretary_call import SecretaryCall
from app.schemas.ai_secretary import (
    SecretaryCreate,
    SecretaryUpdate,
    SecretaryResponse,
    CallResponse,
    CallUpdateStatus,
)
from app.services.secretary_templates import get_all_industries, get_industry_template
from app.services.customer_matching import find_or_create_from_call
from app.utils.auth import get_current_user

logger = logging.getLogger(__name__)


class CallCreate(BaseModel):
    caller_name: str | None = None
    caller_phone: str | None = None
    caller_address: str | None = None
    summary: str
    transcript: str | None = None
    required_fields_data: dict | None = None
    urgency: str = "medium"
    called_at: datetime | None = None

router = APIRouter()


@router.get("/", response_model=SecretaryResponse | None)
async def get_secretary(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Hent brugerens AI Secretary konfiguration."""
    result = await db.execute(
        select(AiSecretary).where(AiSecretary.user_id == user.id)
    )
    return result.scalar_one_or_none()


@router.post("/", response_model=SecretaryResponse, status_code=201)
async def create_secretary(
    data: SecretaryCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Opret AI Secretary konfiguration for brugeren."""
    # Tjek om brugeren allerede har en konfiguration
    result = await db.execute(
        select(AiSecretary).where(AiSecretary.user_id == user.id)
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Secretary already configured")

    secretary = AiSecretary(
        user_id=user.id,
        business_name=data.business_name,
        industry=data.industry,
        phone_number=data.phone_number,
        cvr_number=data.cvr_number,
        contact_persons=[c.model_dump() for c in data.contact_persons],
        business_address=data.business_address,
        business_email=data.business_email,
        voice_id=data.voice_id,
        greeting_text=data.greeting_text,
        system_prompt=data.system_prompt,
        required_fields=data.required_fields,
        knowledge_items=data.knowledge_items,
        ivr_options=[o.model_dump() for o in data.ivr_options],
        is_active=True,
        confirmation_enabled=data.confirmation_enabled,
        confirmation_template=data.confirmation_template,
        response_deadline_hours=data.response_deadline_hours,
    )
    db.add(secretary)
    await db.commit()
    await db.refresh(secretary)
    return secretary


@router.put("/", response_model=SecretaryResponse)
async def update_secretary(
    data: SecretaryUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Opdater AI Secretary konfiguration."""
    result = await db.execute(
        select(AiSecretary).where(AiSecretary.user_id == user.id)
    )
    secretary = result.scalar_one_or_none()
    if not secretary:
        raise HTTPException(status_code=404, detail="Secretary not configured")

    if data.business_name is not None:
        secretary.business_name = data.business_name
    if data.industry is not None:
        secretary.industry = data.industry
    if data.phone_number is not None:
        secretary.phone_number = data.phone_number
    if data.cvr_number is not None:
        secretary.cvr_number = data.cvr_number
    if data.contact_persons is not None:
        secretary.contact_persons = [c.model_dump() for c in data.contact_persons]
    if data.business_address is not None:
        secretary.business_address = data.business_address
    if data.business_email is not None:
        secretary.business_email = data.business_email
    if data.voice_id is not None:
        secretary.voice_id = data.voice_id
    if data.greeting_text is not None:
        secretary.greeting_text = data.greeting_text
    if data.system_prompt is not None:
        secretary.system_prompt = data.system_prompt
    if data.required_fields is not None:
        secretary.required_fields = data.required_fields
    if data.knowledge_items is not None:
        secretary.knowledge_items = data.knowledge_items
    if data.ivr_options is not None:
        secretary.ivr_options = [o.model_dump() for o in data.ivr_options]
    if data.is_active is not None:
        secretary.is_active = data.is_active
    if data.confirmation_enabled is not None:
        secretary.confirmation_enabled = data.confirmation_enabled
    if data.confirmation_template is not None:
        secretary.confirmation_template = data.confirmation_template
    if data.response_deadline_hours is not None:
        secretary.response_deadline_hours = data.response_deadline_hours

    await db.commit()
    await db.refresh(secretary)
    return secretary


@router.get("/industries")
async def list_industries(
    business_name: str = Query(default="", description="Virksomhedsnavn til template"),
):
    """Hent liste af brancher med foreslåede scripts."""
    industries = get_all_industries()
    # Hvis business_name er angivet, inkluder templates
    if business_name:
        for ind in industries:
            template = get_industry_template(ind["id"], business_name)
            if template:
                ind["template"] = template
    return industries


@router.get("/industries/{industry_id}")
async def get_industry(
    industry_id: str,
    business_name: str = Query(default="", description="Virksomhedsnavn til template"),
):
    """Hent template for en specifik branche."""
    template = get_industry_template(industry_id, business_name)
    if not template:
        raise HTTPException(status_code=404, detail="Industry not found")
    return template


@router.get("/dashboard")
async def call_dashboard(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Aggregeret opkalds-statistik til hoveddashboard."""
    result = await db.execute(
        select(AiSecretary).where(AiSecretary.user_id == user.id)
    )
    secretary = result.scalar_one_or_none()

    if not secretary:
        return {
            "total_calls": 0,
            "new_calls": 0,
            "urgent_calls": 0,
            "week_calls": 0,
            "is_configured": False,
            "top_recent": [],
        }

    # Hent alle opkald for denne secretary
    calls_result = await db.execute(
        select(SecretaryCall)
        .where(SecretaryCall.secretary_id == secretary.id)
    )
    calls = calls_result.scalars().all()

    week_ago = datetime.now(timezone.utc) - timedelta(days=7)

    total_calls = len(calls)
    new_calls = sum(1 for c in calls if c.status == "new")
    urgent_calls = sum(1 for c in calls if c.urgency == "high")
    week_calls = sum(1 for c in calls if c.called_at and c.called_at >= week_ago)

    # Alle opkald, sorteret efter called_at desc
    top = sorted(
        calls,
        key=lambda c: c.called_at or datetime.min.replace(tzinfo=timezone.utc),
        reverse=True,
    )

    return {
        "total_calls": total_calls,
        "new_calls": new_calls,
        "urgent_calls": urgent_calls,
        "week_calls": week_calls,
        "is_configured": True,
        "top_recent": [
            {
                "id": str(c.id),
                "caller_name": c.caller_name,
                "caller_phone": c.caller_phone,
                "summary": c.summary,
                "urgency": c.urgency,
                "status": c.status,
                "called_at": c.called_at.isoformat() if c.called_at else None,
            }
            for c in top
        ],
    }


@router.get("/calls", response_model=list[CallResponse])
async def list_calls(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Hent opkaldslog for brugerens AI Secretary."""
    result = await db.execute(
        select(AiSecretary).where(AiSecretary.user_id == user.id)
    )
    secretary = result.scalar_one_or_none()
    if not secretary:
        return []

    result = await db.execute(
        select(SecretaryCall)
        .where(SecretaryCall.secretary_id == secretary.id)
        .order_by(SecretaryCall.called_at.desc())
    )
    return result.scalars().all()


@router.put("/calls/{call_id}", response_model=CallResponse)
async def update_call(
    call_id: UUID,
    data: CallUpdateStatus,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Opdater status/noter på et opkald."""
    result = await db.execute(
        select(SecretaryCall)
        .join(AiSecretary)
        .where(SecretaryCall.id == call_id, AiSecretary.user_id == user.id)
    )
    call = result.scalar_one_or_none()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    if data.status is not None:
        call.status = data.status
    if data.notes is not None:
        call.notes = data.notes

    await db.commit()
    await db.refresh(call)
    return call


@router.post("/calls", response_model=CallResponse, status_code=201)
async def create_call(
    data: CallCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Opret nyt opkald med auto customer-linking + bekræftelse + action extraction."""
    result = await db.execute(
        select(AiSecretary).where(AiSecretary.user_id == user.id)
    )
    secretary = result.scalar_one_or_none()
    if not secretary:
        raise HTTPException(status_code=404, detail="Secretary not configured")

    call = SecretaryCall(
        secretary_id=secretary.id,
        caller_name=data.caller_name,
        caller_phone=data.caller_phone,
        caller_address=data.caller_address,
        summary=data.summary,
        transcript=data.transcript,
        required_fields_data=data.required_fields_data,
        urgency=data.urgency,
        called_at=data.called_at or datetime.now(timezone.utc),
    )
    db.add(call)
    await db.flush()

    # Auto-detect/opret kunde
    try:
        customer = await find_or_create_from_call(
            data.caller_name, data.caller_phone, data.caller_address,
            user.id, db,
        )
        call.customer_id = customer.id
    except Exception:
        logger.exception("Failed to link call to customer")

    await db.commit()
    await db.refresh(call)

    # Trigger bekræftelsesmail (asynkront)
    try:
        from app.tasks.worker import send_call_confirmation_task
        send_call_confirmation_task.delay(str(call.id))
    except Exception:
        logger.debug("Confirmation task not available yet")

    # Trigger action item extraction (asynkront)
    try:
        from app.tasks.worker import extract_action_items_task
        extract_action_items_task.delay(str(call.id))
    except Exception:
        logger.debug("Action extraction task not available yet")

    return call
