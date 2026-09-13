#!/usr/bin/env bash
# =============================================================================
# Cairo — Step 2: Service accounts and IAM bindings
#
# Usage:
#   source env.sh
#   bash src/cairo/ops/scripts/02-iam.sh
#
# Idempotent: creating an already-existing SA or binding is a no-op.
# =============================================================================

set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

# ---------------------------------------------------------------------------
# Guards
# ---------------------------------------------------------------------------
: "${PROJECT_ID:?env.sh not sourced — run: source env.sh}"
: "${PROJECT_NUMBER:?PROJECT_NUMBER missing — run src/cairo/ops/scripts/01-provision.sh first}"
: "${SA_WEB:?SA_WEB not set}"
: "${SA_WORKER:?SA_WORKER not set}"
: "${SA_INVOKER:?SA_INVOKER not set}"

log() { echo "[02-iam] $*"; }
die() { echo "[02-iam] ERROR: $*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Create a service account if it does not already exist
# ---------------------------------------------------------------------------
ensure_service_account() {
  local name="$1"
  local display="$2"

  if gcloud iam service-accounts describe "${name}@${PROJECT_ID}.iam.gserviceaccount.com" \
       &>/dev/null; then
    log "Service account '${name}' already exists — skipping."
  else
    log "Creating service account '${name}'..."
    gcloud iam service-accounts create "$name" --display-name="$display"
    log "Service account '${name}' created."
  fi
}

# ---------------------------------------------------------------------------
# Bind a project-level IAM role to a member (idempotent)
# ---------------------------------------------------------------------------
bind_project_role() {
  local member="$1"
  local role="$2"
  log "  Binding ${role} -> ${member}"
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="$member" \
    --role="$role" \
    --condition=None \
    --quiet
}

# ---------------------------------------------------------------------------
# Bind a service-account-level IAM role (idempotent)
# ---------------------------------------------------------------------------
bind_sa_role() {
  local target_sa="$1"   # the SA being acted on
  local member="$2"      # who gets the role
  local role="$3"
  log "  Binding ${role} on SA ${target_sa} -> ${member}"
  gcloud iam service-accounts add-iam-policy-binding "$target_sa" \
    --member="$member" \
    --role="$role" \
    --quiet
}

# ---------------------------------------------------------------------------
# Create service accounts
# ---------------------------------------------------------------------------
create_service_accounts() {
  log "--- Creating service accounts ---"
  ensure_service_account "cairo-web"     "Cairo web tier"
  ensure_service_account "cairo-worker"  "Cairo inference worker"
  ensure_service_account "cairo-invoker" "Pub/Sub push invoker"
}

# ---------------------------------------------------------------------------
# Web service account roles
#
# Roles granted:
#   cloudsql.client           — connect to Cloud SQL via the proxy
#   pubsub.publisher          — enqueue video-job messages
#   secretmanager.secretAccessor — read DB password at startup
# ---------------------------------------------------------------------------
bind_web_roles() {
  log "--- Binding roles for cairo-web ---"
  local member="serviceAccount:${SA_WEB}"
  for role in \
    roles/cloudsql.client \
    roles/pubsub.publisher \
    roles/secretmanager.secretAccessor
  do
    bind_project_role "$member" "$role"
  done

  # Self-impersonation: required to sign GCS URLs via the IAM SignBlob API
  # without a downloaded service account key file.
  log "  Binding roles/iam.serviceAccountTokenCreator on cairo-web (self-impersonation)"
  bind_sa_role "$SA_WEB" "serviceAccount:${SA_WEB}" \
    "roles/iam.serviceAccountTokenCreator"
}

# ---------------------------------------------------------------------------
# Worker service account roles
#
# Roles granted:
#   cloudsql.client           — write predictions to Cloud SQL
#   secretmanager.secretAccessor — read DB password at startup
#
# Storage access is granted at bucket level in src/cairo/ops/scripts/03-storage.sh.
# ---------------------------------------------------------------------------
bind_worker_roles() {
  log "--- Binding roles for cairo-worker ---"
  local member="serviceAccount:${SA_WORKER}"
  for role in \
    roles/cloudsql.client \
    roles/secretmanager.secretAccessor
  do
    bind_project_role "$member" "$role"
  done
}

# ---------------------------------------------------------------------------
# Verify
# ---------------------------------------------------------------------------
verify() {
  log "--- Verification ---"
  local sa_list
  sa_list=$(gcloud iam service-accounts list --format='value(email)')

  for sa in "$SA_WEB" "$SA_WORKER" "$SA_INVOKER"; do
    if echo "$sa_list" | grep -q "$sa"; then
      log "  OK: ${sa}"
    else
      die "Service account not found: ${sa}"
    fi
  done
  log "Verification passed."
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  log "=== Configuring IAM for project: ${PROJECT_ID} ==="
  create_service_accounts
  bind_web_roles
  bind_worker_roles
  verify
  log "=== 02-iam.sh complete ==="
}

main "$@"
