"""Action Items API — opgaver knyttet til kunder."""

import logging
from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.utils.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class ActionItemCreate(BaseModel):
    customer_id: str
    action: str
    description: str | None = None
    deadline: str | None = None
    source_type: str | None = "manual"


class ActionItemUpdate(BaseModel):
    action: str | None = None
    description: str | None = None
    deadline: str | None = None
    status: str | None = None


# ── Helper: ensure table exists ───────────────────────────────────────────────

async def _ensure_table(db: AsyncSession) -> None:
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS action_items (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            customer_id UUID,
            customer_name VARCHAR(255),
            action TEXT NOT NULL,
            description TEXT,
            deadline TIMESTAMPTZ,
            status VARCHAR(50) DEFAULT 'pending',
            source_type VARCHAR(50) DEFAULT 'manual',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    await db.execute(text(
        "CREATE INDEX IF NOT EXISTS idx_action_items_user ON action_items(user_id, status, created_at DESC)"
    ))
    await db.commit()


def _row_to_dict(row) -> dict:
    return {
        "id": str(row.id),
        "customer_id": str(row.customer_id) if row.customer_id else None,
        "customer_name": row.customer_name,
        "action": row.action,
        "description": row.description,
        "deadline": row.deadline.isoformat() if row.deadline else None,
        "status": row.status,
        "source_type": row.source_type,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/")
async def list_action_items(
    status: str | None = None,
    customer_id: str | None = None,
    overdue: bool = False,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _ensure_table(db)

    where = ["user_id = :uid"]
    params: dict = {"uid": user.id}

    if overdue:
        where.append("deadline < NOW() AND status NOT IN ('completed', 'cancelled')")
        status = None
    if status:
        where.append("status = :status")
        params["status"] = status
    if customer_id:
        where.append("customer_id = :cid")
        params["cid"] = customer_id

    q = f"SELECT * FROM action_items WHERE {' AND '.join(where)} ORDER BY created_at DESC LIMIT 50"
    result = await db.execute(text(q), params)
    return [_row_to_dict(r) for r in result.fetchall()]


@router.get("/dashboard")
async def get_action_items_dashboard(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _ensure_table(db)
    result = await db.execute(text("""
        SELECT status, COUNT(*) as count FROM action_items
        WHERE user_id = :uid GROUP BY status
    """), {"uid": user.id})
    counts = {r.status: r.count for r in result.fetchall()}
    overdue = await db.execute(text(
        "SELECT COUNT(*) FROM action_items WHERE user_id = :uid AND deadline < NOW() AND status = 'pending'"
    ), {"uid": user.id})
    return {
        "pending": counts.get("pending", 0),
        "completed": counts.get("completed", 0),
        "overdue": overdue.scalar() or 0,
    }


@router.post("/", status_code=201)
async def create_action_item(
    data: ActionItemCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _ensure_table(db)
    item_id = uuid4()
    deadline = datetime.fromisoformat(data.deadline) if data.deadline else None

    # Hent kundenavn hvis customer_id er givet
    customer_name = None
    if data.customer_id:
        r = await db.execute(text("SELECT name FROM customers WHERE id = :cid AND user_id = :uid"),
                             {"cid": data.customer_id, "uid": user.id})
        row = r.fetchone()
        if row:
            customer_name = row.name

    await db.execute(text("""
        INSERT INTO action_items (id, user_id, customer_id, customer_name, action, description, deadline, source_type)
        VALUES (:id, :uid, :cid, :cname, :action, :desc, :deadline, :source)
    """), {
        "id": item_id, "uid": user.id,
        "cid": data.customer_id or None,
        "cname": customer_name,
        "action": data.action,
        "desc": data.description,
        "deadline": deadline,
        "source": data.source_type,
    })
    await db.commit()

    r = await db.execute(text("SELECT * FROM action_items WHERE id = :id"), {"id": item_id})
    return _row_to_dict(r.fetchone())


@router.put("/{item_id}")
async def update_action_item(
    item_id: str,
    data: ActionItemUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _ensure_table(db)
    updates = []
    params: dict = {"id": item_id, "uid": user.id}

    if data.action is not None:
        updates.append("action = :action"); params["action"] = data.action
    if data.description is not None:
        updates.append("description = :description"); params["description"] = data.description
    if data.deadline is not None:
        updates.append("deadline = :deadline")
        params["deadline"] = datetime.fromisoformat(data.deadline)
    if data.status is not None:
        updates.append("status = :status"); params["status"] = data.status

    if not updates:
        raise HTTPException(status_code=400, detail="Ingen felter at opdatere")

    updates.append("updated_at = NOW()")
    await db.execute(
        text(f"UPDATE action_items SET {', '.join(updates)} WHERE id = :id AND user_id = :uid"),
        params
    )
    await db.commit()

    r = await db.execute(text("SELECT * FROM action_items WHERE id = :id"), {"id": item_id})
    row = r.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Opgave ikke fundet")
    return _row_to_dict(row)


@router.delete("/{item_id}", status_code=204)
async def delete_action_item(
    item_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _ensure_table(db)
    await db.execute(
        text("DELETE FROM action_items WHERE id = :id AND user_id = :uid"),
        {"id": item_id, "uid": user.id}
    )
    await db.commit()


@router.post("/{item_id}/generate-draft")
async def generate_followup_draft(
    item_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _ensure_table(db)
    r = await db.execute(text("SELECT * FROM action_items WHERE id = :id AND user_id = :uid"),
                         {"id": item_id, "uid": user.id})
    item = r.fetchone()
    if not item:
        raise HTTPException(status_code=404, detail="Opgave ikke fundet")

    from app.services.ai_engine import _call_bedrock_async
    prompt = f"""Skriv et kort, professionelt opfølgnings-email-udkast på dansk.

Opgave: {item.action}
{f'Beskrivelse: {item.description}' if item.description else ''}
{f'Kunde: {item.customer_name}' if item.customer_name else ''}

Skriv KUN email-teksten. Begynd med "Hej," og slut med en høflig hilsen."""

    draft = await _call_bedrock_async(prompt, max_tokens=400)
    return {"draft": draft}
