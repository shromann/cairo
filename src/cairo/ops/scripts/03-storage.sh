#!/usr/bin/env bash
# =============================================================================
# Cairo — Step 3: Cloud Storage bucket, CORS, and lifecycle policy
#
# Usage:
#   source env.sh
#   bash src/cairo/ops/scripts/03-storage.sh
#
# Creates one bucket with two logical prefixes:
#   uploads/   — AVI files uploaded directly by the browser via signed URL
#   reports/   — PDF reports written by the worker
#
# Idempotent: bucket creation and policy updates are safe to re-run.
# =============================================================================

set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

# ---------------------------------------------------------------------------
# Guards
# ---------------------------------------------------------------------------
: "${PROJECT_ID:?env.sh not sourced — run: source env.sh}"
: "${REGION:?REGION is required}"
: "${BUCKET_MEDIA:?BUCKET_MEDIA is required}"
: "${SA_WEB:?SA_WEB not set}"
: "${SA_WORKER:?SA_WORKER not set}"

log() { echo "[03-storage] $*"; }
die() { echo "[03-storage] ERROR: $*" >&2; exit 1; }

readonly CORS_FILE="/tmp/cairo-cors.json"
readonly LIFECYCLE_FILE="/tmp/cairo-lifecycle.json"

# ---------------------------------------------------------------------------
# Create bucket (idempotent)
# ---------------------------------------------------------------------------
create_bucket() {
  if gcloud storage buckets describe "gs://${BUCKET_MEDIA}" &>/dev/null; then
    log "Bucket 'gs://${BUCKET_MEDIA}' already exists — skipping creation."
  else
    log "Creating bucket 'gs://${BUCKET_MEDIA}'..."
    gcloud storage buckets create "gs://${BUCKET_MEDIA}" \
      --location="$REGION" \
      --uniform-bucket-level-access \
      --public-access-prevention
    log "Bucket created."
  fi
}

# ---------------------------------------------------------------------------
# Grant bucket-level IAM (objectAdmin to web and worker)
# ---------------------------------------------------------------------------
bind_bucket_roles() {
  log "Binding storage.objectAdmin for cairo-web..."
  gcloud storage buckets add-iam-policy-binding "gs://${BUCKET_MEDIA}" \
    --member="serviceAccount:${SA_WEB}" \
    --role="roles/storage.objectAdmin"

  log "Binding storage.objectAdmin for cairo-worker..."
  gcloud storage buckets add-iam-policy-binding "gs://${BUCKET_MEDIA}" \
    --member="serviceAccount:${SA_WORKER}" \
    --role="roles/storage.objectAdmin"
}

# ---------------------------------------------------------------------------
# CORS policy
#
# Allows the browser to PUT directly to a signed URL.
# NOTE: tighten 'origin' to your Cloud Run URL before going to production.
#       Wildcard is acceptable for hackathon / development only.
# ---------------------------------------------------------------------------
apply_cors() {
  log "Writing CORS config to ${CORS_FILE}..."
  cat > "$CORS_FILE" <<'EOF'
[{
  "origin": ["*"],
  "method": ["GET", "PUT", "HEAD"],
  "responseHeader": ["Content-Type", "x-goog-resumable"],
  "maxAgeSeconds": 3600
}]
EOF

  log "Applying CORS policy..."
  gcloud storage buckets update "gs://${BUCKET_MEDIA}" --cors-file="$CORS_FILE"
  log "CORS applied."

  log "REMINDER: Tighten the CORS 'origin' to your Cloud Run URL before the demo."
}

# ---------------------------------------------------------------------------
# Lifecycle policy — delete objects older than 30 days
#
# Prevents abandoned uploads (partial AVIs, test files) from accruing cost.
# Adjust 'age' if reports need a longer retention window.
# ---------------------------------------------------------------------------
apply_lifecycle() {
  log "Writing lifecycle config to ${LIFECYCLE_FILE}..."
  cat > "$LIFECYCLE_FILE" <<'EOF'
{
  "rule": [{
    "action": {"type": "Delete"},
    "condition": {"age": 30}
  }]
}
EOF

  log "Applying lifecycle policy (30-day auto-delete)..."
  gcloud storage buckets update "gs://${BUCKET_MEDIA}" \
    --lifecycle-file="$LIFECYCLE_FILE"
  log "Lifecycle policy applied."
}

# ---------------------------------------------------------------------------
# Verify — write and read a smoke object
# ---------------------------------------------------------------------------
verify() {
  log "--- Verification ---"
  local smoke_object="gs://${BUCKET_MEDIA}/uploads/.smoke-test"

  echo "cairo-smoke-$(date -u +%s)" | \
    gcloud storage cp - "$smoke_object"

  local content
  content=$(gcloud storage cat "$smoke_object")
  log "Smoke read: ${content}"

  gcloud storage rm "$smoke_object"
  log "Verification passed."
}

# ---------------------------------------------------------------------------
# Cleanup temp files
# ---------------------------------------------------------------------------
cleanup() {
  rm -f "$CORS_FILE" "$LIFECYCLE_FILE"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  trap cleanup EXIT

  log "=== Configuring Cloud Storage: gs://${BUCKET_MEDIA} ==="
  create_bucket
  bind_bucket_roles
  apply_cors
  apply_lifecycle
  verify
  log "=== 03-storage.sh complete ==="
}

main "$@"
