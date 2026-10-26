#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Restore a backup (backup.sh) into a NEW, EMPTY self-hosted server: the
# stack is running, apply-migrations.sh has run, and nobody has signed up
# yet (the accounts come from the backup).
#
#   ./restore.sh <folder with docker-compose.yml> <pm-data-….sql.gz> [pm-storage-….sql.gz] [pm-files-….tar.gz]
#
# Afterwards every device changes nothing: same address → it pulls again.
# (A device whose address changed resets its sync cursors by itself.)
# Guide: docs/08-server-setup.md.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

COMPOSE_DIR="${1:?usage: restore.sh <compose folder> <pm-data.sql.gz> [pm-storage.sql.gz] [pm-files.tar.gz]}"
DATA="${2:?the pm-data-….sql.gz file}"
STORAGE="${3:-}"
FILES="${4:-}"
HERE="$(cd "$(dirname "$0")" && pwd)"

psql_admin() {
  docker compose -f "$COMPOSE_DIR/docker-compose.yml" exec -T db \
    psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q "$@"
}

read -r -p "This writes $DATA into the server in $COMPOSE_DIR. Type RESTORE to continue: " answer
[ "$answer" = "RESTORE" ] || { echo "Cancelled."; exit 1; }

# Triggers off while loading: the history is restored as it was, not re-recorded.
{ echo "set session_replication_role = replica;"; gunzip -c "$DATA"; } | psql_admin
if [ -n "$STORAGE" ]; then
  { echo "set session_replication_role = replica;"; gunzip -c "$STORAGE"; } | psql_admin
fi
psql_admin < "$HERE/after-restore.sql"
if [ -n "$FILES" ]; then
  tar -xzf "$FILES" -C "$COMPOSE_DIR/volumes"
fi
echo "Restored. Sign in on a device and check a project."
