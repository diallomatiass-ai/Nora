"""AWS Bedrock-based AI engine for email classification and reply generation.

Al AI-processering sker via AWS Bedrock i eu-central-1 (Frankfurt).
Data forlader aldrig EU — Anthropic ser aldrig indholdet direkte.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import TYPE_CHECKING

import boto3
import httpx
from botocore.exceptions import ClientError

from app.config import settings
from app.services.prompt_builder import build_classification_prompt, build_reply_prompt
from app.services.vector_store import search_knowledge, search_similar_replies, search_style_samples

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy import select

    from app.models.email_message import EmailMessage
    from app.models.user import User

logger = logging.getLogger(__name__)

# Retry-konfiguration
_MAX_RETRIES = 3
_RETRY_BASE_DELAY = 1.0  # sekunder


def _get_bedrock_client():
    """Opret boto3 Bedrock Runtime klient med EU-region."""
    kwargs = {
        "service_name": "bedrock-runtime",
        "region_name": settings.aws_region,
    }
    # Hvis eksplicitte credentials er sat i .env — ellers bruges IAM role/~/.aws/credentials
    if settings.aws_access_key_id and settings.aws_secret_access_key:
        kwargs["aws_access_key_id"] = settings.aws_access_key_id
        kwargs["aws_secret_access_key"] = settings.aws_secret_access_key
    return boto3.client(**kwargs)


def _invoke_bedrock_sync(model_id: str, prompt: str, max_tokens: int) -> str:
    """Kald AWS Bedrock synkront (køres i thread via asyncio.to_thread)."""
    client = _get_bedrock_client()

    body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": prompt}],
    })

    response = client.invoke_model(
        modelId=model_id,
        body=body,
        accept="application/json",
        contentType="application/json",
    )

    response_body = json.loads(response["body"].read())
    return response_body["content"][0]["text"]


async def _call_bedrock_async(
    prompt: str, model_id: str | None = None, max_tokens: int = 1024
) -> str:
    """Kald AWS Bedrock asynkront med exponential backoff retry.

    boto3 har ikke native async — vi kører det i en thread pool.
    """
    chosen_model = model_id or settings.bedrock_model
    last_exc: Exception | None = None

    for attempt in range(_MAX_RETRIES):
        try:
            result = await asyncio.to_thread(
                _invoke_bedrock_sync, chosen_model, prompt, max_tokens
            )
            return result

        except ClientError as exc:
            error_code = exc.response["Error"]["Code"]

            if error_code == "ThrottlingException":
                last_exc = exc
                delay = _RETRY_BASE_DELAY * (2 ** attempt)
                logger.warning(
                    "Bedrock throttling (forsøg %d/%d) — venter %.1fs",
                    attempt + 1, _MAX_RETRIES, delay,
                )
                await asyncio.sleep(delay)

            elif error_code in ("ServiceUnavailableException", "InternalServerException"):
                last_exc = exc
                delay = _RETRY_BASE_DELAY * (2 ** attempt)
                logger.warning(
                    "Bedrock server fejl %s (forsøg %d/%d) — venter %.1fs",
                    error_code, attempt + 1, _MAX_RETRIES, delay,
                )
                await asyncio.sleep(delay)

            else:
                # AccessDeniedException, ValidationException etc. — kast videre
                raise

        except Exception:
            raise

    raise RuntimeError(
        f"Bedrock fejlede efter {_MAX_RETRIES} forsøg: {last_exc}"
    ) from last_exc


async def get_embedding(text: str) -> list[float]:
    """Hent embedding-vektor fra Ollama nomic-embed-text.

    AWS Bedrock har ikke et embedding-API til Titan i EU endnu —
    Ollama kører lokalt og sender ingen data nogen steder.
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


async def classify_email(subject: str, body: str) -> dict:
    """Klassificér en email med Claude Haiku via Bedrock (hurtig + billig)."""
    prompt = build_classification_prompt(subject, body)

    try:
        raw_response = await _call_bedrock_async(
            prompt,
            model_id=settings.bedrock_fast_model,
            max_tokens=256,
        )
    except Exception as exc:
        logger.error("Bedrock fejl under klassificering: %s", exc)
        return _default_classification()

    return _parse_classification_response(raw_response)


