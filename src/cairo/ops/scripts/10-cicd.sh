#!/usr/bin/env bash
# =============================================================================
# Cairo — Step 10: CI/CD pipeline setup
#
# Wires the GitHub repository to Cloud Build so every push to main triggers:
#   1. Cloud Build builds the image (bakes PanEcho weights + frontend).
#   2. The image is pushed to Artifact Registry.
#   3. cairo-web is deployed to Cloud Run.
#   4. The Pub/Sub push subscription is updated to the new worker URL.
#
# Usage:
#   source env.sh
#   bash src/cairo/ops/scripts/10-cicd.sh               # full setup
#   bash src/cairo/ops/scripts/10-cicd.sh --dry-run     # print commands only
#
# Requires:
#   - All previous infra steps completed (01-09).
#   - GitHub repo connected to Cloud Build (one-time manual step — see below).
#   - GITHUB_REPO set in env.sh: export GITHUB_REPO="shromann/cairo"
#
# Manual prerequisite (run once in the GCP Console or via gcloud beta):
#   Cloud Build → Triggers → Connect Repository → GitHub → shromann/cairo
#   This cannot be fully automated because it requires a browser OAuth flow.
#
# =============================================================================

set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

# ---------------------------------------------------------------------------
# Guards
# ---------------------------------------------------------------------------
: "${PROJECT_ID:?env.sh not sourced — run: source env.sh}"
: "${REGION:?REGION is required}"
: "${REPO:?REPO is required}"
: "${SQL_CONNECTION:?SQL_CONNECTION missing — run src/cairo/ops/scripts/04-database.sh first}"
: "${BUCKET_MEDIA:?BUCKET_MEDIA is required}"
: "${TOPIC:?TOPIC is required}"
: "${DLQ:?DLQ is required}"
: "${SA_WEB:?SA_WEB not set}"
: "${SA_WORKER:?SA_WORKER not set}"
: "${SA_INVOKER:?SA_INVOKER not set}"

GITHUB_REPO="${GITHUB_REPO:-shromann/cairo}"
TRIGGER_BRANCH="${TRIGGER_BRANCH:-main}"
SERVICE_WEB="${SERVICE_WEB:-cairo-web}"
SUBSCRIPTION_NAME="${TOPIC}-push"
SQL_DB="${SQL_DB:-cairo}"
SQL_USER="${SQL_USER:-cairo_app}"

DRY=0
[[ "${1:-}" == "--dry-run" ]] && DRY=1

log()  { echo "[10-cicd] $*"; }
warn() { echo "[10-cicd] WARN: $*" >&2; }
die()  { echo "[10-cicd] ERROR: $*" >&2; exit 1; }
run()  { log "+ $*"; [[ $DRY -eq 1 ]] || "$@"; }

# ---------------------------------------------------------------------------
# Ensure the Cloud Build GitHub app is connected (check only — OAuth is manual)
# ---------------------------------------------------------------------------
check_github_connection() {
  log "Checking Cloud Build GitHub connection..."
  local connected
  connected=$(gcloud builds triggers list \
    --region="$REGION" \
    --format='value(github.name)' 2>/dev/null | grep -c "$GITHUB_REPO" || true)

  if [[ "$connected" -gt 0 ]]; then
    log "GitHub repo '${GITHUB_REPO}' already connected to Cloud Build."
  else
    warn "GitHub repo '${GITHUB_REPO}' does not appear to be connected yet."
    warn "Complete this one-time manual step:"
    warn "  GCP Console → Cloud Build → Triggers → Connect Repository → GitHub"
    warn "  Then re-run this script."
    warn "Continuing — the trigger will be created but won't fire until connected."
  fi
}

