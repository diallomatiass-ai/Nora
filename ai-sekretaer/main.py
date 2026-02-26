"""
AI Sekretær for Byggebranchen — Ahmes-integreret
=================================================
Dansk AI-telefonreceptionist bygget med:
- Twilio ConversationRelay (telefoni + STT/TTS)
- OpenAI GPT-4o (samtalelogik)
- FastAPI (server)
- Ahmes integration (multi-tenant config + opkaldsdata)

Arkitektur:
  Kunde ringer → Twilio → ConversationRelay (STT) → WebSocket → GPT-4o →
  WebSocket → ConversationRelay (TTS) → Kunde hører svar
  → Opkald slut → POST til Ahmes webhook
"""

import os
import json
import logging
from datetime import datetime, timezone
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, WebSocket, Request, WebSocketDisconnect
from fastapi.responses import HTMLResponse, JSONResponse
from dotenv import load_dotenv
from openai import OpenAI

from config.settings import Settings
from config.prompts import get_system_prompt
from services.call_logger import CallLogger
from services.notification import NotificationService
from services.customer_lookup import CustomerLookup

# ── Setup ──────────────────────────────────────────────────────────────

load_dotenv()
settings = Settings()

# Opret logs-mappe
os.makedirs("logs", exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("logs/ai-sekretaer.log", encoding="utf-8"),
    ],
)
logger = logging.getLogger("ai-sekretaer")

openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)
call_logger = CallLogger(log_dir="logs/calls")
notifier = NotificationService(settings)
customer_lookup = CustomerLookup(data_file="data/customers.json")

# Per-call config cache: call_sid → Ahmes config dict
_call_configs: dict[str, dict] = {}


# ── Ahmes Config Helper ──────────────────────────────────────────────

async def fetch_ahmes_config(to_number: str) -> dict | None:
    """Hent secretary-konfiguration fra Ahmes baseret på Twilio-nummeret."""
    if not settings.AHMES_WEBHOOK_KEY:
        logger.warning("AHMES_WEBHOOK_KEY ikke konfigureret — bruger fallback")
        return None

    url = f"{settings.AHMES_URL}/api/webhooks/secretary-config"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                url,
                params={"phone": to_number},
                headers={"X-Secretary-Key": settings.AHMES_WEBHOOK_KEY},
            )
        if resp.status_code == 200:
            config = resp.json()
            logger.info(f"Ahmes config hentet for {config.get('business_name', 'ukendt')}")
            return config
        else:
            logger.warning(f"Ahmes config fejl {resp.status_code}: {resp.text}")
            return None
    except Exception as e:
        logger.error(f"Kunne ikke hente Ahmes config: {e}")
        return None


