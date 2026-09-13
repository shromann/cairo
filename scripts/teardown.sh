#!/usr/bin/env bash
# =============================================================================
# Cairo — Full infrastructure teardown
#
# Usage:
#   source ../env.sh
#   bash infra/teardown.sh
#
# WARNING: This is IRREVERSIBLE. It deletes the entire GCP project including
# all Cloud SQL data, GCS objects, secrets, and container images.
#
# A 15-second countdown is shown before deletion proceeds.
# Pass --force to skip the countdown (CI/CD only).
# =============================================================================

set -euo pipefail

: "${PROJECT_ID:?env.sh not sourced — run: source env.sh}"

log()  { echo "[teardown] $*"; }
warn() { echo "[teardown] WARN: $*" >&2; }

# ---------------------------------------------------------------------------
# Countdown prompt (skipped with --force)
# ---------------------------------------------------------------------------
confirm_teardown() {
  if [[ "${1:-}" == "--force" ]]; then
    warn "--force flag set — skipping confirmation."
    return
  fi

  warn "==========================================================="
  warn "  You are about to DELETE the GCP project: ${PROJECT_ID}"
  warn "  This will destroy ALL resources: SQL, GCS, secrets, etc."
  warn "  This action is IRREVERSIBLE."
  warn "==========================================================="
  warn ""
  warn "Proceeding in 15 seconds. Press Ctrl+C to abort."

  for i in {15..1}; do
    printf "\r[teardown] %2d seconds remaining..." "$i"
    sleep 1
  done
  echo ""
}

# ---------------------------------------------------------------------------
# Optional: selectively stop running services first (faster cleanup)
# ---------------------------------------------------------------------------
stop_services() {
  log "Stopping Cloud Run services (best-effort)..."
  gcloud run services delete cairo-web    --region="${REGION:-asia-southeast1}" --quiet 2>/dev/null || true
  gcloud run services delete cairo-worker --region="${REGION:-asia-southeast1}" --quiet 2>/dev/null || true
  log "Cloud Run services stopped."
}

# ---------------------------------------------------------------------------
# Delete project
# ---------------------------------------------------------------------------
delete_project() {
  log "Deleting project '${PROJECT_ID}'..."
  gcloud projects delete "$PROJECT_ID" --quiet
  log "Project deletion initiated."
  log "NOTE: GCP schedules projects for deletion after 30 days."
  log "      To cancel: gcloud projects undelete ${PROJECT_ID}"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  confirm_teardown "${1:-}"
  stop_services
  delete_project
  log "=== Teardown complete ==="
}

main "$@"
