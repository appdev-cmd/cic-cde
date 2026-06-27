#!/bin/bash
# Automated PostgreSQL backup for CDE CIC Self-Host
# Runs via cron: 0 2 * * * (daily 02:00 UTC = 09:00 GMT+7)
set -euo pipefail

BACKUP_DIR="/opt/cde/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DAY_OF_WEEK=$(date +%u)
RETENTION_DAYS=14

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting DB backup..."

if [ "$DAY_OF_WEEK" = "7" ]; then
  BACKUP_FILE="$BACKUP_DIR/full_${TIMESTAMP}.sql.gz"
  echo "  Full backup -> $BACKUP_FILE"
  docker exec supabase-db pg_dumpall -U postgres | gzip > "$BACKUP_FILE"
else
  BACKUP_FILE="$BACKUP_DIR/daily_${TIMESTAMP}.sql.gz"
  echo "  Daily backup -> $BACKUP_FILE"
  docker exec supabase-db pg_dump -U postgres -d postgres --format=custom | gzip > "$BACKUP_FILE"
fi

SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "  Backup size: $SIZE"

# Off-site copy to Viettel Object Storage
if [ -f /opt/cde/.secrets ]; then
  S3_BUCKET="cde-backups"
  AKID=$(grep '^VIETTEL_S3_ACCESS_KEY=' /opt/cde/.secrets | cut -d= -f2-)
  SKEY=$(grep '^VIETTEL_S3_SECRET_KEY=' /opt/cde/.secrets | cut -d= -f2-)
  EP=$(grep '^VIETTEL_S3_ENDPOINT=' /opt/cde/.secrets | cut -d= -f2-)
  if [ -n "$AKID" ] && [ -n "$SKEY" ] && [ -n "$EP" ]; then
    echo "  Uploading off-site -> s3://$S3_BUCKET/$(basename "$BACKUP_FILE")"
    docker run --rm -e AWS_ACCESS_KEY_ID="$AKID" -e AWS_SECRET_ACCESS_KEY="$SKEY" \
      -e AWS_DEFAULT_REGION=us-east-1 -v "$BACKUP_FILE":/b.gz amazon/aws-cli \
      --endpoint-url "$EP" s3 cp /b.gz "s3://$S3_BUCKET/$(basename "$BACKUP_FILE")" \
      && echo "  Off-site upload OK" || echo "  WARN: off-site upload FAILED"
    # Off-site retention: 30 days
    docker run --rm -e AWS_ACCESS_KEY_ID="$AKID" -e AWS_SECRET_ACCESS_KEY="$SKEY" \
      -e AWS_DEFAULT_REGION=us-east-1 amazon/aws-cli --endpoint-url "$EP" \
      s3 ls "s3://$S3_BUCKET/" 2>/dev/null | awk -v d="$(date -d '30 days ago' +%Y-%m-%d)" '$1 < d {print $4}' | \
      while read -r old; do [ -n "$old" ] && docker run --rm -e AWS_ACCESS_KEY_ID="$AKID" -e AWS_SECRET_ACCESS_KEY="$SKEY" -e AWS_DEFAULT_REGION=us-east-1 amazon/aws-cli --endpoint-url "$EP" s3 rm "s3://$S3_BUCKET/$old" >/dev/null 2>&1; done
  else
    echo "  WARN: Missing S3 credentials — skipping off-site"
  fi
fi

echo "  Cleaning local backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +${RETENTION_DAYS} -delete

TOTAL=$(du -sh "$BACKUP_DIR" | cut -f1)
echo "  Total backup storage: $TOTAL"
echo "[$(date)] Backup complete."
