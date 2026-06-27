#!/bin/bash
# Update frontend without downtime
# Usage: bash scripts/update-frontend.sh [path-to-dist]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

DIST_SOURCE="${1:-../dist}"

if [ ! -d "$DIST_SOURCE" ]; then
  echo "ERROR: dist folder not found at $DIST_SOURCE"
  echo "Usage: bash scripts/update-frontend.sh [path-to-dist]"
  echo "  Default: ../dist (build from project root: npm run build)"
  exit 1
fi

echo "Updating frontend from $DIST_SOURCE..."

if [ -d "dist" ]; then
  BACKUP="dist.bak.$(date +%Y%m%d_%H%M%S)"
  mv dist "$BACKUP"
  echo "  Current dist backed up to $BACKUP"
fi

cp -r "$DIST_SOURCE" dist
echo "  New dist copied."

docker exec supabase-nginx nginx -s reload
echo "  Nginx reloaded."

echo "Frontend updated successfully."

ls -dt dist.bak.* 2>/dev/null | tail -n +4 | xargs rm -rf 2>/dev/null || true
