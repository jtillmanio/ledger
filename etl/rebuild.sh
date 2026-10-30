#!/usr/bin/env bash
# rebuild.sh — drop the database, recreate it from the migrations, extract,
# load, verify. WSL/Git Bash twin of etl/rebuild.ps1; see that file for the why.
#
#   bash etl/rebuild.sh [--yes] [--skip-extract] [seed-dir]
#   ENV_FILE=.env.live bash etl/rebuild.sh     # production, before cutover only
#
# Reads $ENV_FILE (default .env, the development database) and hands it on to
# load.sh. Refuses when LEDGER_LIVE=true. Never calls Metron.
set -euo pipefail

YES=0; SKIP_EXTRACT=0; SEED=seed
for arg in "$@"; do
  case "$arg" in
    --yes) YES=1 ;;
    --skip-extract) SKIP_EXTRACT=1 ;;
    *) SEED="$arg" ;;
  esac
done

export ENV_FILE="${ENV_FILE:-.env}"
if [ -f "$ENV_FILE" ]; then
  case "$ENV_FILE" in */*) env_path="$ENV_FILE" ;; *) env_path="./$ENV_FILE" ;; esac
  set -a; . "$env_path"; set +a
else
  echo "$ENV_FILE not found; relying on existing environment variables." >&2
fi
: "${DATABASE_URL:?set DATABASE_URL}"
: "${OWNER_ID:?set OWNER_ID}"

case "$(echo "${LEDGER_LIVE:-false}" | tr '[:upper:]' '[:lower:]')" in
  true|1|yes)
    echo "LEDGER_LIVE is true: the app is the source of truth now. Nothing was changed." >&2
    exit 1 ;;
esac

host=$(echo "$DATABASE_URL" | sed -E 's#.*@([^/:?]+).*#\1#')
echo "This DROPS every table in $host and reloads from the workbooks."
if [ "$YES" -ne 1 ]; then
  read -r -p "Type REBUILD to continue: " answer
  [ "$answer" = "REBUILD" ] || { echo "Cancelled. Nothing was changed."; exit 1; }
fi

echo "== 1/5 drop schema"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q \
  -c "DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

echo "== 2/5 migrate"
npx drizzle-kit migrate

if [ "$SKIP_EXTRACT" -eq 1 ]; then
  echo "== 3/5 extract (skipped: using $SEED as it is)"
else
  echo "== 3/5 extract"
  ${PYTHON:-python3} etl/extract.py --comics etl/data/Comics.xlsx --books etl/data/Books.xlsx --out "$SEED" \
    --volume-map etl/data/volume_map.csv --cover-dates etl/data/cover_dates.csv --why-review etl/data/why_review.csv \
    --label-review etl/data/label_review.csv --issue-details etl/data/issue_details.csv \
    --issue-credits etl/data/issue_credits.csv --creator-aliases etl/data/creator_aliases.csv \
    --creator-aliases etl/data/creator_review.csv --book-review etl/data/book_review.csv \
    --book-details etl/data/book_details.csv --calibre-books etl/data/calibre_books.csv \
    --calibre-missing etl/data/calibre_missing.csv
fi

echo "== 4/5 load"
bash etl/load.sh "$SEED"

echo "== 5/5 verify"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f etl/test_views.sql

failed=0
printf "%-18s %8s %8s\n" table seed loaded
for t in tracks blocks runs run_tracks volume_rules issues run_issues creators issue_credits prereqs \
         events event_runs editions issue_progress edition_progress authors book_series \
         book_universes book_subseries books book_genres book_status reading_plan releases wishlist external_lists \
         series_follows author_follows universe_follows read_events; do
  expected=$(${PYTHON:-python3} -c "import csv,sys; print(sum(1 for _ in csv.DictReader(open(sys.argv[1], encoding='utf-8'))))" "$SEED/$t.csv")
  actual=$(psql "$DATABASE_URL" -At -c "SELECT count(*) FROM $t")
  flag=""; [ "$expected" = "$actual" ] || { flag="  <-- mismatch"; failed=$((failed + 1)); }
  printf "%-18s %8s %8s%s\n" "$t" "$expected" "$actual" "$flag"
done
[ "$failed" -eq 0 ] || { echo "$failed table(s) loaded a different row count than their seed CSV." >&2; exit 1; }

psql "$DATABASE_URL" -c "SELECT state, count(*) FROM run_progress GROUP BY 1 ORDER BY 1;"
echo "rebuilt."
