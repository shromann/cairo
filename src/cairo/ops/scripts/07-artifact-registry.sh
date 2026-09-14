#!/usr/bin/env bash
# =============================================================================
# Cairo — Step 7: Artifact Registry repository and Cloud Build IAM
#
# Usage:
#   source env.sh
#   bash src/cairo/ops/scripts/07-artifact-registry.sh
#
# Creates a Docker repository in Artifact Registry and grants the Cloud Build
# service account the rights it needs to push images and act as the web/worker
# service accounts during deployment.
#
# Idempotent: existing resources are skipped.
# =============================================================================

set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

# ---------------------------------------------------------------------------
# Guards
# ---------------------------------------------------------------------------
: "${PROJECT_ID:?env.sh not sourced — run: source env.sh}"
: "${PROJECT_NUMBER:?PROJECT_NUMBER missing — run src/cairo/ops/scripts/01-provision.sh first}"
: "${REGION:?REGION is required}"
: "${REPO:?REPO is required}"
: "${SA_WEB:?SA_WEB not set}"
: "${SA_WORKER:?SA_WORKER not set}"

log() { echo "[07-artifact-registry] $*"; }
die() { echo "[07-artifact-registry] ERROR: $*" >&2; exit 1; }

# Default Cloud Build service account is the Compute Engine default SA
readonly SA_BUILD="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# ---------------------------------------------------------------------------
# Create Artifact Registry repository (idempotent)
# ---------------------------------------------------------------------------
create_repository() {
  if gcloud artifacts repositories describe "$REPO" \
       --location="$REGION" &>/dev/null; then
    log "Repository '${REPO}' already exists — skipping."
  else
    log "Creating Artifact Registry repository '${REPO}'..."
    gcloud artifacts repositories create "$REPO" \
      --repository-format=docker \
      --location="$REGION" \
      --description="Cairo container images"
    log "Repository created."
  fi
}

# ---------------------------------------------------------------------------
# Bind project-level roles to Cloud Build SA
# ---------------------------------------------------------------------------
bind_build_roles() {
  log "Binding project-level roles to Cloud Build SA: ${SA_BUILD}"
  local member="serviceAccount:${SA_BUILD}"

  for role in \
    roles/artifactregistry.writer \
    roles/storage.admin \
    roles/logging.logWriter \
    roles/run.admin              # required to deploy Cloud Run services from Cloud Build
  do
    log "  ${role}"
    gcloud projects add-iam-policy-binding "$PROJECT_ID" \
      --member="$member" \
      --role="$role" \
      --condition=None \
      --quiet
  done
  log "Project-level bindings applied."
}

# ---------------------------------------------------------------------------
# Allow Cloud Build to act as the web and worker service accounts
# (required for --source deployments where Cloud Build deploys to Cloud Run)
# ---------------------------------------------------------------------------
bind_sa_user_roles() {
  log "Granting Cloud Build serviceAccountUser on cairo-web and cairo-worker..."

  gcloud iam service-accounts add-iam-policy-binding "$SA_WEB" \
    --member="serviceAccount:${SA_BUILD}" \
    --role="roles/iam.serviceAccountUser" \
    --quiet

  gcloud iam service-accounts add-iam-policy-binding "$SA_WORKER" \
    --member="serviceAccount:${SA_BUILD}" \
    --role="roles/iam.serviceAccountUser" \
    --quiet

  log "serviceAccountUser bindings applied."
}

# ---------------------------------------------------------------------------
# Print the registry URL for use in Dockerfile / deploy scripts
# ---------------------------------------------------------------------------
print_registry_url() {
  local registry_url="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}"
  log "Registry URL: ${registry_url}"
  log "Full image tag example: ${registry_url}/cairo:latest"

  # Write to env.sh for use by deploy scripts
  if grep -q '^export REGISTRY=' "${ENV_FILE}" 2>/dev/null; then
    sed -i.bak "s|^export REGISTRY=.*|export REGISTRY=\"${registry_url}\"|" "${ENV_FILE}"
    rm -f "${ENV_FILE}.bak"
  else
    echo "" >> "${ENV_FILE}"
    echo "# Populated by src/cairo/ops/scripts/07-artifact-registry.sh" >> "${ENV_FILE}"
    echo "export REGISTRY=\"${registry_url}\"" >> "${ENV_FILE}"
  fi
  log "REGISTRY written to env.sh."
}

# ---------------------------------------------------------------------------
# Verify
# ---------------------------------------------------------------------------
verify() {
  log "--- Verification ---"
  if gcloud artifacts repositories describe "$REPO" \
       --location="$REGION" \
       --format='value(name)' | grep -q "$REPO"; then
    log "  OK: repository '${REPO}' found in ${REGION}."
  else
    die "Repository '${REPO}' not found after creation."
  fi
  log "Verification passed."
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  log "=== Configuring Artifact Registry: ${REPO} (${REGION}) ==="
  create_repository
  bind_build_roles
  bind_sa_user_roles
  print_registry_url
  verify
  log "=== 07-artifact-registry.sh complete ==="
}

main "$@"
