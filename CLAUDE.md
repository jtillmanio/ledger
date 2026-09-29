# Ledger

Personal media ledger replacing two Google Sheets. About 10,138 distinct comic
issues in 10,761 run placements across 258 runs with a prerequisite graph, plus
1,478 books (extract of 2026-09-23; the workbook is still being edited, so
re-count from a fresh extract rather than trusting these). Single user,
multi-user schema.

`docs/STATUS.md` is where we are right now — current task, what's next, what's
built. `docs/HANDOFF.md` has full project context. `docs/TASKS.md` is the
backlog, `docs/FEATURES.md` is scope, `docs/ARCHITECTURE.md` is why the schema
looks like this, `docs/DIAGRAMS.md` is visual. `docs/START-HERE.md` is the
human's runbook — don't run its commands unless asked.

## Which document wins (D-1)

When two documents disagree, believe them in this order:

1. `src/db/schema.ts` and `etl/views.sql` — the code is what actually runs.
2. `docs/TASKS.md` — the acceptance check is the contract for the work.
3. `docs/ARCHITECTURE.md` — why the schema looks the way it does.
4. `docs/FEATURES.md`, `docs/DIAGRAMS.md`, `docs/HANDOFF.md` — scope and
   narrative, drafted earliest and the most likely to have drifted.

Two riders. A document describing something not yet built says so inline —
"(task 2.5)", "(from task 0.3)" — and where it does, the current code wins and
the note tells you when that changes. And every canonical row count comes from
a fresh `etl/extract.py` run; prose that repeats a number is a copy, so correct
the prose, never the extract.

`design/mockups.html` is outside this list: it is authoritative for layout and
copy, and it beats a task description where the two disagree.

`docs/CLAUDE-CODE-PROMPTS.md`, `docs/START-HERE.md`, `docs/OWNER-CHECKLIST.md`
and `docs/STATUS.md` rank **below** `docs/TASKS.md`. They are how the work is
driven, not what it must do: where a pasted prompt or a runbook step disagrees
with the task, the task wins, and the disagreement is a bug to report.

Development happens on Windows in PowerShell. Prefer `py` over `python`, and
`.\etl\load.ps1` over `etl/load.sh`. psql `\copy` paths need forward slashes
even on Windows.

## Commands

```powershell
npm run dev                 # local, needs .env
npm test                    # vitest; needs TEST_DATABASE_URL (never DATABASE_URL), refuses without it
npm run test:all            # test:tokens + check:migrations + test:db:reset + vitest + test:views + test:etl, what CI runs
npm run test:db:reset       # rebuild the TEST database: drizzle-kit migrate, then etl/views.sql
npm run lint                # eslint, zero warnings
npx tsc --noEmit            # typecheck
npm run db:generate         # after editing src/db/schema.ts
npm run db:push             # apply schema.ts to DATABASE_URL with no migration — pre-cutover only, by hand
npm run db:views            # re-apply etl/views.sql to DATABASE_URL (node, not psql); rebuild and Release do it for you
npm run extract             # etl/extract.py with every sidecar CSV (see below); clears seed/ first;
                            # add --with-plan to also load the workbook's To-Read tabs (off by default)
py etl/enrich_comics.py     # Metron: dates, cover URLs, label proposals (--dry-run first)
py etl/enrich_comics.py --details  # Metron: story titles + credits, ~8,100 requests (--dry-run first)
npm run enrich:refresh      # --details --refresh: re-ask Metron about issues it credited nobody on (cache never expires)
npm run sidecars            # etl/check_sidecars.py: validate the issue sidecars, write etl/data/metadata_todo.md
                            # and etl/data/creator_review.csv (close creator names to accept or reject);
                            # an issue fandom_skipped.csv says has a blank Fandom title isn't listed as
                            # missing one (--keep-fandom-untitled lists them)
npm run sidecars:fix        # same, and apply the safe fixes (shifted columns, role spellings, label keys, creator ids)
npm run sidecars:prune-orphans  # same, plus archive-then-remove sidecar rows for labels gone from the workbook
npm run check:role-outliers # etl/check_role_outliers.py: flag Metron credits whose role looks mistagged (report only)
npm run titles:fandom       # etl/fandom_titles.py: fill missing story titles from Marvel Fandom as `hand` (--dry-run first);
                            # writes fandom_skipped.csv (what it couldn't, and why); reads hand-kept
                            # fandom_pages.csv (series -> `Name Vol N`, label -> `Name Vol N issue`)
.\etl\load.ps1              # PowerShell loader; etl/load.sh is the WSL/Git Bash twin
npm run rebuild             # drop, migrate from zero, extract, load, test_views, row counts
                            # etl/rebuild.ps1; refuses when LEDGER_LIVE=true; twin etl/rebuild.sh
npm run test:views          # etl/test_views.sql against TEST_DATABASE_URL; rolls back
npm run test:etl            # py -m unittest over etl/test_*.py, no network
npm run test:tokens         # colour tokens: mockups = globals.css, hue distance, on-fill contrast; no DB
npm run check:migrations    # journal = files, drop/retype has a drizzle/down file, schema.ts fully generated,
                            # no migration already on main edited (standing rule 3); no DB
```

