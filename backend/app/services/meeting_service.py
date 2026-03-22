"""Mødenotat-service — bruger AWS Bedrock (Claude) til at behandle transskriptioner."""

from __future__ import annotations

import json
import logging

logger = logging.getLogger(__name__)


async def process_transcript(transcript: str) -> dict:
    """Behandl en mødetransskription og returner sammenfatning + handlingspunkter."""
    from app.services.ai_engine import _call_bedrock_async

    prompt = f"""Du er en professionel mødesekretær. Analyser nedenstående mødetransskription og returner et JSON-objekt med præcis disse fire felter:

- "title": Kort mødetitel (maks 8 ord)
- "summary": Sammenfatning af mødet (maks 150 ord)
- "action_items": Liste af konkrete handlingspunkter med ansvarlig og deadline hvis nævnt
- "participants": Liste af navne på deltagere nævnt i transskriptionen

Returner KUN validt JSON. Ingen forklaringer, ingen markdown.

Transskription:
{transcript[:8000]}

JSON svar:"""

    try:
        raw = await _call_bedrock_async(prompt, max_tokens=1024)
        return _parse_json_response(raw.strip())
    except Exception as exc:
        logger.error("Bedrock fejl i process_transcript: %s", exc)
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
