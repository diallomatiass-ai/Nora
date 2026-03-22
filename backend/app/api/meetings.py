"""Mødenotat API — CRUD + transskription-behandling."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.meeting_note import MeetingNote
from app.models.user import User
from app.utils.auth import get_current_user

router = APIRouter()


# ── Pydantic schemas ────────────────────────────────────────────────────────

class MeetingCreate(BaseModel):
    title: str | None = None
    transcript: str | None = None
    meeting_date: datetime | None = None
    participants: str | None = None


class MeetingUpdate(BaseModel):
    title: str | None = None
    summary: str | None = None
    action_items: str | None = None
    participants: str | None = None
    meeting_date: datetime | None = None


class MeetingResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    title: str | None
    summary: str | None
    action_items: str | None
    participants: str | None
    meeting_date: datetime | None
    created_at: datetime
    has_transcript: bool

    model_config = {"from_attributes": True}


class ProcessResponse(BaseModel):
    id: uuid.UUID
    title: str
    summary: str
    action_items: list[str]
    participants: list[str]


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("", response_model=list[MeetingResponse])
async def list_meetings(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Hent alle mødenotater for den aktuelle bruger."""
    result = await db.execute(
        select(MeetingNote)
        .where(MeetingNote.user_id == user.id)
        .order_by(MeetingNote.created_at.desc())
    )
    meetings = result.scalars().all()
    return [
        MeetingResponse(
            **{c: getattr(m, c) for c in ["id", "user_id", "title", "summary", "action_items", "participants", "meeting_date", "created_at"]},
            has_transcript=bool(m.transcript),
        )
        for m in meetings
    ]


