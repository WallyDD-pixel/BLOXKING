#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/home/ec2-user/BLOXKING}"

cd "$APP_DIR"

echo ">> git pull"
git pull

echo ">> build + up"
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --build

echo ">> health"
sleep 2
curl -fsS http://127.0.0.1:3000 >/dev/null && echo "OK app up"
