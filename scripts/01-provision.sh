#!/usr/bin/env bash
# =============================================================================
# Cairo — Step 1: GCP project, billing, and API enablement
#
# Usage:
#   source ../env.sh
#   bash scripts/01-provision.sh
#
# Idempotent: safe to re-run; existing resources are left unchanged.
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Guards
# ---------------------------------------------------------------------------
: "${PROJECT_ID:?env.sh not sourced — run: source env.sh}"
: "${BILLING_ACCOUNT:?BILLING_ACCOUNT is required}"
: "${REGION:?REGION is required}"

readonly REQUIRED_GCLOUD_VERSION="515.0.0"

log()  { echo "[01-provision] $*"; }
die()  { echo "[01-provision] ERROR: $*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Check gcloud version
# ---------------------------------------------------------------------------
check_gcloud_version() {
  local installed
  installed=$(gcloud version --format='value("Google Cloud SDK")' 2>/dev/null | head -1)
  log "gcloud version: ${installed}"

  # Simple semver comparison: fail if installed < required
  if [[ "$(printf '%s\n' "$REQUIRED_GCLOUD_VERSION" "$installed" | sort -V | head -1)" != "$REQUIRED_GCLOUD_VERSION" ]]; then
    die "gcloud >= ${REQUIRED_GCLOUD_VERSION} required (Managed Connection Pooling). Installed: ${installed}"
  fi
}

# ---------------------------------------------------------------------------
# Create project (idempotent)
# ---------------------------------------------------------------------------
create_project() {
  if gcloud projects describe "$PROJECT_ID" &>/dev/null; then
    log "Project '${PROJECT_ID}' already exists — skipping creation."
  else
    log "Creating project '${PROJECT_ID}'..."
    gcloud projects create "$PROJECT_ID"
    log "Project created."
  fi

  gcloud config set project "$PROJECT_ID"
  log "Active project set to '${PROJECT_ID}'."
}

# ---------------------------------------------------------------------------
# Link billing
# ---------------------------------------------------------------------------
link_billing() {
  local current_account
  current_account=$(gcloud billing projects describe "$PROJECT_ID" \
    --format='value(billingAccountName)' 2>/dev/null || echo "")

  if [[ "$current_account" == *"$BILLING_ACCOUNT"* ]]; then
    log "Billing account already linked — skipping."
  else
    log "Linking billing account '${BILLING_ACCOUNT}'..."
    gcloud billing projects link "$PROJECT_ID" \
      --billing-account="$BILLING_ACCOUNT"
    log "Billing linked."
  fi
}

# ---------------------------------------------------------------------------
# Enable required APIs
# ---------------------------------------------------------------------------
enable_apis() {
  local -r APIS=(
    run.googleapis.com
    artifactregistry.googleapis.com
    cloudbuild.googleapis.com
    sqladmin.googleapis.com
    pubsub.googleapis.com
    secretmanager.googleapis.com
    storage.googleapis.com
    iamcredentials.googleapis.com   # required for GCS signed URLs without key files
    compute.googleapis.com
  )

  log "Enabling ${#APIS[@]} APIs (this may take a minute)..."
  gcloud services enable "${APIS[@]}"
  log "APIs enabled."
}

# ---------------------------------------------------------------------------
# Populate PROJECT_NUMBER
# ---------------------------------------------------------------------------
export_project_number() {
  export PROJECT_NUMBER
  PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" \
    --format='value(projectNumber)')
  log "PROJECT_NUMBER=${PROJECT_NUMBER}"

  # Persist back into env.sh so subsequent scripts can source it
  if grep -q '^export PROJECT_NUMBER=' ../env.sh 2>/dev/null; then
    sed -i.bak "s|^export PROJECT_NUMBER=.*|export PROJECT_NUMBER=\"${PROJECT_NUMBER}\"|" ../env.sh
    rm -f ../env.sh.bak
  else
    echo "" >> ../env.sh
    echo "# Populated by scripts/01-provision.sh" >> ../env.sh
    echo "export PROJECT_NUMBER=\"${PROJECT_NUMBER}\"" >> ../env.sh
  fi
  log "PROJECT_NUMBER written to env.sh."
}

# ---------------------------------------------------------------------------
# Verify
# ---------------------------------------------------------------------------
verify() {
  log "--- Verification ---"
  gcloud config list --format='table(core.project,core.account)'

  local enabled_count
  enabled_count=$(gcloud services list --enabled --format='value(name)' | wc -l | tr -d ' ')
  log "Enabled APIs: ${enabled_count}"

  if [[ "$enabled_count" -lt 9 ]]; then
    die "Expected at least 9 enabled APIs, found ${enabled_count}."
  fi
  log "Verification passed."
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  log "=== Provisioning GCP project: ${PROJECT_ID} in ${REGION} ==="
  check_gcloud_version
  create_project
  link_billing
  enable_apis
  export_project_number
  verify
  log "=== 01-provision.sh complete ==="
}

main "$@"
