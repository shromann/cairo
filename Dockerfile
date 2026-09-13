# =============================================================================
# Cairo — cairo-web (FastAPI) container image
#
# Build (local):   docker build -t cairo-web .
# Build (GCP):     gcloud builds submit --tag "$REGISTRY/cairo-web:latest" .
#                  (see infra/09-deploy.sh)
#
# Cloud Run injects $PORT; uvicorn binds to it at runtime via the CMD below.
# =============================================================================
FROM python:3.12-slim AS base

# ffmpeg: required by cairo.backend.api.stream_video() to transcode AVI -> MP4.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir uv

WORKDIR /app

# Install dependencies first so this layer is cached across source-only edits.
COPY pyproject.toml uv.lock README.md ./
RUN uv sync --frozen --no-install-project --no-dev

COPY src ./src
RUN uv sync --frozen --no-dev

ENV PATH="/app/.venv/bin:${PATH}"
ENV PYTHONUNBUFFERED=1

EXPOSE 8080

CMD ["sh", "-c", "uvicorn cairo.backend.api:app --host 0.0.0.0 --port ${PORT:-8080}"]
