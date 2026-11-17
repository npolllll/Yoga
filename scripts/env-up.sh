#!/usr/bin/env bash
# Starts Docker (if needed) and the local Supabase stack used for development and tests.
set -euo pipefail
cd "$(dirname "$0")/.."
if ! docker info >/dev/null 2>&1; then
  echo "Starting dockerd…"
  (dockerd >/tmp/dockerd.log 2>&1 &)
  for i in $(seq 1 30); do docker info >/dev/null 2>&1 && break; sleep 1; done
fi
pnpm exec supabase start -x studio,edge-runtime,logflare,vector,realtime,imgproxy,supavisor,postgres-meta
if [ ! -f .env.local ]; then
  eval "$(pnpm exec supabase status -o env 2>/dev/null | sed 's/^/export SB_/')"
  cat > .env.local <<ENV
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=$SB_API_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$SB_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY=$SB_SECRET_KEY
SUPABASE_DB_URL=$SB_DB_URL
MAILPIT_URL=$SB_MAILPIT_URL
ENV
  echo "Wrote .env.local"
fi
