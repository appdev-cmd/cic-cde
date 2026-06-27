#!/bin/bash
# Generate secrets for CDE CIC Self-Host
set -e

echo "=== CDE CIC Self-Host Key Generator ==="
echo ""

JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
echo "JWT_SECRET=${JWT_SECRET}"
echo ""

SECRET_KEY_BASE=$(openssl rand -base64 64 | tr -d '\n')
echo "SECRET_KEY_BASE=${SECRET_KEY_BASE}"
echo ""

POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d '\n' | tr -d '/' | tr -d '+')
echo "POSTGRES_PASSWORD=${POSTGRES_PASSWORD}"
echo ""

echo "=== IMPORTANT ==="
echo "Use these values in your .env file."
echo ""
echo "To generate ANON_KEY and SERVICE_ROLE_KEY:"
echo "  node scripts/generate-jwt-keys.js <JWT_SECRET>"
