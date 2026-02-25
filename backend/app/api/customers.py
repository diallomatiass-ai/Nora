import logging
from uuid import UUID
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
import httpx

from app.database import get_db
from app.config import settings
from app.models.user import User
from app.models.customer import Customer
from app.models.email_message import EmailMessage
from app.models.secretary_call import SecretaryCall
from app.models.action_item import ActionItem
from app.schemas.customer import (
    CustomerCreate, CustomerUpdate, CustomerResponse,
    CustomerListResponse, TimelineItem,
)
from app.utils.auth import get_current_user
from app.services.customer_matching import merge_customers
from app.services import ordrestyring

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/dashboard")
async def customer_dashboard(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stats til hoveddashboard."""
    now = datetime.now(timezone.utc)
    from datetime import timedelta
    week_ago = now - timedelta(days=7)

    total = await db.scalar(
        select(func.count(Customer.id)).where(Customer.user_id == user.id)
    )
    new_this_week = await db.scalar(
        select(func.count(Customer.id)).where(
            Customer.user_id == user.id,
            Customer.created_at >= week_ago,
        )
    )
    pipeline_value = await db.scalar(
        select(func.coalesce(func.sum(Customer.estimated_value), 0)).where(
            Customer.user_id == user.id,
            Customer.status.notin_(["afsluttet", "arkiveret", "tilbud_afvist"]),
        )
    )
    overdue_tasks = await db.scalar(
        select(func.count(ActionItem.id)).where(
            ActionItem.user_id == user.id,
            ActionItem.status == "overdue",
        )
    )

    return {
        "total_customers": total or 0,
        "new_this_week": new_this_week or 0,
        "pipeline_value": float(pipeline_value or 0),
        "overdue_tasks": overdue_tasks or 0,
    }


@router.get("/", response_model=list[CustomerListResponse])
async def list_customers(
    search: str | None = Query(None),
    status: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Liste med search, status-filter, pagination."""
    query = select(Customer).where(Customer.user_id == user.id)

    if status:
        query = query.where(Customer.status == status)

    if search:
        term = f"%{search}%"
        query = query.where(
            or_(
                Customer.name.ilike(term),
                Customer.phone.ilike(term),
                Customer.email.ilike(term),
            )
        )

    query = query.order_by(Customer.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    customers = result.scalars().all()

    # Berig med counts
    response = []
    for c in customers:
        email_count = await db.scalar(
            select(func.count(EmailMessage.id)).where(EmailMessage.customer_id == c.id)
        )
        call_count = await db.scalar(
            select(func.count(SecretaryCall.id)).where(SecretaryCall.customer_id == c.id)
        )
        action_count = await db.scalar(
            select(func.count(ActionItem.id)).where(ActionItem.customer_id == c.id)
        )
        item = CustomerListResponse(
            id=c.id,
            name=c.name,
            phone=c.phone,
            email=c.email,
            source=c.source,
            status=c.status,
            tags=c.tags,
            estimated_value=c.estimated_value,
            email_count=email_count or 0,
            call_count=call_count or 0,
            action_item_count=action_count or 0,
            created_at=c.created_at,
        )
        response.append(item)

    return response


@router.get("/ordrestyring-status")
async def ordrestyring_status(user: User = Depends(get_current_user)):
    """Check if Ordrestyring API key is configured."""
    return {"configured": bool(settings.ordrestyring_api_key)}


@router.get("/{customer_id}", response_model=CustomerResponse)
async def get_customer(
    customer_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.user_id == user.id)
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Kunde ikke fundet")
    return customer


@router.post("/", response_model=CustomerResponse, status_code=201)
async def create_customer(
    data: CustomerCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    customer = Customer(
        user_id=user.id,
        name=data.name,
        phone=data.phone,
        email=data.email,
        address_street=data.address_street,
        address_zip=data.address_zip,
        address_city=data.address_city,
        source=data.source,
        tags=data.tags,
        estimated_value=data.estimated_value,
        notes=data.notes,
    )
    db.add(customer)
    await db.commit()
    await db.refresh(customer)
    return customer


@router.put("/{customer_id}", response_model=CustomerResponse)
async def update_customer(
    customer_id: UUID,
    data: CustomerUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.user_id == user.id)
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Kunde ikke fundet")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(customer, field, value)

    await db.commit()
    await db.refresh(customer)
    return customer


@router.delete("/{customer_id}", status_code=204)
async def delete_customer(
    customer_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.user_id == user.id)
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Kunde ikke fundet")

    await db.delete(customer)
    await db.commit()


@router.get("/{customer_id}/timeline", response_model=list[TimelineItem])
async def get_customer_timeline(
    customer_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Kronologisk tidslinje med emails, opkald og action items."""
    # Verificér ejerskab
    result = await db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.user_id == user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Kunde ikke fundet")

    timeline = []

    # Emails
    result = await db.execute(
        select(EmailMessage).where(EmailMessage.customer_id == customer_id)
    )
    for email in result.scalars().all():
        timeline.append(TimelineItem(
            type="email",
            id=email.id,
            timestamp=email.received_at or email.created_at,
            summary=email.subject or "(Ingen emne)",
            details={
                "from": email.from_address,
                "category": email.category,
                "urgency": email.urgency,
                "is_read": email.is_read,
            },
        ))

    # Opkald
    result = await db.execute(
        select(SecretaryCall).where(SecretaryCall.customer_id == customer_id)
    )
    for call in result.scalars().all():
        timeline.append(TimelineItem(
            type="call",
            id=call.id,
            timestamp=call.called_at,
            summary=call.summary,
            details={
                "caller_name": call.caller_name,
                "caller_phone": call.caller_phone,
                "urgency": call.urgency,
                "status": call.status,
                "confirmation_sent": call.confirmation_sent_at is not None,
            },
        ))

    # Action items
    result = await db.execute(
        select(ActionItem).where(ActionItem.customer_id == customer_id)
    )
    for item in result.scalars().all():
        timeline.append(TimelineItem(
            type="action_item",
            id=item.id,
            timestamp=item.created_at,
            summary=f"{item.action}: {item.description or ''}",
            details={
                "action": item.action,
                "status": item.status,
                "deadline": item.deadline.isoformat() if item.deadline else None,
            },
        ))

    # Sortér kronologisk (nyeste først)
    timeline.sort(key=lambda x: x.timestamp, reverse=True)
    return timeline


class PushOrdrestyringBody(BaseModel):
    description: str = ""


@router.post("/{customer_id}/push-ordrestyring")
async def push_ordrestyring(
    customer_id: UUID,
    body: PushOrdrestyringBody | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Push customer to Ordrestyring.dk as debtor + case."""
    if not settings.ordrestyring_api_key:
        raise HTTPException(status_code=400, detail="Ordrestyring API-nøgle ikke konfigureret")

    result = await db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.user_id == user.id)
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Kunde ikke fundet")

    if customer.external_id:
        raise HTTPException(status_code=409, detail="Allerede overført til Ordrestyring")

    # Build description from calls + body text
    parts: list[str] = []
    call_result = await db.execute(
        select(SecretaryCall).where(SecretaryCall.customer_id == customer_id)
    )
    for call in call_result.scalars().all():
        if call.summary:
            parts.append(call.summary)
    if body and body.description:
        parts.append(body.description)
    description = "\n\n".join(parts) if parts else customer.name

    try:
        data = await ordrestyring.push_customer(customer, description, db)
    except httpx.HTTPStatusError as e:
        logger.error("Ordrestyring API error: %s %s", e.response.status_code, e.response.text)
        raise HTTPException(status_code=502, detail="Kunne ikke forbinde til Ordrestyring")
    except httpx.HTTPError as e:
        logger.error("Ordrestyring connection error: %s", e)
        raise HTTPException(status_code=502, detail="Kunne ikke forbinde til Ordrestyring")

    return {"success": True, **data}


@router.post("/{customer_id}/merge/{other_id}", response_model=CustomerResponse)
async def merge_customer(
    customer_id: UUID,
    other_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Flet to kunder. Behold primary, flyt alt fra other."""
    try:
        primary = await merge_customers(customer_id, other_id, user.id, db)
        await db.commit()
        await db.refresh(primary)
        return primary
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
