"""Nora Meeting Agent — fanger systemlyd og transcriberer live.

Virker med Teams, Zoom, Google Meet — alt der kører på denne PC.
Al lyd proceseres 100% lokalt via faster-whisper.
Kun færdig tekst sendes til Nora-backend.

Brug:
    python agent.py --meeting-id <id> --server http://localhost:9090
    python agent.py --server http://localhost:9090  # opretter nyt møde automatisk
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import queue
import sys
import threading
import time
from datetime import datetime
from typing import Optional

import httpx
import numpy as np
import sounddevice as sd

try:
    from faster_whisper import WhisperModel
except ImportError:
    print("Mangler faster-whisper: pip install faster-whisper")
    sys.exit(1)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Konfiguration
# ---------------------------------------------------------------------------

SAMPLE_RATE = 16_000          # Hz — Whisper kræver 16kHz
CHUNK_SECONDS = 5             # Sekunder per transcription-chunk
SILENCE_THRESHOLD = 0.003     # RMS under denne = stilhed
WHISPER_MODEL_SIZE = "medium" # tiny/base/small/medium/large-v3
WHISPER_LANGUAGE = None       # None = auto-detect (da + en)


# ---------------------------------------------------------------------------
# Audio capture
# ---------------------------------------------------------------------------

class AudioCapture:
    """Fanger systemlyd (loopback) eller mikrofon-input."""

    def __init__(self, device_index: Optional[int] = None):
        self.device_index = device_index
        self._audio_queue: queue.Queue[np.ndarray] = queue.Queue()
        self._stream: Optional[sd.InputStream] = None
        self._running = False

    def list_devices(self) -> list[dict]:
        """List tilgængelige lydenheder."""
        devices = []
        for i, dev in enumerate(sd.query_devices()):
            if dev["max_input_channels"] > 0:
                devices.append({
                    "index": i,
                    "name": dev["name"],
                    "channels": dev["max_input_channels"],
                })
        return devices

    def start(self):
        """Start lydoptagelse."""
        self._running = True
        self._stream = sd.InputStream(
            device=self.device_index,
            samplerate=SAMPLE_RATE,
            channels=1,
            dtype="float32",
            blocksize=int(SAMPLE_RATE * 0.1),  # 100ms blokke
            callback=self._callback,
        )
        self._stream.start()
        logger.info("Lydoptagelse startet (enhed: %s)", self.device_index or "standard")

    def stop(self):
        """Stop lydoptagelse."""
        self._running = False
        if self._stream:
            self._stream.stop()
            self._stream.close()

    def _callback(self, indata: np.ndarray, frames: int, time_info, status):
        if status:
            logger.warning("Lydstatus: %s", status)
        if self._running:
            self._audio_queue.put(indata.copy().flatten())

    def get_chunk(self, seconds: float) -> Optional[np.ndarray]:
        """Hent N sekunders lyd fra køen. Returnerer None ved timeout."""
        target_samples = int(SAMPLE_RATE * seconds)
        collected: list[np.ndarray] = []
        collected_samples = 0
        deadline = time.monotonic() + seconds + 1.0

        while collected_samples < target_samples:
            try:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    break
                chunk = self._audio_queue.get(timeout=min(remaining, 0.5))
                collected.append(chunk)
                collected_samples += len(chunk)
            except queue.Empty:
                break

        if not collected:
            return None
        return np.concatenate(collected)


# ---------------------------------------------------------------------------
# Transcription
# ---------------------------------------------------------------------------

class Transcriber:
    """Transcriberer lyd med faster-whisper (100% lokalt)."""

    def __init__(self, model_size: str = WHISPER_MODEL_SIZE):
        logger.info("Indlæser Whisper %s model...", model_size)
        # compute_type="int8" er hurtig og bruger lidt RAM
        self.model = WhisperModel(model_size, device="cpu", compute_type="int8")
        logger.info("Whisper model klar")

    def transcribe(self, audio: np.ndarray) -> str:
        """Transcribér numpy audio array. Returnerer tekst."""
        rms = float(np.sqrt(np.mean(audio ** 2)))
        if rms < SILENCE_THRESHOLD:
            return ""  # Stilhed — spring over

        segments, info = self.model.transcribe(
            audio,
            language=WHISPER_LANGUAGE,
            vad_filter=True,       # Voice Activity Detection — ignorer stilhed
            vad_parameters={
                "min_silence_duration_ms": 500,
                "threshold": 0.3,
            },
            beam_size=3,
        )

        texts = [seg.text.strip() for seg in segments]
        return " ".join(t for t in texts if t)


# ---------------------------------------------------------------------------
# Nora Backend klient
# ---------------------------------------------------------------------------

class NoraClient:
    """Sender transcription-chunks til Nora backend."""

    def __init__(self, server_url: str, token: str):
        self.server_url = server_url.rstrip("/")
        self.headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    async def create_meeting(self, title: str) -> str:
        """Opret nyt møde i Nora og returner meeting_id."""
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.server_url}/api/meetings",
                json={"title": title, "notes": ""},
                headers=self.headers,
                timeout=10.0,
            )
            resp.raise_for_status()
            data = resp.json()
            return data["id"]

    async def send_chunk(self, meeting_id: str, speaker: str, text: str, elapsed_secs: int):
        """Send et transcription-chunk til backend."""
        minutes = elapsed_secs // 60
        seconds = elapsed_secs % 60
        timestamp = f"{minutes:02d}:{seconds:02d}"

        async with httpx.AsyncClient() as client:
            try:
                resp = await client.post(
                    f"{self.server_url}/api/meetings/{meeting_id}/transcript-chunk",
                    json={"speaker": speaker, "text": text, "timestamp": timestamp},
                    headers=self.headers,
                    timeout=10.0,
                )
                resp.raise_for_status()
            except Exception as exc:
                logger.warning("Kunne ikke sende chunk til backend: %s", exc)

    async def finalize(self, meeting_id: str):
        """Afslut møde — backend genererer referat via Bedrock."""
        async with httpx.AsyncClient() as client:
            try:
                resp = await client.post(
                    f"{self.server_url}/api/meetings/{meeting_id}/finalize",
                    headers=self.headers,
                    timeout=30.0,
                )
                resp.raise_for_status()
                return resp.json()
            except Exception as exc:
                logger.error("Finalize fejlede: %s", exc)
                return None


# ---------------------------------------------------------------------------
# Login helper
# ---------------------------------------------------------------------------

async def login(server_url: str, email: str, password: str) -> str:
    """Log ind og returner JWT token."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{server_url.rstrip('/')}/api/auth/login",
            json={"email": email, "password": password},
            timeout=10.0,
        )
        resp.raise_for_status()
        return resp.json()["access_token"]


