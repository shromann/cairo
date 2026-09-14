#!/usr/bin/env bash
# =============================================================================
# Cairo — Step 6: Pub/Sub topics (DLQ and main)
#
# Usage:
#   source env.sh
#   bash src/cairo/ops/scripts/06-pubsub.sh
#
# Creates:
#   video-jobs-dlq  — dead-letter topic for failed messages
#   video-jobs      — main work queue (one message = 8 videos for GPU batching)
#
# The subscription that wires video-jobs -> cairo-worker is created in
# src/cairo/ops/scripts/08-smoke-test.sh (needs the worker's Cloud Run URL).
#
# Idempotent: creating an existing topic is a no-op.
# =============================================================================

set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

# ---------------------------------------------------------------------------
# Guards
# ---------------------------------------------------------------------------
: "${PROJECT_ID:?env.sh not sourced — run: source env.sh}"
: "${PROJECT_NUMBER:?PROJECT_NUMBER missing — run src/cairo/ops/scripts/01-provision.sh first}"
: "${TOPIC:?TOPIC is required}"
: "${DLQ:?DLQ is required}"

log() { echo "[06-pubsub] $*"; }
die() { echo "[06-pubsub] ERROR: $*" >&2; exit 1; }

readonly SA_PUBSUB="service-${PROJECT_NUMBER}@gcp-sa-pubsub.iam.gserviceaccount.com"

# ---------------------------------------------------------------------------
# Create a Pub/Sub topic (idempotent)
# ---------------------------------------------------------------------------
ensure_topic() {
  local name="$1"
  if gcloud pubsub topics describe "$name" &>/dev/null; then
    log "Topic '${name}' already exists — skipping."
  else
    log "Creating topic '${name}'..."
    gcloud pubsub topics create "$name"
    log "Topic '${name}' created."
  fi
}

# ---------------------------------------------------------------------------
# Grant the Pub/Sub service account the ability to impersonate itself
# (required for push subscriptions with authentication)
# ---------------------------------------------------------------------------
bind_pubsub_token_creator() {
  log "Binding roles/iam.serviceAccountTokenCreator to Pub/Sub service account..."
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SA_PUBSUB}" \
    --role="roles/iam.serviceAccountTokenCreator" \
    --condition=None \
    --quiet
  log "Binding applied."
}

# ---------------------------------------------------------------------------
# Allow Pub/Sub service account to publish to the DLQ
# (required when a subscription's dead-letter policy is active)
# ---------------------------------------------------------------------------
bind_dlq_publisher() {
  log "Granting Pub/Sub service account publisher rights on DLQ '${DLQ}'..."
  gcloud pubsub topics add-iam-policy-binding "$DLQ" \
    --member="serviceAccount:${SA_PUBSUB}" \
    --role="roles/pubsub.publisher"
  log "DLQ binding applied."
}

# ---------------------------------------------------------------------------
# Verify
# ---------------------------------------------------------------------------
verify() {
  log "--- Verification ---"
  local topics
  topics=$(gcloud pubsub topics list --format='value(name)')

  for t in "$TOPIC" "$DLQ"; do
    if echo "$topics" | grep -q "$t"; then
      log "  OK: ${t}"
    else
      die "Topic not found: ${t}"
    fi
  done
  log "Verification passed."
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  log "=== Configuring Pub/Sub for project: ${PROJECT_ID} ==="

  # DLQ must exist before the main topic references it as a dead-letter target
  ensure_topic "$DLQ"
  ensure_topic "$TOPIC"

  bind_pubsub_token_creator
  bind_dlq_publisher

  verify

  log ""
  log "NOTE: The push subscription (${TOPIC} -> cairo-worker) is created in"
  log "      src/cairo/ops/scripts/08-smoke-test.sh after the worker's Cloud Run URL is known."
  log "=== 06-pubsub.sh complete ==="
}

main "$@"