@router.post("", response_model=MeetingResponse, status_code=201)
async def create_meeting(
    data: MeetingCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Opret et nyt mødenotat (med eller uden transskription)."""
    meeting = MeetingNote(
        user_id=user.id,
        title=data.title,
        transcript=data.transcript,
        meeting_date=data.meeting_date or datetime.now(timezone.utc),
        participants=data.participants,
    )
    db.add(meeting)
    await db.commit()
    await db.refresh(meeting)

    # Behandl transskription automatisk hvis den er inkluderet
    if data.transcript:
        try:
            from app.services.meeting_service import process_transcript
            result = await process_transcript(data.transcript)
            meeting.title = meeting.title or result["title"]
            meeting.summary = result["summary"]
            meeting.action_items = json.dumps(result["action_items"], ensure_ascii=False)
            if not meeting.participants and result["participants"]:
                meeting.participants = ", ".join(result["participants"])
            await db.commit()
            await db.refresh(meeting)
        except Exception:
            pass  # Gem mødet selvom behandling fejler

    return MeetingResponse(
        **{c: getattr(meeting, c) for c in ["id", "user_id", "title", "summary", "action_items", "participants", "meeting_date", "created_at"]},
        has_transcript=bool(meeting.transcript),
    )


@router.get("/{meeting_id}", response_model=MeetingResponse)
async def get_meeting(
    meeting_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Hent et enkelt mødenotat."""
    result = await db.execute(
        select(MeetingNote).where(MeetingNote.id == meeting_id, MeetingNote.user_id == user.id)
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Mødenotat ikke fundet")
    return MeetingResponse(
        **{c: getattr(meeting, c) for c in ["id", "user_id", "title", "summary", "action_items", "participants", "meeting_date", "created_at"]},
        has_transcript=bool(meeting.transcript),
    )


@router.put("/{meeting_id}", response_model=MeetingResponse)
async def update_meeting(
    meeting_id: uuid.UUID,
    data: MeetingUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Opdater et mødenotat."""
    result = await db.execute(
        select(MeetingNote).where(MeetingNote.id == meeting_id, MeetingNote.user_id == user.id)
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Mødenotat ikke fundet")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(meeting, field, value)

    await db.commit()
    await db.refresh(meeting)
    return MeetingResponse(
        **{c: getattr(meeting, c) for c in ["id", "user_id", "title", "summary", "action_items", "participants", "meeting_date", "created_at"]},
        has_transcript=bool(meeting.transcript),
    )


@router.delete("/{meeting_id}", status_code=204)
async def delete_meeting(
    meeting_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Slet et mødenotat."""
    result = await db.execute(
        select(MeetingNote).where(MeetingNote.id == meeting_id, MeetingNote.user_id == user.id)
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Mødenotat ikke fundet")
    await db.delete(meeting)
    await db.commit()


@router.post("/{meeting_id}/process", response_model=ProcessResponse)
async def process_meeting(
    meeting_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Kør AI-behandling på et eksisterende mødenotats transskription."""
    result = await db.execute(
        select(MeetingNote).where(MeetingNote.id == meeting_id, MeetingNote.user_id == user.id)
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Mødenotat ikke fundet")
    if not meeting.transcript:
        raise HTTPException(status_code=400, detail="Ingen transskription at behandle")

    from app.services.meeting_service import process_transcript
    processed = await process_transcript(meeting.transcript)

    meeting.title = processed["title"]
    meeting.summary = processed["summary"]
    meeting.action_items = json.dumps(processed["action_items"], ensure_ascii=False)
    if processed["participants"]:
        meeting.participants = ", ".join(processed["participants"])
    await db.commit()

    return ProcessResponse(
        id=meeting.id,
        title=processed["title"],
        summary=processed["summary"],
        action_items=processed["action_items"],
        participants=processed["participants"],
    )


# ── Transcript chunk ─────────────────────────────────────────────────────────

class TranscriptChunk(BaseModel):
    speaker: str
    text: str
    timestamp: str  # "MM:SS" format


@router.post("/{meeting_id}/transcript-chunk")
async def add_transcript_chunk(
    meeting_id: uuid.UUID,
    chunk: TranscriptChunk,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Tilføj en transskriptionslinje til et møde (live optagelse)."""
    result = await db.execute(
        select(MeetingNote).where(MeetingNote.id == meeting_id, MeetingNote.user_id == user.id)
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Møde ikke fundet")

    line = f"[{chunk.speaker}] {chunk.timestamp}: {chunk.text}"
    existing = meeting.transcript or ""
    meeting.transcript = (existing + "\n" + line).strip()
    await db.commit()
    return {"ok": True}


# ── Send referat ─────────────────────────────────────────────────────────────

class SendReferatRequest(BaseModel):
    recipients: list[str]
    summary: str
    action_items: list[str]
    full_text: str


@router.post("/{meeting_id}/send-referat")
async def send_referat(
    meeting_id: uuid.UUID,
    data: SendReferatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Gem referat og returner mailto-link til afsendelse."""
    result = await db.execute(
        select(MeetingNote).where(MeetingNote.id == meeting_id, MeetingNote.user_id == user.id)
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Møde ikke fundet")

    meeting.summary = data.summary
    meeting.action_items = json.dumps(data.action_items, ensure_ascii=False)
    await db.commit()

    subject = f"Referat: {meeting.title or 'Møde'}"
    body_parts = [
        f"Opsummering:\n{data.summary}",
        "",
        "Handlingspunkter:",
        *[f"- {item}" for item in data.action_items],
        "",
        f"Fuld transskription:\n{data.full_text}",
    ]
    body = "\n".join(body_parts)[:2000]

    return {
        "ok": True,
        "mailto": f"mailto:{','.join(data.recipients)}?subject={subject}&body={body}",
    }


# ── Finalize (kald fra nora-agent efter mødet) ────────────────────────────────

class FinalizeResponse(BaseModel):
    id: uuid.UUID
    summary: str
    action_items: list[str]
    full_text: str


@router.post("/{meeting_id}/finalize", response_model=FinalizeResponse)
async def finalize_meeting(
    meeting_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generer referat fra akkumuleret live-transcript via Bedrock.

    Kaldes af nora-agent når brugeren stopper optagelsen.
    """
    result = await db.execute(
        select(MeetingNote).where(MeetingNote.id == meeting_id, MeetingNote.user_id == user.id)
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Møde ikke fundet")

    if not meeting.transcript:
        raise HTTPException(status_code=400, detail="Ingen transcript at generere referat fra")

    from app.services.ai_engine import generate_meeting_summary
    summary_data = await generate_meeting_summary(meeting.transcript)

    meeting.summary = summary_data["summary"]
    meeting.action_items = json.dumps(summary_data["action_items"], ensure_ascii=False)
    await db.commit()
    await db.refresh(meeting)

    action_items_list = []
    if meeting.action_items:
        try:
            action_items_list = json.loads(meeting.action_items)
        except json.JSONDecodeError:
            action_items_list = []

    return FinalizeResponse(
        id=meeting.id,
        summary=meeting.summary or "",
        action_items=action_items_list,
        full_text=summary_data["full_text"],
    )
