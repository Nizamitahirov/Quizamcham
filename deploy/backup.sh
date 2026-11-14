#!/bin/sh
# Hər gecə 03:30 (Bakı) PostgreSQL ehtiyat nüsxəsi → /backups (serverdə /opt/jabr/backups), 14 gün saxlanılır; fayllar — həftəlik.
# Kənar nüsxə (istəyə bağlı): BACKUP_S3_* təyin olunubsa, hər nüsxə S3-uyğun saxlanca da göndərilir
# (Contabo Object Storage, Cloudflare R2, Backblaze B2 …) — server itsə də data qalır.
# Vəziyyət /backups/status faylına yazılır (api monitorinqi oxuyur).
set -eu

offsite() {
  # $1 — yerli fayl; S3 açarları yoxdursa heç nə etmir
  [ -n "${BACKUP_S3_ENDPOINT:-}" ] && [ -n "${BACKUP_S3_BUCKET:-}" ] && [ -n "${BACKUP_S3_KEY:-}" ] && [ -n "${BACKUP_S3_SECRET:-}" ] || return 0
  command -v curl >/dev/null 2>&1 || apk add --no-cache curl >/dev/null 2>&1 || { echo "offsite: curl yoxdur"; return 1; }
  name=$(basename "$1")
  url="${BACKUP_S3_ENDPOINT%/}/${BACKUP_S3_BUCKET}/$(date -u +%Y)/${name}"
  if curl -fsS --retry 3 --retry-delay 20 --max-time 1800 \
      --aws-sigv4 "aws:amz:${BACKUP_S3_REGION:-auto}:s3" --user "${BACKUP_S3_KEY}:${BACKUP_S3_SECRET}" \
      -H "x-amz-content-sha256: UNSIGNED-PAYLOAD" -T "$1" "$url" >/dev/null; then
    echo "offsite ok: $name"; return 0
  fi
  echo "offsite FAILED: $name"; return 1
}

status() { printf '%s\n' "$1" > /backups/status.part && mv /backups/status.part /backups/status; }

while true; do
  now=$(date -u +%H%M)
  if [ "$now" = "2330" ] || [ -f /backups/run-now ]; then
    rm -f /backups/run-now 2>/dev/null || true
    f="/backups/jabr-$(date -u +%Y%m%d-%H%M).sql.gz"
    if pg_dump -h db -U jabr -d jabr --no-owner | gzip -9 > "$f.part"; then
      mv "$f.part" "$f"; echo "backup ok: $f"
      if offsite "$f"; then off=ok; else off=failed; fi
      [ -n "${BACKUP_S3_BUCKET:-}" ] || off=off
      status "time=$(date -u +%s) file=$(basename "$f") size=$(wc -c < "$f") offsite=$off"
    else
      rm -f "$f.part"; echo "backup FAILED"
      status "time=$(date -u +%s) file= size=0 offsite=failed error=pg_dump"
    fi
    find /backups -name 'jabr-*.sql.gz' -mtime +14 -delete
    # tapşırıq faylları: həftəlik tam arxiv (bazar), 4 həftə saxlanılır
    if [ -d /files ] && [ "$(date -u +%u)" = "7" ]; then
      a="/backups/jabr-files-$(date -u +%Y%m%d).tar.gz"
      if tar -czf "$a.part" -C /files . && mv "$a.part" "$a"; then echo "files backup ok: $a"; offsite "$a" || true; else rm -f "$a.part"; fi
      find /backups -name 'jabr-files-*.tar.gz' -mtime +28 -delete
    fi
    sleep 61
  fi
  sleep 30
done
