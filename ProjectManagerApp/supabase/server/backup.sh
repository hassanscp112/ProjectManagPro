#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Back up the shared data of the self-hosted server. The structure comes
# from the migrations, so a backup holds data only:
#   pm-data-<time>.sql.gz      the app's tables (projects, members, items,
#                              the change history …) + the accounts
#   pm-storage-<time>.sql.gz   the list of uploaded files (storage.objects)
#   pm-files-<time>.tar.gz     the uploaded files themselves
# Keeps the newest $KEEP sets (default 28 = a week at every 6 hours).
#
#   ./backup.sh <folder with docker-compose.yml> [backup folder]
#
# Schedule: Linux / macOS — crontab -e:
#   0 */6 * * *  /path/to/backup.sh /path/to/supabase-project /path/to/pm-backups
# Windows — Task Scheduler, every 6 hours, program
#   "C:\Program Files\Git\bin\bash.exe"
# with arguments
#   -lc "/c/path/to/backup.sh /c/path/to/supabase-project /c/path/to/pm-backups"
# Copy the backup folder off the laptop too (USB disk, cloud drive).
# Guide: docs/08-server-setup.md.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

COMPOSE_DIR="${1:?usage: backup.sh <folder with docker-compose.yml> [backup folder]}"
OUT="${2:-$COMPOSE_DIR/../pm-backups}"
KEEP="${KEEP:-28}"
STAMP="$(date +%Y-%m-%d_%H-%M)"
mkdir -p "$OUT"

dump() {
  docker compose -f "$COMPOSE_DIR/docker-compose.yml" exec -T db \
    pg_dump -U supabase_admin -d postgres --data-only --no-owner --no-privileges "$@"
}

dump -t 'public.*' -t 'app_private.items_seq' -t 'auth.users' -t 'auth.identities' | gzip > "$OUT/pm-data-$STAMP.sql.gz"
dump -t 'storage.objects' | gzip > "$OUT/pm-storage-$STAMP.sql.gz"
if [ -d "$COMPOSE_DIR/volumes/storage" ]; then
  tar -czf "$OUT/pm-files-$STAMP.tar.gz" -C "$COMPOSE_DIR/volumes" storage
fi

# keep the newest $KEEP of each kind
for kind in data storage files; do
  ls -1t "$OUT"/pm-"$kind"-* 2>/dev/null | tail -n +"$((KEEP + 1))" | while read -r old; do rm -f -- "$old"; done
done
echo "Backup written to $OUT (pm-*-$STAMP)."
