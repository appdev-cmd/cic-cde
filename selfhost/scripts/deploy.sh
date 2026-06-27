#!/bin/bash
# Deploy CDE CIC Self-Host Stack
# Run from /opt/cde/selfhost/
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

echo "============================================="
echo "  CDE CIC Self-Host - Deploy"
echo "============================================="

# Pre-flight checks
echo ""
echo "[Pre-flight] Checking requirements..."

if [ ! -f ".env" ]; then
  echo "  ERROR: .env file not found!"
  echo "  Run: cp .env.example .env && nano .env"
  exit 1
fi

source .env

# Validate critical env vars
MISSING=""
for VAR in POSTGRES_PASSWORD JWT_SECRET ANON_KEY SERVICE_ROLE_KEY SECRET_KEY_BASE SITE_URL; do
  VAL=$(eval echo "\${$VAR:-}")
  if [ -z "$VAL" ] || [[ "$VAL" == *"your-"* ]] || [[ "$VAL" == *"placeholder"* ]]; then
    MISSING="$MISSING  - $VAR\n"
  fi
done

if [ -n "$MISSING" ]; then
  echo "  ERROR: The following .env values are missing or still placeholders:"
  echo -e "$MISSING"
  echo "  Please fill in real values in .env"
  exit 1
fi

# Check SSL certs
if [ ! -f "nginx/ssl/server.crt" ] || [ ! -f "nginx/ssl/server.key" ]; then
  echo "  WARN: SSL certificates not found in nginx/ssl/"
  echo "  Generate with: certbot certonly --standalone -d cde.cic.com.vn"
  echo ""
  read -p "  Continue without SSL? (for testing only) [y/N] " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
  echo "  Generating self-signed cert for testing..."
  mkdir -p nginx/ssl
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout nginx/ssl/server.key -out nginx/ssl/server.crt \
    -subj "/CN=localhost" 2>/dev/null
fi

# Check frontend dist
if [ ! -d "dist" ] && [ ! -d "../dist" ]; then
  echo "  WARN: Frontend dist/ not found."
  echo "  Build frontend first: cd /opt/cde && npm run build"
  echo "  Then copy: cp -r /opt/cde/dist /opt/cde/selfhost/dist"
  echo ""
  read -p "  Continue without frontend? [y/N] " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
  mkdir -p dist
  echo '<!DOCTYPE html><html><body><h1>CDE CIC - Frontend not built yet</h1></body></html>' > dist/index.html
fi

echo "  All checks passed."
echo ""

# Step 1: Pull images
echo "[1/4] Pulling Docker images..."
docker compose pull

# Step 2: Build custom API
echo "[2/4] Building CDE API image..."
docker compose build api

# Step 3: Start stack
echo "[3/4] Starting stack..."
docker compose up -d

# Step 4: Wait and verify
echo "[4/4] Verifying services..."
echo "  Waiting 30s for services to start..."
sleep 30

ALL_OK=true
for SVC in db auth rest realtime storage kong nginx; do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' "supabase-${SVC}" 2>/dev/null || echo "unknown")
  if [ "$STATUS" = "healthy" ]; then
    printf "  %-12s %s\n" "$SVC" "✓ healthy"
  else
    printf "  %-12s %s\n" "$SVC" "✗ $STATUS"
    ALL_OK=false
  fi
done

# Check CDE API separately
STATUS=$(docker inspect --format='{{.State.Health.Status}}' "cde-api" 2>/dev/null || echo "unknown")
if [ "$STATUS" = "healthy" ]; then
  printf "  %-12s %s\n" "cde-api" "✓ healthy"
else
  printf "  %-12s %s\n" "cde-api" "✗ $STATUS"
  ALL_OK=false
fi

echo ""
if [ "$ALL_OK" = true ]; then
  echo "============================================="
  echo "  Deploy Successful!"
  echo "============================================="
  echo ""
  echo "  URL:  ${SITE_URL}"
  echo "  API:  ${SITE_URL}/rest/v1/"
  echo "  Auth: ${SITE_URL}/auth/v1/health"
  echo ""
else
  echo "============================================="
  echo "  Some services are not healthy yet."
  echo "============================================="
  echo ""
  echo "  Check logs: docker compose logs -f"
  echo "  Services may still be starting up."
  echo ""
fi

# Setup backup cron
if ! crontab -l 2>/dev/null | grep -q "backup-db.sh"; then
  echo "Setting up daily DB backup cron..."
  (crontab -l 2>/dev/null; echo "0 2 * * * /opt/cde/selfhost/scripts/backup-db.sh >> /var/log/cde-backup.log 2>&1") | crontab -
  echo "  Backup scheduled: daily at 02:00 UTC (09:00 GMT+7)"
fi
