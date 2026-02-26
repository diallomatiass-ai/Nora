import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.action_item import ActionItem
from app.utils.auth import get_current_user

router = APIRouter()


class ActionItemCreate(BaseModel):
    customer_id: uuid.UUID | None = None
    call_id: uuid.UUID | None = None
    action: str
    description: str | None = None
    status: str = "pending"
    deadline: datetime | None = None


class ActionItemUpdate(BaseModel):
    action: str | None = None
    description: str | None = None
    status: str | None = None
    deadline: datetime | None = None


class ActionItemResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    customer_id: uuid.UUID | None
    call_id: uuid.UUID | None
    action: str
    description: str | None
    status: str
    deadline: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


@router.get("/", response_model=list[ActionItemResponse])
async def list_action_items(
    status: str | None = Query(None, description="Filtrer på status: pending, done, overdue"),
    customer_id: uuid.UUID | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Liste action items for den aktuelle bruger."""
    query = select(ActionItem).where(ActionItem.user_id == user.id)

    if status:
        query = query.where(ActionItem.status == status)
    if customer_id:
        query = query.where(ActionItem.customer_id == customer_id)

    query = query.order_by(ActionItem.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/", response_model=ActionItemResponse, status_code=201)
async def create_action_item(
    data: ActionItemCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Opret nyt action item."""
    item = ActionItem(
        user_id=user.id,
        customer_id=data.customer_id,
        call_id=data.call_id,
        action=data.action,
        description=data.description,
        status=data.status,
        deadline=data.deadline,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.put("/{item_id}", response_model=ActionItemResponse)
async def update_action_item(
    item_id: uuid.UUID,
    data: ActionItemUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Opdater status, deadline eller beskrivelse på et action item."""
    result = await db.execute(
        select(ActionItem).where(ActionItem.id == item_id, ActionItem.user_id == user.id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Action item ikke fundet")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(item, field, value)

    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=204)
async def delete_action_item(
    item_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Slet et action item."""
    result = await db.execute(
        select(ActionItem).where(ActionItem.id == item_id, ActionItem.user_id == user.id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Action item ikke fundet")

    await db.delete(item)
    await db.commit()
