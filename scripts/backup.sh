#!/usr/bin/env bash
# Backup without paid features: schema + data dumps via the Supabase CLI (pg_dump in Docker).
#   pnpm db:backup                      # local stack
#   SUPABASE_DB_URL=postgres://… pnpm db:backup   # remote project (session pooler/direct URL)
# Output: backups/<timestamp>/{schema.sql,data-public.sql,data-auth.sql,storage-objects.csv}
# data-auth.sql contains e-mail addresses and password hashes: store backups encrypted, never in git.
set -euo pipefail
cd "$(dirname "$0")/.."
TS=$(date -u +%Y%m%dT%H%M%SZ)
OUT="backups/$TS"
mkdir -p "$OUT"
if [ -n "${SUPABASE_DB_URL:-}" ] && [[ "$SUPABASE_DB_URL" != *127.0.0.1* ]]; then TARGET=(--db-url "$SUPABASE_DB_URL"); else TARGET=(--local); fi
pnpm exec supabase db dump "${TARGET[@]}" -f "$OUT/schema.sql"
pnpm exec supabase db dump "${TARGET[@]}" --data-only --schema public -f "$OUT/data-public.sql"
pnpm exec supabase db dump "${TARGET[@]}" --data-only --schema auth -f "$OUT/data-auth.sql"
if [ "${TARGET[0]}" = "--local" ]; then
  docker exec supabase_db_balance psql -U postgres -At -c "copy (select bucket_id, name, metadata->>'mimetype', metadata->>'size' from storage.objects) to stdout with csv" > "$OUT/storage-objects.csv"
fi
echo "Backup written to $OUT"
ls -la "$OUT"
