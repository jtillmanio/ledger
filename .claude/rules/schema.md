---
paths:
  - "src/db/**"
  - "etl/**"
  - "drizzle/**"
  - "seed/**"
---

# Schema and data-model rules

Loads automatically when you're touching the database layer, ETL, migrations,
or seed data — not on every session. See `CLAUDE.md` for what's true
everywhere else.

- **Derived data is never stored.** Readiness, completion percentages, track
  rollups, and capacity live in `etl/views.sql`. If you find yourself adding a
  `completed_count` column, stop — it belongs in a view.
- **A run's series text and years are derived, never stored.** `runs` has no
  `series_issues`, `start_year` or `end_year`. The `run_span` view builds the
  series text from the issue labels (grouped by series and volume, ranges
  collapsed) and the years from the earliest and latest `issues.cover_date`.
  Read them through `run_span`; never format them in the app and never add them
  back as columns. `dated_issues < issue_count` means the span is incomplete.
- **Issue metadata and whys come from sidecar files, not the workbook.** They sit
  beside `etl/data/volume_map.csv` and survive every re-extract:
  `cover_dates.csv` (label; `source` metron|hand), `issue_details.csv` (label;
  story title with `story_title_source`, cover URL), `issue_credits.csv` (label,
  creator, role; `source` metron|hand), `label_review.csv` (label → proposed
  label; `decision` accept|reject), `why_review.csv` (run id; `decision`
  accept|edit|keep), `creator_aliases.csv` (alias → creator name, hand-kept)
  and `creator_review.csv` (close creator names from `npm run sidecars`;
  `decision` accept|reject, an accepted row counts as an alias).
  `etl/enrich_comics.py` writes the first four and never
  overwrites a `hand` value; a `(label, role)` pair with any hand credit is left
  alone entirely.
- **A label changes only through an accepted label review.** Enrich proposes
  Metron's canonical label; extract applies a rename only when `decision` is
  `accept`, and enrich rekeys every sidecar to the new label on its next run.
  Nothing ever writes back to the workbook.
- **One issue row per comic.** `issues` is what exists — one row per label, id a
  slug of the label, never a run position. `run_issues(id, run_id, sequence,
  issue_id, type, notes)` is where it sits in a run; `type` and `notes` belong to
  the placement. The same issue in four runs is one `issues` row and four
  `run_issues` rows. Credits key on `issues.id`. Totals above a run count
  `DISTINCT issue_id`; never SUM run totals across runs.
- **Read state is per run.** `issue_progress` keys on the placement
  (`user_id, placement_id` → `run_issues.id`), never on the issue. Reading an
  issue in one run leaves it unread in every other run holding it. Nothing
  propagates a mark. "Read before, in which runs" is derived from the
  `issue_read_runs` view and shown as a hint on the row; it never checks a box.
  Block/track rollups count an issue read when any placement of it in that
  scope is read. ARCHITECTURE 2.14.
