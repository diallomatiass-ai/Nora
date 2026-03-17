"""Mødenotat-service — bruger Claude API (eller Ollama som fallback) til at behandle transskriptioner."""

from __future__ import annotations

import json
import logging

from app.config import settings

logger = logging.getLogger(__name__)


async def process_transcript(transcript: str) -> dict:
    """Behandl en mødetransskription og returner sammenfatning + handlingspunkter."""
    prompt = f"""Du er en professionel mødesekretær. Analyser nedenstående mødetransskription og returner et JSON-objekt med præcis disse fire felter:

- "title": Kort mødetitel (maks 8 ord)
- "summary": Sammenfatning af mødet (maks 150 ord)
- "action_items": Liste af konkrete handlingspunkter med ansvarlig og deadline hvis nævnt
- "participants": Liste af navne på deltagere nævnt i transskriptionen

Returner KUN validt JSON. Ingen forklaringer, ingen markdown.

Transskription:
{transcript[:8000]}

JSON svar:"""

    if settings.anthropic_api_key:
        return await _process_with_anthropic(prompt)
    else:
        return await _process_with_ollama(prompt)


async def _process_with_anthropic(prompt: str) -> dict:
    import anthropic
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    try:
        message = await client.messages.create(
            model=settings.claude_fast_model,
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text.strip()
        return _parse_json_response(raw)
    except Exception as exc:
        logger.error("Claude API fejl i process_transcript: %s", exc)
        raise RuntimeError(f"Transskription-behandling fejlede: {exc}") from exc


async def _process_with_ollama(prompt: str) -> dict:
    import httpx
    url = f"{settings.ollama_base_url}/api/generate"
    payload = {
        "model": settings.ollama_model,
        "prompt": prompt,
        "stream": False,
        "options": {"num_predict": 400},
    }
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
            raw = data.get("response", "").strip()
        return _parse_json_response(raw)
    except Exception as exc:
        logger.error("Ollama fejl i process_transcript: %s", exc)
        raise RuntimeError(f"Transskription-behandling fejlede: {exc}") from exc


def _parse_json_response(raw: str) -> dict:
    if raw.startswith("```"):
        lines = [l for l in raw.split("\n") if not l.strip().startswith("```")]
        raw = "\n".join(lines).strip()
    try:
        data = json.loads(raw)
        return {
            "title": str(data.get("title", "Mødenotat"))[:255],
            "summary": str(data.get("summary", "")),
            "action_items": data.get("action_items", []),
            "participants": data.get("participants", []),
        }
    except json.JSONDecodeError:
        logger.warning("Kunne ikke parse JSON fra LLM — returnerer tom struktur")
        return {"title": "Mødenotat", "summary": "", "action_items": [], "participants": []}
