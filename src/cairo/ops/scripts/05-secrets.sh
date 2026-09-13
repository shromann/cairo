#!/usr/bin/env bash
# =============================================================================
# Cairo — Step 5: Secret Manager
#
# Usage:
#   source env.sh             # ensure DB_PASSWORD is set from step 04
#   bash src/cairo/ops/scripts/05-secrets.sh
#
# Stores the database password as a Secret Manager secret.
# Both cairo-web and cairo-worker already hold secretAccessor from 02-iam.sh.
#
# Idempotent: adding a new version to an existing secret is safe.
# =============================================================================

set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

# ---------------------------------------------------------------------------
# Guards
# ---------------------------------------------------------------------------
: "${PROJECT_ID:?env.sh not sourced — run: source env.sh}"
: "${DB_PASSWORD:?DB_PASSWORD not set — run src/cairo/ops/scripts/04-database.sh first}"

log() { echo "[05-secrets] $*"; }
die() { echo "[05-secrets] ERROR: $*" >&2; exit 1; }

readonly SECRET_NAME="cairo-db-password"

# ---------------------------------------------------------------------------
# Store DB password in Secret Manager
#
# If the secret already exists, a new version is added (rotation-safe).
# The old version is NOT destroyed — do that manually when confident.
# ---------------------------------------------------------------------------
store_db_password() {
  if gcloud secrets describe "$SECRET_NAME" &>/dev/null; then
    log "Secret '${SECRET_NAME}' already exists — adding a new version..."
    printf "%s" "$DB_PASSWORD" | \
      gcloud secrets versions add "$SECRET_NAME" --data-file=-
    log "New version added."
  else
    log "Creating secret '${SECRET_NAME}'..."
    printf "%s" "$DB_PASSWORD" | \
      gcloud secrets create "$SECRET_NAME" \
        --data-file=- \
        --replication-policy=automatic
    log "Secret created."
  fi
}

# ---------------------------------------------------------------------------
# Verify — access the latest version
# ---------------------------------------------------------------------------
verify() {
  log "--- Verification ---"
  local retrieved
  retrieved=$(gcloud secrets versions access latest --secret="$SECRET_NAME")

  if [[ "$retrieved" != "$DB_PASSWORD" ]]; then
    die "Retrieved secret does not match DB_PASSWORD. Check for encoding issues."
  fi
  log "Secret round-trip verification passed."
  log "(Password value intentionally not printed.)"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  log "=== Storing secrets in Secret Manager ==="
  store_db_password
  verify
  log ""
  log "Retrieve at runtime with:"
  log "  gcloud secrets versions access latest --secret=${SECRET_NAME}"
  log "=== 05-secrets.sh complete ==="
}

main "$@"
