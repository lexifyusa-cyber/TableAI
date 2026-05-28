#!/usr/bin/env bash
# Production entrypoint for TableAI on Fly (tableai-dev).
#
# Code is baked into the image. The Fly volume at /workspace holds data:
#   - pgdata : co-located PostgreSQL 17 + pgvector cluster (app DB)
#   - media  : owner-uploaded images (symlinked from /app/backend/static/media)
#
# Postgres runs in-container under supervisord with its data dir on the
# volume, so the DB survives deploys (the machine is replaced each release;
# the volume is not). We init the cluster + the `vector` extension on first
# boot, then hand off to supervisord. Migrations themselves run in the
# backend supervisord program every deploy, not here (here is first-boot only).
set -euo pipefail

mkdir -p /var/log /workspace/media
mkdir -p /var/run/postgresql && chown postgres:postgres /var/run/postgresql

PGDATA=/workspace/pgdata
PGBIN=/usr/lib/postgresql/17/bin
mkdir -p "$PGDATA"
chown postgres:postgres "$PGDATA"
chmod 700 "$PGDATA"

if [ ! -f "$PGDATA/PG_VERSION" ]; then
  echo "[entrypoint] initializing PostgreSQL 17 cluster at $PGDATA"
  su postgres -c "$PGBIN/initdb -D $PGDATA -U postgres --auth-local=trust --auth-host=trust --encoding=UTF8"
  {
    echo "listen_addresses = 'localhost'"
    echo "port = 5432"
    echo "shared_buffers = 128MB"
    echo "max_connections = 100"
  } >> "$PGDATA/postgresql.conf"
  su postgres -c "$PGBIN/pg_ctl -D $PGDATA -w start"
  su postgres -c "$PGBIN/createdb -h localhost -U postgres tableai" || true
  # CREATE EXTENSION must run before any alembic migration that declares a
  # Vector column. Cheap insurance even though current 0001..0007 don't use
  # one yet — the dep is in pyproject so a future migration likely will.
  su postgres -c "$PGBIN/psql -h localhost -U postgres -d tableai -c 'CREATE EXTENSION IF NOT EXISTS vector;'"
  su postgres -c "$PGBIN/psql -h localhost -U postgres -d tableai -c 'CREATE EXTENSION IF NOT EXISTS \"pgcrypto\";'"
  su postgres -c "$PGBIN/pg_ctl -D $PGDATA -m fast -w stop"
  echo "[entrypoint] PostgreSQL cluster initialized (db: tableai, ext: vector + pgcrypto)"
fi

exec supervisord -c /etc/supervisor/conf.d/tableai.conf
