#!/usr/bin/env bash
# =============================================================
#  AI-FIT  —  Production Deployment Script
#  Usage:
#    sh scripts/deploy.sh           # full deploy
#    sh scripts/deploy.sh --init    # first-time: generate env files + deploy
#    sh scripts/deploy.sh --migrate # run DB migrations only (no rebuild)
# =============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${CYAN}[deploy]${NC} $*"; }
ok()   { echo -e "${GREEN}[OK]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
fail() { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

MODE="${1:-}"

# ── Helper: generate secrets ──────────────────────────────────────────────────
generate_env_files() {
  log "Generating secure secrets for production env files..."

  if ! command -v python3 >/dev/null 2>&1; then
    fail "python3 is required to generate secrets. Install it and retry."
  fi

  SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
  JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")
  DB_PASS=$(python3 -c "import secrets; print(secrets.token_urlsafe(24))")
  FERNET_KEY=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())" 2>/dev/null \
    || python3 -c "import base64,os; print(base64.urlsafe_b64encode(os.urandom(32)).decode())")

  # Root .env
  if [ ! -f ".env" ]; then
    cat > .env <<EOF
DB_PORT=5432
POSTGRES_USER=aifitdb_user
POSTGRES_PASSWORD=${DB_PASS}
POSTGRES_DB=aifitdb

HTTP_PORT=80

VITE_API_BASE=/api
EOF
    ok "Created .env (root)"
  else
    warn ".env already exists — skipping (edit manually if needed)"
  fi

  # Backend .env
  if [ ! -f "backend/.env" ]; then
    sed \
      -e "s|REPLACE_WITH_GENERATED_HEX_SECRET_64_CHARS|${SECRET_KEY}|g" \
      -e "s|REPLACE_WITH_GENERATED_HEX_JWT_SECRET_64_CHARS|${JWT_SECRET}|g" \
      -e "s|REPLACE_WITH_FERNET_KEY|${FERNET_KEY}|g" \
      -e "s|REPLACE_WITH_STRONG_PASSWORD_32+CHARS|${DB_PASS}|g" \
      backend/.env.production.example > backend/.env
    ok "Created backend/.env with generated secrets"
    warn "IMPORTANT: Edit backend/.env — set FRONTEND_BASE_URL, CORS_ORIGINS, SMTP_*, ADMIN_EMAIL"
  else
    warn "backend/.env already exists — skipping (edit manually if needed)"
  fi
}

# ── Pre-flight: validate env files ────────────────────────────────────────────
validate_env() {
  log "Validating environment files..."
  if [ ! -f ".env" ] || [ ! -f "backend/.env" ]; then
    fail "Missing .env or backend/.env. Run: sh scripts/deploy.sh --init"
  fi
  sh scripts/check-env.sh production
  ok "Environment validation passed"
}

# ── Build & start ─────────────────────────────────────────────────────────────
build_and_start() {
  log "Pulling latest images..."
  docker compose pull db redis 2>/dev/null || true

  log "Building application images..."
  docker compose build --pull backend web

  log "Starting database and Redis..."
  docker compose up -d db redis

  log "Waiting for database to be healthy..."
  for i in $(seq 1 30); do
    if docker compose exec db pg_isready -U "${POSTGRES_USER:-aifitdb_user}" -d "${POSTGRES_DB:-aifitdb}" >/dev/null 2>&1; then
      ok "Database is ready"
      break
    fi
    [ "$i" -eq 30 ] && fail "Database did not become healthy in time"
    sleep 2
  done
}

# ── Database migrations ───────────────────────────────────────────────────────
run_migrations() {
  log "Running database migrations..."
  docker compose run --rm \
    -e FLASK_APP=run.py \
    backend flask db upgrade
  ok "Migrations applied"
}

# ── Seed admin user ───────────────────────────────────────────────────────────
seed_admin() {
  log "Seeding admin user (if ADMIN_EMAIL is set)..."
  docker compose run --rm backend python seed.py 2>/dev/null && ok "Seed done" || warn "Seed skipped or failed (non-fatal)"
}

# ── Start full stack ──────────────────────────────────────────────────────────
start_services() {
  log "Starting all services..."
  docker compose up -d
  ok "All services started"

  log "Health check..."
  sleep 4
  HEALTH=$(docker compose exec web wget -qO- http://localhost/api/health 2>/dev/null || echo "")
  if echo "$HEALTH" | grep -q '"ok"'; then
    ok "Health check passed — API is responding"
  else
    warn "Health check did not get expected response. Check logs: docker compose logs backend"
  fi
}

# ── Main flow ─────────────────────────────────────────────────────────────────
case "$MODE" in
  --init)
    generate_env_files
    validate_env
    build_and_start
    run_migrations
    seed_admin
    start_services
    ;;
  --migrate)
    validate_env
    run_migrations
    ;;
  "")
    validate_env
    build_and_start
    run_migrations
    start_services
    ;;
  *)
    echo "Usage: sh scripts/deploy.sh [--init|--migrate]" >&2
    exit 1
    ;;
esac

echo ""
ok "Deployment complete."
echo -e "  Frontend: ${CYAN}http://\$(hostname -I | awk '{print \$1}')${NC}"
echo -e "  Logs:     ${CYAN}docker compose logs -f${NC}"
echo -e "  Stop:     ${CYAN}docker compose down${NC}"
