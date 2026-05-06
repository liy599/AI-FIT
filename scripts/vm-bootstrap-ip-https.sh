#!/usr/bin/env sh
set -eu

ORIGIN_IP="${ORIGIN_IP:-137.43.49.50}"

if [ -z "${ACME_EMAIL:-}" ]; then
  echo "Set ACME_EMAIL before running, for example:"
  echo "ACME_EMAIL=admin@example.com ORIGIN_IP=${ORIGIN_IP} sh scripts/vm-bootstrap-ip-https.sh"
  exit 1
fi

if [ ! -f backend/.env ]; then
  echo "backend/.env is required. Copy backend/.env.example to backend/.env and set real secrets first."
  exit 1
fi

mkdir -p deploy/certbot/www

docker compose -f docker-compose.yml -f deploy/docker-compose.bootstrap.yml up -d --build db redis backend web caddy

docker compose --profile certbot run --rm certbot certonly \
  --webroot \
  --webroot-path /var/www/certbot \
  --ip-address "${ORIGIN_IP}" \
  --cert-name "${ORIGIN_IP}" \
  --preferred-profile shortlived \
  --email "${ACME_EMAIL}" \
  --agree-tos \
  --no-eff-email \
  --non-interactive

docker compose -f docker-compose.yml -f deploy/docker-compose.bootstrap.yml stop caddy
docker compose up -d --build caddy

echo "HTTPS is configured at https://${ORIGIN_IP}/"
