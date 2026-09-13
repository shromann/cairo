# syntax=docker/dockerfile:1.7
# cairo-web: FastAPI (PanEcho inference + DB API) serving the built Astro frontend from one container.
# Built by Cloud Build (scripts/09-deploy-web.sh); runs on Cloud Run with Cloud SQL via the connector.

# ---- stage 1: frontend ------------------------------------------------------------------------
FROM node:22-slim AS frontend
WORKDIR /app/frontend
COPY src/cairo/frontend/package.json src/cairo/frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY src/cairo/frontend/ ./
# API is same-origin in the container; GLB heart on.
ENV PUBLIC_API_URL="" PUBLIC_HEART_RENDERER=glb ASTRO_TELEMETRY_DISABLED=1
RUN npm run build

# ---- stage 2: backend --------------------------------------------------------------------------
FROM python:3.12-slim AS backend
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 UV_SYSTEM_PYTHON=1 UV_COMPILE_BYTECODE=1 \
    TORCH_HOME=/opt/torch-cache CAIRO_MP4_CACHE=/tmp/mp4 CAIRO_STATIC_DIR=/app/frontend/dist
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg libgl1 libglib2.0-0 git \
    && rm -rf /var/lib/apt/lists/*
COPY --from=ghcr.io/astral-sh/uv:0.5 /uv /usr/local/bin/uv
WORKDIR /app
COPY pyproject.toml README.md ./
COPY src ./src
# CPU-only torch keeps the image ~2 GB instead of ~7 GB with CUDA wheels.
RUN uv pip install --index-strategy unsafe-best-match \
      --extra-index-url https://download.pytorch.org/whl/cpu \
      torch torchvision \
    && uv pip install -e .
COPY alembic.ini ./
# alembic migrations live inside src/cairo/backend/alembic/ — already copied above via COPY src ./src
# Bake PanEcho weights + ConvNeXt backbone into the image so cold starts don't hit GitHub.
RUN python -c "import torch; torch.hub.load('CarDS-Yale/PanEcho', 'PanEcho', tasks='all', trust_repo=True, verbose=False); print('PanEcho cached')"
COPY --from=frontend /app/frontend/dist ./frontend/dist
COPY scripts/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh
EXPOSE 8080
CMD ["/app/entrypoint.sh"]
