#!/usr/bin/env bash
# Applique les migrations SQL sur Postgres local (EC2).
# Usage sur le serveur :
#   cd /home/ec2-user/BLOXKING   # ou ton clone git
#   git pull
#   bash scripts/apply-db-migrations.sh
#
# Évite l'erreur « could not change directory » : psql lit les fichiers depuis /tmp.

set -euo pipefail

DB="${BLOXKING_DB:-bloxking}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="/tmp/bloxking-migrations-$$"
mkdir -p "$TMP"

MIGRATIONS=(
  "07_match_cancellation_requests.sql"
  "08_dispute_early_and_cancel_attachments.sql"
  "09_user_presence.sql"
  "10_in_app_notifications.sql"
  "11_elo_upset_bonus.sql"
  "12_grants_user_notifications.sql"
  "13_matchmaking_unified_pool.sql"
  "14_matchmaking_avoid_rematch.sql"
  "15_player_blame_moderation.sql"
  "16_elo_blame_penalty.sql"
  "17_match_start_dodge_tracking.sql"
  "18_start_dodge_bloxking_grants.sql"
  "19_matchmaking_block_same_ip.sql"
  "20_admin_dispute_decisions.sql"
  "21_site_pvp_toggle.sql"
)

echo "Repo: $REPO_ROOT"
echo "Base: $DB"
echo ""

for f in "${MIGRATIONS[@]}"; do
  src="$REPO_ROOT/db/$f"
  if [[ ! -f "$src" ]]; then
    echo "SKIP (fichier absent): db/$f — fais d'abord: git pull"
    continue
  fi
  dest="$TMP/$f"
  cp "$src" "$dest"
  chmod 644 "$dest"
  echo ">>> db/$f"
  # psql tente de cd vers le cwd courant : lancer depuis /tmp évite
  # « could not change directory to /home/ec2-user/... Permission denied »
  (cd /tmp && sudo -u postgres psql -d "$DB" -f "$dest")
  echo ""
done

rm -rf "$TMP"
echo "Terminé."
