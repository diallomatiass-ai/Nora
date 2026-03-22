from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.template import Template
from app.schemas.template import TemplateCreate, TemplateUpdate, TemplateResponse
from app.utils.auth import get_current_user
from app.services.ai_engine import _call_bedrock_async as _call_claude_async

router = APIRouter()


class TemplateGenerateRequest(BaseModel):
    description: str
    category: str | None = None
    tone: str = "professionel"


class TemplateGenerateResponse(BaseModel):
    body: str
    subject: str | None = None


@router.post("/generate", response_model=TemplateGenerateResponse)
async def generate_template(
    data: TemplateGenerateRequest,
    user: User = Depends(get_current_user),
):
    category_hints = {
        "inquiry": "svar på en kundehenvendelse eller spørgsmål",
        "complaint": "håndtering af en klage eller utilfreds kunde",
        "order": "bekræftelse eller opdatering om en ordre",
        "support": "teknisk support eller hjælp til en kunde",
        "other": "generel forretningskommunikation",
    }
    category_context = category_hints.get(data.category or "", "generel forretningskommunikation")

    prompt = f"""Du er en professionel assistent der hjælper danske virksomheder med at skrive e-mail skabeloner.

Skriv en e-mail skabelon til følgende formål:
{data.description}

Kategori: {category_context}
Tone: {data.tone}

Krav til skabelonen:
- Skriv på dansk
- Brug [NAVN] som pladsholder for kundens navn
- Brug [VIRKSOMHED] som pladsholder for afsenderens virksomhed
- Brug [MEDARBEJDER] som pladsholder for den ansvarlige medarbejders navn
- Andre relevante pladsholdere kan tilføjes med [HAKKER]
- Tone skal være {data.tone}
- Skabelonen skal være klar til brug — ingen forklaringer eller kommentarer
- Inkluder passende hilsen og afslutning

Returner KUN selve skabelonteksten, intet andet."""

    body = await _call_claude_async(prompt, max_tokens=600)
    return TemplateGenerateResponse(body=body.strip())


@router.get("/", response_model=list[TemplateResponse])
async def list_templates(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Template).where(Template.user_id == user.id).order_by(Template.usage_count.desc())
    )
    return result.scalars().all()


@router.post("/", response_model=TemplateResponse, status_code=201)
async def create_template(
    data: TemplateCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    template = Template(user_id=user.id, name=data.name, category=data.category, body=data.body)
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return template


@router.put("/{template_id}", response_model=TemplateResponse)
async def update_template(
    template_id: UUID,
    data: TemplateUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Template).where(Template.id == template_id, Template.user_id == user.id)
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    if data.name is not None:
        template.name = data.name
    if data.category is not None:
        template.category = data.category
    if data.body is not None:
        template.body = data.body

    await db.commit()
    await db.refresh(template)
    return template


@router.delete("/{template_id}", status_code=204)
async def delete_template(
    template_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Template).where(Template.id == template_id, Template.user_id == user.id)
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    await db.delete(template)
    await db.commit()
