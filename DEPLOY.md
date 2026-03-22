# Nora — Deploy Guide

## Hvad er hvad

| Fil | Brug |
|-----|------|
| `docker-compose.yml` | Lokal udvikling (live-reload, volume mounts) |
| `docker-compose.prod.yml` | Produktion (ingen volume mounts, alle services restart:always) |
| `nginx/nginx.conf` | Lokal nginx (HTTP only, port 9090) |
| `nginx/nginx-prod.conf` | Produktion nginx (HTTPS, rate limiting, gzip, security headers) |
| `deploy.sh` | Kør én gang på frisk Hetzner VPS |
| `.github/workflows/deploy.yml` | Auto-deploy ved git push til master |

---

## 1. Forbered Hetzner VPS

### Anbefalet server
- **Type**: CX21 (2 vCPU, 4 GB RAM) eller CX31 (2 vCPU, 8 GB RAM)
- **OS**: Ubuntu 22.04
- **Region**: Nuremberg / Falkenstein (EU)

### Bootstrap
```bash
# Upload og kør bootstrap script
scp deploy.sh root@DIN_SERVER_IP:/root/
ssh root@DIN_SERVER_IP "bash /root/deploy.sh nora.ditdomæne.dk din@email.dk"
```

Scriptet installerer automatisk: Docker, ufw, fail2ban, certbot, Let's Encrypt SSL, kloner repoet.

### Upload .env
```bash
scp .env root@DIN_SERVER_IP:/opt/nora/.env
```

---

## 2. GitHub Actions CI/CD

Tilføj disse secrets i GitHub → Settings → Secrets → Actions:

| Secret | Indhold |
|--------|---------|
| `VPS_HOST` | IP-adressen på din Hetzner server |
| `VPS_USER` | `root` (eller din deployment-bruger) |
| `VPS_SSH_KEY` | Privat SSH-nøgle (indhold af `~/.ssh/id_rsa`) |
| `VPS_PORT` | `22` (valgfri, default er 22) |

### Generer SSH-nøgle til deployment
```bash
# På din lokale maskine
ssh-keygen -t ed25519 -C "nora-deploy" -f ~/.ssh/nora_deploy

# Tilføj public key til serveren
ssh-copy-id -i ~/.ssh/nora_deploy.pub root@DIN_SERVER_IP

# Kopier private key indhold → indsæt som VPS_SSH_KEY secret
cat ~/.ssh/nora_deploy
```

Efter setup: hvert `git push origin master` deployer automatisk til serveren.

---

## 3. Tjenester du skal oprette

### AWS Bedrock (AI-motor)
1. Log ind på AWS Console → IAM → Opret bruger `nora-bedrock`
2. Giv policy: `AmazonBedrockFullAccess`
3. Opret access key → gem i `.env`:
   ```
   AWS_ACCESS_KEY_ID=AKIA...
   AWS_SECRET_ACCESS_KEY=...
   ```
4. Aktivér Claude modeller i AWS Bedrock console (eu-central-1):
   - `eu.anthropic.claude-3-5-sonnet-20241022-v2:0`
   - `eu.anthropic.claude-3-haiku-20240307-v1:0`

### Stripe (betaling)
1. Opret konto på stripe.com
2. Opret 3 produkter (Starter / Pro / Business) med månedlige priser
3. Gem price IDs + secret key i `.env`:
   ```
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_PUBLISHABLE_KEY=pk_live_...
   STRIPE_PRICE_STARTER=price_...
   STRIPE_PRICE_PRO=price_...
   STRIPE_PRICE_BUSINESS=price_...
   ```
4. Webhooks → Tilføj endpoint: `https://nora.ditdomæne.dk/api/billing/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
   - Gem `STRIPE_WEBHOOK_SECRET=whsec_...`

### Gmail OAuth (venter på CVR)
1. Google Cloud Console → Nyt projekt
2. APIs → Gmail API aktivér
3. OAuth consent screen → External → Udfyld app info
4. Credentials → OAuth 2.0 Client ID → Web application
   - Redirect URI: `https://nora.ditdomæne.dk/api/auth/gmail/callback`
5. Gem i `.env`: `GMAIL_CLIENT_ID` + `GMAIL_CLIENT_SECRET`

### Microsoft/Outlook OAuth (venter på CVR)
1. Azure Portal → App registrations → New registration
2. Platform: Web, Redirect URI: `https://nora.ditdomæne.dk/api/auth/outlook/callback`
3. Certificates & secrets → New client secret
4. Gem i `.env`: `OUTLOOK_CLIENT_ID` + `OUTLOOK_CLIENT_SECRET`

### Sentry (fejlsporing — valgfri)
1. Opret projekt på sentry.io
2. Gem `SENTRY_DSN=https://...@sentry.io/...` i `.env`

---

## 4. Produktion .env (komplet skabelon)

```env
# Database
POSTGRES_USER=mailbot
POSTGRES_PASSWORD=STÆRK_ADGANGSKODE
POSTGRES_DB=mailbot
DATABASE_URL=postgresql+asyncpg://mailbot:STÆRK_ADGANGSKODE@localhost:5434/mailbot

# Redis
REDIS_URL=redis://localhost:6380/0

# JWT
SECRET_KEY=<python3 -c "import secrets; print(secrets.token_hex(32))">
ACCESS_TOKEN_EXPIRE_MINUTES=10080

# Kryptering
ENCRYPTION_KEY=<python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())">

# AWS Bedrock
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=eu-central-1
BEDROCK_MODEL=eu.anthropic.claude-3-5-sonnet-20241022-v2:0
BEDROCK_FAST_MODEL=eu.anthropic.claude-3-haiku-20240307-v1:0

# Ollama (embeddings)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_EMBED_MODEL=nomic-embed-text

# ChromaDB
CHROMA_HOST=localhost
CHROMA_PORT=8002

# Gmail OAuth
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REDIRECT_URI=https://nora.ditdomæne.dk/api/auth/gmail/callback

# Outlook OAuth
OUTLOOK_CLIENT_ID=
OUTLOOK_CLIENT_SECRET=
OUTLOOK_TENANT_ID=common
OUTLOOK_REDIRECT_URI=https://nora.ditdomæne.dk/api/auth/outlook/callback

# Stripe
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_STARTER=
STRIPE_PRICE_PRO=
STRIPE_PRICE_BUSINESS=
STRIPE_SUCCESS_URL=https://nora.ditdomæne.dk/billing?success=true
STRIPE_CANCEL_URL=https://nora.ditdomæne.dk/billing?canceled=true

# Frontend
NEXT_PUBLIC_API_URL=/api
FRONTEND_URL=https://nora.ditdomæne.dk

# Sentry
SENTRY_DSN=
SENTRY_ENVIRONMENT=production
LOG_LEVEL=INFO

# Mail sync
MAIL_SYNC_INTERVAL_SECONDS=60
```
