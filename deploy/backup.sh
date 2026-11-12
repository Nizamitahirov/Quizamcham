#!/bin/sh
# Hər gecə 03:30 (Bakı) PostgreSQL ehtiyat nüsxəsi → /backups (serverdə /opt/jabr/backups), 14 gün saxlanılır; fayllar — həftəlik.
set -eu
while true; do
  now=$(date -u +%H%M)
  if [ "$now" = "2330" ]; then
    f="/backups/jabr-$(date -u +%Y%m%d-%H%M).sql.gz"
    if pg_dump -h db -U jabr -d jabr --no-owner | gzip -9 > "$f.part"; then mv "$f.part" "$f"; echo "backup ok: $f"; else rm -f "$f.part"; echo "backup FAILED"; fi
    find /backups -name 'jabr-*.sql.gz' -mtime +14 -delete
    # tapşırıq faylları: həftəlik tam arxiv (bazar), 4 həftə saxlanılır
    if [ -d /files ] && [ "$(date -u +%u)" = "7" ]; then
      a="/backups/jabr-files-$(date -u +%Y%m%d).tar.gz"
      tar -czf "$a.part" -C /files . && mv "$a.part" "$a" && echo "files backup ok: $a" || rm -f "$a.part"
      find /backups -name 'jabr-files-*.tar.gz' -mtime +28 -delete
    fi
    sleep 61
  fi
  sleep 30
done
