#!/usr/bin/env bash
# load.sh — push the extracted CSVs into Postgres. Safe to re-run: it truncates
# the catalog and progress tables first, so the workbook stays the source of
# truth until you cut over. Reads $ENV_FILE (default .env, the development
# database); ENV_FILE=.env.live loads production, at Step 14 and never after.
set -euo pipefail

ENV_FILE="${ENV_FILE:-.env}"
if [ -f "$ENV_FILE" ]; then
  case "$ENV_FILE" in */*) env_path="$ENV_FILE" ;; *) env_path="./$ENV_FILE" ;; esac
  set -a; . "$env_path"; set +a
else
  echo "$ENV_FILE not found; relying on existing environment variables." >&2
fi

# The guard (R2-02). This script TRUNCATEs every progress table; once the app is
# the source of truth it must never run.
case "$(echo "${LEDGER_LIVE:-false}" | tr '[:upper:]' '[:lower:]')" in
  true|1|yes)
    echo "LEDGER_LIVE is true: the app is the source of truth now; loading would truncate progress recorded only there. Nothing was changed." >&2
    exit 1 ;;
esac

: "${DATABASE_URL:?set DATABASE_URL}"
: "${OWNER_ID:?set OWNER_ID}"
SEED="${1:-seed}"

# OWNER_ID is a key written into CSVs and a sed replacement: keep it a slug, so
# no character in it can mean anything to either (R2 L-5).
case "$OWNER_ID" in
  *[!a-z0-9_-]*)
    echo "OWNER_ID must be lowercase letters, digits, - or _ (it is a key): $OWNER_ID" >&2
    exit 1 ;;
esac

# The extract writes a literal $OWNER placeholder; bind it to your real user id.
tmp=$(mktemp -d)
for f in issue_progress edition_progress book_status reading_plan; do
  sed "s/\\\$OWNER/${OWNER_ID}/g" "$SEED/$f.csv" > "$tmp/$f.csv"
done

# The owner id and name go in as psql variables, quoted by psql (:'var'), so an
# apostrophe in OWNER_NAME cannot break the SQL (R2 L-5; load.ps1 doubles them).
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -v owner_id="$OWNER_ID" -v owner_name="${OWNER_NAME:-$OWNER_ID}" <<SQL
BEGIN;

INSERT INTO users (id, name) VALUES (:'owner_id', :'owner_name')
  ON CONFLICT (id) DO NOTHING;

TRUNCATE issue_progress, edition_progress, book_status, reading_plan,
         run_tracks, event_runs, prereqs, issue_credits, creators,
         run_issues, issues, events, editions,
         runs, blocks, tracks, releases, wishlist, external_lists,
         books, book_series, authors, shelves RESTART IDENTITY CASCADE;

\\copy tracks        FROM '$SEED/tracks.csv'        CSV HEADER
\\copy blocks(id,track_id,number,name) FROM '$SEED/blocks.csv' CSV HEADER
\\copy runs(id,title,tier,block_id,sequence,spine,rating,why,why_source,notes,placeholder) FROM '$SEED/runs.csv' CSV HEADER
\\copy run_tracks    FROM '$SEED/run_tracks.csv'    CSV HEADER
\\copy issues(id,label,cover_date,cover_date_source,story_title,story_title_source,cover_url,metron_id) FROM '$SEED/issues.csv' CSV HEADER
\\copy run_issues(id,run_id,sequence,issue_id,type,notes) FROM '$SEED/run_issues.csv' CSV HEADER
\\copy creators(id,name,metron_id) FROM '$SEED/creators.csv' CSV HEADER
\\copy issue_credits(issue_id,creator_id,role,source) FROM '$SEED/issue_credits.csv' CSV HEADER
\\copy prereqs       FROM '$SEED/prereqs.csv'       CSV HEADER
\\copy events        FROM '$SEED/events.csv'        CSV HEADER
\\copy event_runs    FROM '$SEED/event_runs.csv'    CSV HEADER
\\copy editions      FROM '$SEED/editions.csv'      CSV HEADER

\\copy authors        FROM '$SEED/authors.csv'        CSV HEADER
\\copy book_series    FROM '$SEED/book_series.csv'    CSV HEADER
\\copy books(id,title,author_id,series_id,series_position,genre,book_type,word_count,word_count_source,published_year) FROM '$SEED/books.csv' CSV HEADER
\\copy releases       FROM '$SEED/releases.csv'       CSV HEADER
\\copy wishlist(genre,raw_entry,book_id) FROM '$SEED/wishlist.csv' CSV HEADER
\\copy external_lists(source,year,rank,raw_title,book_id) FROM '$SEED/external_lists.csv' CSV HEADER

\\copy issue_progress(user_id,placement_id,completed_at,completed_at_precision) FROM '$tmp/issue_progress.csv' CSV HEADER
\\copy edition_progress FROM '$tmp/edition_progress.csv' CSV HEADER
\\copy book_status(user_id,book_id,status,finished_on,finished_on_precision,year_rank,rating) FROM '$tmp/book_status.csv' CSV HEADER
\\copy reading_plan(user_id,book_id,period,ordinal) FROM '$tmp/reading_plan.csv' CSV HEADER

-- run_issues.id came from the CSV (extract numbers placements in sheet order,
-- D-16), so the serial never advanced: move it past them, or the first
-- placement the app adds collides with a loaded one.
SELECT setval(pg_get_serial_sequence('run_issues', 'id'),
              COALESCE((SELECT max(id) FROM run_issues), 0) + 1, false);

COMMIT;
SQL

rm -rf "$tmp"
psql "$DATABASE_URL" -f etl/views.sql
echo "loaded."
