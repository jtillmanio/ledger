#!/usr/bin/env bash
# load-comics.sh — replace the comics catalog and comics progress from the seed,
# and no books row (task 1.29, D-128). Twin of load-comics.ps1, which says more.
#   bash etl/load-comics.sh [--yes] [seed-dir]
# From the books cutover until the comics cutover, Comics.xlsx stays the comics
# record: run `npm run extract:comics`, then this. One transaction, no CASCADE:
# read_events loses only its comic reads, inbox keeps every note. Reads
# $ENV_FILE (default .env, the development database). Runs while LEDGER_LIVE is
# true; refuses once LEDGER_COMICS_LIVE is. Only the owner runs it against
# ENV_FILE=.env.live.
set -euo pipefail

YES=0; SEED=seed
for arg in "$@"; do
  case "$arg" in
    --yes) YES=1 ;;
    *) SEED="$arg" ;;
  esac
done

ENV_FILE="${ENV_FILE:-.env}"
if [ -f "$ENV_FILE" ]; then
  case "$ENV_FILE" in */*) env_path="$ENV_FILE" ;; *) env_path="./$ENV_FILE" ;; esac
  set -a; . "$env_path"; set +a
else
  echo "$ENV_FILE not found; relying on existing environment variables." >&2
fi

# The guard (1.29, D-128), before anything else is read or reached. LEDGER_LIVE
# is the books' flag, and this load leaves the books alone.
case "$(echo "${LEDGER_COMICS_LIVE:-false}" | tr '[:upper:]' '[:lower:]')" in
  true|1|yes)
    echo "LEDGER_COMICS_LIVE is true in $ENV_FILE: the app is the comics record now; a comics load would replace comics progress recorded only there. Nothing was changed." >&2
    exit 1 ;;
esac

: "${DATABASE_URL:?set DATABASE_URL}"
: "${OWNER_ID:?set OWNER_ID}"

# OWNER_ID is a key written into CSVs and a sed replacement: keep it a slug.
case "$OWNER_ID" in
  *[!a-z0-9_-]*)
    echo "OWNER_ID must be lowercase letters, digits, - or _ (it is a key): $OWNER_ID" >&2
    exit 1 ;;
esac

# The comics seed npm run extract:comics writes; a books file is never read.
for f in tracks blocks runs run_tracks volume_rules issues run_issues \
         creators issue_credits prereqs events event_runs editions \
         issue_progress edition_progress; do
  [ -f "$SEED/$f.csv" ] || { echo "missing $SEED/$f.csv - run npm run extract:comics first" >&2; exit 1; }
done

host=$(echo "$DATABASE_URL" | sed -E 's#.*@([^/:?]+).*#\1#')
echo "This REPLACES every comics table in $host (runs, issues, placements, read marks, the queue, eras) from $SEED. No books table is touched."
if [ "$YES" -ne 1 ]; then
  answer=""
  read -r -p "Type COMICS to continue: " answer || true
  [ "$answer" = "COMICS" ] || { echo "Not confirmed. Nothing was changed." >&2; exit 1; }
fi

# The extract writes a literal $OWNER placeholder; bind it to your real user id.
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
for f in issue_progress edition_progress; do
  sed "s/\\\$OWNER/${OWNER_ID}/g" "$SEED/$f.csv" > "$tmp/$f.csv"
done

# The same statements as load-comics.ps1, in the same order
# (test/load-scripts.test.ts compares them). No CASCADE anywhere.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q \
  -v owner_id="$OWNER_ID" -v owner_name="${OWNER_NAME:-$OWNER_ID}" <<SQL || {
BEGIN;

INSERT INTO users (id, name) VALUES (:'owner_id', :'owner_name')
  ON CONFLICT (id) DO NOTHING;

-- inbox holds both media: a note resolved into a run keeps its link through
-- the reload while the run is still in the sheet (run ids are its slugs).
CREATE TEMP TABLE comics_load_inbox_runs ON COMMIT DROP AS
  SELECT id, run_id FROM inbox WHERE run_id IS NOT NULL;

-- read_events holds both media: only the comic reads go with their placements.
DELETE FROM read_events WHERE placement_id IS NOT NULL;

-- Nothing outside the comics references these, and without CASCADE Postgres
-- refuses the TRUNCATE if anything ever does.
TRUNCATE issue_progress, edition_progress, run_queue, run_tracks, event_runs, prereqs,
         issue_credits, creators, events, editions, volume_rules RESTART IDENTITY;

-- inbox and read_events reference these, so they are deleted, never truncated.
DELETE FROM run_issues;
DELETE FROM eras;
DELETE FROM issues;
DELETE FROM runs;
DELETE FROM blocks;
DELETE FROM tracks;
SELECT setval(pg_get_serial_sequence('eras', 'id'), 1, false);

\\copy tracks        FROM '$SEED/tracks.csv'        CSV HEADER
\\copy blocks(id,track_id,number,name) FROM '$SEED/blocks.csv' CSV HEADER
\\copy runs(id,title,tier,block_id,sequence,spine,rating,why,why_source,notes,placeholder) FROM '$SEED/runs.csv' CSV HEADER
\\copy run_tracks    FROM '$SEED/run_tracks.csv'    CSV HEADER
\\copy volume_rules(series,run_id,issue_from,issue_to,year) FROM '$SEED/volume_rules.csv' CSV HEADER
\\copy issues(id,label,cover_date,cover_date_source,story_title,story_title_source,cover_url,metron_id) FROM '$SEED/issues.csv' CSV HEADER
\\copy run_issues(id,run_id,sequence,issue_id,type,notes) FROM '$SEED/run_issues.csv' CSV HEADER
\\copy creators(id,name,metron_id) FROM '$SEED/creators.csv' CSV HEADER
\\copy issue_credits(issue_id,creator_id,role,source) FROM '$SEED/issue_credits.csv' CSV HEADER
\\copy prereqs       FROM '$SEED/prereqs.csv'       CSV HEADER
\\copy events        FROM '$SEED/events.csv'        CSV HEADER
\\copy event_runs    FROM '$SEED/event_runs.csv'    CSV HEADER
\\copy editions      FROM '$SEED/editions.csv'      CSV HEADER

\\copy issue_progress(user_id,placement_id,completed_at,completed_at_precision) FROM '$tmp/issue_progress.csv' CSV HEADER
\\copy edition_progress FROM '$tmp/edition_progress.csv' CSV HEADER

UPDATE inbox SET run_id = l.run_id
  FROM comics_load_inbox_runs l
  WHERE inbox.id = l.id AND EXISTS (SELECT 1 FROM runs r WHERE r.id = l.run_id);

-- run_issues.id came from the CSV (D-16): move the serial past it (load.sh).
SELECT setval(pg_get_serial_sequence('run_issues', 'id'),
              COALESCE((SELECT max(id) FROM run_issues), 0) + 1, false);

COMMIT;
SQL
  echo "comics load failed; the transaction rolled back, nothing was changed" >&2
  exit 1
}
echo "comics loaded."
