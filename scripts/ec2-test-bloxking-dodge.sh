#!/usr/bin/env bash
set -euo pipefail
cd /home/ec2-user/BLOXKING
set -a
# shellcheck disable=SC1091
source ./.env.production
set +a
psql "$DATABASE_URL" -f /tmp/ec2-test-bloxking-dodge.sql