## Non-obvious rules

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
  and nothing is matched on similarity alone. `etl/enrich_comics.py` writes the first four and never
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
- **Read state is per run** *(target state: `schema.ts` is still keyed on the issue until task 0.8 lands)*. `issue_progress` keys on the placement
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
  legitimately unscheduled; the plan starts empty and is built in the app (extract
  skips the workbook's To-Read tabs unless `--with-plan`); an entry
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
- **A date is stored with its precision, and the two cannot disagree.**
  `issue_progress.completed_at`, `book_status.finished_on` and (from 1.5)
  `read_events.finished_on` are each paired with a `*_precision` of `exact`,
  `approximate` or `none`, and the date is NULL exactly when the precision is
  `none`. A read with no known date is `none`, never `now()`. A year-only finish
  is `approximate` (its July 1st), never `exact`. Anything computing pace ignores
  `none`, and anything sorting by a finish date puts NULLs last. ARCHITECTURE 2.17.
- **A book's finish year is derived from `finished_on`** *(from task 1.5, D-21;
  until then `book_status.finished_year` is still the stored column)*. 1.5 drops
  `finished_year`; every reader takes `extract(year FROM finished_on)`, and a
  `read` book with precision `none` is the *No year* group.
- **One placement per (run, issue).** `run_issues` is UNIQUE on `(run_id,
  issue_id)`; extract drops a repeated label in one run and reports it (`repeat
  placement dropped`). Rereads inside a run do not come back (D-19): a planned
  reread is a note on the placement, and a run's issue count is its distinct
  issues. 0.8a keeps the UNIQUE.
- **Every table is in the export.** `GET /api/export` reads its tables from
  `src/db/export-tables.ts`. A task that creates a table adds it there in the
  same PR (`USER_TABLES` if it has a `user_id`; `users` stays out, D-17);
  `test/export-tables.test.ts` fails on any table left out.
- **Catalog and progress are separate.** `issues` is what exists, `issue_progress`
  is what Justin read. Every progress table is keyed `(user_id, entity_id)`.
  Never add a per-user boolean to a catalog table.
- **`postgres.js` needs `prepare: false`** — Neon runs a transaction-mode pooler.
- Run IDs are hand-authored slugs (`hickman-ff`). Never regenerate them.
- Runs with `placeholder = true` are forward-declared prereq targets. Hide them
  from run lists; keep their edges.
- Soft delete only *(from task 0.3; `deleted_at` does not exist yet, so earlier queries cannot filter on it)*. `deleted_at IS NULL` on every read. A hard delete on `runs`
  cascades to issues and prereq edges. That includes `run_issues` (R3-06): removing an
  issue from a run soft-deletes the placement, because a hard delete cascades to its
  `issue_progress` row and drops reading history.
- Enrichment scripts never overwrite a hand-entered value.
- No page render calls an external API. The one live path is an **add flow**:
  TMDB, Metron and Open Library are searched when the user submits a search in
  Add, and results are cached. Hardcover is backfill-only. TMDB attribution
  belongs in the footer.
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
- Detail views are intercepted routes, not modal components: a sheet from a
  list, a full page on direct load. The back button must dismiss.
