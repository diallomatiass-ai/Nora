"""Claude API-based AI engine for email classification and reply generation."""

from __future__ import annotations

import json
import logging
from typing import TYPE_CHECKING

import httpx
import anthropic
from sqlalchemy import select

from app.config import settings
from app.services.prompt_builder import build_classification_prompt, build_reply_prompt
from app.services.vector_store import search_knowledge, search_similar_replies

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.models.email_message import EmailMessage
    from app.models.user import User

logger = logging.getLogger(__name__)

# Anthropic klient (sync — bruges via asyncio.to_thread)
_anthropic_client = anthropic.Anthropic(api_key=settings.anthropic_api_key)


async def get_embedding(text: str) -> list[float]:
    """Get an embedding vector from the Ollama nomic-embed-text model.

    Anthropic har ikke et embedding-API — Ollama bruges stadig til embeddings.

    Args:
        text: The text to embed.

    Returns:
        A list of floats representing the embedding vector.
    """
    url = f"{settings.ollama_base_url}/api/embeddings"
    payload = {
        "model": settings.ollama_embed_model,
        "prompt": text,
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
            return data["embedding"]
    except Exception as exc:
        logger.warning("Embedding API fejl: %s — returnerer tom vektor", exc)
        return []


def _call_claude(prompt: str, model: str | None = None, max_tokens: int = 1024) -> str:
    """Kald Claude API synkront og returnér svartekst.

    Args:
        prompt: Prompten der sendes til Claude.
        model: Model-ID — defaults til settings.claude_model.
        max_tokens: Maks antal output-tokens.

    Returns:
        Genereret tekst fra Claude.
    """
    chosen_model = model or settings.claude_model
    message = _anthropic_client.messages.create(
        model=chosen_model,
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text


async def _call_claude_async(prompt: str, model: str | None = None, max_tokens: int = 1024) -> str:
    """Asynkron wrapper til _call_claude via asyncio.to_thread.

    Args:
        prompt: Prompten der sendes til Claude.
        model: Model-ID.
        max_tokens: Maks antal output-tokens.

    Returns:
        Genereret tekst fra Claude.
    """
    import asyncio
    return await asyncio.to_thread(_call_claude, prompt, model, max_tokens)


async def classify_email(subject: str, body: str) -> dict:
    """Klassificér en email med Claude Haiku (hurtig + billig).

    Args:
        subject: Email-emnelinjen.
        body: Email-brødteksten.

    Returns:
        Dict med category, urgency, topic, confidence.
    """
    prompt = build_classification_prompt(subject, body)

    try:
        raw_response = await _call_claude_async(
            prompt,
            model=settings.claude_fast_model,
            max_tokens=256,
        )
    except anthropic.APIError as exc:
        logger.error("Claude API fejl under klassificering: %s", exc)
        return _default_classification()

    return _parse_classification_response(raw_response)


def _parse_classification_response(raw: str) -> dict:
    """Parse LLM klassificerings-svar som JSON.

    Args:
        raw: Råtekst fra LLM.

    Returns:
        Parsed klassificerings-dict, eller defaults ved fejl.
    """
    text = raw.strip()

    # Fjern markdown code fences hvis til stede
    if text.startswith("```"):
        lines = text.split("\n")
        lines = [line for line in lines if not line.strip().startswith("```")]
        text = "\n".join(lines).strip()

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                data = json.loads(text[start : end + 1])
            except json.JSONDecodeError:
                logger.warning("Kunne ikke parse klassificerings-JSON: %s", text[:200])
                return _default_classification()
        else:
            logger.warning("Intet JSON-objekt fundet i klassificerings-svar: %s", text[:200])
            return _default_classification()

    valid_categories = {"tilbud", "booking", "reklamation", "faktura", "leverandor", "intern", "spam", "andet",
                        "inquiry", "complaint", "order", "support", "other"}
    valid_urgencies = {"high", "medium", "low"}

    category = str(data.get("category", "andet")).lower()
    if category not in valid_categories:
        category = "andet"

    urgency = str(data.get("urgency", "medium")).lower()
    if urgency not in valid_urgencies:
        urgency = "medium"

    topic = str(data.get("topic", ""))[:100]

    try:
        confidence = float(data.get("confidence", 0.5))
        confidence = max(0.0, min(1.0, confidence))
    except (TypeError, ValueError):
        confidence = 0.5

    return {
        "category": category,
        "urgency": urgency,
        "topic": topic,
        "confidence": confidence,
    }


def _default_classification() -> dict:
    """Returnér sikre standard klassificeringsværdier."""
    return {
        "category": "andet",
        "urgency": "medium",
        "topic": "",
        "confidence": 0.0,
    }


async def generate_reply(
    email: EmailMessage, user: User, db: AsyncSession
) -> str:
    """Orkestrér fuld svargenererings-pipeline med Claude Sonnet.

    Trin:
      1. Søg ChromaDB efter relevante videnbase-poster.
      2. Søg ChromaDB efter lignende tidligere godkendte svar.
      3. Hent matchende skabeloner fra databasen.
      4. Byg reply-prompt med al kontekst.
      5. Kald Claude Sonnet for at generere svaret.

    Args:
        email: EmailMessage der skal besvares.
        user: Ejeren af mailkontoen.
        db: Async database session.

    Returns:
        Genereret svartekst.
    """
    user_id_str = str(user.id)
    query_text = f"{email.subject or ''} {email.body_text or ''}"

    try:
        knowledge_context = await search_knowledge(
            query=query_text, user_id=user_id_str, n_results=3
        )
    except Exception as exc:
        logger.warning("Videnbase-søgning fejlede: %s", exc)
        knowledge_context = []

    try:
        similar_replies = await search_similar_replies(
            query=query_text, user_id=user_id_str, n_results=3
        )
    except Exception as exc:
        logger.warning("Similar-replies søgning fejlede: %s", exc)
        similar_replies = []

    from app.models.template import Template

    templates: list[Template] = []
    try:
        stmt = select(Template).where(Template.user_id == user.id)
        if email.category:
            stmt = stmt.where(Template.category == email.category)
        stmt = stmt.order_by(Template.usage_count.desc()).limit(3)
        result = await db.execute(stmt)
        templates = list(result.scalars().all())
    except Exception as exc:
        logger.warning("Skabelon-hentning fejlede: %s", exc)

    prompt = await build_reply_prompt(
        email=email,
        user=user,
        knowledge_context=knowledge_context,
        similar_replies=similar_replies,
        templates=templates,
    )

    try:
        reply_text = await _call_claude_async(
            prompt,
            model=settings.claude_model,
            max_tokens=512,
        )
    except anthropic.APIError as exc:
        logger.error("Claude API fejl under svargenerering: %s", exc)
        raise RuntimeError(f"Kunne ikke generere svar: {exc}") from exc

    return reply_text.strip()


# Bagudkompatibilitet — bruges af chat.py
async def _call_ollama_generate(prompt: str) -> str:
    """Alias til _call_claude_async for bagudkompatibilitet med chat.py."""
    return await _call_claude_async(prompt, max_tokens=1024)
