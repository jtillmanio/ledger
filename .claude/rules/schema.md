---
paths:
  - "src/db/**"
  - "etl/**"
  - "drizzle/**"
  - "seed/**"
---

# Schema and data-model rules

Loads automatically when you're touching the database layer, ETL, migrations,
or seed data — not on every session. This file is the only home of these
rules; `CLAUDE.md` holds what's true everywhere else (the databases, production,
Release, test isolation) and the Hard rules a reviewer checks.

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
  accept|edit|keep) and `creator_aliases.csv` (alias → the creator name credits
  use, hand-kept: `Walt Simonson,Walter Simonson`; extract resolves credits and
  the sheet-writer check through it, and `sidecars:fix` gives an aliased hand
  credit Metron's id and spelling). `npm run sidecars` also writes
  `creator_review.csv`: hand credits and sheet writers whose name is close to a
  Metron creator, `decision` accept|reject; an accepted row counts as an alias,
  and nothing is matched on similarity alone. `etl/enrich_comics.py` writes the
  first four and never overwrites a `hand` value; a `(label, role)` pair with
  any hand credit is left alone entirely.
- **A label changes only through an accepted label review.** Enrich proposes
  Metron's canonical label; extract applies a rename only when `decision` is
  `accept`, and enrich rekeys every sidecar to the new label on its next run.
  Nothing ever writes back to the workbook.
- **A book is its title and author; two merge only through a merge decision**
  (task 1.13, D-25a, D-68). Extract compares both after `clean()` and `key()`,
  so one title under two authors is two books. `etl/data/book_review.csv`
  (`kind` book|author|series, `a`, `b`, authors, tabs, `reason` same title|
  similar, `similarity`, `keep`, `decision` merge|separate) is written by
  `npm run extract`: it proposes pairs (≥ 0.4 trigram similarity, never names
  that differ only by a number), keeps every decision, and applies only `merge`,
  before the load, so the merged-away spelling never becomes a row. Books by
  two authors pair only on an identical title (`same title`), where `keep`
  names the surviving author. `keep` counts only with a `decision`: an
  undecided row is rebuilt each run, and a decided row whose names have left
  the workbook stays and is reported as `stale review`. A title seen with no
  author joins the one authored book with that title, stays a book of its own
  when there is none, and is reported in `unresolved.csv` when there are
  several. The workbook loads no
  read state (D-41): `seed/workbook_reads.csv` lists its reads for hand entry
  and is not loaded. A To-Read tab for 2028 or later is speculative and loads
  nothing (`SPECULATIVE_FROM`, owner 2026-10-19): no book, status or plan row;
  `seed/workbook_plans.csv` lists its titles and is not loaded.
- **One issue row per comic.** `issues` is what exists — one row per label, id a
  slug of the label, never a run position. `run_issues(id, run_id, sequence,
  issue_id, type, notes)` is where it sits in a run; `type` and `notes` belong to
  the placement. The same issue in four runs is one `issues` row and four
  `run_issues` rows. Credits key on `issues.id`. Totals above a run count
  `DISTINCT issue_id`; never SUM run totals across runs.
- **One placement per (run, issue).** `run_issues` is UNIQUE on `(run_id,
  issue_id)`; extract drops a repeated label in one run and reports it (`repeat
  placement dropped`). Rereads inside a run do not come back (D-19): a planned
  reread is a note on the placement, and a run's issue count is its distinct
  issues. 0.8a keeps the UNIQUE. Re-adding an issue whose placement was
  soft-deleted restores that row, never inserts beside it (0.4).
- **Read state is per run.** `issue_progress` keys on the placement
  (`user_id, placement_id` → `run_issues.id`), never on the issue. Reading an
  issue in one run leaves it unread in every other run holding it. Nothing
  propagates a mark. "Read before, in which runs" is derived from the
  `issue_read_runs` view and shown as a hint on the row; it never checks a box.
  Block/track rollups count an issue read when any placement of it in that
  scope is read. ARCHITECTURE 2.14.
- **Catalog and progress are separate.** `issues` is what exists, `issue_progress`
  is what Justin read. Every progress table is keyed `(user_id, entity_id)`.
  Never add a per-user boolean to a catalog table.
- **A run's writers and artists are derived, never stored.** `runs` has no
  `writer` or `artists`. Read them from `run_credit_line` (creators on ≥25% of
  the run's credited issues, max three), built from `issue_credits` via
  `run_creators`. There is no hand-typed fallback — to fix a credit line, fix
  the issue credits.
- **The comics Up next queue is an ordered list, not a plan** *(table arrives
  with task 1.10)*. `run_queue (user_id, run_id, ordinal)` has no years,
  quarters or capacity, and never gets them; that is `reading_plan`'s job for
  books. The order is authored and stored. What a queued run's state is
  (unstarted, in flight, done) is derived through `run_queue_state` and never
  written to the queue. Nothing removes a queue row except the user.
  ARCHITECTURE 2.16.
- **A why is authored, so it is stored.** `runs.why_source` is `hand` or
  `claude`. `hand` means Justin wrote or edited it and nothing automated may
  replace it. `claude` means a Claude draft accepted as-is; it may be
  re-proposed for review, never silently rewritten.
- **A plan entry's year is derived from its period, never stored beside it**
  (task 1.7). `reading_plan.period` is one text column — `2027-Q1`, `2027` or
  `on_deck`; there are no months (D-38) — and the year is `left(period, 4)`. An entry with
  a bare year is legitimately unscheduled; the plan starts empty and is built in
  the app (D-13: extract skips the workbook's To-Read tabs unless
  `--with-plan`); an entry whose year and quarter could disagree is a bug the
  schema should not allow. Read year/quarter/level through the `plan_period`
  view, never by parsing in the app.
- **A to-read book sits at one of four levels** (D-37, task 1.7): a quarter
  (ordered), a bare year (unordered, counts against that year), On deck
  (`on_deck`: no year, unordered) or Someday, which is every `to_read` book with
  no plan row — derived, never stored. Read a book's level through
  `to_read_level`. Only quarters are ordered: `reading_plan.ordinal` is
  contiguous from 1 within a quarter and NULL everywhere else, authored and
  stored like the queue's. A book joins the end of the quarter it is placed in;
  write periods and ordinals only through the plan helpers in `src/db/writes.ts`
  (`placeInPlan`, `movePlan`, `takeOutOfPlan`, `reorderQuarter`, `moveToTop`,
  `moveToSomeday`).
- **Blocks group runs inside a track; eras section issues inside a run.** Both
  are tables, both are optional, and both are ordered — `blocks(track_id,
  number, name?)` and `eras(run_id, ordinal, name)`. Era membership goes on the
  placement (`run_issues.era_id`), not the issue. A block is a position, so
  it is numbered and may be unnamed. An era is a story, so it is named. A run
  with no block renders a two-rail telescope; a run with no eras renders a flat
  spine. Neither is an error.
- **A date is stored with its precision, and the two cannot disagree.**
  `issue_progress.completed_at`, `book_status.finished_on` and (from 1.5)
  `read_events.finished_on` are each paired with a `*_precision` of `exact`,
  `approximate` or `none`, and the date is NULL exactly when the precision is
  `none`. A read with no known date is `none`, never `now()`. A year-only finish
  is `approximate` (its July 1st), never `exact`. Anything computing pace ignores
  `none`, and anything sorting by a finish date puts NULLs last. A calendar day
  in `completed_at` is stored as its `America/New_York` midnight, *today* is the
  Eastern day, and every date is shown in Eastern (1.16, D-67). ARCHITECTURE 2.17.
- **A book's finish year is derived from `finished_on`** (task 1.5, D-21). 1.5
  dropped `finished_year`, and it never comes back; every reader takes
  `extract(year FROM finished_on)`, and a `read` book with precision `none` is
  the *No year* group. **Years count reads, not books** (D-65): read the year
  through the `book_reads` view (every `read_events` row, plus a `read` status
  with no log row), so a reread counts in its own year and the first keeps its.
- **Reads are a log** (task 1.5, FEATURES #22). `read_events` holds one row per
  finished read, a book (`book_id`) or a placement (`placement_id`, never the
  issue), exactly one (`num_nonnulls` CHECK); `reread_of` is the same item's
  previous read. `book_status` is the current-status projection over it, written
  only through `saveBookStatus`: entering `read` appends a read, `read` on a book
  already read re-dates its latest one, and leaving `read` keeps the finish date.
  Comic reads don't write `read_events` yet; `issue_progress` is their record.
- **Every table is in the export.** `GET /api/export` reads its tables from
  `src/db/export-tables.ts`. A task that creates a table adds it there in the
  same PR (`USER_TABLES` if it has a `user_id`; `users` stays out, D-17);
  `test/export-tables.test.ts` fails on any table left out.
- **Soft delete only.** `deleted_at IS NULL` on every read. A hard delete on
  `runs` cascades to issues and prereq edges. That includes `run_issues`
  (R3-06): removing an issue from a run soft-deletes the placement, because a
  hard delete cascades to its `issue_progress` row and drops reading history.
- **`postgres.js` needs `prepare: false`** — Neon runs a transaction-mode pooler.
- Raw SQL in `src/db/queries.ts` for anything joining views; Drizzle builder for
  writes, except a write that must be one round trip and all-or-nothing (the
  range mark), which may be one raw SQL statement in `src/db/writes.ts` (D-57).
- Run IDs are hand-authored slugs (`hickman-ff`). Never regenerate them.
- Runs with `placeholder = true` are forward-declared prereq targets. Hide them
  from run lists; keep their edges.
- Enrichment scripts never overwrite a hand-entered value.
- **Every add flow offers search or freeform, and ends in a real row.** Match
  the user's own catalog first, then the API, or let them type it. Either path
  creates (or reuses) the `issues` / `books` / `titles` row, then writes the
  placement, shelf, status or plan row that points at it. Freeform issue labels
  go through the bulk-entry parser. ARCHITECTURE 2.15. Watch is the exception:
  TMDB search only, and when TMDB fails or finds nothing the screen offers
  **Save to inbox** (a Watch capture note) instead of a freeform path (D-28).
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
- `etl/extract.py` is the migration from the workbooks. Changing its output
  format means re-running against both `.xlsx` files and diffing the CSVs.
- **Migrations that drop or retype a column ship a down file.** `drizzle-kit`
  writes forward-only SQL. A migration that drops, retypes or merges columns also
  adds `drizzle/down/<tag>.sql` by hand, and its task test runs up → down → up
  asserting row values, not just that it ran — including that a precision-`none`
  row is still `none` with a NULL date afterwards. `drizzle/down/0004_date_precision.sql`
  shows the file shape but is **not** the standard: it is lossy by design (undated
  reads come back as `exact` `now()`), which was acceptable only because the
  database was disposable. Do not copy that part.
  Hand-edit the generated file when a retype needs `USING`. Verify with
  `npm run test:db:reset`, which runs `drizzle-kit migrate`, not `db:push`.