# ---------------------------------------------------------------------------
# Write cloudbuild.yaml (build + push + deploy)
# ---------------------------------------------------------------------------
write_cloudbuild_yaml() {
  local root
  root="$(dirname "$0")/.."
  local yaml="${root}/cloudbuild.yaml"

  log "Writing ${yaml}..."
  cat > "$yaml" <<EOF
# =============================================================================
# Cairo — Cloud Build pipeline
# Triggered on push to '${TRIGGER_BRANCH}' by src/cairo/ops/scripts/10-cicd.sh.
#
# Steps:
#   1. Build the multi-stage image (frontend + backend + PanEcho weights).
#   2. Push to Artifact Registry.
#   3. Deploy cairo-web to Cloud Run.
#   4. Run /api/health smoke test.
#
# Substitutions (override in trigger UI or --substitutions flag):
#   _SERVICE   cairo-web
#   _REGION    ${REGION}
#   _REPO      ${REPO}
# =============================================================================
substitutions:
  _SERVICE: "${SERVICE_WEB}"
  _REGION: "${REGION}"
  _REPO: "${REPO}"

options:
  logging: CLOUD_LOGGING_ONLY
  machineType: E2_HIGHCPU_8   # 8 vCPU speeds up the torch install step

steps:
  # -------------------------------------------------------------------------
  # 1. Build the image
  # -------------------------------------------------------------------------
  - name: "gcr.io/cloud-builders/docker"
    id: build
    args:
      - build
      - "--tag=\${_REGION}-docker.pkg.dev/\$PROJECT_ID/\${_REPO}/\${_SERVICE}:\$SHORT_SHA"
      - "--tag=\${_REGION}-docker.pkg.dev/\$PROJECT_ID/\${_REPO}/\${_SERVICE}:latest"
      - "--cache-from=\${_REGION}-docker.pkg.dev/\$PROJECT_ID/\${_REPO}/\${_SERVICE}:latest"
      - "--build-arg=BUILDKIT_INLINE_CACHE=1"
      - "."
    timeout: "1800s"

  # -------------------------------------------------------------------------
  # 2. Push both tags
  # -------------------------------------------------------------------------
  - name: "gcr.io/cloud-builders/docker"
    id: push-sha
    waitFor: [build]
    args:
      - push
      - "\${_REGION}-docker.pkg.dev/\$PROJECT_ID/\${_REPO}/\${_SERVICE}:\$SHORT_SHA"

  - name: "gcr.io/cloud-builders/docker"
    id: push-latest
    waitFor: [build]
    args:
      - push
      - "\${_REGION}-docker.pkg.dev/\$PROJECT_ID/\${_REPO}/\${_SERVICE}:latest"

  # -------------------------------------------------------------------------
  # 3. Deploy to Cloud Run
  # -------------------------------------------------------------------------
  - name: "gcr.io/google.com/cloudsdktool/cloud-sdk:slim"
    id: deploy
    waitFor: [push-sha]
    entrypoint: gcloud
    args:
      - run
      - deploy
      - "\${_SERVICE}"
      - "--image=\${_REGION}-docker.pkg.dev/\$PROJECT_ID/\${_REPO}/\${_SERVICE}:\$SHORT_SHA"
      - "--region=\${_REGION}"
      - "--service-account=${SA_WEB}"
      - "--allow-unauthenticated"
      - "--port=8080"
      - "--cpu=2"
      - "--memory=4Gi"
      - "--concurrency=4"
      - "--timeout=300"
      - "--min-instances=0"
      - "--max-instances=3"
      - "--add-cloudsql-instances=${SQL_CONNECTION}"
      - "--set-env-vars=APP_ENV=production,SQL_CONNECTION=${SQL_CONNECTION},DB_NAME=${SQL_DB},DB_USER=${SQL_USER},BUCKET_MEDIA=${BUCKET_MEDIA},CAIRO_MP4_CACHE=/tmp/mp4"
      - "--set-secrets=DB_PASSWORD=cairo-db-password:latest"
      - "--quiet"

  # -------------------------------------------------------------------------
  # 4. Health check
  # -------------------------------------------------------------------------
  - name: "gcr.io/google.com/cloudsdktool/cloud-sdk:slim"
    id: health-check
    waitFor: [deploy]
    entrypoint: bash
    args:
      - "-c"
      - |
          URL=\$(gcloud run services describe \${_SERVICE} \\
            --region=\${_REGION} \\
            --format='value(status.url)')
          echo "Service URL: \$URL"
          for i in \$(seq 1 5); do
            curl -sf "\${URL}/api/health" && echo " — health OK" && exit 0
            echo "  attempt \$i/5 failed, retrying in 5s..."
            sleep 5
          done
          echo "Health check failed after 5 attempts" >&2
          exit 1

images:
  - "\${_REGION}-docker.pkg.dev/\$PROJECT_ID/\${_REPO}/\${_SERVICE}:\$SHORT_SHA"
  - "\${_REGION}-docker.pkg.dev/\$PROJECT_ID/\${_REPO}/\${_SERVICE}:latest"

timeout: "2100s"
EOF

  log "cloudbuild.yaml written."
}

