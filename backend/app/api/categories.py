"""Bruger-definerede email-kategorier — Fyxers #1 klage var manglende tilpasning."""

import logging
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User
from app.utils.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

# Standard kategorier — bruges som fallback og for nye brugere
DEFAULT_CATEGORIES = [
    {"id": "tilbud",      "label": "Tilbud",      "color": "#3B82F6", "description": "Prisforespørgsler og tilbud"},
    {"id": "booking",     "label": "Booking",     "color": "#14B8A6", "description": "Tidsbestillinger og reservationer"},
    {"id": "faktura",     "label": "Faktura",     "color": "#F97316", "description": "Fakturaer og betalinger"},
    {"id": "reklamation", "label": "Reklamation", "color": "#EF4444", "description": "Klager og reklamationer"},
    {"id": "intern",      "label": "Intern",      "color": "#8B5CF6", "description": "Interne meddelelser"},
    {"id": "leverandor",  "label": "Leverandør",  "color": "#06B6D4", "description": "Fra leverandører og partnere"},
    {"id": "support",     "label": "Support",     "color": "#EAB308", "description": "Kundeservice og hjælp"},
    {"id": "spam",        "label": "Spam",        "color": "#6B7280", "description": "Uønskede emails"},
    {"id": "andet",       "label": "Andet",       "color": "#94A3B8", "description": "Øvrige emails"},
]


async def _ensure_table(db: AsyncSession) -> None:
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS user_categories (
            id SERIAL PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            category_id VARCHAR(50) NOT NULL,
            label VARCHAR(100) NOT NULL,
            color VARCHAR(20) DEFAULT '#6B7280',
            description TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            sort_order INT DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(user_id, category_id)
        )
    """))
    await db.commit()


class CategoryUpdate(BaseModel):
    label: str | None = None
    color: str | None = None
    description: str | None = None
    is_active: bool | None = None


class CategoryCreate(BaseModel):
    category_id: str
    label: str
    color: str = "#6B7280"
    description: str | None = None


@router.get("/")
async def list_categories(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Hent brugerens kategorier (custom + defaults)."""
    await _ensure_table(db)

    result = await db.execute(text("""
        SELECT category_id, label, color, description, is_active, sort_order
        FROM user_categories WHERE user_id = :uid ORDER BY sort_order, label
    """), {"uid": user.id})
    custom = {r.category_id: r for r in result.fetchall()}

    categories = []
    for default in DEFAULT_CATEGORIES:
        if default["id"] in custom:
            row = custom[default["id"]]
            categories.append({
                "id": row.category_id,
                "label": row.label,
                "color": row.color,
                "description": row.description,
                "is_active": row.is_active,
                "is_custom": False,
            })
        else:
            categories.append({**default, "is_active": True, "is_custom": False})

    # Tilføj brugerens egne custom kategorier
    for cat_id, row in custom.items():
        if cat_id not in {d["id"] for d in DEFAULT_CATEGORIES}:
            categories.append({
                "id": row.category_id,
                "label": row.label,
                "color": row.color,
                "description": row.description,
                "is_active": row.is_active,
                "is_custom": True,
            })

    return categories


@router.post("/", status_code=201)
async def create_category(
    data: CategoryCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Opret en ny custom kategori."""
    await _ensure_table(db)
    await db.execute(text("""
        INSERT INTO user_categories (user_id, category_id, label, color, description)
        VALUES (:uid, :cid, :label, :color, :desc)
        ON CONFLICT (user_id, category_id) DO UPDATE
        SET label = :label, color = :color, description = :desc
    """), {
        "uid": user.id, "cid": data.category_id.lower().replace(" ", "_"),
        "label": data.label, "color": data.color, "desc": data.description,
    })
    await db.commit()
    return {"id": data.category_id, "label": data.label, "color": data.color}


@router.patch("/{category_id}")
async def update_category(
    category_id: str,
    data: CategoryUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Opdatér en kategori (label, farve, aktiv/inaktiv)."""
    await _ensure_table(db)

    # Hent eksisterende eller brug default
    result = await db.execute(text("""
        SELECT * FROM user_categories WHERE user_id = :uid AND category_id = :cid
    """), {"uid": user.id, "cid": category_id})
    existing = result.fetchone()

    # Find default som base
    default = next((d for d in DEFAULT_CATEGORIES if d["id"] == category_id), None)
    base_label = existing.label if existing else (default["label"] if default else category_id)
    base_color = existing.color if existing else (default["color"] if default else "#6B7280")
    base_desc = existing.description if existing else (default.get("description") if default else None)

    await db.execute(text("""
        INSERT INTO user_categories (user_id, category_id, label, color, description, is_active)
        VALUES (:uid, :cid, :label, :color, :desc, :active)
        ON CONFLICT (user_id, category_id) DO UPDATE
        SET label = :label, color = :color, description = :desc, is_active = :active
    """), {
        "uid": user.id, "cid": category_id,
        "label": data.label if data.label is not None else base_label,
        "color": data.color if data.color is not None else base_color,
        "desc": data.description if data.description is not None else base_desc,
        "active": data.is_active if data.is_active is not None else True,
    })
    await db.commit()
    return {"updated": category_id}


@router.delete("/{category_id}", status_code=204)
async def delete_category(
    category_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Slet en custom kategori (default-kategorier kan ikke slettes, kun deaktiveres)."""
    await _ensure_table(db)
    is_default = any(d["id"] == category_id for d in DEFAULT_CATEGORIES)
    if is_default:
        raise HTTPException(status_code=400, detail="Standard kategorier kan ikke slettes — brug PATCH til at deaktivere")
    await db.execute(text(
        "DELETE FROM user_categories WHERE user_id = :uid AND category_id = :cid"
    ), {"uid": user.id, "cid": category_id})
    await db.commit()


@router.get("/active-ids")
async def get_active_category_ids(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[str]:
    """Bruges af AI engine til at injicere brugerens aktive kategorier i prompt."""
    await _ensure_table(db)

    result = await db.execute(text("""
        SELECT category_id FROM user_categories
        WHERE user_id = :uid AND is_active = TRUE
    """), {"uid": user.id})
    custom_active = {r.category_id for r in result.fetchall()}

    # Deaktiverede defaults
    result2 = await db.execute(text("""
        SELECT category_id FROM user_categories
        WHERE user_id = :uid AND is_active = FALSE
    """), {"uid": user.id})
    deactivated = {r.category_id for r in result2.fetchall()}

    active = list(custom_active)
    for d in DEFAULT_CATEGORIES:
        if d["id"] not in deactivated and d["id"] not in custom_active:
            active.append(d["id"])

    return active
