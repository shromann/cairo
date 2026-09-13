#!/usr/bin/env bash
# =============================================================================
# Cairo — Step 8: Smoke test and budget guard
#
# Usage:
#   source env.sh
#   bash src/cairo/ops/scripts/08-smoke-test.sh
#
# Deploys Google's hello container to cairo-web, verifies it returns HTML,
# then sets up a budget alert.
#
# NOTE: The Pub/Sub push subscription wiring video-jobs -> cairo-worker is
# also created here, because it needs the worker's Cloud Run URL.
# Run this script again after the real worker image is deployed in 06-deploy.
# =============================================================================

set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

# ---------------------------------------------------------------------------
# Guards
# ---------------------------------------------------------------------------
: "${PROJECT_ID:?env.sh not sourced — run: source env.sh}"
: "${REGION:?REGION is required}"
: "${BILLING_ACCOUNT:?BILLING_ACCOUNT is required}"
: "${TOPIC:?TOPIC is required}"
: "${DLQ:?DLQ is required}"
: "${SA_WEB:?SA_WEB not set}"
: "${SA_WORKER:?SA_WORKER not set}"
: "${SA_INVOKER:?SA_INVOKER not set}"

log()  { echo "[08-smoke-test] $*"; }
warn() { echo "[08-smoke-test] WARN: $*" >&2; }
die()  { echo "[08-smoke-test] ERROR: $*" >&2; exit 1; }

readonly BUDGET_AMOUNT="100AUD"
readonly SUBSCRIPTION_NAME="${TOPIC}-push"
readonly HELLO_IMAGE="us-docker.pkg.dev/cloudrun/container/hello"

# ---------------------------------------------------------------------------
# Deploy the hello container to cairo-web
# ---------------------------------------------------------------------------
deploy_hello_web() {
  log "Deploying hello container to cairo-web..."
  gcloud run deploy cairo-web \
    --image="$HELLO_IMAGE" \
    --region="$REGION" \
    --service-account="$SA_WEB" \
    --allow-unauthenticated \
    --quiet
  log "cairo-web deployed."
}

# ---------------------------------------------------------------------------
# Retrieve and verify the web URL
# ---------------------------------------------------------------------------
verify_web() {
  log "--- Verifying cairo-web ---"
  local url
  url=$(gcloud run services describe cairo-web \
    --region="$REGION" \
    --format='value(status.url)')

  log "cairo-web URL: ${url}"

  local response
  response=$(curl -s --max-time 10 "$url" | head -5)

  if [[ -z "$response" ]]; then
    die "curl returned empty response from ${url}"
  fi
  log "Response (first 5 lines):"
  echo "$response"
  log "Web smoke test passed."

  # Persist URL to env.sh for use in 06-deploy
  if grep -q '^export WEB_URL=' "${ENV_FILE}" 2>/dev/null; then
    sed -i.bak "s|^export WEB_URL=.*|export WEB_URL=\"${url}\"|" "${ENV_FILE}"
    rm -f "${ENV_FILE}.bak"
  else
    echo "" >> "${ENV_FILE}"
    echo "# Populated by src/cairo/ops/scripts/08-smoke-test.sh" >> "${ENV_FILE}"
    echo "export WEB_URL=\"${url}\"" >> "${ENV_FILE}"
  fi
}

# ---------------------------------------------------------------------------
# Create the Pub/Sub push subscription pointing at cairo-worker
#
# The worker URL is unknown at this point (first run before real deploy).
# If WORKER_URL is set in the environment, the subscription is created now;
# otherwise a placeholder is used and this block should be re-run after deploy.
# ---------------------------------------------------------------------------
create_push_subscription() {
  if [[ -z "${WORKER_URL:-}" ]]; then
    warn "WORKER_URL not set — skipping push subscription creation."
    warn "Re-run this script after the worker is deployed:"
    warn "  export WORKER_URL=\$(gcloud run services describe cairo-worker \\
      --region=${REGION} --format='value(status.url)')"
    return
  fi

  local push_endpoint="${WORKER_URL}/worker/pubsub"

  if gcloud pubsub subscriptions describe "$SUBSCRIPTION_NAME" &>/dev/null; then
    log "Subscription '${SUBSCRIPTION_NAME}' already exists — updating push endpoint..."
    gcloud pubsub subscriptions modify-push-config "$SUBSCRIPTION_NAME" \
      --push-endpoint="$push_endpoint" \
      --push-auth-service-account="$SA_INVOKER"
    log "Push endpoint updated."
  else
    log "Creating push subscription '${SUBSCRIPTION_NAME}'..."
    gcloud pubsub subscriptions create "$SUBSCRIPTION_NAME" \
      --topic="$TOPIC" \
      --push-endpoint="$push_endpoint" \
      --push-auth-service-account="$SA_INVOKER" \
      --ack-deadline=600 \
      --dead-letter-topic="$DLQ" \
      --max-delivery-attempts=5 \
      --expiration-period=never
    log "Subscription created."
  fi
}

# ---------------------------------------------------------------------------
# Budget alert — warn at 50% and 90% of 100 AUD
# ---------------------------------------------------------------------------
create_budget() {
  log "Creating billing budget: ${BUDGET_AMOUNT}..."

  # Budget creation is not idempotent via gcloud — skip if one already exists
  local existing
  existing=$(gcloud billing budgets list \
    --billing-account="$BILLING_ACCOUNT" \
    --format='value(displayName)' 2>/dev/null | grep -c "cairo-hackathon" || true)

  if [[ "$existing" -gt 0 ]]; then
    log "Budget 'cairo-hackathon' already exists — skipping."
    return
  fi

  gcloud billing budgets create \
    --billing-account="$BILLING_ACCOUNT" \
    --display-name="cairo-hackathon" \
    --budget-amount="$BUDGET_AMOUNT" \
    --threshold-rule=percent=50 \
    --threshold-rule=percent=90

  log "Budget created with alerts at 50% and 90%."
}

# ---------------------------------------------------------------------------
# Pause reminder
# ---------------------------------------------------------------------------
print_pause_instructions() {
  log ""
  log "=== Between sessions: pause the database ==="
  log "  Stop:   gcloud sql instances patch ${SQL_INSTANCE:-cairo-db} --activation-policy=NEVER"
  log "  Resume: gcloud sql instances patch ${SQL_INSTANCE:-cairo-db} --activation-policy=ALWAYS"
  log "  Nuke:   gcloud projects delete ${PROJECT_ID}"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  log "=== Running infrastructure smoke test ==="
  deploy_hello_web
  verify_web
  create_push_subscription
  create_budget
  print_pause_instructions
  log "=== 08-smoke-test.sh complete ==="
}

main "$@"
