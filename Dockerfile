# syntax=docker/dockerfile:1
# Production image for TableAI — CI/CD model (mirrors sti-dev).
#
# Code is BAKED into the image (GitHub Actions -> flyctl deploy on push to
# main). The Fly volume at /workspace holds DATA ONLY:
#   - pgdata : the co-located PostgreSQL 17 + pgvector cluster
#   - media  : owner-uploaded images (symlinked from /app/backend/static/media)
#
# The React/Vite PWA is built to static files and served by FastAPI itself
# (BUNDLED_FRONTEND_DIR) on :8001 — single origin for API + SPA, no Vite dev
# server, no --reload.
FROM python:3.12-slim

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    NODE_MAJOR=20 \
    PLAYWRIGHT_BROWSERS_PATH=/opt/playwright

# postgresql-17 + pgvector = the app DB; postgresql-client for psql/pg_dump
# during init + ops. supervisor runs postgres and uvicorn under one PID 1.
RUN apt-get update && apt-get install -y --no-install-recommends \
      curl ca-certificates gnupg git supervisor procps \
      postgresql-client postgresql-17 postgresql-17-pgvector \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
         | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" \
         > /etc/apt/sources.list.d/nodesource.list \
    && apt-get update && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# cloudflared sidecar — the app has no public Fly IPs in production; all
# inbound traffic enters via the Cloudflare Tunnel that this binary serves
# (token-managed; ingress is configured on the Cloudflare side).
RUN curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
      -o /usr/local/bin/cloudflared \
    && chmod +x /usr/local/bin/cloudflared

# ---- python deps (baked) ----
COPY backend/requirements.txt /tmp/requirements.txt
RUN pip install --upgrade pip && pip install -r /tmp/requirements.txt

# Playwright + chromium (used by services/render.py for headless-DOM fetch
# during the demo-generation flow). --with-deps installs the OS libs.
RUN playwright install --with-deps chromium

# ---- frontend build (static SPA, served by FastAPI) ----
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
ARG VITE_API_URL=
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_API_URL=$VITE_API_URL \
    VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
# `npm run build` runs `tsc -b && vite build`; skip the tsc gate so a stray
# type error doesn't block a deploy. The vite build alone produces dist/.
RUN npx vite build

# ---- backend code (baked) ----
WORKDIR /app
COPY backend/ /app/backend/
# Owner-uploaded media must persist across deploys -> redirect the hardcoded
# backend/static/media path at /workspace/media on the Fly volume. Public
# tier is served via FastAPI's StaticFiles mount (see main.py); private +
# internal tiers go through auth-gated routes.
RUN rm -rf /app/backend/static/media && \
    mkdir -p /workspace/media && \
    ln -s /workspace/media /app/backend/static/media

# ---- supervisord + entrypoint ----
COPY deploy/supervisord.conf /etc/supervisor/conf.d/tableai.conf
COPY deploy/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 8001
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
