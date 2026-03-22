"""Customers API — CRM-modul til Nora."""

import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional
from uuid import uuid4

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

class CustomerCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address_street: Optional[str] = None
    address_zip: Optional[str] = None
    address_city: Optional[str] = None
    source: Optional[str] = None
    tags: Optional[list[str]] = None
    estimated_value: Optional[float] = None
    notes: Optional[str] = None
    status: Optional[str] = "ny_henvendelse"


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address_street: Optional[str] = None
    address_zip: Optional[str] = None
    address_city: Optional[str] = None
    source: Optional[str] = None
    tags: Optional[list[str]] = None
    estimated_value: Optional[float] = None
    notes: Optional[str] = None
    status: Optional[str] = None


# ── Ensure tables ─────────────────────────────────────────────────────────────

async def _ensure_tables(db: AsyncSession) -> None:
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS customers (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255),
            phone VARCHAR(50),
            address_street VARCHAR(255),
            address_zip VARCHAR(20),
            address_city VARCHAR(100),
            source VARCHAR(100),
            tags JSONB DEFAULT '[]',
            estimated_value NUMERIC(12, 2),
            notes TEXT,
            status VARCHAR(50) DEFAULT 'ny_henvendelse',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    await db.execute(text(
        "CREATE INDEX IF NOT EXISTS idx_customers_user ON customers(user_id, created_at DESC)"
    ))
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS customer_timeline (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            customer_id UUID NOT NULL,
            event_type VARCHAR(50) DEFAULT 'note',
            description TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    await db.execute(text(
        "CREATE INDEX IF NOT EXISTS idx_customer_timeline ON customer_timeline(customer_id, created_at DESC)"
    ))
    await db.commit()


def _row_to_dict(row) -> dict:
    return {
        "id": str(row.id),
        "name": row.name,
        "email": row.email,
        "phone": row.phone,
        "address_street": row.address_street,
        "address_zip": row.address_zip,
        "address_city": row.address_city,
        "source": row.source,
        "tags": row.tags if row.tags else [],
        "estimated_value": float(row.estimated_value) if row.estimated_value else None,
        "notes": row.notes,
        "status": row.status,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/dashboard")
async def get_customer_dashboard(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _ensure_tables(db)

    total = await db.execute(
        text("SELECT COUNT(*) FROM customers WHERE user_id = :uid"), {"uid": user.id}
    )
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    new_week = await db.execute(
        text("SELECT COUNT(*) FROM customers WHERE user_id = :uid AND created_at >= :w"),
        {"uid": user.id, "w": week_ago}
    )
    pipeline = await db.execute(
        text("""SELECT COALESCE(SUM(estimated_value), 0) FROM customers
               WHERE user_id = :uid AND status NOT IN ('afsluttet', 'tilbud_afvist', 'arkiveret')"""),
        {"uid": user.id}
    )
    by_status = await db.execute(
        text("SELECT status, COUNT(*) as cnt FROM customers WHERE user_id = :uid GROUP BY status"),
        {"uid": user.id}
    )

    return {
        "total": total.scalar() or 0,
        "new_this_week": new_week.scalar() or 0,
        "pipeline_value": float(pipeline.scalar() or 0),
        "by_status": {r.status: r.cnt for r in by_status.fetchall()},
    }


@router.get("/")
async def list_customers(
    search: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _ensure_tables(db)

    where = ["user_id = :uid"]
    params: dict = {"uid": user.id, "skip": skip, "limit": limit}

    if status:
        where.append("status = :status")
        params["status"] = status
    if search:
        where.append("(name ILIKE :q OR email ILIKE :q OR phone ILIKE :q)")
        params["q"] = f"%{search}%"

    q = f"""SELECT * FROM customers WHERE {' AND '.join(where)}
            ORDER BY created_at DESC LIMIT :limit OFFSET :skip"""
    result = await db.execute(text(q), params)
    return [_row_to_dict(r) for r in result.fetchall()]


@router.post("/", status_code=201)
async def create_customer(
    data: CustomerCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _ensure_tables(db)
    cid = uuid4()
    await db.execute(text("""
        INSERT INTO customers (id, user_id, name, email, phone, address_street, address_zip,
            address_city, source, tags, estimated_value, notes, status)
        VALUES (:id, :uid, :name, :email, :phone, :astr, :azip, :acity, :source,
                cast(:tags as jsonb), :val, :notes, :status)
    """), {
        "id": cid, "uid": user.id, "name": data.name,
        "email": data.email, "phone": data.phone,
        "astr": data.address_street, "azip": data.address_zip, "acity": data.address_city,
        "source": data.source, "tags": json.dumps(data.tags or []),
        "val": data.estimated_value, "notes": data.notes,
        "status": data.status or "ny_henvendelse",
    })
    await db.execute(text("""
        INSERT INTO customer_timeline (user_id, customer_id, event_type, description)
        VALUES (:uid, :cid, 'oprettet', 'Kunde oprettet')
    """), {"uid": user.id, "cid": cid})
    await db.commit()

    r = await db.execute(text("SELECT * FROM customers WHERE id = :id"), {"id": cid})
    return _row_to_dict(r.fetchone())


@router.get("/{customer_id}")
async def get_customer(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _ensure_tables(db)
    r = await db.execute(
        text("SELECT * FROM customers WHERE id = :id AND user_id = :uid"),
        {"id": customer_id, "uid": user.id}
    )
    row = r.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Kunde ikke fundet")
    return _row_to_dict(row)


@router.put("/{customer_id}")
async def update_customer(
    customer_id: str,
    data: CustomerUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _ensure_tables(db)

    updates = ["updated_at = NOW()"]
    params: dict = {"id": customer_id, "uid": user.id}

    if data.name is not None:
        updates.append("name = :name"); params["name"] = data.name
    if data.email is not None:
        updates.append("email = :email"); params["email"] = data.email
    if data.phone is not None:
        updates.append("phone = :phone"); params["phone"] = data.phone
    if data.address_street is not None:
        updates.append("address_street = :astr"); params["astr"] = data.address_street
    if data.address_zip is not None:
        updates.append("address_zip = :azip"); params["azip"] = data.address_zip
    if data.address_city is not None:
        updates.append("address_city = :acity"); params["acity"] = data.address_city
    if data.source is not None:
        updates.append("source = :source"); params["source"] = data.source
    if data.tags is not None:
        updates.append("tags = cast(:tags as jsonb)"); params["tags"] = json.dumps(data.tags)
    if data.estimated_value is not None:
        updates.append("estimated_value = :val"); params["val"] = data.estimated_value
    if data.notes is not None:
        updates.append("notes = :notes"); params["notes"] = data.notes
    if data.status is not None:
        updates.append("status = :status"); params["status"] = data.status

    await db.execute(
        text(f"UPDATE customers SET {', '.join(updates)} WHERE id = :id AND user_id = :uid"),
        params
    )

    if data.status is not None:
        await db.execute(text("""
            INSERT INTO customer_timeline (user_id, customer_id, event_type, description)
            VALUES (:uid, :cid, 'status_skift', :desc)
        """), {"uid": user.id, "cid": customer_id, "desc": f"Status ændret til: {data.status}"})

    await db.commit()

    r = await db.execute(text("SELECT * FROM customers WHERE id = :id"), {"id": customer_id})
    row = r.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Kunde ikke fundet")
    return _row_to_dict(row)


@router.delete("/{customer_id}", status_code=204)
async def delete_customer(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _ensure_tables(db)
    await db.execute(
        text("DELETE FROM customers WHERE id = :id AND user_id = :uid"),
        {"id": customer_id, "uid": user.id}
    )
    await db.commit()


@router.get("/{customer_id}/timeline")
async def get_customer_timeline(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _ensure_tables(db)
    r = await db.execute(
        text("""SELECT id, event_type, description, created_at
                FROM customer_timeline WHERE customer_id = :cid AND user_id = :uid
                ORDER BY created_at DESC LIMIT 50"""),
        {"cid": customer_id, "uid": user.id}
    )
    return [
        {
            "id": str(row.id),
            "event_type": row.event_type,
            "description": row.description,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
        for row in r.fetchall()
    ]
