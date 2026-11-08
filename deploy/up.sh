#!/usr/bin/env bash
# Serverdə işə düşür (GitHub Actions çağırır): sirləri ilk dəfə yaradır və xidmətləri qaldırır.
set -euo pipefail
cd "$(dirname "$0")"
if [ ! -f .env ]; then
  umask 077
  echo "POSTGRES_PASSWORD=$(head -c 32 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 40)" > .env
  echo "SITE_ADDRESS=:80" >> .env
  echo "==> .env yaradıldı (yalnız serverdə saxlanılır)"
fi
docker compose up -d --build --remove-orphans
docker image prune -f >/dev/null
sleep 5
docker compose ps
echo "==> health:"
curl -fsS http://127.0.0.1/api/health || (docker compose logs --tail=50 api; exit 1)
echo
