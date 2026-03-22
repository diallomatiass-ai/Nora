# CLAUDE.md - Nora Project

## Ressourcehåndtering

Før du starter arbejde på dette projekt, stop altid andre Docker-projekter for at frigøre RAM:

```bash
# Stop andre projekter (kør dette først)
cd /home/ahmes/coas-20 && docker compose down 2>/dev/null
cd /home/ahmes/ebistrade && docker compose down 2>/dev/null
docker stop open-webui 2>/dev/null

# Gå tilbage til Nora
cd /home/ahmes/nora
```

## Projekt-info

- **Navn**: Nora (AI Mailbot / Ahmes)
- **Lokation**: /home/ahmes/nora
- **GitHub**: https://github.com/diallomatiass-ai/Nora.git

## Før Docker Compose

Tjek altid at `.env` filen eksisterer før `docker compose up`:

```bash
if [ ! -f .env ]; then
  cp .env.example .env
  echo "⚠️  Oprettet .env fra .env.example - tjek og opdater værdier"
fi
```

## Nødvendige environment variabler

- NEXT_PUBLIC_API_URL
- POSTGRES_USER
- POSTGRES_PASSWORD
- POSTGRES_DB
