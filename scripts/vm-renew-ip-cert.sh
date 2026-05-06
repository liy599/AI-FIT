#!/usr/bin/env sh
set -eu

docker compose --profile certbot run --rm certbot renew \
  --webroot \
  --webroot-path /var/www/certbot \
  --non-interactive

docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