# ---------------------------------------------------------------------------
# Hoved-loop
# ---------------------------------------------------------------------------

async def run_agent(
    server_url: str,
    token: str,
    meeting_id: Optional[str],
    speaker_name: str,
    device_index: Optional[int],
):
    """Hoved-loop: optag → transcribér → send → gentag."""

    nora = NoraClient(server_url, token)

    # Opret møde hvis ikke givet
    if not meeting_id:
        title = f"Møde {datetime.now().strftime('%d. %b %Y, %H:%M')}"
        meeting_id = await nora.create_meeting(title)
        logger.info("Nyt møde oprettet: %s", meeting_id)

    capture = AudioCapture(device_index=device_index)
    transcriber = Transcriber()

    logger.info("=== Nora Meeting Agent starter ===")
    logger.info("Møde ID : %s", meeting_id)
    logger.info("Server  : %s", server_url)
    logger.info("Speaker : %s", speaker_name)
    logger.info("Tryk Ctrl+C for at stoppe og generere referat")

    capture.start()
    start_time = time.monotonic()
    chunk_count = 0

    try:
        while True:
            audio = capture.get_chunk(CHUNK_SECONDS)
            if audio is None:
                continue

            # Transcribér i thread (CPU-intensivt — bloker ikke event loop)
            text = await asyncio.to_thread(transcriber.transcribe, audio)

            if text:
                elapsed = int(time.monotonic() - start_time)
                minutes = elapsed // 60
                seconds = elapsed % 60
                logger.info("[%02d:%02d] %s: %s", minutes, seconds, speaker_name, text)

                await nora.send_chunk(
                    meeting_id=meeting_id,
                    speaker=speaker_name,
                    text=text,
                    elapsed_secs=elapsed,
                )
                chunk_count += 1

    except KeyboardInterrupt:
        logger.info("\nStopper optagelse...")

    finally:
        capture.stop()

    elapsed_total = int(time.monotonic() - start_time)
    logger.info("Møde varighed: %d min %d sek (%d chunks)", elapsed_total // 60, elapsed_total % 60, chunk_count)

    if chunk_count > 0:
        logger.info("Genererer referat via Bedrock...")
        result = await nora.finalize(meeting_id)
        if result:
            logger.info("\n=== REFERAT KLAR ===")
            logger.info("Opsummering: %s", result.get("summary", ""))
            logger.info("Åbn Nora for at se og sende referatet.")
        else:
            logger.warning("Referat-generering fejlede — se Nora for råt transcript.")
    else:
        logger.info("Ingen tale registreret.")

    logger.info("Møde ID %s — åbn %s/meetings for at se referatet", meeting_id, server_url)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

async def main():
    parser = argparse.ArgumentParser(description="Nora Meeting Agent")
    parser.add_argument("--server", default="http://localhost:9090", help="Nora server URL")
    parser.add_argument("--email", help="Nora login email")
    parser.add_argument("--password", help="Nora login password")
    parser.add_argument("--token", help="JWT token (alternativ til email/password)")
    parser.add_argument("--meeting-id", help="Eksisterende møde ID (udelad for at oprette nyt)")
    parser.add_argument("--speaker", default="Dig", help="Dit navn i transcript (default: Dig)")
    parser.add_argument("--device", type=int, help="Lydenheds-index (udelad for standard)")
    parser.add_argument("--list-devices", action="store_true", help="List lydenheder og afslut")
    parser.add_argument("--model", default=WHISPER_MODEL_SIZE,
                        choices=["tiny", "base", "small", "medium", "large-v3"],
                        help="Whisper model størrelse")
    args = parser.parse_args()

    if args.list_devices:
        capture = AudioCapture()
        devices = capture.list_devices()
        print("\nTilgængelige lydenheder:")
        for dev in devices:
            print(f"  [{dev['index']}] {dev['name']} ({dev['channels']} kanaler)")
        print("\nTip: På Linux — brug PulseAudio monitor-enhed for systemlyd (loopback)")
        print("     Eksempel: --device <index for 'Monitor of ...'>\n")
        return

    # Hent token
    token = args.token
    if not token:
        email = args.email or input("Nora email: ")
        password = args.password or input("Nora password: ")
        try:
            token = await login(args.server, email, password)
            logger.info("Logget ind.")
        except Exception as exc:
            logger.error("Login fejlede: %s", exc)
            sys.exit(1)

    await run_agent(
        server_url=args.server,
        token=token,
        meeting_id=args.meeting_id,
        speaker_name=args.speaker,
        device_index=args.device,
    )


if __name__ == "__main__":
    asyncio.run(main())