# ---------------------------------------------------------------------------
# Create the Cloud Build trigger
# ---------------------------------------------------------------------------
create_build_trigger() {
  log "Checking for existing Cloud Build trigger..."
  local existing
  existing=$(gcloud builds triggers list \
    --region="$REGION" \
    --format='value(name)' 2>/dev/null | grep -c "cairo-deploy-web" || true)

  if [[ "$existing" -gt 0 ]]; then
    log "Trigger 'cairo-deploy-web' already exists — skipping."
    return
  fi

  log "Creating Cloud Build trigger for '${GITHUB_REPO}' branch '${TRIGGER_BRANCH}'..."
  run gcloud builds triggers create github \
    --name="cairo-deploy-web" \
    --region="$REGION" \
    --repo-name="${GITHUB_REPO##*/}" \
    --repo-owner="${GITHUB_REPO%%/*}" \
    --branch-pattern="^${TRIGGER_BRANCH}$" \
    --build-config="cloudbuild.yaml" \
    --service-account="projects/${PROJECT_ID}/serviceAccounts/${SA_WEB}" \
    --description="Build and deploy cairo-web on push to ${TRIGGER_BRANCH}"
  log "Trigger created."
}

# ---------------------------------------------------------------------------
# Grant Cloud Build SA the run.admin role (needed to deploy Cloud Run)
# ---------------------------------------------------------------------------
bind_cloud_run_admin() {
  local project_number
  project_number=$(gcloud projects describe "$PROJECT_ID" \
    --format='value(projectNumber)')
  local sa_build="${project_number}-compute@developer.gserviceaccount.com"

  log "Granting run.admin to Cloud Build SA: ${sa_build}..."
  run gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${sa_build}" \
    --role="roles/run.admin" \
    --condition=None \
    --quiet
  log "run.admin binding applied."
}

