#!/bin/bash
# Health check script for all CDE CIC services
set -uo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

echo "============================================="
echo "  CDE CIC Self-Host - Health Check"
echo "  $(date)"
echo "============================================="
echo ""

ERRORS=0

check_container() {
  local name="$1"
  local container="$2"

  STATUS=$(docker inspect --format='{{.State.Status}}' "$container" 2>/dev/null || echo "not_found")
  HEALTH=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "n/a")

  if [ "$STATUS" = "running" ] && [ "$HEALTH" = "healthy" ]; then
    printf "  ${GREEN}✓${NC} %-16s running / healthy\n" "$name"
  elif [ "$STATUS" = "running" ]; then
    printf "  ${YELLOW}~${NC} %-16s running / %s\n" "$name" "$HEALTH"
  else
    printf "  ${RED}✗${NC} %-16s %s\n" "$name" "$STATUS"
    ERRORS=$((ERRORS + 1))
  fi
}

echo "Containers:"
check_container "PostgreSQL"       "supabase-db"
check_container "Auth (GoTrue)"    "supabase-auth"
check_container "REST (PostgREST)" "supabase-rest"
check_container "Realtime"         "supabase-realtime"
check_container "Storage"          "supabase-storage"
check_container "Kong Gateway"     "supabase-kong"
check_container "Nginx"            "supabase-nginx"
check_container "CDE API"          "cde-api"

echo ""
echo "Resources:"

TOTAL_MEM=$(docker stats --no-stream --format '{{.MemUsage}}' $(docker compose ps -q 2>/dev/null) 2>/dev/null | head -20)
if [ -n "$TOTAL_MEM" ]; then
  echo "  Container memory usage:"
  docker stats --no-stream --format '  {{.Name}}: {{.MemUsage}} ({{.MemPerc}})' 2>/dev/null | sort
fi

echo ""
echo "Disk:"
df -h / | tail -1 | awk '{printf "  Root:    %s used / %s total (%s)\n", $3, $2, $5}'

PGDATA_SIZE=$(docker exec supabase-db du -sh /var/lib/postgresql/data 2>/dev/null | cut -f1 || echo "n/a")
echo "  DB data: $PGDATA_SIZE"

BACKUP_SIZE=$(du -sh /opt/cde/backups 2>/dev/null | cut -f1 || echo "n/a")
echo "  Backups: $BACKUP_SIZE"

echo ""
if [ "$ERRORS" -gt 0 ]; then
  echo -e "${RED}$ERRORS service(s) have issues.${NC}"
  echo "Run 'docker compose logs <service>' for details."
  exit 1
else
  echo -e "${GREEN}All services OK.${NC}"
  exit 0
fi
