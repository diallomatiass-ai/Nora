# Slagplan: Nora på det Skandinaviske Marked

Dato: 2026-03-20

---

## Fase 0 — Teknisk fundament (nu → uge 2)

### AI-motor: AWS Bedrock + EU-region (erstatter Ollama)

Ollama droppes som primær AI-motor. I stedet bruges **Claude via AWS Bedrock** i `eu-central-1` (Frankfurt).

**Arkitektur:**
```
Brugerens email → Nora VPS (EU) → AWS Bedrock eu-central-1 → Svar
                                        ↑
                          Data forlader ikke EU.
                          AWS gemmer det ikke.
                          Ingen tredjepart har adgang.
```

**Fordele:**
- Data forbliver i EU — stærkt GDPR-argument
- Langt bedre kvalitet end Mistral/tinyllama lokalt
- Ingen RAM-problemer (Ollama væk)
- Stabil og skalerbar fra dag ét

**Implementering:**
1. Opret AWS-konto → aktivér Bedrock i `eu-central-1`
2. Anmod om adgang til `anthropic.claude-haiku-3` (godkendes automatisk)
3. Byt `ai_engine.py` ud: Ollama-kald → `boto3` Bedrock-kald
4. Tilføj `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` + `AWS_REGION=eu-central-1` til `.env`

**Pris:** Claude Haiku via Bedrock ≈ $0.25/million tokens → 10.000 emails ≈ $2-3/md

**Salgstale (opdateret):**
> *"Vi bruger enterprise AI med EU-dataopbevaring. Al data proceseres i Frankfurt — ingen ChatGPT, ingen OpenAI, ingen data uden for EU."*

### Ollama (beholdes som valgfrit)
Ollama forbliver i `docker-compose.yml` som fallback for kunder der ønsker 100% lokal AI (ingen cloud overhovedet). Aktiveres via en indstilling i admin-panelet.

---

## Fase 1 — Fundament (nu → måned 2)

### Produkt: Sproglig paritet
Nora skal tale alle 4 sprog flydende — ikke bare UI-oversættelse, men AI-svar der genereres på brugerens sprog.

Konkret:
- System-prompt tilpasses per sprog (da/sv/no/en)
- AI kører via AWS Bedrock (Claude Haiku) — ingen model-download nødvendig
- UI oversættes: dansk → færdig, svensk + norsk → oversættes
- Auto-detect sprog fra indgående mail → svar på samme sprog

### ICP (Ideal Customer Profile) for Skandinavien

| Segment | Størrelse | Smertepunkt |
|---|---|---|
| Danske SMV'er (5-50 ansatte) | ~150.000 | Drukner i kunde-mails |
| Svenske SMV'er | ~200.000 | Samme |
| Norske SMV'er | ~100.000 | Dyreste arbejdskraft i Norden → størst ROI |

---

## Fase 2 — Go-to-Market (måned 2-4)

### Kanal 1: LinkedIn (organisk)
- Indhold på dansk, svensk og norsk — separate opslag
- Hook: "Din virksomhed bruger X timer om ugen på at svare mails. Nora gør det på 2 minutter."
- Målgruppe: Ejere og daglige ledere i SMV'er

### Kanal 2: Cold outreach
- Find virksomheder med 5-30 ansatte via LinkedIn Sales Navigator eller CVR-lignende registre (SE: Bolagsverket, NO: Brønnøysund)
- Personlig besked på deres sprog
- Tilbud: 30 dages gratis, ingen kreditkort

### Kanal 3: Dansk/Norsk/Svensk startup-communities
- DK: The Hub, Founders, Startupdenmark
- SE: SUP46, Minc, Sting
- NO: StartupLab, Founders

---

## Fase 3 — Vækst (måned 4-8)

### Prisstrategi (skandinavisk tilpasset)

| Plan | DKK | SEK | NOK |
|---|---|---|---|
| Starter | 299 kr/md | 399 kr/md | 399 kr/md |
| Pro | 799 kr/md | 999 kr/md | 999 kr/md |
| Business | 1.999 kr/md | 2.499 kr/md | 2.499 kr/md |

Norske kunder kan betale mere — arbejdskraften er dyrere, ROI er højere.

### GDPR som salgsargument (vigtigt i Norden)
Skandinavien er GDPR-bevidst. Noras EU-baserede AI (ingen data til OpenAI, data i Frankfurt) er en **konkurrencefordel** — markedsfør det aktivt:
> *"Al data proceseres i EU. Ingen ChatGPT. Ingen OpenAI. GDPR-compliant fra dag ét."*

### Partnerskaber
- Regnskabssystemer: e-conomic (DK), Fortnox (SE), Tripletex (NO)
- CRM'er: SuperOffice (Norden-dominerende)
- Integration = distribution

---

## Prioriteret to-do liste (teknisk)

### Sprint 1 — Produkt klar (2-3 dage)
1. **AWS Bedrock** — opret konto, aktivér Claude Haiku i eu-central-1, byt ai_engine.py ud
2. **Gmail OAuth** — Google Cloud Console projekt, OAuth credentials, test med rigtig mailkonto
3. **Hetzner VPS** — CX22 (€6/md), deploy med docker compose, SSL med Let's Encrypt
4. **Stripe nøgler** — koden er klar, bare indsæt live-nøgler i .env

### Sprint 2 — Marked klar (uge 2)
5. **Landing page** — dansk, én side, fokus på GDPR + tidsbesparelse
6. **5 beta-brugere** — find håndværkere/SMV'er via CVR-scanner, gratis adgang mod feedback

### Sprint 3 — Møde-agent (uge 2-3)

**Hvad den gør:**
- Transcriberer møder live — Teams, Zoom, Google Meet, alt der kører på PC'en
- Identificerer hvem der sagde hvad (speaker diarization)
- Identificerer action items automatisk
- Laver opsummering og referatudkast
- Sender referatmail til deltagerne når mødet slutter
- Gemmer det hele i Nora's eksisterende meetings-modul

**Arkitektur:**
```
PC Audio
    ↓
Nora Meeting Agent (Python desktop-app, ~200 linjer)
    ├── faster-whisper (lokal STT — ingen data til tredjepart)
    └── pyannote.audio (speaker diarization — lokal)
    ↓ WebSocket → Nora Backend (allerede bygget)
Real-time transcript i Nora UI
    ↓ (bruger klikker "Afslut møde")
Claude Bedrock EU → opsummering + action items + referatudkast
    ↓
Email til deltagere (allerede bygget)
```

**Hvad der bygges:**
- [ ] `nora-agent/` — Python desktop-app (`sounddevice` + `faster-whisper` + `pyannote.audio` + `websockets`)
- [ ] `POST /api/meetings/{id}/transcript-chunk` — ny backend-route
- [ ] Claude-prompt: transcript → referat + action items
- [ ] "Afslut møde + send referat" knap i meetings UI

**Hvad der IKKE skal bygges:** Backend, WebSocket, email-sending, meetings UI — eksisterer allerede.

**GDPR:** `faster-whisper` + `pyannote` kører 100% lokalt. Kun færdig tekst sendes til Nora (EU-server). Claude ser aldrig lyd — kun tekst.

### Sprint 4 — Vækst (måned 2+)
7. **Flersproget AI** — system-prompt per sprog (da/sv/no/en), auto-detect
8. **UI oversættelse** — svensk + norsk
9. **E-conomic + Fortnox integration** (åbner dørene til tusindvis af SMV'er)
10. **Teams Bot** (valgfrit) — officiel Microsoft-integration som alternativ til desktop-agenten
