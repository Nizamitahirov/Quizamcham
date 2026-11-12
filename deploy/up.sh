#!/usr/bin/env bash
# Serverdə işə düşür (GitHub Actions çağırır): sirləri ilk dəfə yaradır və xidmətləri qaldırır.
set -euo pipefail
cd "$(dirname "$0")"
if [ ! -f .env ]; then
  umask 077
  echo "POSTGRES_PASSWORD=$(head -c 32 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 40)" > .env
  echo "==> .env yaradıldı (yalnız serverdə saxlanılır)"
fi
# sayt ünvanı (GitHub Actions ötürür): .env-də yenilənir
if [ -n "${SITE_HOST:-}" ]; then
  first=$(echo "$SITE_HOST" | cut -d, -f1 | tr -d ' ')
  grep -v -e '^SITE_HOST=' -e '^SITE_ADDRESS=' -e '^SITE_REDIRECT=' -e '^PUBLIC_URL=' .env > .env.tmp || true
  { echo "SITE_HOST=\"$SITE_HOST\""; echo "SITE_REDIRECT=$first"; echo "PUBLIC_URL=https://$first"; } >> .env.tmp
  chmod 600 .env.tmp && mv .env.tmp .env
fi
# Google girişi üçün ictimai Client ID (gizli deyil)
if [ -n "${GOOGLE_CLIENT_ID:-}" ]; then
  grep -v '^GOOGLE_CLIENT_ID=' .env > .env.tmp || true
  echo "GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID" >> .env.tmp
  chmod 600 .env.tmp && mv .env.tmp .env
fi
# serverin ictimai IP-si (mail diaqnostikası: SPF/PTR yoxlaması üçün)
if [ -n "${SERVER_IP:-}" ]; then
  grep -v '^SERVER_IP=' .env > .env.tmp || true
  echo "SERVER_IP=$SERVER_IP" >> .env.tmp
  chmod 600 .env.tmp && mv .env.tmp .env
fi
docker compose up -d --build --remove-orphans
docker image prune -f >/dev/null
sleep 5
docker compose ps
echo "==> hazır ictimai quizlər:"
docker compose exec -T api node dist/seed.js || true
docker compose exec -T api node dist/maintenance.js || true
echo "==> health:"
curl -fsS http://127.0.0.1/api/health || (docker compose logs --tail=50 api; exit 1)
echo
echo "==> mail (DKIM açarı — DNS-ə əlavə olunmalıdır, Ayarlar → E-poçt göndərmə-də də görünür):"
docker compose exec -T mail sh -c 'cat /var/lib/rspamd/dkim/*.txt 2>/dev/null' || true
echo
