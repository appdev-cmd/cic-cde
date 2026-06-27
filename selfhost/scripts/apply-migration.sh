#!/bin/bash
# Apply Supabase migrations to self-hosted DB
# Usage: bash scripts/apply-migration.sh [migration-file]
# Without argument: applies all migrations in ../supabase/migrations/
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
MIGRATION_DIR="${PROJECT_DIR}/../supabase/migrations"

if [ ! -d "$MIGRATION_DIR" ]; then
  echo "ERROR: Migration directory not found: $MIGRATION_DIR"
  exit 1
fi

if [ -n "${1:-}" ]; then
  FILES=("$1")
else
  FILES=($(ls "$MIGRATION_DIR"/*.sql 2>/dev/null | sort))
fi

if [ ${#FILES[@]} -eq 0 ]; then
  echo "No migration files found."
  exit 0
fi

echo "Applying ${#FILES[@]} migration(s)..."

for f in "${FILES[@]}"; do
  FNAME=$(basename "$f")
  echo "  Applying: $FNAME"
  docker exec -i supabase-db psql -U postgres -d postgres < "$f" 2>&1 | head -5
  echo "    Done."
done

echo ""
echo "All migrations applied."
