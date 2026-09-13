#!/usr/bin/env bash
# =============================================================================
# Cairo — Step 9: Build and deploy the real cairo-web (FastAPI) container
#
# Usage:
#   source ../env.sh
#   bash infra/09-deploy.sh
#
# Builds the image in infra/../Dockerfile via Cloud Build, pushes it to the
# Artifact Registry repo created in 07-artifact-registry.sh, and deploys it to
# the cairo-web Cloud Run service (replacing the hello-world placeholder from
# 08-smoke-test.sh).
#
# Only cairo-web is deployed here. cairo-worker is not deployed because the
# async video-processing worker (the Pub/Sub push handler at /worker/pubsub)
# has not been implemented yet — see src/cairo/backend/README.md.
#
# Idempotent: re-running rebuilds the image and redeploys the same revision
# name; Cloud Run keeps the old revision available for rollback.
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Guards
# ---------------------------------------------------------------------------
: "${PROJECT_ID:?env.sh not sourced — run: source env.sh}"
: "${REGION:?REGION is required}"
: "${REGISTRY:?REGISTRY missing — run infra/07-artifact-registry.sh first}"
: "${SQL_CONNECTION:?SQL_CONNECTION missing — run infra/04-database.sh first}"
: "${SQL_DB:?SQL_DB is required}"
: "${SQL_USER:?SQL_USER is required}"
: "${BUCKET_MEDIA:?BUCKET_MEDIA is required}"
: "${TOPIC:?TOPIC is required}"
: "${SA_WEB:?SA_WEB not set}"

log() { echo "[09-deploy] $*"; }
die() { echo "[09-deploy] ERROR: $*" >&2; exit 1; }

readonly IMAGE="${REGISTRY}/cairo-web:latest"
readonly CORS_ORIGINS="${CORS_ORIGINS:-http://localhost:4321}"
readonly REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ---------------------------------------------------------------------------
# Build and push the image via Cloud Build
# ---------------------------------------------------------------------------
build_image() {
  log "Submitting build for ${IMAGE}..."
  gcloud builds submit "$REPO_ROOT" --tag "$IMAGE"
  log "Image pushed."
}

# ---------------------------------------------------------------------------
# Deploy to Cloud Run
#
# DB_PASSWORD is projected from Secret Manager, never passed as plaintext.
# The Cloud SQL Python connector (used by cairo.backend.db) talks to the
# Cloud SQL Admin API directly via the attached service account's ADC —
# no --add-cloudsql-instances sidecar is required.
# ---------------------------------------------------------------------------
deploy_web() {
  log "Deploying ${IMAGE} to cairo-web..."
  gcloud run deploy cairo-web \
    --image="$IMAGE" \
    --region="$REGION" \
    --service-account="$SA_WEB" \
    --allow-unauthenticated \
    --set-env-vars="APP_ENV=production,SQL_CONNECTION=${SQL_CONNECTION},DB_USER=${SQL_USER},DB_NAME=${SQL_DB},BUCKET_MEDIA=${BUCKET_MEDIA},TOPIC=${TOPIC},CORS_ORIGINS=${CORS_ORIGINS}" \
    --set-secrets="DB_PASSWORD=cairo-db-password:latest" \
    --min-instances=0 \
    --max-instances=10 \
    --quiet
  log "cairo-web deployed."
}

# ---------------------------------------------------------------------------
# Verify
# ---------------------------------------------------------------------------
verify() {
  log "--- Verification ---"
  local url
  url=$(gcloud run services describe cairo-web \
    --region="$REGION" \
    --format='value(status.url)')
  log "cairo-web URL: ${url}"

  local response
  response=$(curl -s --max-time 15 "${url}/api/health")
  log "Health response: ${response}"

  if [[ "$response" != *'"ok":true'* ]]; then
    die "Health check did not return ok:true. Check Cloud Run logs: gcloud run services logs read cairo-web --region=${REGION}"
  fi

  # Persist URL to env.sh for reuse (frontend config, docs, etc.)
  if grep -q '^export WEB_URL=' "${REPO_ROOT}/env.sh" 2>/dev/null; then
    sed -i.bak "s|^export WEB_URL=.*|export WEB_URL=\"${url}\"|" "${REPO_ROOT}/env.sh"
    rm -f "${REPO_ROOT}/env.sh.bak"
  else
    echo "" >> "${REPO_ROOT}/env.sh"
    echo "# Populated by infra/09-deploy.sh" >> "${REPO_ROOT}/env.sh"
    echo "export WEB_URL=\"${url}\"" >> "${REPO_ROOT}/env.sh"
  fi

  log "Verification passed."
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  log "=== Deploying cairo-web to Cloud Run ==="
  build_image
  deploy_web
  verify
  log ""
  log "NOTE: cairo-worker still runs the hello-world placeholder from"
  log "      08-smoke-test.sh. Implement the /worker/pubsub handler before"
  log "      deploying a real image to it, then repeat this script's"
  log "      build/deploy pattern with --image=\${REGISTRY}/cairo-worker:latest"
  log "      and SA_WORKER."
  log "=== 09-deploy.sh complete ==="
}

main "$@"
