#!/bin/sh
# Hər gecə 03:30 (Bakı) PostgreSQL ehtiyat nüsxəsi → /backups (serverdə /opt/jabr/backups), 14 gün saxlanılır.
set -eu
while true; do
  now=$(date -u +%H%M)
  if [ "$now" = "2330" ]; then
    f="/backups/jabr-$(date -u +%Y%m%d-%H%M).sql.gz"
    if pg_dump -h db -U jabr -d jabr --no-owner | gzip -9 > "$f.part"; then mv "$f.part" "$f"; echo "backup ok: $f"; else rm -f "$f.part"; echo "backup FAILED"; fi
    find /backups -name 'jabr-*.sql.gz' -mtime +14 -delete
    sleep 61
  fi
  sleep 30
done
