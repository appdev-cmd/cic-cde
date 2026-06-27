#!/bin/bash
# Setup Viettel Cloud VM for CDE CIC Self-Host
# Run as root on a fresh Ubuntu 22.04/24.04 VM
set -euo pipefail

echo "============================================="
echo "  CDE CIC Self-Host - Viettel Cloud VM Setup"
echo "============================================="

# 1. System update
echo "[1/7] Updating system..."
apt-get update -y && apt-get upgrade -y

# 2. Install Docker
echo "[2/7] Installing Docker..."
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
else
  echo "  Docker already installed: $(docker --version)"
fi

# 3. Install Docker Compose plugin
echo "[3/7] Installing Docker Compose..."
if ! docker compose version &>/dev/null; then
  apt-get install -y docker-compose-plugin
else
  echo "  Docker Compose already installed: $(docker compose version)"
fi

# 4. Install utilities
echo "[4/7] Installing utilities..."
apt-get install -y curl wget git certbot rclone jq htop

# 5. Setup project directory
echo "[5/7] Setting up /opt/cde..."
mkdir -p /opt/cde
if [ ! -d "/opt/cde/selfhost" ]; then
  echo "  WARN: /opt/cde/selfhost not found."
  echo "  Upload the selfhost/ folder to /opt/cde/"
  echo "  Example: scp -r selfhost/ root@<VM_IP>:/opt/cde/"
fi

# 6. Firewall
echo "[6/7] Configuring firewall..."
if command -v ufw &>/dev/null; then
  ufw allow 22/tcp
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw --force enable
  echo "  UFW enabled: ports 22, 80, 443 open"
else
  echo "  UFW not available, configure firewall manually via Viettel Console"
fi

# 7. Kernel tuning for containers
echo "[7/7] Tuning kernel..."
cat > /etc/sysctl.d/99-cde.conf <<'SYSCTL'
# Max file descriptors
fs.file-max = 65536
# Network tuning
net.core.somaxconn = 1024
net.ipv4.tcp_max_syn_backlog = 1024
# VM tuning (prevent OOM on 8GB RAM)
vm.swappiness = 10
vm.overcommit_memory = 1
SYSCTL
sysctl -p /etc/sysctl.d/99-cde.conf

echo ""
echo "============================================="
echo "  VM Setup Complete!"
echo "============================================="
echo ""
echo "Next steps:"
echo "  1. Upload selfhost/ folder to /opt/cde/"
echo "  2. cd /opt/cde/selfhost"
echo "  3. bash scripts/generate-keys.sh"
echo "  4. node scripts/generate-jwt-keys.js <JWT_SECRET>"
echo "  5. cp .env.example .env && nano .env"
echo "  6. bash scripts/deploy.sh"
echo ""
