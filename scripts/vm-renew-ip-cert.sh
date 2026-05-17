#!/usr/bin/env sh
set -eu

compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
  else
    docker-compose "$@"
  fi
}

compose --profile certbot run --rm certbot renew \
  --webroot \
  --webroot-path /var/www/certbot \
  --non-interactive

compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
