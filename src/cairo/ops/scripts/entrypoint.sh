#!/usr/bin/env bash
# Apply migrations (idempotent), then serve. Cloud Run sets $PORT.
set -euo pipefail
cd /app
if [[ "${SKIP_MIGRATIONS:-0}" != "1" ]]; then
  echo "[entrypoint] alembic upgrade head"
  alembic -c /app/src/cairo/backend/alembic.ini upgrade head
fi
exec uvicorn cairo.backend.api:app --host 0.0.0.0 --port "${PORT:-8080}" --workers 1 --timeout-keep-alive 75
