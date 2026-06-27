#!/bin/bash
# Migrate data from Supabase Cloud to CDE CIC Self-Hosted
# Run from /opt/cde/selfhost/
set -euo pipefail

echo "============================================="
echo "  CDE CIC - Migrate from Supabase Cloud"
echo "============================================="
echo ""

source .env

# ── STEP 1: Database Migration ──
echo "[Step 1] Database Migration"
echo ""

if [ -z "${CLOUD_DB_URL:-}" ]; then
  echo "  Enter your Supabase Cloud database URL:"
  echo "  Format: postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres"
  read -p "  CLOUD_DB_URL: " CLOUD_DB_URL
fi

DUMP_FILE="/tmp/cde_cloud_dump_$(date +%Y%m%d).sql"

echo "  Dumping from Supabase Cloud..."
echo "  (This may take a few minutes depending on data size)"

pg_dump "$CLOUD_DB_URL" \
  --no-owner \
  --no-privileges \
  --exclude-schema=supabase_migrations \
  --exclude-schema=supabase_functions \
  --exclude-schema=extensions \
  --exclude-schema=_analytics \
  --exclude-schema=_realtime \
  --exclude-schema=auth \
  --exclude-schema=storage \
  -f "$DUMP_FILE"

DUMP_SIZE=$(du -h "$DUMP_FILE" | cut -f1)
echo "  Dump complete: $DUMP_FILE ($DUMP_SIZE)"

echo ""
echo "  Restoring to local DB..."
docker exec -i supabase-db psql -U postgres -d postgres < "$DUMP_FILE"
echo "  Database restored."

echo ""
echo "  Dumping auth.users from Cloud..."
AUTH_DUMP="/tmp/cde_auth_dump_$(date +%Y%m%d).sql"
pg_dump "$CLOUD_DB_URL" \
  --no-owner \
  --no-privileges \
  --schema=auth \
  --data-only \
  --table=auth.users \
  --table=auth.identities \
  --table=auth.mfa_factors \
  --table=auth.mfa_challenges \
  -f "$AUTH_DUMP" 2>/dev/null || echo "  WARN: Could not dump auth tables (may need direct DB access)"

if [ -f "$AUTH_DUMP" ] && [ -s "$AUTH_DUMP" ]; then
  docker exec -i supabase-db psql -U postgres -d postgres < "$AUTH_DUMP"
  echo "  Auth users restored."
fi

# ── STEP 2: Storage Migration ──
echo ""
echo "[Step 2] Storage Migration (S3 to Viettel Object Storage)"
echo ""

if [ -z "${CLOUD_S3_ENDPOINT:-}" ]; then
  echo "  Do you want to migrate storage files? [y/N]"
  read -p "  " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "  Skipping storage migration."
    echo ""
    echo "  Done! Database migrated successfully."
    exit 0
  fi

  echo ""
  echo "  You need rclone configured with two remotes:"
  echo "    1. 'supabase-cloud' - Supabase Cloud S3 storage"
  echo "    2. 'viettel-s3'     - Viettel Object Storage"
  echo ""
  read -p "  Are rclone remotes configured? [y/N] " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "  Configure rclone first, then re-run this script."
    exit 0
  fi
fi

echo "  Syncing storage files..."
rclone sync supabase-cloud:stub viettel-s3:${VIETTEL_S3_BUCKET:-cde-documents} \
  --progress \
  --transfers 8 \
  --checkers 16 \
  --s3-chunk-size 64M

echo ""
echo "============================================="
echo "  Migration Complete!"
echo "============================================="
echo ""
echo "  Next: verify at ${SITE_URL}"
echo "  Health: bash scripts/health-check.sh"
echo ""