def _parse_classification_response(raw: str) -> dict:
    """Parse LLM klassificerings-svar som JSON."""
    text = raw.strip()

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
                data = json.loads(text[start: end + 1])
            except json.JSONDecodeError:
                logger.warning("Kunne ikke parse klassificerings-JSON: %s", text[:200])
                return _default_classification()
        else:
            logger.warning("Intet JSON-objekt fundet i klassificerings-svar: %s", text[:200])
            return _default_classification()

    valid_categories = {
        "tilbud", "booking", "reklamation", "faktura", "leverandor", "intern", "support", "spam", "andet",
        "inquiry", "complaint", "order", "other",
    }
    valid_urgencies = {"high", "medium", "low"}
    valid_sentiments = {"positive", "neutral", "negative"}

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

    ai_summary = str(data.get("ai_summary", ""))[:200] or None

    sentiment = str(data.get("sentiment", "neutral")).lower()
    if sentiment not in valid_sentiments:
        sentiment = "neutral"

    return {
        "category": category,
        "urgency": urgency,
        "topic": topic,
        "confidence": confidence,
        "ai_summary": ai_summary,
        "sentiment": sentiment,
    }


def _default_classification() -> dict:
    return {
        "category": "andet",
        "urgency": "medium",
        "topic": "",
        "confidence": 0.0,
        "ai_summary": None,
        "sentiment": "neutral",
    }


async def generate_reply(
    email: "EmailMessage", user: "User", db: "AsyncSession"
) -> str:
    """Orkestrér fuld svargenererings-pipeline med Claude Sonnet via Bedrock."""
    from sqlalchemy import select
    from app.models.template import Template

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

    try:
        style_samples = await search_style_samples(
            query=query_text, user_id=user_id_str, n_results=2
        )
    except Exception as exc:
        logger.warning("Style-samples søgning fejlede: %s", exc)
        style_samples = []

    templates = []
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
        style_samples=style_samples,
    )

    try:
        reply_text = await _call_bedrock_async(
            prompt,
            model_id=settings.bedrock_model,
            max_tokens=768,
        )
    except Exception as exc:
        logger.error("Bedrock fejl under svargenerering: %s", exc)
        raise RuntimeError(f"Kunne ikke generere svar: {exc}") from exc

    return reply_text.strip()


async def generate_meeting_summary(transcript: str) -> dict:
    """Generer mødereferat, action items og opsummering fra transcript.

    Returnerer: {summary, action_items: [str], full_text: str}
    """
    prompt = f"""Du er en professionel mødesekretær. Analyser denne mødetranscript og returner JSON.

TRANSCRIPT:
{transcript}

Returner KUN valid JSON i dette format:
{{
  "summary": "2-3 sætninger der opsummerer mødet",
  "action_items": ["Action item 1", "Action item 2"],
  "full_text": "Komplet formateret referat på dansk"
}}

Svar på det sprog mødet primært foregik på (dansk eller engelsk)."""

    try:
        raw = await _call_bedrock_async(prompt, model_id=settings.bedrock_model, max_tokens=1024)
        text = raw.strip()
        if text.startswith("```"):
            lines = [l for l in text.split("\n") if not l.strip().startswith("```")]
            text = "\n".join(lines).strip()
        data = json.loads(text)
        return {
            "summary": data.get("summary", ""),
            "action_items": data.get("action_items", []),
            "full_text": data.get("full_text", transcript),
        }
    except Exception as exc:
        logger.error("Bedrock fejl under mødereferat: %s", exc)
        return {"summary": "", "action_items": [], "full_text": transcript}


async def refine_suggestion(current_text: str, instruction: str) -> str:
    """Forfin et AI-svarforslag baseret på brugerens instruktion."""
    prompt = f"""Du er en professionel emailassistent. Opdater dette svarforslag baseret på instruktionen.

NUVÆRENDE FORSLAG:
{current_text}

INSTRUKTION FRA BRUGEREN:
{instruction}

Returner KUN det opdaterede svarforslag — ingen forklaring, ingen ekstra tekst."""

    try:
        return await _call_bedrock_async(
            prompt, model_id=settings.bedrock_model, max_tokens=512
        )
    except Exception as exc:
        logger.error("Bedrock fejl under raffinering: %s", exc)
        return current_text


# Bagudkompatibilitet — bruges af chat.py
async def _call_ollama_generate(prompt: str) -> str:
    """Alias til _call_bedrock_async for bagudkompatibilitet."""
    return await _call_bedrock_async(prompt, max_tokens=1024)
