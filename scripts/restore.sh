#!/usr/bin/env bash
# Restore a backup made by scripts/backup.sh into a database that already has the migrations applied
# (fresh project: `supabase db push` / local: `supabase db reset`). Runs in ONE transaction.
#   scripts/restore.sh backups/<timestamp>            # local stack
#   SUPABASE_DB_URL=postgres://… scripts/restore.sh backups/<timestamp>
set -euo pipefail
cd "$(dirname "$0")/.."
DIR="${1:?usage: scripts/restore.sh backups/<timestamp>}"
TABLES="public.audit_log, public.goals, public.practice_log, public.step_completions, public.pose_progress, public.favorites, public.media_assets, public.reviews, public.document_versions, public.publications, public.documents, public.site_settings, public.skills, public.categories, public.levels, public.user_roles, public.profiles"
SQL=$(mktemp)
{
  echo "set session_replication_role = replica;"
  echo "truncate $TABLES restart identity cascade;"
  cat "$DIR/data-public.sql"
} > "$SQL"
if [ -n "${SUPABASE_DB_URL:-}" ] && [[ "$SUPABASE_DB_URL" != *127.0.0.1* ]]; then
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q --single-transaction -f "$DIR/data-auth.sql"
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q --single-transaction -f "$SQL"
else
  docker exec -i supabase_db_balance psql -U postgres -v ON_ERROR_STOP=1 -q --single-transaction < "$SQL"
fi
rm -f "$SQL"
echo "Restored public data from $DIR (auth users: load data-auth.sql into an empty auth schema if needed)."
