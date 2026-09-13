#!/usr/bin/env bash
# =============================================================================
# Cairo — Step 4: Cloud SQL (PostgreSQL 16) instance, database, user
#
# Usage:
#   source ../env.sh
#   bash scripts/04-database.sh
#
# Run this first and move on — provisioning takes 5–10 minutes.
# The script polls until the instance is RUNNABLE before enabling pooling.
#
# Idempotent: safe to re-run; existing resources are skipped.
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Guards
# ---------------------------------------------------------------------------
: "${PROJECT_ID:?env.sh not sourced — run: source env.sh}"
: "${REGION:?REGION is required}"
: "${SQL_INSTANCE:?SQL_INSTANCE is required}"
: "${SQL_DB:?SQL_DB is required}"
: "${SQL_USER:?SQL_USER is required}"

log()  { echo "[04-database] $*"; }
warn() { echo "[04-database] WARN: $*" >&2; }
die()  { echo "[04-database] ERROR: $*" >&2; exit 1; }

readonly POLL_INTERVAL=15   # seconds between state polls
readonly POLL_TIMEOUT=600   # 10 min max wait

# ---------------------------------------------------------------------------
# Create the Cloud SQL instance (idempotent)
#
# Tier: db-g1-small — satisfies MCP's min max_connections requirement.
# Swap for db-f1-micro only if you skip Managed Connection Pooling and
# cap web instances at 10 (see 06-deploy.sh).
# ---------------------------------------------------------------------------
create_instance() {
  if gcloud sql instances describe "$SQL_INSTANCE" &>/dev/null; then
    log "Instance '${SQL_INSTANCE}' already exists — skipping creation."
    return
  fi

  log "Creating Cloud SQL instance '${SQL_INSTANCE}' (this may take 5–10 min)..."
  gcloud sql instances create "$SQL_INSTANCE" \
    --database-version=POSTGRES_16 \
    --edition=ENTERPRISE \
    --tier=db-g1-small \
    --region="$REGION" \
    --storage-size=10GB \
    --storage-auto-increase \
    --no-backup

  log "Instance creation requested."
}

# ---------------------------------------------------------------------------
# Poll until instance reaches RUNNABLE state
# ---------------------------------------------------------------------------
wait_for_runnable() {
  log "Waiting for instance '${SQL_INSTANCE}' to reach RUNNABLE state..."
  local elapsed=0

  while true; do
    local state
    state=$(gcloud sql instances describe "$SQL_INSTANCE" \
      --format='value(state)' 2>/dev/null || echo "UNKNOWN")

    if [[ "$state" == "RUNNABLE" ]]; then
      log "Instance is RUNNABLE."
      return
    fi

    if [[ "$elapsed" -ge "$POLL_TIMEOUT" ]]; then
      die "Timed out after ${POLL_TIMEOUT}s waiting for RUNNABLE (current state: ${state})."
    fi

    log "  State: ${state} — waiting ${POLL_INTERVAL}s (${elapsed}/${POLL_TIMEOUT}s elapsed)..."
    sleep "$POLL_INTERVAL"
    elapsed=$((elapsed + POLL_INTERVAL))
  done
}

# ---------------------------------------------------------------------------
# Generate a cryptographically strong password and export it
# ---------------------------------------------------------------------------
generate_password() {
  if [[ -n "${DB_PASSWORD:-}" ]]; then
    log "DB_PASSWORD already set in environment — reusing."
    return
  fi

  export DB_PASSWORD
  DB_PASSWORD=$(openssl rand -base64 24)
  log "DB_PASSWORD generated (not logged)."
}

# ---------------------------------------------------------------------------
# Create the database (idempotent)
# ---------------------------------------------------------------------------
create_database() {
  if gcloud sql databases describe "$SQL_DB" \
       --instance="$SQL_INSTANCE" &>/dev/null; then
    log "Database '${SQL_DB}' already exists — skipping."
  else
    log "Creating database '${SQL_DB}'..."
    gcloud sql databases create "$SQL_DB" --instance="$SQL_INSTANCE"
    log "Database created."
  fi
}

# ---------------------------------------------------------------------------
# Create the application user (idempotent)
# ---------------------------------------------------------------------------
create_user() {
  if gcloud sql users describe "$SQL_USER" \
       --instance="$SQL_INSTANCE" &>/dev/null; then
    log "User '${SQL_USER}' already exists — skipping creation."
    log "WARN: If you need to rotate the password, run:"
    log "  gcloud sql users set-password ${SQL_USER} --instance=${SQL_INSTANCE} --password=<new>"
  else
    log "Creating SQL user '${SQL_USER}'..."
    gcloud sql users create "$SQL_USER" \
      --instance="$SQL_INSTANCE" \
      --password="$DB_PASSWORD"
    log "User created."
  fi
}

# ---------------------------------------------------------------------------
# Capture and persist the connection name
# ---------------------------------------------------------------------------
export_connection_name() {
  export SQL_CONNECTION
  SQL_CONNECTION=$(gcloud sql instances describe "$SQL_INSTANCE" \
    --format='value(connectionName)')
  log "SQL_CONNECTION=${SQL_CONNECTION}"

  # Persist to env.sh so deploy scripts can source it
  if grep -q '^export SQL_CONNECTION=' ../env.sh 2>/dev/null; then
    sed -i.bak "s|^export SQL_CONNECTION=.*|export SQL_CONNECTION=\"${SQL_CONNECTION}\"|" \
      ../env.sh
    rm -f ../env.sh.bak
  else
    echo "" >> ../env.sh
    echo "# Populated by scripts/04-database.sh" >> ../env.sh
    echo "export SQL_CONNECTION=\"${SQL_CONNECTION}\"" >> ../env.sh
  fi
  log "SQL_CONNECTION written to env.sh."
}

# ---------------------------------------------------------------------------
# Enable Managed Connection Pooling
#
# Restarts the instance. Run now to avoid disruption during a demo.
# Falls back gracefully if the instance uses the legacy network architecture.
# ---------------------------------------------------------------------------
enable_connection_pooling() {
  log "Enabling Managed Connection Pooling..."
  if gcloud sql instances patch "$SQL_INSTANCE" \
       --enable-connection-pooling 2>&1 | tee /tmp/mcp-output.txt; then
    log "Connection pooling enabled."
  else
    warn "Could not enable Managed Connection Pooling."
    warn "This usually means the instance uses the legacy Cloud SQL network architecture."
    warn "Workaround: cap --max-instances=10 on the web service in scripts/08-smoke-test.sh."
    warn "Output: $(cat /tmp/mcp-output.txt)"
  fi
  rm -f /tmp/mcp-output.txt
}

# ---------------------------------------------------------------------------
# Verify
# ---------------------------------------------------------------------------
verify() {
  log "--- Verification ---"
  local state
  state=$(gcloud sql instances describe "$SQL_INSTANCE" \
    --format='value(state)')
  log "Instance state: ${state}"

  if [[ "$state" != "RUNNABLE" ]]; then
    die "Expected RUNNABLE, got: ${state}"
  fi
  log "Verification passed."
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  log "=== Provisioning Cloud SQL: ${SQL_INSTANCE} (${REGION}) ==="
  create_instance
  wait_for_runnable
  generate_password
  create_database
  create_user
  export_connection_name
  enable_connection_pooling
  wait_for_runnable  # pooling patch restarts the instance
  verify
  log ""
  log "Next step: run scripts/05-secrets.sh to store DB_PASSWORD in Secret Manager."
  log "  export DB_PASSWORD=\"${DB_PASSWORD}\" (already set in this shell)"
  log "=== 04-database.sh complete ==="
}

main "$@"
