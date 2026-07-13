#!/usr/bin/env bash
# CoTailor one-command deploy.
#
# Fresh environment needs only: Node.js 20+, pnpm, and a running PostgreSQL.
#
#   cp .env.deploy.example .env.deploy   # then edit DATABASE_URL (and the
#                                        # public URL if this is a remote server)
#   bash deploy.sh                       # install + build + db + seed + start
#
# Subcommands:
#   bash deploy.sh setup   # install, build, bootstrap+seed DB — do NOT start
#   bash deploy.sh db      # (re)apply DB schema + seeds only
#   bash deploy.sh start   # start the apps only (assumes already set up)
#
# Re-running is safe: the destructive schema (init.sql) is applied only when the
# database is empty; every seed is idempotent.
set -euo pipefail
cd "$(dirname "$0")"

# ---- Config: .env.deploy overrides these defaults, which the environment can override too ----
if [ -f .env.deploy ]; then set -a; . ./.env.deploy; set +a; fi

DATABASE_URL="${DATABASE_URL:-postgresql://cotailor:cotailor@127.0.0.1:5432/cotailor?schema=public}"
API_PORT="${API_PORT:-3001}"
LLM_PROVIDER="${LLM_PROVIDER:-stub}"
NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:${API_PORT}/api/v1}"
ADMIN_EMAILS="${ADMIN_EMAILS:-wrenikey.dev@gmail.com}"
export DATABASE_URL NEXT_PUBLIC_API_URL

log() { printf '\033[36m→ %s\033[0m\n' "$*"; }
die() { printf '\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

preflight() {
  command -v node >/dev/null || die "Node.js 20+ is required."
  command -v pnpm >/dev/null || die "pnpm is required (npm i -g pnpm)."
  command -v psql >/dev/null || die "psql (PostgreSQL client) is required for DB setup."
}

# A strong JWT secret must persist across restarts (else all sessions drop), so
# generate once and save it back to .env.deploy.
ensure_secret() {
  if [ -z "${JWT_SECRET:-}" ]; then
    JWT_SECRET="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
    echo "JWT_SECRET=\"$JWT_SECRET\"" >> .env.deploy
    log "generated a JWT_SECRET (saved to .env.deploy)"
  fi
}

# The API reads apps/api/.env at startup (ConfigModule). Write the resolved values there.
write_env() {
  ensure_secret
  {
    echo "DATABASE_URL=\"$DATABASE_URL\""
    echo "API_PORT=$API_PORT"
    echo "JWT_SECRET=\"$JWT_SECRET\""
    echo "LLM_PROVIDER=\"$LLM_PROVIDER\""
    echo "ADMIN_EMAILS=\"$ADMIN_EMAILS\""
    [ -n "${GEMINI_API_KEY:-}" ]    && echo "GEMINI_API_KEY=\"$GEMINI_API_KEY\""
    [ -n "${GEMINI_MODEL:-}" ]      && echo "GEMINI_MODEL=\"$GEMINI_MODEL\""
    [ -n "${OPENAI_API_KEY:-}" ]    && echo "OPENAI_API_KEY=\"$OPENAI_API_KEY\""
    [ -n "${OPENAI_MODEL:-}" ]      && echo "OPENAI_MODEL=\"$OPENAI_MODEL\""
    [ -n "${ANTHROPIC_API_KEY:-}" ] && echo "ANTHROPIC_API_KEY=\"$ANTHROPIC_API_KEY\""
  } > apps/api/.env
  log "wrote apps/api/.env"
}

build_all() {
  log "installing dependencies"
  pnpm install
  log "building shared package"
  pnpm --filter @cotailor/shared run build
  log "generating Prisma client"
  pnpm --filter @cotailor/api run prisma:generate
  log "building api / web / admin"
  pnpm --filter @cotailor/api run build
  pnpm --filter @cotailor/web run build
  pnpm --filter @cotailor/admin run build
}

# Apply schema + reference-data seeds + admin, in dependency order. init.sql is
# destructive (DROP SCHEMA), so it runs only on an empty database; the rest are
# idempotent and safe to re-run.
db_bootstrap() {
  local P="apps/api/prisma"
  local has_user
  has_user="$(psql "$DATABASE_URL" -tAc "SELECT to_regclass('public.\"User\"') IS NOT NULL;" 2>/dev/null || echo "")"
  if [ "$has_user" = "t" ]; then
    log "schema present — skipping init.sql (destructive), applying idempotent seeds only"
  else
    log "empty database — applying schema (init.sql)"
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$P/init.sql"
  fi
  for f in taxonomy family family-seed cert-catalog cert-catalog-multicat seed-admin; do
    log "applying $f.sql"
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$P/$f.sql"
  done
  log "database ready — admin: $ADMIN_EMAILS"
}

start_all() {
  log "starting  api:${API_PORT}  web:3000  admin:3002   (Ctrl+C stops all)"
  exec pnpm --parallel \
    --filter @cotailor/api --filter @cotailor/web --filter @cotailor/admin run start
}

case "${1:-all}" in
  setup) preflight; write_env; build_all; db_bootstrap ;;
  db)    preflight; db_bootstrap ;;
  start) preflight; start_all ;;
  all)   preflight; write_env; build_all; db_bootstrap; start_all ;;
  *)     die "usage: deploy.sh [all|setup|db|start]" ;;
esac
