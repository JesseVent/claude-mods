#!/usr/bin/env bash
# Dev-phase Supabase with no migrations: supabase/schemas/ is the schema, and
# pg-delta applies it straight to the dev database.
#   flat.sh flatten  [--db-url URL]    export the database to supabase/schemas/, delete supabase/migrations/
#   flat.sh apply    [--db-url URL] [pgdelta flags]    apply supabase/schemas/ to the database
#   flat.sh reset                      empty the local database, apply supabase/schemas/, run supabase/seed.sql
#   flat.sh graduate                   dump the local database to one baseline migration, for Phase: live
# Without --db-url (or DB_URL) the target is the local stack from `supabase status`.
set -euo pipefail

PGDELTA_VERSION="${PGDELTA_VERSION:-1.0.0-alpha.60}"
SCHEMAS=supabase/schemas

die() { echo "flat: $*" >&2; exit 1; }
# ponytail: no @supabase/pg-topo beside pg-delta, so a shadow load that sticks isn't reordered
# for you; install both into one cache dir if hand-written files start failing to load.
pgdelta() { bunx -p "@supabase/pg-delta@$PGDELTA_VERSION" pgdelta "$@"; }

# With no migrations, the CLI's own seeding runs against an empty database and
# fails `supabase start`, so flatten turns it off and reset seeds after apply.
seed_enabled() {
  local f=supabase/config.toml
  grep -q '^\[db\.seed\]' "$f" || printf '\n[db.seed]\nenabled = true\n' >>"$f"
  sed "/^\[db\.seed\]/,/^\[/ s/^enabled = .*/enabled = $1/" "$f" >"$f.tmp" && mv "$f.tmp" "$f"
}

db_url() {
  if [ -n "${DB_URL:-}" ]; then echo "$DB_URL"; return; fi
  supabase status -o env 2>/dev/null | sed -n 's/^DB_URL="\(.*\)"$/\1/p' | grep . ||
    die "the local stack isn't running: supabase start (or pass --db-url)"
}

apply() {
  local url
  url=$(db_url)
  pgdelta schema apply --dir "$SCHEMAS" --target "$url" --profile supabase "$@"
}

flatten() {
  git rev-parse --git-dir >/dev/null 2>&1 || die "not a git repo; git is what keeps the migrations this deletes"
  [ -z "$(git status --porcelain -- supabase/migrations)" ] || die "commit supabase/migrations first; git is what keeps the migrations this deletes"
  local url out others
  # Once this is pushed, teammates' supabase start and db reset give an empty database.
  others=$(git log --format=%an | grep -vxF "$(git config user.name)" | grep -v '\[bot\]$' | sort -u | paste -sd, -) || true
  [ -z "$others" ] || [ "${FLAT_SHARED_OK:-}" = 1 ] ||
    die "others commit to this repo ($others): once pushed, their supabase start and db reset give an empty database until they run flat.sh reset. Tell the user; rerun with FLAT_SHARED_OK=1 once they agree"
  url=$(db_url)
  pgdelta schema export --source "$url" --out-dir "$SCHEMAS" --profile supabase
  # The tree only replaces the migrations if it reloads to the same database.
  out=$(DB_URL="$url" apply --dry-run 2>&1 >/dev/null) || { echo "$out" >&2; die "the exported tree didn't load; migrations kept"; }
  grep -q '^Planning: 0 action' <<<"$out" || { echo "$out" >&2; die "the exported tree doesn't match the database; migrations kept"; }
  git rm -rq --ignore-unmatch -- supabase/migrations
  seed_enabled false
  echo "flat: $SCHEMAS is now the schema; supabase/migrations removed (git has the old files); [db.seed] off, flat.sh reset seeds."
}

reset() {
  [ -z "${DB_URL:-}" ] || die "reset is local-only; for a remote dev project run supabase db reset --linked --no-seed, then flat.sh apply --db-url"
  supabase db reset --local --no-seed
  apply
  # ponytail: runs supabase/seed.sql only, not [db.seed] sql_paths globs; read config.toml if a project splits its seed.
  if [ -f supabase/seed.sql ]; then psql "$(db_url)" -v ON_ERROR_STOP=1 -q -f supabase/seed.sql; fi
}

graduate() {
  [ -z "$(ls supabase/migrations/*.sql 2>/dev/null)" ] || die "supabase/migrations already has files"
  local file
  file="supabase/migrations/$(date -u +%Y%m%d%H%M%S)_baseline.sql"
  mkdir -p supabase/migrations
  supabase db dump --local -f "$file"
  seed_enabled true
  echo "flat: wrote $file and turned [db.seed] back on; check it replays with: supabase db reset"
}

cmd="${1:-}"
shift || true
if [ "${1:-}" = "--db-url" ]; then
  [ -n "${2:-}" ] || die "--db-url needs a value"
  export DB_URL="$2"
  shift 2
fi
[ -f supabase/config.toml ] || die "run from the project root (no supabase/config.toml here)"
! grep -qsE '^[^a-z]*Phase:[[:space:]]*live' CLAUDE.md || die "CLAUDE.md says Phase: live; a live project changes through migrations"

case "$cmd" in
  flatten | reset | graduate) "$cmd" ;;
  apply) apply "$@" ;;
  *) sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//' >&2; exit 2 ;;
esac