- **A run's writers and artists are derived, never stored.** `runs` has no
  `writer` or `artists`. Read them from `run_credit_line` (creators on ≥25% of
  the run's credited issues, max three), built from `issue_credits` via
  `run_creators`. There is no hand-typed fallback — to fix a credit line, fix
  the issue credits.
- **The comics Up next queue is an ordered list, not a plan** *(table arrives with task 1.10)*. `run_queue
  (user_id, run_id, ordinal)` has no years, quarters or capacity, and never
  gets them; that is `reading_plan`'s job for books. The order is authored and
  stored. What a queued run's state is (unstarted, in flight, done) is derived
  through `run_queue_state` and never written to the queue. Nothing removes a
  queue row except the user. ARCHITECTURE 2.16.
- **A why is authored, so it is stored.** `runs.why_source` is `hand` or
  `claude`. `hand` means Justin wrote or edited it and nothing automated may
  replace it. `claude` means a Claude draft accepted as-is; it may be
  re-proposed for review, never silently rewritten.
- **A plan entry's year is derived from its period, never stored beside it** *(from task 1.7; `reading_plan` still has `planned_year`/`planned_quarter`)*.
  `reading_plan.period` is one text column — `2027-Q1`, `2027-03`, `2027`, or
  `someday` — and the year is `left(period, 4)`. An entry with a bare year is
  legitimately unscheduled; the plan starts empty and is built in the app (D-13,
  extract skips the workbook's To-Read tabs unless `--with-plan`); an entry
  whose year and quarter could disagree is a bug the schema should not allow.
  Read year/quarter/month through the `plan_period` view, never by parsing in
  the app.
- **Blocks group runs inside a track; eras section issues inside a run.** Both
  are tables, both are optional, and both are ordered — `blocks(track_id,
  number, name?)` and `eras(run_id, ordinal, name)`. Era membership goes on the
  placement (`run_issues.era_id`), not the issue. A block is a position, so
  it is numbered and may be unnamed. An era is a story, so it is named. A run
  with no block renders a two-rail telescope; a run with no eras renders a flat
  spine. Neither is an error.
- **Catalog and progress are separate.** `issues` is what exists, `issue_progress`
  is what Justin read. Every progress table is keyed `(user_id, entity_id)`.
  Never add a per-user boolean to a catalog table.
- **`postgres.js` needs `prepare: false`** — Neon runs a transaction-mode pooler.
- Run IDs are hand-authored slugs (`hickman-ff`). Never regenerate them.
- Runs with `placeholder = true` are forward-declared prereq targets. Hide them
  from run lists; keep their edges.
- Soft delete only. `deleted_at IS NULL` on every read. A hard delete on `runs`
  cascades to issues and prereq edges. That includes `run_issues` (R3-06): a hard
  delete cascades to its `issue_progress` row and drops reading history.
- A date is stored with its precision (`exact` | `approximate` | `none`), and the
  date is NULL exactly when the precision is `none`. Never write `now()` for a
  read with no known date, and sort finish dates `NULLS LAST` (ARCHITECTURE 2.17).
- A book's finish year is derived from `book_status.finished_on` *(from task
  1.5, D-21; until then `finished_year` is the stored column)*. 1.5 drops
  `finished_year`; never add it back.
- One placement per (run, issue): `run_issues` is UNIQUE on `(run_id, issue_id)`
  and stays so through 0.8a (D-19). A planned reread is a note on the placement;
  a run's issue count is its distinct issues. Re-adding an issue whose placement
  was soft-deleted restores that row, never inserts beside it (0.4).
- Every table is in `GET /api/export`: a new table goes into
  `src/db/export-tables.ts` in the same PR (`test/export-tables.test.ts` fails
  otherwise). `users` stays out (D-17).
- Enrichment scripts never overwrite a hand-entered value.
- No page render calls an external API. The one live path is an **add flow**:
  TMDB, Metron and Open Library are searched when the user submits a search in
  Add, and results are cached. Hardcover is backfill-only. TMDB attribution
  belongs in the footer.
- **Every add flow offers search or freeform, and ends in a real row.** Match
  the user's own catalog first, then the API, or let them type it. Either path
  creates (or reuses) the `issues` / `books` / `titles` row, then writes the
  placement, shelf, status or plan row that points at it. Freeform issue labels
  go through the bulk-entry parser. ARCHITECTURE 2.15.
- Shelves hold books or titles, never runs, and never both at once —
  `shelves.kind` is `books` or `titles`, with `shelf_books` / `shelf_titles`
  each carrying a real non-null foreign key. Don't reintroduce a polymorphic
  `shelf_items` table: a nullable-FK row needs a `num_nonnulls` check to stay
  honest, and every read needs a CASE. Two narrow tables cost one join and
  nothing else.
- The watchlist tracks seasons, never episodes. Show state is derived from
  `season_status` via the `show_progress` view — never write a show-level status
  to `title_status`, with one exception: `dropped` (`kind = 'tv'`, `status =
  'dropped'`), which `show_progress` reads first. Films use `title_status`
  directly.
- Franchises are facts about the work (TMDB collections plus curation); shelves
  are the user's opinion. Different tables, don't merge them.
- IMPORTANT: AI-generated issue labels never reach the database without passing
  the bulk-entry parser, a Metron existence check, and an explicit user accept.
  Metron-proposed labels (`label_review.csv`) follow the same rule: explicit
  accept only.
- **Production is disposable until cutover; development always is.**
  `npm run rebuild` drops and reloads everything, and the loader's
  `TRUNCATE … CASCADE` also empties every table referencing a run, issue or book
  (queue, shelves, eras, inbox). `.env` is the development database; production
  is reached only through `-EnvFile .env.live` (`ENV_FILE=.env.live` for the
  bash twins), and only when the owner asks. `.env.live` `LEDGER_LIVE=true` (set
  at START-HERE Step 14, right after the final load and before the month of
  running both — D-18) makes load and rebuild refuse against production. Never
  suggest a rebuild or `load.ps1` of production once that is set.
- `etl/extract.py` is the migration from the workbooks. Changing its output
  format means re-running against both `.xlsx` files and diffing the CSVs.