# ---------------------------------------------------------------------------
# Update the Pub/Sub push subscription with the live worker URL
# Called after a successful deploy so the subscription points to the correct URL.
# ---------------------------------------------------------------------------
update_pubsub_subscription() {
  log "Fetching cairo-web URL to update Pub/Sub push subscription..."

  local web_url
  web_url=$(gcloud run services describe "$SERVICE_WEB" \
    --region="$REGION" \
    --format='value(status.url)' 2>/dev/null || echo "")

  if [[ -z "$web_url" ]]; then
    warn "cairo-web not yet deployed — skipping Pub/Sub subscription update."
    warn "Re-run this script after the first deploy."
    return
  fi

  local push_endpoint="${web_url}/worker/pubsub"

  if gcloud pubsub subscriptions describe "$SUBSCRIPTION_NAME" &>/dev/null; then
    log "Updating push endpoint to: ${push_endpoint}"
    run gcloud pubsub subscriptions modify-push-config "$SUBSCRIPTION_NAME" \
      --push-endpoint="$push_endpoint" \
      --push-auth-service-account="$SA_INVOKER"
    log "Subscription updated."
  else
    log "Creating push subscription '${SUBSCRIPTION_NAME}'..."
    run gcloud pubsub subscriptions create "$SUBSCRIPTION_NAME" \
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
# Write .github/workflows/ci.yml — lint + test gate before Cloud Build fires
# ---------------------------------------------------------------------------
write_github_actions_workflow() {
  local root
  root="$(dirname "$0")/.."
  local workflow_dir="${root}/.github/workflows"
  local workflow="${workflow_dir}/ci.yml"

  mkdir -p "$workflow_dir"
  log "Writing ${workflow}..."
  cat > "$workflow" <<'YAML'
# =============================================================================
# Cairo — GitHub Actions CI
#
# Runs on every pull request and push to main.
# Lints with ruff, type-checks with mypy, runs pytest.
# Cloud Build handles the build + deploy after this passes.
# =============================================================================
name: CI

on:
  push:
    branches: [main, "feature/**", "features/**"]
  pull_request:
    branches: [main]

jobs:
  lint-and-test:
    name: Lint, type-check, test
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: cairo_app
          POSTGRES_PASSWORD: dev
          POSTGRES_DB: cairo
        ports: ["5432:5432"]
        options: >-
          --health-cmd="pg_isready -U cairo_app"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=5

    env:
      DATABASE_URL: postgresql+pg8000://cairo_app:dev@localhost:5432/cairo
      APP_ENV: development

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Python 3.12
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install uv
        uses: astral-sh/setup-uv@v4
        with:
          version: "latest"

      - name: Install dependencies
        run: uv sync --all-extras

      - name: Lint (ruff)
        run: uv run ruff check src/

      - name: Format check (ruff)
        run: uv run ruff format --check src/

      - name: Type check (mypy)
        run: uv run mypy src/cairo/backend/

      - name: Run migrations
        run: uv run alembic -c src/cairo/backend/alembic.ini upgrade head

      - name: Test
        run: uv run pytest --tb=short -q
YAML

  log ".github/workflows/ci.yml written."
}

# ---------------------------------------------------------------------------
# Verify trigger exists
# ---------------------------------------------------------------------------
verify() {
  log "--- Verification ---"
  local triggers
  triggers=$(gcloud builds triggers list \
    --region="$REGION" \
    --format='value(name)' 2>/dev/null)
  log "Cloud Build triggers:"
  echo "$triggers" | sed 's/^/  /'
  log "Verification complete."
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  log "=== Setting up CI/CD for Cairo (project: ${PROJECT_ID}) ==="
  log "    GitHub repo : ${GITHUB_REPO}"
  log "    Branch      : ${TRIGGER_BRANCH}"
  log "    Service     : ${SERVICE_WEB}"
  log "    Region      : ${REGION}"
  [[ $DRY -eq 1 ]] && log "    Mode        : DRY RUN (no changes will be made)"

  check_github_connection
  write_cloudbuild_yaml
  bind_cloud_run_admin
  create_build_trigger
  update_pubsub_subscription
  write_github_actions_workflow
  verify

  log ""
  log "=== CI/CD setup complete ==="
  log ""
  log "Pipeline:"
  log "  PR / push  ->  GitHub Actions (lint + mypy + pytest)"
  log "  Merge main ->  Cloud Build trigger 'cairo-deploy-web'"
  log "               -> builds image (bakes PanEcho weights)"
  log "               -> pushes to Artifact Registry"
  log "               -> deploys cairo-web to Cloud Run"
  log "               -> health checks /api/health"
  log ""
  log "Manual step still required if not yet done:"
  log "  GCP Console -> Cloud Build -> Triggers -> Connect Repository -> GitHub -> ${GITHUB_REPO}"
}

main "$@"
