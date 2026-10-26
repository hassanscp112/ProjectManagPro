#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Apply ProjectManagerApp's database migrations to the self-hosted Supabase
# running on this machine (Docker Compose). Safe to run again: each
# migration runs once, in one transaction, and is recorded where the
# Supabase CLI records its own (supabase_migrations.schema_migrations), so
# `npx supabase db push` agrees later.
#
#   ./apply-migrations.sh <folder with docker-compose.yml>
#
# On Windows run it in Git Bash. Guide: docs/08-server-setup.md.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

COMPOSE_DIR="${1:?usage: apply-migrations.sh <folder with docker-compose.yml>}"
HERE="$(cd "$(dirname "$0")" && pwd)"
MIGRATIONS="$HERE/../migrations"

psql_db() {
  docker compose -f "$COMPOSE_DIR/docker-compose.yml" exec -T db \
    psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q "$@"
}

psql_db -c "create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);"

for file in "$MIGRATIONS"/*.sql; do
  base="$(basename "$file" .sql)"
  version="${base%%_*}"
  name="${base#*_}"
  applied="$(psql_db -tAc "select 1 from supabase_migrations.schema_migrations where version = '$version'")"
  if [ "$applied" = "1" ]; then
    echo "= $base (already applied)"
    continue
  fi
  echo "+ $base"
  {
    echo "begin;"
    cat "$file"
    echo
    echo "insert into supabase_migrations.schema_migrations (version, name) values ('$version', '$name');"
    echo "commit;"
  } | psql_db
done
echo "Migrations are up to date."