- IMPORTANT: AI-generated issue labels never reach the database without passing
  the bulk-entry parser, a Metron existence check, and an explicit user accept.
  Metron-proposed labels (`label_review.csv`) follow the same rule: explicit
  accept only.
- **The database is disposable until cutover.** `npm run rebuild` drops and
  reloads everything, and `load.ps1` / `load.sh` truncate every progress table
  **and, through `CASCADE`, every table that references a run, issue or book**
  (queue, shelves, eras, inbox, sessions). `.env` `LEDGER_LIVE=true` (set at
  START-HERE Step 14, right after the final load and *before* the month of
  running both — D-18) makes all four refuse. Never suggest a rebuild or a load
  once that is set.
- **A merge is not a deploy; Release is** (START-HERE Step 13). Vercel stages
  every build of `main`, and `.github/workflows/release.yml`, run by hand after
  the merge, checks CI on that commit, snapshots Neon, migrates, re-applies
  views and promotes, in that order. It is the only path a migration takes to
  the live database: never tell anyone to run `db:migrate`, `db:push` or
  `db:views` against `DATABASE_URL` once the repo variable `LEDGER_LIVE` is
  `true`. Before that, a schema change goes through `npm run rebuild`.
- **Tests touch `TEST_DATABASE_URL` and nothing else.** `DATABASE_URL` is the live
  Neon ledger. `scripts/lib/testdb.mjs` refuses when the test URL is unset or
  names the same host and database, and `npm test` fails at once. Never point a
  test, a fixture or a script that truncates at `DATABASE_URL`, and never add a
  fallback to it.
- `etl/extract.py` is the migration from the workbooks. Changing its output
  format means re-running against both `.xlsx` files and diffing the CSVs.

## Design

`design/mockups.html` (v4) is the reviewed layout and copy for every screen.
Match it. It is annotated with the reasoning behind each decision; read the
notes column before changing a layout. Where a task description and the mockup
disagree, the mockup wins.

Phone at 360–412px is the primary device and every screen is designed there
first. A desktop layout that a phone layout degrades into is the wrong answer.

- **One dashboard per medium**, not one dashboard for everything. `/comics`,
  `/books`, `/watch`. `/` redirects to whichever you touched last. List screens
  sit one level down (`/comics/runs`, `/books/list`).
- **Every medium has a status screen with the same three tabs**:
  `/comics/status`, `/books/status` and `/watch/status`, with *In flight · Up
  next · Done*, in that order and under those names. Each tab reads from
  existing views; nothing about them is stored.
- **Every add surface opens on a segmented control with Search selected** and
  the freeform path beside it — *Type it* for issues, *Paste a list · By hand*
  for books. The user's own catalog is matched first, and an existing
  row shows as theirs ("in 3 runs") rather than as a second copy. Watch opens
  on Search alone; its fallback is *Save to inbox* (D-28).
- **A read-elsewhere hint is grey, never green.** Green means read *here*. The
  `read in Hickman — FF` note on a spine row must not look like a checkmark.
- **Every dashboard has the same five slots in the same order**: now → next,
  with a control on it → position → situation → a compact rollup → the thumb
  bar. What differs between media is what fills a slot, not the order.
- **The thumb bar is fixed at the bottom of every dashboard and the run
  detail**, same position, same primary verb slot. Marking what you just read
  is one tap and reachable with a thumb. Nothing displaces it. On desktop
  (900px+) the three dashboards carry the same verbs in the page header,
  primary last; the run detail keeps the bottom bar at every width (D-25). The
  mark verb names the issue by its label, never by its reading-order position
  (`Mark X-Men (2019) #8 read`; `#141` alone only on a single-series run).
- **Position is drawn, not counted.** Three nested positions (issue in run, run
  in block, block in track) render as the telescope, not as three percentages.
  Books get the same instinct applied to time: the plan rail.
