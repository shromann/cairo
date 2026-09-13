#!/usr/bin/env bash
# =============================================================================
# Cairo — Step 9: build the cairo-web image with Cloud Build and deploy to Cloud Run
#   source env.sh && infra/09-deploy-web.sh            # build + deploy
#   infra/09-deploy-web.sh --dry-run                    # print the commands only
# Requires steps 01-07 (APIs, IAM, bucket, Cloud SQL, secret, artifact registry).
# =============================================================================
set -euo pipefail
: "${PROJECT_ID:?env.sh not sourced}"; : "${REGION:?}"; : "${REPO:?}"; : "${SQL_CONNECTION:?run infra/04-database.sh}"
: "${SQL_DB:=cairo}"; : "${SQL_USER:=cairo_app}"; : "${BUCKET_MEDIA:=${PROJECT_ID}-media}"
SERVICE="${SERVICE:-cairo-web}"
TAG="${TAG:-$(git -C "$(dirname "$0")/.." rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M)}"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${SERVICE}:${TAG}"
SA_WEB="${SA_WEB:-cairo-web@${PROJECT_ID}.iam.gserviceaccount.com}"
DRY=0; [[ "${1:-}" == "--dry-run" ]] && DRY=1
run() { echo "+ $*"; [[ $DRY -eq 1 ]] || "$@"; }

echo "[09-deploy-web] project=${PROJECT_ID} region=${REGION} service=${SERVICE}"
echo "[09-deploy-web] image=${IMAGE}"
echo "[09-deploy-web] cloud sql=${SQL_CONNECTION} db=${SQL_DB} user=${SQL_USER} bucket=gs://${BUCKET_MEDIA}"

# 1. build (Cloud Build; no local Docker needed). The image bakes CPU torch + PanEcho weights (~2 GB).
run gcloud builds submit "$(dirname "$0")/.." --tag "$IMAGE" --timeout=1800 --machine-type=e2-highcpu-8

# 2. deploy. Inference runs on CPU inside the request: 2 vCPU / 4 GiB, one request at a time, 5-min timeout.
run gcloud run deploy "$SERVICE" \
  --image="$IMAGE" \
  --region="$REGION" \
  --service-account="$SA_WEB" \
  --allow-unauthenticated \
  --port=8080 \
  --cpu=2 --memory=4Gi --concurrency=4 --timeout=300 \
  --min-instances=0 --max-instances=3 \
  --add-cloudsql-instances="$SQL_CONNECTION" \
  --set-env-vars="APP_ENV=production,SQL_CONNECTION=${SQL_CONNECTION},DB_NAME=${SQL_DB},DB_USER=${SQL_USER},BUCKET_MEDIA=${BUCKET_MEDIA},CAIRO_MP4_CACHE=/tmp/mp4" \
  --set-secrets="DB_PASSWORD=cairo-db-password:latest"

[[ $DRY -eq 1 ]] && exit 0
URL=$(gcloud run services describe "$SERVICE" --region="$REGION" --format='value(status.url)')
echo "[09-deploy-web] ${URL}"
curl -sf "${URL}/api/health" && echo
