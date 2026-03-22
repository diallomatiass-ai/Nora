#!/bin/bash
# =============================================================================
# Nora — Hetzner VPS Bootstrap Script
# Kør én gang på en frisk Ubuntu 22.04 server
# =============================================================================
set -e

DOMAIN="${1:-}"
EMAIL="${2:-}"
APP_DIR="/opt/nora"
REPO="https://github.com/diallomatiass-ai/Nora.git"

echo "╔══════════════════════════════════════════════════════╗"
echo "║          Nora — VPS Bootstrap                       ║"
echo "╚══════════════════════════════════════════════════════╝"

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
    echo "Brug: ./deploy.sh dindomæne.dk din@email.dk"
    exit 1
fi

# ── System ────────────────────────────────────────────────────────────────────
echo ""
echo "→ Opdaterer system..."
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq curl git ufw fail2ban

# ── Docker ────────────────────────────────────────────────────────────────────
echo ""
echo "→ Installerer Docker..."
if ! command -v docker &>/dev/null; then
    curl -fsSL https://get.docker.com | bash
    usermod -aG docker "$USER" || true
fi
docker --version

# ── Firewall ──────────────────────────────────────────────────────────────────
echo ""
echo "→ Konfigurerer firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp   comment "SSH"
ufw allow 80/tcp   comment "HTTP"
ufw allow 443/tcp  comment "HTTPS"
ufw --force enable

# ── Fail2ban ──────────────────────────────────────────────────────────────────
systemctl enable fail2ban --quiet
systemctl start fail2ban

# ── Certbot / Let's Encrypt ───────────────────────────────────────────────────
echo ""
echo "→ Installerer Certbot..."
snap install --classic certbot 2>/dev/null || apt-get install -y -qq certbot

# Stopper nginx midlertidigt for at få certifikat
echo "→ Henter SSL-certifikat for $DOMAIN..."
certbot certonly --standalone \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    -d "$DOMAIN" \
    -d "www.$DOMAIN" || {
    echo "⚠️  Certbot fejlede — fortsætter uden SSL (konfigurér manuelt)"
}

# Auto-renew
echo "0 12 * * * root certbot renew --quiet --deploy-hook 'docker compose -f $APP_DIR/docker-compose.prod.yml exec nginx nginx -s reload'" \
    > /etc/cron.d/certbot-renew

# ── Klon Nora ─────────────────────────────────────────────────────────────────
echo ""
echo "→ Kloner Nora til $APP_DIR..."
if [ -d "$APP_DIR" ]; then
    cd "$APP_DIR"
    git pull origin master
else
    git clone "$REPO" "$APP_DIR"
    cd "$APP_DIR"
fi

# ── .env ──────────────────────────────────────────────────────────────────────
if [ ! -f "$APP_DIR/.env" ]; then
    echo ""
    echo "⚠️  Ingen .env fil fundet!"
    echo "   Opret $APP_DIR/.env med disse variabler:"
    cat <<'ENVTEMPLATE'

DATABASE_URL=postgresql+asyncpg://mailbot:SKIFT_MEG@localhost:5434/mailbot
REDIS_URL=redis://localhost:6380/0
SECRET_KEY=<generer med: python3 -c "import secrets; print(secrets.token_hex(32))">
ACCESS_TOKEN_EXPIRE_MINUTES=10080
POSTGRES_USER=mailbot
POSTGRES_PASSWORD=SKIFT_MEG
POSTGRES_DB=mailbot
ENCRYPTION_KEY=<generer med: python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())">
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=eu-central-1
BEDROCK_MODEL=eu.anthropic.claude-3-5-sonnet-20241022-v2:0
BEDROCK_FAST_MODEL=eu.anthropic.claude-3-haiku-20240307-v1:0
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_EMBED_MODEL=nomic-embed-text
CHROMA_HOST=localhost
CHROMA_PORT=8002
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REDIRECT_URI=https://DOMAIN/api/auth/gmail/callback
OUTLOOK_CLIENT_ID=
OUTLOOK_CLIENT_SECRET=
OUTLOOK_TENANT_ID=common
OUTLOOK_REDIRECT_URI=https://DOMAIN/api/auth/outlook/callback
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_STARTER=
STRIPE_PRICE_PRO=
STRIPE_PRICE_BUSINESS=
STRIPE_SUCCESS_URL=https://DOMAIN/billing?success=true
STRIPE_CANCEL_URL=https://DOMAIN/billing?canceled=true
FRONTEND_URL=https://DOMAIN
NEXT_PUBLIC_API_URL=/api
SENTRY_DSN=
SENTRY_ENVIRONMENT=production
LOG_LEVEL=INFO

ENVTEMPLATE
    echo "   Kør deploy.sh igen efter .env er oprettet."
    exit 1
fi

# ── Patch nginx-prod.conf med korrekt domæne ──────────────────────────────────
echo ""
echo "→ Sætter domæne i nginx-prod.conf..."
sed -i "s/DOMAIN/$DOMAIN/g" "$APP_DIR/nginx/nginx-prod.conf"

# ── Start Nora ────────────────────────────────────────────────────────────────
echo ""
echo "→ Bygger og starter Nora..."
cd "$APP_DIR"
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

echo ""
echo "→ Venter på services..."
sleep 10
docker compose -f docker-compose.prod.yml ps

# ── Ollama (embeddings) ───────────────────────────────────────────────────────
if ! command -v ollama &>/dev/null; then
    echo ""
    echo "→ Installerer Ollama..."
    curl -fsSL https://ollama.ai/install.sh | bash
    systemctl enable ollama
    systemctl start ollama
    sleep 3
    ollama pull nomic-embed-text
fi

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  ✅ Nora er oppe!                                    ║"
echo "║                                                      ║"
printf "║  URL:  https://%-37s║\n" "$DOMAIN"
echo "║                                                      ║"
echo "║  Næste skridt:                                       ║"
echo "║  1. Tilføj GitHub secrets (VPS_HOST, VPS_SSH_KEY)   ║"
echo "║  2. Udfyld AWS Bedrock nøgler i .env                ║"
echo "║  3. Udfyld Stripe nøgler i .env                     ║"
echo "║  4. Opret Gmail/Outlook OAuth apps                  ║"
echo "╚══════════════════════════════════════════════════════╝"