async def post_call_to_ahmes(session: dict, to_number: str) -> bool:
    """Post opkaldsdata til Ahmes webhook efter afsluttet opkald."""
    if not settings.AHMES_WEBHOOK_KEY:
        return False

    # Map urgency
    urgency_map = {"lav": "low", "normal": "medium", "høj": "high", "akut": "high"}
    raw_urgency = session.get("customer_info", {}).get("urgency", "normal")
    urgency = urgency_map.get(raw_urgency, raw_urgency)

    # Byg transcript fra messages
    transcript_lines = []
    for msg in session.get("messages", []):
        role = msg.get("role", "unknown")
        text = msg.get("text", "")
        if role == "customer":
            transcript_lines.append(f"Kunde: {text}")
        elif role == "assistant":
            transcript_lines.append(f"AI: {text}")
    transcript = "\n".join(transcript_lines)

    customer_info = session.get("customer_info", {})
    payload = {
        "phone_number": to_number,
        "caller_name": customer_info.get("customer_name"),
        "caller_phone": customer_info.get("customer_phone"),
        "caller_address": customer_info.get("address"),
        "summary": session.get("summary", "Ingen opsummering"),
        "transcript": transcript,
        "urgency": urgency,
        "call_type": session.get("call_type"),
        "messages": session.get("messages", []),
        "called_at": session.get("started_at"),
    }

    url = f"{settings.AHMES_URL}/api/webhooks/secretary-call"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                url,
                json=payload,
                headers={
                    "X-Secretary-Key": settings.AHMES_WEBHOOK_KEY,
                    "Content-Type": "application/json",
                },
            )
        if resp.status_code == 201:
            result = resp.json()
            logger.info(f"Opkald sendt til Ahmes: {result.get('id')}")
            return True
        else:
            logger.error(f"Ahmes call POST fejl {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        logger.error(f"Kunne ikke sende opkald til Ahmes: {e}")
        return False


# ── App Lifecycle ──────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("AI Sekretær starter op...")
    logger.info(f"   Server: {settings.DOMAIN}")
    logger.info(f"   Port: {settings.PORT}")
    logger.info(f"   Ahmes URL: {settings.AHMES_URL}")
    logger.info(f"   Viderestillingstilstand: {settings.FORWARDING_MODE}")
    # GDPR: Slet gamle opkaldslogger ved startup
    deleted = call_logger.cleanup_old_calls(max_age_days=settings.DATA_RETENTION_DAYS)
    if deleted:
        logger.info(f"   GDPR oprydning: {deleted} gamle opkald slettet")
    yield
    logger.info("AI Sekretær lukker ned.")


app = FastAPI(
    title="AI Sekretær - Byggebranchen",
    version="2.0.0",
    lifespan=lifespan,
)


# ── Health Check ───────────────────────────────────────────────────────

@app.get("/")
async def health():
    return {
        "status": "running",
        "service": "AI Sekretær",
        "version": "2.0.0",
        "ahmes_integration": bool(settings.AHMES_WEBHOOK_KEY),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ── Twilio Webhook: Incoming Call ──────────────────────────────────────

@app.api_route("/incoming-call", methods=["GET", "POST"])
async def incoming_call(request: Request):
    """
    Twilio kalder denne endpoint når et opkald kommer ind.
    Understøtter betinget viderestilling: læser ForwardedFrom for at
    identificere det originale firmanummer. Henter config fra Ahmes
    eller lokal customer_lookup.
    """
    # Hent Twilio request params
    if request.method == "POST":
        form = await request.form()
        params = dict(form)
    else:
        params = dict(request.query_params)

    to_number = params.get("To", settings.TWILIO_PHONE_NUMBER)
    forwarded_from = params.get("ForwardedFrom", "")
    call_sid = params.get("CallSid", "unknown")
    caller_number = params.get("From", "")

    if forwarded_from:
        logger.info(
            f"Indgaaende opkald til {to_number} "
            f"(viderestillet fra {forwarded_from}, SID: {call_sid})"
        )
    else:
        logger.info(f"Indgaaende opkald til {to_number} (SID: {call_sid})")

    # Lookup-nummer: brug ForwardedFrom hvis tilgængeligt (betinget viderestilling),
    # ellers brug To (direkte opkald til Twilio-nummer)
    lookup_number = forwarded_from or to_number

    # 1) Prøv Ahmes config
    config = await fetch_ahmes_config(lookup_number)

    # 2) Fallback: Prøv lokal customer_lookup
    if not config:
        local_config = customer_lookup.lookup(lookup_number)
        if not local_config and forwarded_from:
            # Prøv også at slå op via original_number
            local_config = customer_lookup.lookup_by_forwarded_from(forwarded_from)
        if local_config:
            logger.info(f"Lokal config fundet for {local_config.get('business_name', 'ukendt')}")
            config = local_config

    if config:
        welcome = config.get("greeting_text", settings.WELCOME_GREETING)
        voice_id = config.get("voice_id", settings.ELEVENLABS_VOICE_ID)
        _call_configs[call_sid] = {
            **config,
            "to_number": to_number,
            "forwarded_from": forwarded_from,
            "caller_number": caller_number,
            "booking_enabled": config.get("booking_enabled", False),
        }
    else:
        # Fallback til lokale settings
        welcome = settings.WELCOME_GREETING
        voice_id = settings.ELEVENLABS_VOICE_ID
        _call_configs[call_sid] = {
            "to_number": to_number,
            "forwarded_from": forwarded_from,
            "caller_number": caller_number,
            "owner_phone": settings.OWNER_PHONE,
            "owner_name": settings.OWNER_NAME,
            "booking_enabled": False,
        }

    # WebSocket URL via Ahmes domæne med /secretary/ prefix
    ws_url = f"wss://{settings.DOMAIN}/secretary/ws"

    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <ConversationRelay
            url="{ws_url}"
            welcomeGreeting="{welcome}"
            ttsProvider="ElevenLabs"
            voice="{voice_id}"
            language="da-DK"
            transcriptionProvider="deepgram"
            speechModel="nova-2"
            dtmfDetection="true"
            interruptible="true"
            profanityFilter="false"
        />
    </Connect>
</Response>"""

    logger.info(f"   WebSocket URL: {ws_url}")
    return HTMLResponse(content=twiml, media_type="application/xml")


# ── WebSocket: Real-time Samtale ───────────────────────────────────────

@app.websocket("/ws")
async def websocket_handler(websocket: WebSocket):
    """
    WebSocket forbindelse fra Twilio ConversationRelay.

    Modtager: Transskriberet tekst fra kunden (STT)
    Sender: AI-svar som tekst (ConversationRelay konverterer til TTS)
    """
    await websocket.accept()
    logger.info("WebSocket forbindelse etableret")

    # Samtalehistorik for denne session
    session = {
        "call_sid": None,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "messages": [],
        "customer_info": {},
        "call_type": None,
        "summary": None,
    }

    # System prompt — sættes ved setup event når vi kender call_sid
    conversation_history = []
    config = None

    try:
        async for raw_message in websocket.iter_text():
            data = json.loads(raw_message)
            event_type = data.get("type", "")

            # ── Session startet ────────────────────────────────────
            if event_type == "setup":
                session["call_sid"] = data.get("callSid", "unknown")
                logger.info(f"   Call SID: {session['call_sid']}")

                # Hent config for dette opkald
                config = _call_configs.pop(session["call_sid"], None)

                # Gem config-data i session for calendar functions
                if config:
                    session["to_number"] = config.get("to_number", settings.TWILIO_PHONE_NUMBER)
                    session["booking_enabled"] = config.get("booking_enabled", False)
                else:
                    session["to_number"] = settings.TWILIO_PHONE_NUMBER
                    session["booking_enabled"] = False

                # Sæt system prompt
                if config and config.get("system_prompt"):
                    # Brug Ahmes system prompt
                    system_prompt = config["system_prompt"]
                    logger.info("Bruger Ahmes system prompt")
                else:
                    # Fallback til lokal prompt
                    system_prompt = get_system_prompt(settings)
                    logger.info("Bruger fallback system prompt")

                conversation_history.append({
                    "role": "system",
                    "content": system_prompt,
                })

            # ── Kunde har talt (transskription klar) ───────────────
            elif event_type == "prompt":
                customer_text = data.get("voicePrompt", "").strip()
                if not customer_text:
                    continue

                logger.info(f"Kunde: {customer_text}")
                session["messages"].append({
                    "role": "customer",
                    "text": customer_text,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })

                # Tilføj til samtalehistorik
                conversation_history.append({
                    "role": "user",
                    "content": customer_text,
                })

                # ── Generer AI-svar ────────────────────────────────
                try:
                    ai_text = await generate_ai_response(
                        conversation_history, session
                    )

                    logger.info(f"AI: {ai_text}")
                    session["messages"].append({
                        "role": "assistant",
                        "text": ai_text,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    })

                    conversation_history.append({
                        "role": "assistant",
                        "content": ai_text,
                    })

                    # Send svar til ConversationRelay (som konverterer til tale)
                    response_payload = {
                        "type": "text",
                        "token": ai_text,
                        "last": True,
                    }
                    await websocket.send_text(json.dumps(response_payload))

                except Exception as e:
                    logger.error(f"Fejl ved AI-svar: {e}")
                    fallback = {
                        "type": "text",
                        "token": "Undskyld, jeg havde lidt tekniske problemer. "
                                 "Kan du prøve at gentage det?",
                        "last": True,
                    }
                    await websocket.send_text(json.dumps(fallback))

            # ── Afbrydelse (kunde taler mens AI svarer) ────────────
            elif event_type == "interrupt":
                logger.info("Kunde afbroed AI-svaret")

            # ── DTMF taster ────────────────────────────────────────
            elif event_type == "dtmf":
                digit = data.get("digit", "")
                logger.info(f"DTMF: {digit}")
                if digit == "1":
                    # GDPR: Kunden vælger telefonsvarer i stedet for AI
                    logger.info("Kunde valgte telefonsvarer (DTMF 1)")
                    session["call_type"] = "voicemail"
                    end_msg = {
                        "type": "end",
                        "handoffData": json.dumps({
                            "action": "voicemail",
                            "reason": "Kunde valgte telefonsvarer via DTMF 1",
                        }),
                    }
                    await websocket.send_text(json.dumps(end_msg))
                elif digit == "0":
                    # Viderestil til ejerens mobil
                    owner_phone = settings.OWNER_PHONE
                    if config and config.get("owner_phone"):
                        owner_phone = config["owner_phone"]
                    transfer = {
                        "type": "end",
                        "handoffData": json.dumps({
                            "action": "transfer",
                            "number": owner_phone,
                        }),
                    }
                    await websocket.send_text(json.dumps(transfer))

    except WebSocketDisconnect:
        logger.info("WebSocket forbindelse lukket")
    except Exception as e:
        logger.error(f"WebSocket fejl: {e}")
    finally:
        # ── Gem opkald og send til Ahmes ─────────────────────────
        to_number = config.get("to_number", settings.TWILIO_PHONE_NUMBER) if config else settings.TWILIO_PHONE_NUMBER
        await finalize_call(session, conversation_history, to_number)


# ── AI Response Generation ─────────────────────────────────────────────

async def generate_ai_response(
    conversation_history: list, session: dict
) -> str:
    """
    Genererer AI-svar med GPT-4o.
    Bruger function calling til at detektere akutte opkald og bookning.
    """
    tools = [
        {
            "type": "function",
            "function": {
                "name": "classify_call",
                "description": "Klassificer opkaldet baseret på samtalen",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "call_type": {
                            "type": "string",
                            "enum": [
                                "tilbud",
                                "akut",
                                "spørgsmål",
                                "eksisterende_kunde",
                                "spam",
                            ],
                            "description": "Type af opkald",
                        },
                        "urgency": {
                            "type": "string",
                            "enum": ["lav", "normal", "høj", "akut"],
                        },
                        "customer_name": {"type": "string"},
                        "customer_phone": {"type": "string"},
                        "project_description": {"type": "string"},
                        "address": {"type": "string"},
                    },
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "transfer_to_owner",
                "description": "Viderestil opkaldet til ejeren/håndværkeren når det er akut",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "reason": {"type": "string"},
                    },
                    "required": ["reason"],
                },
            },
        },
    ]

    # Tilføj calendar tools hvis booking er aktiveret
    if session.get("booking_enabled"):
        tools.extend([
            {
                "type": "function",
                "function": {
                    "name": "check_availability",
                    "description": "Tjek ledige tider i håndværkerens kalender",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "preferred_date": {
                                "type": "string",
                                "description": "Foretrukken dato i YYYY-MM-DD format",
                            },
                            "flexibility_days": {
                                "type": "integer",
                                "description": "Antal dage at søge frem fra foretrukken dato",
                                "default": 3,
                            },
                            "preferred_time_of_day": {
                                "type": "string",
                                "enum": ["morning", "afternoon", "any"],
                                "default": "any",
                            },
                        },
                        "required": ["preferred_date"],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "book_appointment",
                    "description": "Book aftale i kalenderen. KUN efter kunden har bekræftet tidspunkt.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "date": {"type": "string", "description": "Dato YYYY-MM-DD"},
                            "time": {"type": "string", "description": "Tidspunkt HH:MM"},
                            "customer_name": {"type": "string"},
                            "customer_phone": {"type": "string"},
                            "customer_address": {"type": "string"},
                            "description": {"type": "string", "description": "Kort beskrivelse af opgaven"},
                            "estimated_duration_minutes": {"type": "integer", "default": 60},
                        },
                        "required": ["date", "time", "customer_name", "customer_phone", "description"],
                    },
                },
            },
        ])

    completion = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=conversation_history,
        tools=tools,
        tool_choice="auto",
        temperature=0.7,
        max_tokens=300,
    )

    message = completion.choices[0].message

    # Håndter function calls
    if message.tool_calls:
        tool_results = {}
        for tool_call in message.tool_calls:
            fn_name = tool_call.function.name
            fn_args = json.loads(tool_call.function.arguments)

            if fn_name == "classify_call":
                session["call_type"] = fn_args.get("call_type")
                session["customer_info"] = {
                    k: v
                    for k, v in fn_args.items()
                    if k != "call_type" and v
                }
                logger.info(
                    f"Opkald klassificeret: {session['call_type']} "
                    f"({fn_args.get('urgency', 'ukendt')} prioritet)"
                )
                tool_results[tool_call.id] = json.dumps({"status": "ok"})

            elif fn_name == "transfer_to_owner":
                logger.info(f"Viderestilling: {fn_args.get('reason')}")
                tool_results[tool_call.id] = json.dumps({"status": "ok"})

            elif fn_name == "check_availability":
                result = await call_ahmes_calendar_availability(session, fn_args)
                logger.info(f"Kalender-tjek: {len(result.get('slots', []))} ledige tider")
                tool_results[tool_call.id] = json.dumps(result, ensure_ascii=False)

            elif fn_name == "book_appointment":
                result = await call_ahmes_calendar_book(session, fn_args)
                logger.info(f"Booking resultat: {result.get('success')}")
                if result.get("success"):
                    session["appointment_booked"] = fn_args
                tool_results[tool_call.id] = json.dumps(result, ensure_ascii=False)

        # Hvis der er function calls men også tekst, returner teksten
        if message.content:
            return message.content

        # Ellers, bed om nyt svar efter function call
        conversation_history.append(message.model_dump())
        for tool_call in message.tool_calls:
            conversation_history.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": tool_results.get(tool_call.id, json.dumps({"status": "ok"})),
            })

        followup = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=conversation_history,
            temperature=0.7,
            max_tokens=300,
        )
        return followup.choices[0].message.content or ""

    return message.content or ""


# ── Calendar API Helpers ──────────────────────────────────────────────

async def call_ahmes_calendar_availability(session: dict, args: dict) -> dict:
    """Kald Ahmes webhook for at tjekke kalender-ledighed."""
    to_number = session.get("to_number", settings.TWILIO_PHONE_NUMBER)

    preferred_date = args["preferred_date"]
    flexibility_days = args.get("flexibility_days", 3)
    preferred_time = args.get("preferred_time_of_day", "any")

    # Beregn date_to
    from datetime import datetime as dt, timedelta
    try:
        date_from = dt.strptime(preferred_date, "%Y-%m-%d")
        date_to = (date_from + timedelta(days=flexibility_days)).strftime("%Y-%m-%d")
    except ValueError:
        return {"slots": [], "error": "Ugyldigt datoformat"}

    url = f"{settings.AHMES_URL}/api/webhooks/calendar/availability"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                url,
                params={
                    "phone": to_number,
                    "date_from": preferred_date,
                    "date_to": date_to,
                    "preferred_time": preferred_time,
                },
                headers={"X-Secretary-Key": settings.AHMES_WEBHOOK_KEY},
            )
        if resp.status_code == 200:
            return resp.json()
        logger.error(f"Calendar availability fejl {resp.status_code}: {resp.text}")
        return {"slots": [], "error": "Kunne ikke tjekke kalender"}
    except Exception as e:
        logger.error(f"Calendar availability exception: {e}")
        return {"slots": [], "error": "Kunne ikke tjekke kalender"}


async def call_ahmes_calendar_book(session: dict, args: dict) -> dict:
    """Kald Ahmes webhook for at booke aftale."""
    to_number = session.get("to_number", settings.TWILIO_PHONE_NUMBER)

    url = f"{settings.AHMES_URL}/api/webhooks/calendar/book"
    payload = {
        "phone": to_number,
        "date": args["date"],
        "time": args["time"],
        "customer_name": args["customer_name"],
        "customer_phone": args["customer_phone"],
        "customer_address": args.get("customer_address", ""),
        "description": args["description"],
        "duration": args.get("estimated_duration_minutes", 60),
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                url,
                json=payload,
                headers={
                    "X-Secretary-Key": settings.AHMES_WEBHOOK_KEY,
                    "Content-Type": "application/json",
                },
            )
        if resp.status_code == 200:
            return resp.json()
        logger.error(f"Calendar book fejl {resp.status_code}: {resp.text}")
        return {"success": False, "error": "Booking fejlede"}
    except Exception as e:
        logger.error(f"Calendar book exception: {e}")
        return {"success": False, "error": "Booking fejlede"}


# ── Post-Call Processing ───────────────────────────────────────────────

async def finalize_call(session: dict, conversation_history: list, to_number: str):
    """Gem opkaldslog, send til Ahmes, og send SMS som fallback."""
    if not session["messages"]:
        return

    # Generer opsummering med GPT
    try:
        summary_prompt = [
            {
                "role": "system",
                "content": (
                    "Opsummer dette telefonopkald kort på dansk. "
                    "Inkluder: hvem ringede, hvad ville de, "
                    "og hvad er næste skridt. Max 3 sætninger."
                ),
            },
            {
                "role": "user",
                "content": json.dumps(session["messages"], ensure_ascii=False),
            },
        ]
        summary_resp = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=summary_prompt,
            max_tokens=150,
        )
        session["summary"] = summary_resp.choices[0].message.content
    except Exception as e:
        logger.error(f"Kunne ikke generere opsummering: {e}")
        session["summary"] = "Opsummering ikke tilgængelig"

    # Gem til fil (lokal backup)
    call_logger.save(session)

    # Send til Ahmes
    ahmes_success = await post_call_to_ahmes(session, to_number)

    if not ahmes_success:
        # Fallback: Send SMS-notifikation hvis Ahmes fejler
        logger.warning("Ahmes POST fejlede — sender SMS som fallback")
        await notifier.notify_owner(session)
    else:
        logger.info("Opkald sendt til Ahmes — SMS-notifikation springes over")

    logger.info(f"Opkald afsluttet og gemt: {session.get('call_sid')}")
    logger.info(f"   Opsummering: {session.get('summary')}")


# ── API Endpoints ─────────────────────────────────────────────────────

@app.get("/api/calls")
async def get_calls():
    """Hent alle opkaldslogger."""
    return call_logger.get_all()


@app.get("/api/calls/{call_sid}")
async def get_call(call_sid: str):
    """Hent et specifikt opkald."""
    call = call_logger.get(call_sid)
    if call:
        return call
    return JSONResponse(status_code=404, content={"error": "Opkald ikke fundet"})


@app.get("/api/stats")
async def get_stats():
    """Statistik over opkald."""
    return call_logger.get_stats()


# ── Kunde-endpoints ───────────────────────────────────────────────────

@app.post("/api/customers")
async def create_customer(request: Request):
    """
    Opret ny kundekonfiguration med tildelt Twilio-nummer.
    Body: { twilio_number, business_name, business_type, owner_name, owner_phone,
            original_number, services, area, hours, email, website,
            forwarding_mode, ring_timeout }
    """
    body = await request.json()
    twilio_number = body.get("twilio_number")
    if not twilio_number:
        return JSONResponse(status_code=400, content={"error": "twilio_number er påkrævet"})

    # Tjek om nummeret allerede er tildelt
    existing = customer_lookup.lookup(twilio_number)
    if existing:
        return JSONResponse(status_code=409, content={"error": "Twilio-nummer allerede tildelt"})

    config = {
        "business_name": body.get("business_name", ""),
        "business_type": body.get("business_type", ""),
        "owner_name": body.get("owner_name", ""),
        "owner_phone": body.get("owner_phone", ""),
        "original_number": body.get("original_number", ""),
        "services": body.get("services", ""),
        "area": body.get("area", ""),
        "hours": body.get("hours", ""),
        "email": body.get("email", ""),
        "website": body.get("website", ""),
        "forwarding_mode": body.get("forwarding_mode", settings.FORWARDING_MODE),
        "ring_timeout": body.get("ring_timeout", settings.RING_TIMEOUT),
        "greeting_text": body.get("greeting_text", ""),
        "voice_id": body.get("voice_id", settings.ELEVENLABS_VOICE_ID),
    }

    result = customer_lookup.create(twilio_number, config)
    return JSONResponse(status_code=201, content=result)


@app.get("/api/customers")
async def list_customers():
    """Hent alle kundekonfigurationer."""
    return customer_lookup.get_all()


@app.get("/api/customers/{twilio_number}/setup-instructions")
async def get_setup_instructions(
    twilio_number: str,
    carrier: str = "tdc",
    mode: str = "",
):
    """
    Hent opsætningsinstruktioner for betinget viderestilling
    baseret på kundens teleselskab.
    """
    # Hent kundens config for at bruge deres forwarding_mode som default
    customer_config = customer_lookup.lookup(twilio_number)
    forwarding_mode = mode or (
        customer_config.get("forwarding_mode", settings.FORWARDING_MODE)
        if customer_config else settings.FORWARDING_MODE
    )
    ring_timeout = (
        customer_config.get("ring_timeout", settings.RING_TIMEOUT)
        if customer_config else settings.RING_TIMEOUT
    )

    instructions = CustomerLookup.get_setup_instructions(
        twilio_number=twilio_number,
        carrier=carrier,
        forwarding_mode=forwarding_mode,
        ring_timeout=ring_timeout,
    )

    if "error" in instructions:
        return JSONResponse(status_code=400, content=instructions)
    return instructions


# ── GDPR-endpoints ────────────────────────────────────────────────────

@app.delete("/api/gdpr/delete/{phone_number}")
async def gdpr_delete(phone_number: str):
    """Slet alle gemte data for et telefonnummer (GDPR sletningsret)."""
    deleted = call_logger.delete_customer_data(phone_number)
    return {
        "phone_number": phone_number,
        "deleted_records": deleted,
        "message": f"{deleted} opkaldsposter slettet",
    }


@app.get("/api/gdpr/export/{phone_number}")
async def gdpr_export(phone_number: str):
    """Eksportér alle gemte data for et telefonnummer (GDPR indsigtsret)."""
    records = call_logger.export_customer_data(phone_number)
    return {
        "phone_number": phone_number,
        "record_count": len(records),
        "records": records,
    }


# ── Server Entry Point ─────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=True,
        log_level="info",
    )
