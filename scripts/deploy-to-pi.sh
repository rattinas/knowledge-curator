#!/bin/bash
# Deploy Knowledge Curator to Raspberry Pi 4
#
# Prerequisites:
#   - SSH access to your Pi
#   - Docker + Docker Compose installed on Pi
#   - Portainer (comes with HA OS) or SSH terminal
#
# Usage:
#   bash scripts/deploy-to-pi.sh PI_IP_ADDRESS
#
# Example:
#   bash scripts/deploy-to-pi.sh 192.168.178.50

set -e

PI_HOST="${1:-homeassistant.local}"
PI_USER="${2:-root}"
REMOTE_DIR="/root/knowledge-curator"

echo "=== Knowledge Curator → Raspberry Pi Deployment ==="
echo "Target: ${PI_USER}@${PI_HOST}"
echo ""

# 1. Build Docker image for ARM64 locally (faster than building on Pi)
echo "📦 Building Docker image for ARM64..."
docker buildx build \
  --platform linux/arm64 \
  --tag knowledge-curator:latest \
  --load \
  . 2>&1 | tail -5

# 2. Save image
echo "💾 Saving Docker image..."
docker save knowledge-curator:latest | gzip > /tmp/knowledge-curator.tar.gz
SIZE=$(du -h /tmp/knowledge-curator.tar.gz | cut -f1)
echo "   Image size: $SIZE"

# 3. Transfer to Pi
echo "📤 Transferring to Pi..."
ssh ${PI_USER}@${PI_HOST} "mkdir -p ${REMOTE_DIR}"
scp /tmp/knowledge-curator.tar.gz ${PI_USER}@${PI_HOST}:${REMOTE_DIR}/
scp docker-compose.yml ${PI_USER}@${PI_HOST}:${REMOTE_DIR}/

# 4. Load and start on Pi
echo "🚀 Starting on Pi..."
ssh ${PI_USER}@${PI_HOST} << 'REMOTE'
cd /root/knowledge-curator
docker load < knowledge-curator.tar.gz
rm knowledge-curator.tar.gz
docker compose up -d
echo "Waiting for startup..."
sleep 10
curl -s -o /dev/null -w "HTTP %{http_code}" http://localhost:3000 && echo " ✅ Running!" || echo " ❌ Failed"
REMOTE

# 5. Cleanup
rm -f /tmp/knowledge-curator.tar.gz

echo ""
echo "=== Deployment Complete ==="
echo "🌐 Web UI:  http://${PI_HOST}:3000"
echo "📱 Telegram Bot laeuft automatisch nach Scheduler-Start"
echo ""
echo "Naechste Schritte:"
echo "  1. Oeffne http://${PI_HOST}:3000/settings"
echo "  2. Trage deine API Keys ein"
echo "  3. Richte Telegram ein"
echo "  4. Klick 'Scheduler starten'"
echo "  5. Fertig! Laeuft 24/7 auf dem Pi."