- **Five readiness states, one badge partial.** `blocked` is the only amber
  readiness badge (`⊘ N runs first`); `ready_hard` is outlined green (`○ ready ·
  N soft unread`), `ready_all` `● ready`, `reading` `◐ n / N` with no
  prerequisite badge beside it, `read` `✓`. Glyph plus text, never colour alone.
  ARCHITECTURE §4.
- **Telescope cells have a floor** — 14px phone, 16px desktop, overflow folded
  into `+N runs` stubs — and read state is drawn as segments, not one fill. The
  geometry will be `src/components/telescope/layout.ts` (task 2.5), not a hand-drawn SVG.
- **Contrast and targets are tokens, not taste.** `--faint` is text-safe
  (4.5:1 or more on every surface, `#606979`); `--faint-deco` is for rules; thumb bar and icon buttons are 44px,
  nothing interactive under 24px; every control is a real button or link with a
  name. `.bar` is the app header only; era and block meters are `.emeter`.
- **Hue identifies data, never navigation.** Sidebar icons are neutral; one
  franchise keeps one hue on every screen; watch genre chips are grey with text.
  DNF and *Skip* are grey — only *Remove* and *Drop* may be red.
- **Every screen has its states drawn**: empty (one primary action), loading
  (skeletons at the loaded size), offline (sync pill), rate-limited, error,
  metadata pending. See docs/TASKS.md's *UX floor*.
- **Never draw progress against the catalog.** 76 of ~10,100 as a bar is a lie
  told with a rectangle. Comics measure against the run and the block; the
  catalog total appears once, small, as provenance. A track is drawn as a row
  of its blocks, each filled by its own share read, with `read / total` as
  text — never one bar against the whole track (D-29).

## Style

- Plain CSS with the custom properties in `src/app/globals.css`. No Tailwind, no
  CSS-in-JS. The token set there is the same one as `design/mockups.html`.
- **Colour is functional, and there are exactly four meanings.** `--ready`
  green is read/done. `--brand` blue is where you are, and the primary action.
  `--blocked` amber is *held* — either a hard prerequisite is unread or a
  decision has not been made (over capacity, no quarter chosen). `--danger` red
  is destructive actions and validation failures only. **Nothing on a dashboard
  is ever red.** `--t1`–`--t8` carry track and genre identity and nothing else,
  and never sit within ΔE2000 15 of `--ready`, `--blocked` or `--danger` (D-24,
  `npm run test:tokens`). Every progress meter fills with `--ready` (D-26). Text
  on a filled control uses `--on-*`, never a literal `#fff`.
  Anything without a meaning stays grey.
- **Amber clears when the user decides, including when they decide to keep the
  overage.** Accepting an over-committed year is a first-class outcome that
  persists. An indicator you cannot dismiss by choosing is one people stop
  reading.
- `--mark` and `--held` survive as aliases for `--ready` and `--blocked` so the
  first three routes keep rendering. New code uses the real names.
- Server components by default. Client components only where there is state.
- Raw SQL in `src/db/queries.ts` for anything joining views; Drizzle builder for
  writes.

## Workflow

- IMPORTANT: never commit to `main`. Branch `task/<id>-<slug>` (or `fix/`,
  `docs/`, `chore/` outside a task), one PR per task in `docs/TASKS.md`, squash
  merge by the owner. Branching, staging, commit messages and PR bodies are in
  `.claude/rules/git.md`.
- IMPORTANT: a PR is ready only when everything that can test it has passed
  **on the branch**: `/verify` (the full CI suite) locally, CI green, the
  Vercel preview for UI, and any changed workflow run with `--ref <branch>`.
  Never find out on `main`. Details in `.claude/rules/git.md`.
- IMPORTANT: no task merges without a test that would have failed before it.
- Tick the task's checkbox in `docs/TASKS.md` in the same PR.
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
- **Stop and ask before** adding or changing a schema column; changing how any
  stored date is written or interpreted; creating a git repo or remote, or
  changing its visibility; touching any database that is not `TEST_DATABASE_URL`;
  deleting or rewriting rows in `issue_progress`, `book_status` or `reading_plan`.
  An ambiguity in a task is a question, not a guess: write it down and stop.
