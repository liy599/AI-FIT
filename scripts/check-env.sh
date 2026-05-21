#!/usr/bin/env sh
set -eu

MODE="${1:-production}"
ROOT_ENV="${ROOT_ENV:-.env}"
BACKEND_ENV="${BACKEND_ENV:-backend/.env}"

case "$MODE" in
  production|development) ;;
  *)
    printf 'Usage: %s [production|development]\n' "$0" >&2
    exit 2
    ;;
esac

errors=0
warnings=0

error() {
  errors=$((errors + 1))
  printf 'ERROR: %s\n' "$1" >&2
}

warn() {
  warnings=$((warnings + 1))
  printf 'WARN: %s\n' "$1" >&2
}

ok() {
  printf 'OK: %s\n' "$1"
}

env_value() {
  file="$1"
  key="$2"
  awk -v target="$key" '
    /^[[:space:]]*#/ || /^[[:space:]]*$/ { next }
    {
      line = $0
      sub(/\r$/, "", line)
      sub(/^[[:space:]]*export[[:space:]]+/, "", line)
      eq = index(line, "=")
      if (eq == 0) { next }
      key = substr(line, 1, eq - 1)
      value = substr(line, eq + 1)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", key)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)
      if (key == target) {
        print value
        exit
      }
    }
  ' "$file"
}

require_file() {
  file="$1"
  if [ ! -f "$file" ]; then
    error "Missing env file: $file"
    return
  fi
  if [ ! -s "$file" ]; then
    error "Env file exists but is empty: $file"
    return
  fi
  ok "Found $file"
}

require_key() {
  file="$1"
  key="$2"
  value="$(env_value "$file" "$key")"
  if [ -z "$value" ]; then
    error "$file must set $key"
  fi
}

warn_key() {
  file="$1"
  key="$2"
  value="$(env_value "$file" "$key")"
  if [ -z "$value" ]; then
    warn "$file does not set $key"
  fi
}

require_equals() {
  file="$1"
  key="$2"
  expected="$3"
  value="$(env_value "$file" "$key")"
  if [ "$value" != "$expected" ]; then
    error "$file must set $key=$expected"
  fi
}

require_not_demo_value() {
  file="$1"
  key="$2"
  value="$(env_value "$file" "$key")"
  case "$value" in
    ""|strongpass|aifitguard|password|changeme|change-me*|replace-with*|*strongpass*|*replace-with*)
      error "$file has an unsafe demo value for $key"
      ;;
  esac
}

require_secret_strength() {
  file="$1"
  key="$2"
  value="$(env_value "$file" "$key")"
  case "$value" in
    ""|dev-*|change-me*|replace-with*)
      error "$file has a default or placeholder $key"
      return
      ;;
  esac
  if [ "${#value}" -lt 32 ]; then
    error "$file must set $key to at least 32 characters"
  fi
}

contains() {
  haystack="$1"
  needle="$2"
  case "$haystack" in
    *"$needle"*) return 0 ;;
    *) return 1 ;;
  esac
}

require_file "$ROOT_ENV"
require_file "$BACKEND_ENV"

if [ ! -f "$ROOT_ENV" ] || [ ! -f "$BACKEND_ENV" ] || [ ! -s "$ROOT_ENV" ] || [ ! -s "$BACKEND_ENV" ]; then
  printf '\nFix missing/empty env files before running deeper checks.\n' >&2
  exit 1
fi

for key in DB_PORT POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB HTTP_PORT VITE_API_BASE; do
  require_key "$ROOT_ENV" "$key"
done

for key in APP_ENV DB_AUTO_INIT SECRET_KEY JWT_SECRET_KEY DATA_ENCRYPTION_KEY DATABASE_URL FRONTEND_BASE_URL CORS_ORIGINS PASSWORD_RESET_DEBUG_RETURN_LINK; do
  require_key "$BACKEND_ENV" "$key"
done

database_url="$(env_value "$BACKEND_ENV" DATABASE_URL)"
postgres_db="$(env_value "$ROOT_ENV" POSTGRES_DB)"
frontend_base_url="$(env_value "$BACKEND_ENV" FRONTEND_BASE_URL)"
cors_origins="$(env_value "$BACKEND_ENV" CORS_ORIGINS)"
http_port="$(env_value "$ROOT_ENV" HTTP_PORT)"
vite_api_base="$(env_value "$ROOT_ENV" VITE_API_BASE)"

case "$database_url" in
  postgresql+psycopg://*) ;;
  *) error "$BACKEND_ENV DATABASE_URL must use postgresql+psycopg://" ;;
esac

if ! contains "$database_url" "@db:"; then
  error "$BACKEND_ENV DATABASE_URL should point to the Compose db service, not localhost or a host-only name"
fi

if [ -n "$postgres_db" ] && ! contains "$database_url" "/$postgres_db"; then
  warn "$BACKEND_ENV DATABASE_URL database name does not appear to match $ROOT_ENV POSTGRES_DB"
fi

if [ "$vite_api_base" != "/api" ]; then
  warn "$ROOT_ENV VITE_API_BASE is '$vite_api_base'; VM HTTP deployment normally uses /api"
fi

if ! contains "$cors_origins" "$frontend_base_url"; then
  warn "$BACKEND_ENV CORS_ORIGINS does not include FRONTEND_BASE_URL"
fi

case "$MODE" in
  production)
    require_equals "$BACKEND_ENV" APP_ENV production
    require_equals "$BACKEND_ENV" DB_AUTO_INIT 0
    require_equals "$BACKEND_ENV" PASSWORD_RESET_DEBUG_RETURN_LINK 0
    require_equals "$BACKEND_ENV" REDIS_URL redis://redis:6379/0
    require_key "$BACKEND_ENV" ADMIN_EMAIL
    require_secret_strength "$BACKEND_ENV" SECRET_KEY
    require_secret_strength "$BACKEND_ENV" JWT_SECRET_KEY
    require_not_demo_value "$BACKEND_ENV" DATA_ENCRYPTION_KEY
    require_not_demo_value "$ROOT_ENV" POSTGRES_PASSWORD
    require_not_demo_value "$BACKEND_ENV" DATABASE_URL
    case "$frontend_base_url" in
      http://localhost*|http://127.0.0.1*|https://localhost*|https://127.0.0.1*)
        error "$BACKEND_ENV FRONTEND_BASE_URL must not be localhost in production"
        ;;
    esac
    if [ "$http_port" = "80" ]; then
      case "$frontend_base_url" in
        https://*) warn "$BACKEND_ENV FRONTEND_BASE_URL is HTTPS while Compose exposes HTTP_PORT=80; verify an HTTPS reverse proxy exists" ;;
      esac
    fi
    ;;
  development)
    require_equals "$BACKEND_ENV" APP_ENV development
    warn_key "$BACKEND_ENV" ADMIN_EMAIL
    ;;
esac

printf '\nChecked mode: %s\n' "$MODE"
printf 'Warnings: %s\n' "$warnings"
printf 'Errors: %s\n' "$errors"

if [ "$errors" -gt 0 ]; then
  exit 1
fi

ok "Environment files passed checks"
