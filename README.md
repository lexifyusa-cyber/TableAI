# TableAI

Multi-tenant AI assistant SaaS for small businesses. Customer-facing PWA chat + in-store tablet experience + owner dashboard. Sold door-to-door with a pre-built demo for each prospect.

## Sales motion

The "Niagara Falls model": every prospect gets a tailored demo built ahead of time. Walk in with their AI on a tablet, scan their QR, show them their menu chatting back at them. They buy or we archive.

## Stack

- **Backend:** FastAPI, async SQLAlchemy, Postgres 16 with pgvector, Anthropic Python SDK
- **Frontend:** React + Vite + Tailwind, PWA via Workbox (next sprint)
- **DB:** Multi-tenant via shared schema + tenant_id on every row, enforced in app layer

## Local dev

```bash
# 1. Postgres
docker compose up -d

# 2. Backend
cd backend
uv sync                          # install deps (or: pip install -e .)
cp ../.env.example ../.env       # then fill in ANTHROPIC_API_KEY
uv run alembic upgrade head      # apply migrations
uv run uvicorn app.main:app --reload --port 8000
```

API at http://localhost:8000, docs at /docs.

## Demo a restaurant

```bash
curl -X POST http://localhost:8000/api/demo/generate \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.gr8indianfood.com/", "slug": "gif"}'
```

Then visit http://localhost:8000/api/menu?tenant=gif to see the imported data.

## Layout

```
backend/
  app/
    api/           HTTP endpoints
    services/      LLM, scraper, demo-generator, POS clients
    models/        SQLAlchemy ORM (tenants, menus, conversations, ...)
    middleware/    Subdomain → tenant resolution
    prompts/       System prompts for Claude
  alembic/         DB migrations
frontend/          React PWA (next sprint)
```
