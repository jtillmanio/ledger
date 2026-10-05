# Tasks

One task per Claude Code session. Each is scoped to fit in a single context
window and ends with a check that returns pass or fail — without that, "looks
done" is the only signal available and you become the verification loop.

Convention: branch `task/<id>-<slug>`, one PR per task, squash merge.

**Legend** — ☐ todo · ☑ done · size: S = under an hour, M = a sitting, L = a weekend

---

**Design reference:** `design/mockups.html` (v4) is the agreed layout and wording
for every screen. Open it before building a UI task. Where the mockup and a task
description disagree, the mockup wins — it's the thing that was reviewed.

**Styling blueprint** (D-31): `docs/DESIGN.md` indexes the Step 3 design files —
`design/STYLE_GUIDE.md`, `design/tokens.css` and the `design/*.dc.html` spec
pages. They win on tokens, type, elevation, motion, telescope and plan-rail
geometry, and component states; the mockup still wins on layout and copy. Where
they disagree with the mockup on their own ground (the mockup draws a vertical
telescope; SG-D1 makes it horizontal), the task that builds the component
redraws the mockup to match in the same PR (standing rule 6). Tailwind names in
those files and in `NEW_UI_AUDIT_REPORT.md` are vocabulary, never classes to
ship.

**Four colour meanings, and only four.** `--ready` green is read. `--brand` blue
is where you are, and the primary action. `--blocked` amber is *held* — a hard
prerequisite unread, or a decision not yet made. `--danger` red is destructive
actions and validation failures only. Nothing on a dashboard is red. Track and
genre hues (`--t1`–`--t8`) carry identity and nothing else.

**The UX floor, for every UI task** (from the Sept 2026 audit,
`UI_AUDIT_REPORT.md`; ARCHITECTURE §4 design notes). A screen is not done until:
it has its empty, loading and error states drawn (FEATURES Part 2c → Everywhere);
text is at least 4.5:1 and control outlines 3:1 in both themes; thumb-bar and
icon buttons are 44px and nothing interactive is under 24px; every control is a
real `<button>` or `<a href>` with an accessible name; every readiness badge
carries a glyph and text; the phone bar is the one `Comics · Books · Watch`
partial. Where a task says "screenshot", that means 360px, 834px (a tablet,
D-33) and 1280px, light and dark. Hover reveals, hover popovers, drag and
shift-click sit behind `(hover:hover) and (pointer:fine)`; every one of them has
a tap, long-press or sheet route for touch, which is what a tablet gets.

The states look the same everywhere (STYLE_GUIDE §9): an empty slate is a
`--raise` panel with one primary action; a skeleton is the loaded geometry in
`--sunk`, shimmer off under reduced motion; *rate-limited* is amber (held) with a
mono countdown and a freeform escape (*Type it instead*); an API error is a
neutral line with a grey `×`, never red, because nothing destructive happened;
*metadata pending* is a dashed `--muted` cover outline and an italic line. An
unavailable action is `aria-disabled="true"` with a visible reason under it
(*Resolve 2 lines to add*), never a bare `disabled` that hides why (UX-N18).
Motion confirms, never celebrates: durations come from `--dur-1`…`--dur-4`,
and `prefers-reduced-motion` makes every one of them 0.

**Focus returns where it came from** (R1-11). A sheet or dialog returns focus to
the control that opened it when it closes, by any route — confirm, Cancel, Esc
or the back button. An intercepted route returns focus to the row link that led
to it. This is one behaviour in the shared sheet component, not eight
per-screen fixes: 1.1, 1.3c, 1.3b, 1.4c, 1.8b, 2.1b, 2.3, 2.6 and 2.7 all open
one. A sheet also traps Tab while open and is labelled by its own heading.
Opening one puts focus on that heading (`tabindex="-1"`) and marks the page
behind it `inert`; Esc and Back both dismiss (UX-N11). Sheets are solid
`--overlay` over `--scrim`, never glass (SG §8).

**Figures in the mockups are sample data** (D-7). `design/mockups.html` wins on
layout, wording and behaviour — never on a number. Every count, cost, capacity
and percentage in it is illustrative; the app computes them, and no acceptance
check asserts a figure copied out of a mockup or out of prose. Where a check
needs to be exact, it asserts a relationship ("the switch hides exactly the rows
whose `run_state = 'blocked'`") or builds its own fixture.

## Phase 0 — Foundation (prerequisites for everything else)

### ☑ 0.1 Test harness · S
Landed. Vitest plus a Postgres **test database**, and nothing else: a suite that
can `TRUNCATE` never guesses which database it is holding (R3-02, D-R3-2).

- **Which database.** `TEST_DATABASE_URL` only — a Neon branch of the ledger or a
  local Postgres database named `*_test` (START-HERE, *Test database*).
  `scripts/lib/testdb.mjs` refuses when it is unset or points at the same
  host and database as `DATABASE_URL`, and `test/global-setup.ts` runs that
  check before any test file loads. There is no fallback to `DATABASE_URL`, and
  the guard has its own test (`test/testdb-guard.test.ts`).
- **Schema comes from the migrations,** not `db:push`: `npm run test:db:reset`
  drops everything, runs `drizzle-kit migrate` (the path a rebuild takes, so a
  broken migration cannot ship green), then applies `etl/views.sql`.
- **What runs.** `npm test` = `vitest run`. `npm run test:all` = `test:tokens`
  (colour tokens, D-24), `check:migrations` (journal, down files, ungenerated
  schema changes, edits to applied migrations), `test:db:reset`, `npm test`,
  `npm run test:views` (`etl/test_views.sql`, against the test database) and
  `npm run test:etl` (Python). CI runs the same set (0.2). Isolation
  is `TRUNCATE` in `beforeEach`; files run one at a time.
- **Ported ETL tests are not part of this task** (0.6's "port both into vitest"
  is dropped): the Python suite and `test_views.sql` stay where they are and run
  under `test:all`, so nothing is re-written to be run twice.
- First test: `test/run-readiness.test.ts` — three runs, two issues each, one hard
  edge; `blocked` until the prerequisite is read, then `ready_all`. It also pins
  `run_ancestors` on a branching graph with a back edge and the date-precision
  CHECK.

**Check:** with `TEST_DATABASE_URL` set, `npm run test:all` passes; with it unset,
`npm test` fails immediately naming the variable. **This task blocks every other
task.** The owner sets `TEST_DATABASE_URL` once (START-HERE).

### ☑ 0.2 CI · S
`.github/workflows/ci.yml` (exists; one job, not four): `tsc --noEmit`, `npm run
lint` (`eslint.config.mjs` landed, R0-05), `npm run test:db:reset`, `npm test`,
`npm run test:views`, the Python tests and `next build`, against a Postgres
service container. There is no `DATABASE_URL` in the job; only `TEST_DATABASE_URL`.
Runs on PR. **Needs the repository to exist first (R3-01).** The owner creates
the private repo and confirms `.gitignore` covers `.env`, `seed/` and
`etl/data/*.csv` sidecars that must not be public, before this task runs.

**Check:** open a throwaway PR, confirm the `check` job goes green and that
breaking a view definition turns it red.

**Done 2026-09-30.** Green on #26 and #27. Red on the throwaway #28, which
made `run_progress.read_issues` count every placement: `test:views` failed with
*shared issue not read in both runs: a 2/2, b 2/2* ([run 36777783528](https://github.com/jtillmanio/ledger/actions/runs/36777783528)),
and #28 was closed unmerged.

### ☑ 0.3 Schema additions · M
Apply what is still outstanding in FEATURES.md Part 5 as one Drizzle migration:
`reading_settings`, `eras` (+ `run_issues.era_id`, ARCHITECTURE 2.10), `volume_rules`,
`shelves(kind CHECK IN ('books','titles'))` with **`shelf_books` only**
(`shelf_titles` lands with `titles` in 8.1/8.6, because a foreign key needs its
target — R3-04; FEATURES' `shelf_items` block is void, ARCHITECTURE 2.5e),
`word_count_source`, `page_count`, `books.cover_url`, `books.open_library_id`,
`books.hardcover_id`, `book_status.notes`, and `deleted_at` on `runs` / `issues` /
`books` **and `run_issues`** (R3-06). `open_library_id` and `hardcover_id` were
added here because 1.4c's check writes the first and no task added either
(owner, 2026-09-30).

**Done 2026-10-01, migration `0005_schema_additions`.** Shapes the owner settled
before it was written:

- `books.word_count_source` is `stated | estimated` and **NULL exactly when
  `word_count` is** — the same pairing CHECK as `issues.cover_date_source`, no
  default. The migration backfills `stated` for every book that has a count;
  extract writes it.
- `eras` is UNIQUE on `(run_id, ordinal)`, like `blocks`. `run_issues.era_id`
  is a composite foreign key `(era_id, run_id) → eras(id, run_id)`, so a
  placement cannot sit in another run's era, with `ON DELETE SET NULL
  ("era_id")`: deleting an era clears the placement's era and nothing else. The
  column list is hand-written into the migration; drizzle-kit cannot express it.
- `shelves.user_id` and `shelf_books.ordinal` are NOT NULL.
- `reading_settings` checks `plan_granularity IN ('quarter','month')` and
  `theme IN ('system','light','dark')`, and goes with its user (`ON DELETE
  CASCADE`), like every other per-user table.

**Three value CHECKs** (R2 L-3/L-4, owner-approved, D-27), so a typo can never
be stored — it matters once 3.3 lets the app write prerequisite edges, where a
stray `Hard` would silently read as soft:

- `prereqs.type IN ('hard', 'soft')`
- `runs.tier IS NULL OR runs.tier BETWEEN 1 AND 5`
- `events.verdict IS NULL OR events.verdict IN ('read-it', 'tie-ins-only',
  'summary-is-fine')` — the values the sheet actually uses (`schema.ts`'s old
  comment said `read-it | skip | optional`, which no row holds).

The 2026-09-24 extract satisfies all three (220 hard + 218 soft; tiers 1–4 and
9 blank; 18 / 8 / 3 verdicts).

**`run_issues.deleted_at` is not optional.** After 0.8, `issue_progress` points at
`run_issues.id ON DELETE CASCADE`; without it, removing a misplaced issue from a
641-issue run cascade-deletes that placement's reading history, and the only undo
is an 8-second in-memory toast. Removing a placement from a run soft-deletes it.

`book_status.finished_on` is **not** in this migration: it already exists and was
retyped `text → date` with `finished_on_precision` in migration `0004` (R3-05,
D-R3-1). Nothing here touches it.

`reading_plan` is **not** in this migration. Its period columns collapse to
one in task 1.7; doing it here would mean writing `planned_month` and then
dropping it.

`blocks` **landed early**, before the first data load, because it changes the
shape of `runs` and the ETL — doing it after the load would have meant a data
migration instead of one more CSV. `cover_url` and `metron_id` are already on `issues`
(`schema.ts`); the rest remain here.

`issues.metron_id` and `issues.cover_date` (with `cover_date_source`) **also
landed early**, in migration `0002` with task 0.6 — run years are derived from
cover dates, so they had to exist before the load. `cover_url`, `story_title`,
`run_issues`, `creators` and `issue_credits` landed in migration `0003` with
task 0.7. `metron_id` is still not unique: until a label review merges them, two
spellings of one comic can both match it.

**Check:** `drizzle-kit generate` produces one migration. On a **fresh** test
database, `npm run test:db:reset` (which runs `drizzle-kit migrate`) applies
clean, and `drizzle-kit push` then reports no diff — `push` alone never runs the
generated file, so a bad `ALTER` would pass it and fail the next rebuild (R3-11).
*(As run on 2026-10-01, push never reports no diff in this repo, on `main` either:
it offers to drop every view and index `etl/views.sql` creates, and it reads
composite primary keys and unique constraints back from
`information_schema.constraint_column_usage` without an order, so it re-creates
whichever ones come back shuffled — `blocks` and `run_issues` constraints this
task never touched included. What the check is for is met by `test:db:reset`
running the migration itself and the vitest test reading the catalog.)*
A vitest test reads `information_schema.columns` and asserts each new column and
type (`psql` is not needed and not assumed), and that inserting a prereq of type
`Hard`, a run of tier 7 and an event verdict of `skip` each violate their CHECK.
Existing tests pass, and `npm run rebuild` still loads every row.

### ☑ 0.4 Soft-delete everywhere · S
Every read query filters `deleted_at IS NULL`. Add a partial index.

Placements too (R3-06): a soft-deleted `run_issues` row is filtered from the
spine, counts and views, and **keeps its `issue_progress` row** — that is the
point of soft-deleting it.

**Re-adding a removed issue restores its row** (S-07). A soft-deleted placement
still holds its `(run_id, issue_id)` and `(run_id, sequence)` slots, and
Postgres cannot make a `DEFERRABLE` unique partial on `deleted_at IS NULL`. So
the constraints stay full-table, and adding an issue whose placement in this run
is soft-deleted **clears `deleted_at` on that row** (and moves it to the
requested sequence) instead of inserting a new one. Never hard-delete the old
row to make room: that is the cascade this task exists to prevent. Renumbering a
run shifts every placement in it, deleted or not.

**Check:** a test that soft-deletes a run and asserts it disappears from
`listRuns` but its issues and prereq edges still exist. A second test soft-deletes
a placement that has a progress row and asserts the row survives, and that
restoring the placement brings the read mark back. A third soft-deletes a
placement, re-adds the same issue to the run, and asserts one `run_issues` row
(the original id, `deleted_at` NULL) and the progress row intact.

### ☑ 0.5 Volume-year normalization · S
`volume_map.csv` carries 66 approved rules across 60 series, and
`etl/extract.py` applies them plus the trailing-year label reordering.

The two items an earlier review flagged as remaining work — the `Amazing
Spider-Man`/`The Amazing Spider-Man` leading-article split (137 vs 100 bare
labels), and the three `X-Men (vol. 2) #177-179` labels missing a year — turned
out to already be resolved in the workbook itself. A fresh 2026-10-02 extract
found no bare or split spelling for either case: every Amazing Spider-Man
label reads `The Amazing Spider-Man`, and the three X-Men labels are already
`X-Men (2004) #177-179`, Metron-matched. The two `volume_map.csv` rows
describing them were stale (left over from an earlier `etl/volumes.py` pass,
predating whatever later fixed the workbook) and have been removed. See
HANDOFF.md section 5.6.

**Check:** re-ran `etl/extract.py --volume-map`, diffed `issues.csv` against
the previous extract — zero labels changed, row count held at 10,131. Only
`volume_map.csv` itself changed (two stale rows removed; 67→66 rules, 61→60
series).

### ☑ 0.6 Derived run span, cover dates, reviewed whys · M
Landed before the first load. `runs.series_issues`, `start_year` and `end_year`
are gone (212 of 259 disagreed with their own issues); the `run_span` view
derives them. `issues.cover_date` + `cover_date_source` feed the years, filled by
`etl/enrich_comics.py` from Metron plus hand entry in `cover_dates.csv`.
`runs.why_source` records whether a why is `hand` or an accepted `claude` draft;
all 259 whys were redrafted into `why_review.csv` for review. Migration `0002`
also carries the pending `blocks` change.

**Check:** `etl/test_views.sql` passes (series grouping, point issues, freeform
labels, publication-span years, an issue edit changing the span, both CHECK
constraints); `py -m unittest discover -s etl -p "test_*.py"` passes (label
parsing, volume choice, hand dates never overwritten, cache makes a re-run free,
dry run writes nothing, why decisions). Both run under `npm run test:all` (0.1); they
are not ported to vitest.

### ☑ 0.7 One issue per comic, credits, story titles, label review · M
Landed before the first load. Plan and findings: project doc
`claude/issue-metadata-plan.md`.

**Issues split from placements.** `issues` is now one row per comic, keyed by a
slug of its label (`fantastic-four-1961-570`), with `label` unique. Where it sits
in a run lives in `run_issues(run_id, sequence, issue_id, type, notes)`. The
sheet had 10,835 rows for 10,285 distinct labels; 426 raw labels sat in two to
four runs. Credits attach to the issue and track/block/catalog totals count it
once. Issue ids are no longer positional (pre-build review 4.6). *Progress also
attached to the issue here, so reading a crossover once marked it read in every
run. Reversed by 0.8: read state is per run.*

**Credits, never typed.** `creators(id, name, metron_id)` and
`issue_credits(issue_id, creator_id, role, source)` with six roles: writer,
artist, inker, colorist, letterer, cover. `runs.writer` and `runs.artists` are
gone — the sheet's values are kept in `seed/workbook_run_fields.csv` and extract
flags a run whose typed writer doesn't appear in its credits. The
`run_creators` and `run_credit_line` views derive a run's credit line (creators
on ≥25% of its credited issues, max three). No hand fallback, by decision.

**Story titles and covers.** `issues.story_title` + `story_title_source`
(paired CHECK, like cover dates) and `issues.cover_url`.

**Label review.** `etl/enrich_comics.py` compares every matched label with
Metron's canonical label and writes `label_review.csv`: `year_added`,
`oneshot_number`, `name_style`, `subtitle`, and `wrong_volume` (an issue dated
more than two years outside the run's typed span, with a same-named volume that
fits proposed when exactly one does). Extract applies only `accept`. Accepted
renames rekey every sidecar on the next enrich run, hand rows included.

**Enrich.** The default pass adds cover URLs and label proposals from pages it
already fetches — no new requests. `--details` fetches each matched issue's
detail page (~8,100 requests, about two days of Metron's quota) for story titles
and credits. A `(label, role)` pair with any hand credit is never touched.

**Rebuild.** `.\etl\rebuild.ps1` (`npm run rebuild`, `etl/rebuild.sh`) drops the
schema, migrates from zero, extracts, loads, runs `test_views.sql` and compares
every table's row count with its seed CSV. Refuses when `LEDGER_LIVE=true`.

**Check:** `py -m unittest discover -s etl -p "test_*.py"` passes (one issue with
two placements; Completed in one run but not another loads read and is flagged;
a repeated label is two placements of one issue; negative issue numbers keep
distinct ids; only accepted renames apply, stale ones are flagged; role mapping;
hand credits own their role; hand story titles survive; rekey moves hand rows;
review decisions survive unchanged proposals; wrong-volume proposal; details
pass cached). `etl/test_views.sql` passes on an empty and a loaded database
(shared issue read in both runs and counted once per track; credit line from
credits only with the 25% line; uncredited run has null lines; story-title
CHECK; duplicate label rejected; role CHECK; deleting an issue cascades its
placements and credits). A migrate-from-zero schema is identical to
`drizzle-kit push` from `schema.ts`, and `0003` applied to a loaded `0002`
database keeps all 76 progress rows.

### ☑ 0.8a Read state per run — schema, ETL and views · M
Requirement change, Sept 2026. ARCHITECTURE 2.14. Reading an issue in one run
must leave it unread in every other run that places it. **Land before 1.1, 1.5
and 1.6** (they write or read progress) and before cutover (the database is
still disposable, so this is a rebuild, not a data migration). Split in two
(R3-12): this half is backend and tests; the spine UI is 0.8b.

- `run_issues` gains `id serial PRIMARY KEY`. `(run_id, sequence)` becomes
  `UNIQUE (run_id, sequence) DEFERRABLE INITIALLY DEFERRED` (renumbering later
  sequences on insert fails mid-statement otherwise; R0-15). The surrogate key is
  there because inserting an issue renumbers later sequences.
- **Rereads do not come back (D-19).** Migration `0004` made `run_issues`
  `UNIQUE (run_id, issue_id)` and extract drops the repeated placements the sheet
  contained, because they looked like a block entered twice. The owner decided to
  keep it that way: **this task keeps the UNIQUE**, a planned reread is a note on
  the placement, and a run's issue count is its distinct issues (D-12). Do not
  add a `reread` column.
- `issue_progress` becomes `(user_id, placement_id → run_issues.id ON DELETE
  CASCADE, completed_at, completed_at_precision)`, primary key `(user_id,
  placement_id)`. `issue_id` goes. **The precision columns already exist and the
  pairing CHECK carries over unchanged** (migration `0004`, ARCHITECTURE 2.17);
  do not re-derive them. `completed_at` stays nullable.
- `etl/extract.py` writes one progress row per `Completed` sheet row, keyed by
  the placement, with `completed_at` blank and precision `none` (it already does
  both for the issue-keyed rows), and drops the "completed in one run, not
  another" flag. Placement ids are assigned in sheet order so
  `issue_progress.csv` can reference them. Re-run against both workbooks and diff
  (standing rule 4).
- Views: `run_progress` and `run_readiness` count the run's own placements.
  `track_issue_counts`, `block_issue_counts`, `block_progress` and
  `catalogTotals()` count an issue read in a scope when any of its placements
  in that scope is read. New `issue_read_runs(user_id, issue_id, run_ids[],
  first_read_at, first_read_precision)`. `first_read_at` ignores `precision =
  'none'` rows for ordering and is NULL when every read is undated;
  `first_read_precision` is that read's precision (`none` when `first_read_at`
  is NULL), so 1.1's *Original dates* can copy it (S-15).
- `/api/progress/issue` takes a placement id.

**Check:** `etl/test_views.sql` and vitest: an issue placed in runs A and B,
marked read in A, is read in A's `run_progress` and unread in B's; `issue_read_runs`
returns `{A}`. A prerequisite run whose issues are all read *elsewhere* is still
unfinished for `run_readiness`. `issue_read_runs` reports an `approximate` first
read as `approximate`. A crossover in two runs of one track counts once
in `track_issue_counts` and reads as read once either placement is. Reordering a
run leaves every `issue_progress` row pointing at the same issue. `py -m unittest`
covers the extract change, and `npm run rebuild` loads 76 progress rows, every one
with a NULL date and precision `none`. **Real-data fixture** (owner, D-26): after
the rebuild, *Dark Reign: The Cabal (2009) #1* reads as read in `hickman-ff` and
unread in `bendis-dark-reign` (the sheet ticks it in one and not the other), and
`issue_read_runs` returns `{hickman-ff}` for it; the extract no longer reports
it as `completed in one run, not another`.

**Done 2026-10-02, migration `0007_placement_progress`** (with
`drizzle/down/0007_placement_progress.sql`). Live gets it through
`npm run rebuild` on `main` after the merge, then Release (START-HERE Step 13).
On a loaded database (a preview's copy of live) 0007 copies each issue-keyed
read onto every placement of its issue, soft-deleted ones included, so every
view answers as it did the moment before; a rebuild loads the per-row truth
(owner's decision). A read on an issue
no run places stops the migration instead of being dropped. The loaders
`setval` the placement serial after loading extract's sheet-order ids.
`addIssueToRun` shifts sequences in one deferred UPDATE. The rebuild was run
against the test database: 76 rows, all undated and `none`, and the Cabal
fixture as stated.

### ☑ 0.8b Read state per run — the spine · S
Depends on 0.8a. The spine renders a grey `read in <run title>` note (`+N` past one
run) on any row whose issue is read in another run, per `design/mockups.html` →
"Run detail — eras".

The spine row markup is part of the task, because the hint is the whole point of
the model: the circle is `<button class="chk" aria-pressed aria-label="Mark
Uncanny X-Men #141 read in this run">`; the grey hint carries a screen-reader
lead-in (*Previously read in …*) and is **hidden on a row already read here**;
a trailing `+N` is a button that opens the issue sheet (3.5). The unchecked ring
uses `--muted` (3:1). The hint is grey, never green (CLAUDE.md).

**Check:** render test: B's spine row carries `read in A`; a row read here shows no
hint, a row read only elsewhere shows it, and every `.chk` has an accessible name
and `aria-pressed`.

**Done 2026-10-02**, `test/spine.test.tsx` (server-rendered markup from
`runDetail` against the test database). `runDetail` reads the other runs from
`issue_read_runs`, excluding the run itself. The hint names the earliest read
first and dates it only when its precision is not `none` (`· Mar 2025`,
`· ~Mar 2025` when approximate). Until 3.5 builds the issue sheet, the `+N`
button discloses the other run titles in place (owner's decision); 3.5 turns it
into the sheet link. The row takes the mockup's `.iss` grid, with the reading
order's sequence number in the trailing column where the mockup draws a cover,
until the run-detail rebuild brings covers.

### ☑ 0.9 Page performance — measure, find the cause, fix it · M
Reported by the owner on the deployed preview and production: moving between
pages on the basic v1 app feels laggy and slow. Nothing has measured it yet, so
this task starts with numbers, not fixes. It sits in Phase 0 on purpose: every
later screen (1.8's shell, 1.9, 2.4's dashboards) inherits whatever is wrong in
the data path, and it is cheaper to find it while there are four routes than
while there are forty. It does not depend on 0.8a/0.8b and may be done before or
between them.

**1. Measure first, and write it down.** On the Vercel preview (and once on
production), on a phone-class profile (Lighthouse mobile, or Chrome throttled to
Slow 4G and 4× CPU) *and* on the owner's actual phone, record for `/comics`,
`/comics/[runId]` (one small run, one 100+ issue run), `/books` and `/login`:
TTFB, LCP, and the time from tapping a link to the next paint. Do each cold (first
hit after 10+ minutes idle, which is the Neon scale-to-zero wake) and warm
(second hit), and say which is which. Put the table in the PR body, with the run
that produced it. Without the before column there is no claim of an improvement.

**2. Find where the time goes**, in this order, recording each answer. The likely
causes are listed so none is skipped, not because any is known to be it:

- **Database round trips.** Time every query a page runs (`EXPLAIN (ANALYZE,
  BUFFERS)` on the views: `run_readiness`, `run_span`, `run_progress`,
  `run_credit_line` are the heavy ones over ~10,761 placements). Count queries
  per request and whether any run in sequence that could be `Promise.all`. A
  view that recomputes the whole catalog to render one run is the first suspect;
  check whether it filters by run *before* aggregating.
- **Region and connection.** Vercel function region against the Neon endpoint
  (`us-east-2`, Ohio; `vercel.json` sets no `regions`, so functions use the
  Vercel default). Confirm `DATABASE_URL` is the `-pooler` host, that `postgres.js`
  is created once per instance and not per request, and what a cold Neon wake
  costs (compute scales to zero after 5 minutes idle on the free plan).
- **Rendering.** Every page is `export const dynamic = "force-dynamic"`, so
  nothing is cached and each navigation is a full server render and query pass.
  Decide, page by page, what may be cached or streamed: the catalog changes when
  the owner edits, not per request. Look at `loading.tsx` / Suspense so a
  navigation paints a skeleton at once (the UX floor) rather than blocking on the
  slowest query, and at `<Link>` prefetching.
- **Payload.** Bytes of HTML/RSC and JS shipped per route, how many rows a page
  serialises (the 258-run list, a 100+ issue spine), client components that
  could be server components, images and fonts. Next 16's `next build` no longer
  prints route sizes; measure the transferred bytes instead.
- **Proxy.** `src/proxy.ts` (Next 16's name for middleware) runs on every
  request for the passcode gate; confirm it does no database work.

**3. Fix the causes that measured as large**, one commit each, with the
before/after for that change. A cause that measures as small is left alone and
named in the PR. A fix that needs a schema change (an index) stops and asks first
(CLAUDE.md). A materialised view stores derived data and so conflicts with
*Derived data is never stored*: prefer an index or a better query, and raise it as
a decision if only a materialised view will do.

**4. Leave a budget behind.** Add the target to `docs/ARCHITECTURE.md` as a short
*Performance budget* section, and a cheap regression guard where one can be made
deterministic (a vitest that a page's query count does not exceed N, or a check on
the `next build` route-size table). No test asserts a wall-clock time: those are
flaky in CI.

**Target** (adjust after step 1 if the numbers show it is unrealistic, and say
so): a warm navigation between dashboards and run detail paints in under 1s on
the throttled profile; a cold Neon wake shows a skeleton immediately instead of a
blank page; no page runs more queries than it has distinct data needs.

**Check:** the PR carries the before/after table for the routes above, cold and
warm, on the preview. The per-page query count is recorded and the guard test
passes. `EXPLAIN` output for any view changed shows the run filter applied early.
`/verify` is green and the migration checks pass unchanged (no schema change
unless the owner approved one).

**Done 2026-10-04**, no schema change. The time was in the database and in the
app, not in Vercel or Neon's hosting. On catalog-sized data the run list's query
took 5.8 s: run_credit_line rebuilt all 87k placed credits on every read
(run_creators' CTE was materialized) and scanned them once per run, and run_span
ran its label regex over every issue in the catalog, four times per reference.
Both now filter by run first and parse each label once: the run list 5.8 s →
0.27 s, home 1.6 s → 0.32 s, a run header 0.3–0.6 s → 15–75 ms. The run page's
three queries go out in one wave. The nav's Export `<Link>` was prefetched on
every page view, which ran the handler and built a 20 MB export each time; it is
a plain link now. No route had a loading boundary, so Next prefetched nothing
and a tap froze the screen until every query answered; `/comics`, a run and
`/books` now paint their skeleton within about 100 ms of a tap. On the preview,
throttled (Slow 4G, 4× CPU), tap → page went from 7.2 s to 1.2 s warm on
`/comics` and from 5.4–8.2 s to 2.2–2.7 s cold. The table, query counts and
`EXPLAIN` output are in the PR; the budget and its guards are in ARCHITECTURE §5.
Left alone, measured small: the Vercel region (iad1 to Neon in Ohio, about
10–12 ms a round trip), page bytes (3–35 KB transferred), run_readiness'
prerequisite side (14 ms). The owner's phone column was not taken (owner's
call); the throttled profile stands in for it. `/` has no skeleton until 1.8
makes it a redirect.

### ☐ 0.10 Lighthouse on every preview · M
Depends on 0.9: its routes, its measurement runner and the *Performance budget*
it leaves in `docs/ARCHITECTURE.md`. It does not block Phase 1, but build it
before 1.8, so the app shell is the first screen measured on its own PR rather
than after it ships. Asked for by the owner on 2026-10-03.

0.9 measured by hand, once. A number taken once goes stale with the next screen,
so this makes every preview measure itself and tells the PR what changed.

- **When.** `.github/workflows/lighthouse.yml` runs when Vercel reports a
  preview deployment `success` (`deployment_status`), and by hand
  (`workflow_dispatch`) with a URL. It never runs on its own against production:
  Release's smoke test owns production, and a pass there reads the live
  database through the app. A hand run against production is the owner's call.
- **Getting in.** Every deployment sits behind Vercel Authentication and the
  passcode gate. The job sends `x-vercel-protection-bypass` from the existing
  `VERCEL_AUTOMATION_BYPASS_SECRET`, signs in by posting a new
  `APP_PASSCODE` repository secret to `/api/login`, and hands both the header
  and the `rt_session` cookie to Lighthouse. Both values are masked; neither
  is ever echoed. When 6.13 replaces the passcode, it updates this step.
- **What is measured.** The routes 0.9 measured — `/login`, `/comics`, one
  small run, one run of 100+ issues and `/books` — listed once in the
  workflow; a task that adds a top-level screen adds its URL there in the same
  PR. Lighthouse mobile with devtools throttling (Slow 4G, 4× CPU), version
  pinned, three runs per route, median reported. Beside it, 0.9's
  tap → next-paint runner (moved from scratch into `scripts/perf/`) times the
  same tap pairs on the same profile.
- **What fails the job** — only what holds still between runs:
  - any request to a route handler (`/api/*`) during a page load or a
    prefetch, by name (0.9 found the nav prefetching `/api/export`);
  - per route, document plus RSC bytes, JS bytes and request count over the
    budget in ARCHITECTURE's *Performance budget*;
  - CLS of 0.1 or more;
  - an accessibility category score below the one recorded in the budget.
- **What is reported, never gated.** TTFB, response complete, FCP, LCP, TBT and
  tap → next paint, first hit and median, against `main`'s last run where there
  is one. One PR comment, updated in place, plus the job summary. No
  wall-clock assertion: those flake, and a preview's Neon branch is cold or
  warm by chance (0.9 step 4).
- **Reports stay private.** The HTML and JSON reports are workflow artifacts
  with 14-day retention, nothing more. Never LHCI's temporary public storage
  or any public upload: a report holds the rendered pages — the library and
  the reading history.
- **Docs.** `.claude/rules/git.md`'s *Test on the branch* names this run where
  it now says "once they exist"; START-HERE gets the `APP_PASSCODE` secret
  beside the bypass secret (10e).

**Check:** on this task's own PR the workflow runs against the PR's preview,
posts the table and attaches the reports as artifacts. On a throwaway branch, a
`<Link href="/api/export">` put back in the nav fails the job with that request
named, and removing it turns the job green. A `workflow_dispatch` run with a URL
works. Neither secret appears in any log, and no report leaves GitHub.

---

## Phase 1 — Daily use (build before anything clever)

**Build order.** The tasks below are in the order they are built, which is
not ID order. The IDs predate the reviews that fixed the order (R3-10, R3-12,
D-20, D-31), and decisions, reviews, branches and commits cite them, so they
stay. START-HERE Step 12 groups them into sittings:

| Sitting | Tasks, in order | Why this order |
|---|---|---|
| 3 | 1.2 → 1.1 → 1.6 | 1.1's check asserts undo, and 1.1 must not carry its own (R3-10) |
| 4 | 1.3 → 1.3c → 1.3b | 1.3c's review table takes the parser's output; 1.3b's Metron results go through the same review and insert |
| 5 | 1.4 → 1.4c → 1.4b → 1.5 | resolving an inbox note (1.4b) routes into the add flows; 1.5 must land before real rereads overwrite history |
| 6 | 1.7 → 1.8a → 1.8 → 1.8b | 1.8a's tokens come before the first UI task; 1.8b was split out of 1.8 (R3-12) |
| 7 | 1.10 → 1.9 → 2.11a → 1.11 | 1.9's Up next tab reads the queue; 2.11a is numbered in Phase 2 but built here, before cutover (D-20); so is 1.11 (D-36) |

### ☐ 1.2 Undo · S
**Build before 1.1** (R3-10): 1.1's check asserts undo, and 1.1 must not carry its
own. Last-action stack in memory, `Ctrl+Z` and a toast with an undo button. Covers
single marks, range marks, and status changes.

**One interface, three later users** (R1-09). The stack holds
`{ label: string, undo: () => Promise<void> }`, not progress rows, so a caller
supplies its own inverse. Build it that way now: **1.10** pushes a queue-order
snapshot (reorder and remove), **1.1** pushes a range mark as one entry, and
**1.4c/1.3** push an insert. Typing the stack to `issue_progress` means
rewriting it twice.

**2.7's Undo is not this.** Accepting an overage is persisted and dated, and its
*Undo acceptance* control sits on a banner that survives a reload — it deletes
the acceptance row. The toast stack is in memory and lasts 8 seconds. Two
different affordances; do not share a component between them.

**Check:** test asserts mark → undo restores exact prior state, including
`completed_at`. Test that an entry pushed with an arbitrary inverse closure runs
it on undo, so the stack is not coupled to progress rows.

### ☐ 1.1 Range marking · M
Depends on 0.8a and **1.2** — build undo first (R3-10); 1.1 pushes its range mark
onto that stack and never ships a throwaway undo of its own.

Shift-click on desktop, long-press on mobile, selects a range in the spine. A
row menu offers "mark everything through here." One request, not N.

**The desktop selection is visible before the sheet opens** (UX-N17; a mouse or
trackpad, `(pointer:fine)`, at any width; a tablet uses long-press). The first
click sets an anchor row (1px `--brand` ring); moving the pointer tints the rows
it would include in `--brand-soft`; a floating pill counts them (*Mark 18 read
· Shift-click to finish*); the shift-click opens the range sheet with that count.
Esc clears the anchor. **Prompts
for a date**: today, a picked date, spread across a range, or no date. Single
taps never prompt.

**The endpoint** (R3-10). `POST /api/progress/range` with
`{ runId, placementIds: number[], mode, date?, from?, to? }`. The client sends
placement ids, never a sequence range: a stale desktop tab (D-9 accepted no
revalidation) would otherwise mark whichever issues now sit at those sequences.
The server checks every id belongs to `runId` and rejects the request otherwise.
Add the route to ARCHITECTURE's route table. Optional placements in the range are
included, and the sheet says how many (*96 issues · 4 optional*).

**Date rules** (R3-07). A date is stored with its precision (ARCHITECTURE 2.17):

| Mode | `completed_at` | precision |
|---|---|---|
| Today | `now()` | `exact` |
| Pick a date | that date | `exact` |
| Spread over a range | two dates, start and end; placements distributed evenly by ordinal, non-decreasing | `approximate` |
| No date | NULL | `none` |
| Original dates (Adopt only) | the placement's `issue_read_runs.first_read_at`; NULL when the prior reads are undated | `issue_read_runs.first_read_precision` — never assumed `exact` |

- **A range never changes an existing `completed_at`.** Writes are `ON CONFLICT
  DO NOTHING`; a placement already read here is skipped and counted (*4 already
  read, kept their dates*). Overwriting a real date with today's is the failure
  this rule exists for.
- **Spread** needs both dates and shows them as two fields; the last placement
  gets the end date. Undated (`none`) never appears in pace maths.
- **Adopt N prior reads** is a second entry point, in the run hero when unread
  placements have reads elsewhere (`issue_read_runs`). It opens the same sheet
  pre-filled with those placements and the fifth radio, *Original dates*, which
  exists only from Adopt (add it to the mockup's four). With two prior reads it
  takes the earliest (`first_read_at`). It acts on this run only, supports Undo,
  and is the explicit, previewed version of what auto-ticking would have done.
- The run hero's `⋯` menu also offers *Copy unread · Copy all · Copy as ranges*
  (a toast, `role="status"`, confirms).

**Check:** test marks sequences 5 through 200 of a run in one call and asserts
196 `issue_progress` rows, one per placement, in one round trip. Marks go to
this run's placements only (0.8a): an issue in the range also placed in another
run stays unread there. A range containing four placements that already carry a
March date leaves those four dates untouched (`DO NOTHING`). Spread over 10
placements writes non-decreasing dates from start to end with precision
`approximate`; No date writes NULL and `none`. A request whose `placementIds`
include an id from another run is rejected and writes nothing. Adopting 9 prior
reads writes 9 placements with `completed_at` equal to their original read dates
(NULL where those were undated) and the same precision (an `approximate` prior
read stays `approximate`), in one request, and one undo removes exactly
those 9. At 1280px, a click on the fifth row and a shift-click on the
twenty-second opens the sheet counting 18 placements. Manually: open
`hickman-krakoa` (641 issues), mark a 100-issue range, confirm no visible stall.

### ☐ 1.6 Resume pointer · S
Dashboard shows "Continue: Fantastic Four #583" per in-progress run, linking to
that row in the spine. Derived — lowest `run_issues.sequence` whose *placement*
is unread — never stored. An issue read only in another run is still unread
here, so the pointer stops on it; the row's `read in …` hint lets you tick it
and move on.

The pointer's home is the comics **telecard**, kicker *PICK UP WHERE YOU LEFT
OFF*: run name, credit line, a state badge (`◐ 42 / 381`, with no prerequisite
badge beside it — the five-state rules are in 2.4), the telescope (2.5) and the
ladder. Its primary button, **Resume #141**, is the same verb as the thumb bar's
*Mark #141 read*. Phone and desktop render the same badges from one component.

**The spine hero carries the pointer too** (Oct 2026, spine v2; STYLE_GUIDE §9
*Next-issue strip*; mockup `spine`). Above *Resume #141* sits a compact strip: a
tonal `--raise` well with no ring, holding the next placement's cover thumb (4.3's
row rules, text fallback until then), the kicker *NEXT · 42 / 381*, the full
label and the placement's `run_issues.notes` as its `.inote`. It is one link to
the issue sheet (3.5), named *Next: 42 of 381, Uncanny X-Men #141, Days of
Future Past, part one*. The only `--brand` in the hero is the *Resume* button.
The thumb bar verb is unchanged. A fully read run renders the existing
fully-read treatment instead (ARCHITECTURE §4 *Fully read*). On desktop the
strip is in the sticky `dk-rail` hero.

**Check:** test with a run where issues 1-5 and 7 are read; assert the pointer
returns issue 6. Mark issue 6 read in a different run holding it and assert the
pointer still returns 6. Render the spine hero for that run and assert that the
strip names issue 6 with its ordinal and its placement note, that its link's
accessible name starts *Next: 6 of*, and that it contains no element styled
`--brand` other than the Resume button. Mark every placement read and assert
that the strip is gone and the fully-read badge is rendered.

### ☐ 1.3 Bulk issue entry — parser and validation · M
The single highest-risk feature: if adding a run is slower than Sheets you will
drift back. Split in two (R3-12): this task is the pure parser and its validation
rules, testable with no UI; **1.3c** is the review table and the insert. The
**Type it** half of `/comics/[runId]/add`: a textarea, one issue per line, pasted
from anywhere. The **Search** half is 1.3b, and both halves share 1.3c's review
table and insert. Mockup: `design/mockups.html` → "Add issues — search or type".

Pipeline is in DIAGRAMS.md §6. The grammar, derived from the 10,834 existing
labels:

```
label   := title [ " (" year ")" ] " #" designator
title   := printable text, no leading/trailing space
year    := 4 digits, the volume year
desig   := number | number "." number | "Annual " number
          | range: number "-" number   (expanded on insert)
```

Validation rules, in order:

| Rule | Behavior |
|---|---|
| Normalize | NFKC, trim, collapse internal whitespace, en/em dash to hyphen |
| Unparseable | Flag, offer manual accept — 302 existing labels are legitimately freeform (`Dark Reign: The Cabal`, `Astonishing Tales #1 (Mojoworld)`) |
| Unknown series | Flag as new, ask to confirm or correct against existing titles by trigram similarity |
| **Ambiguous volume** | **59 series in your data appear both with and without a volume year.** `Captain America #1` matches 8 volumes; `Avengers #1` matches 6. If the series has more than one known volume year and the input omits it, flag and make the user pick |
| Range | `#1-12` expands to 12 rows, preserving order |
| Duplicate | Already present in this run — flag, default to skip |

**Check:** unit tests for the parser against a fixture of 40 lines covering
every rule above, including the 8-volume Captain America case; `#1-12` expands to
12 in order; a line already in the run is flagged *skip*. No database is touched.

### ☐ 1.3c Bulk issue entry — review table and insert · M
Depends on 1.3. Everything the parser produces lands in a review table (accept /
fix / drop) before insert. Nothing writes until the user confirms. Sequence
appends after the run's current max.

A line whose label already exists in `issues` reuses that row and creates only
the placement; the review row says "already in N runs". A new label creates the
`issues` row first. Nothing is written until the user confirms, and then
everything is written in one transaction. A placement already in the run is never
inserted twice (`run_issues` is UNIQUE per run and issue, D-19). A line whose
issue was **removed** from this run (a soft-deleted placement) restores that
row rather than inserting (0.4, S-07); its review row says *restore — was
removed*, and its old read mark comes back with it.

The review table has five columns — kind glyph, parsed line, why, check, decision
(ARCHITECTURE §4, *Review tables*) — with `role="radiogroup"` decisions and
`aria-invalid` on failed rows. **The header and the button count the real
insert**, not the line count: a paste that expands to 10 issues with one already
in the run says *9 will be added*. Below the table an **insertion preview**
shows three existing rows above and below the insertion point, the new rows
highlighted, and an *Insert after* picker (default: the end of the run).

**The screen names the run it adds to** (FEATURES 2c *Remember the last run*;
UX-N27): a chip at the top of both halves of Add issues, *Adding to: Claremont —
Uncanny X-Men · Change*, where *Change* picks another run without leaving the
screen, so consecutive adds to different runs don't re-navigate.

**Check:** integration test that pastes 24 lines into an empty run and asserts 24 issues in order, and that
a line matching an existing label adds a placement without a second `issues`
row. Test that the count in the header equals expanded lines minus duplicates
for the fixture paste (10 − 1 = 9), and that choosing *Insert after #336* places
the new sequences after it and renumbers later ones without touching their
progress rows. Pasting a label whose placement in this run was soft-deleted
restores the original row (same id, progress intact) and inserts nothing.

### ☐ 1.3b Add issues from a Metron search · M
Requirement change, Sept 2026. ARCHITECTURE 2.15. The **Search** half of
`/comics/[runId]/add`, and the default tab. Type `thor 337-340` or `balder the
brave 1`. Your own catalog is matched first, then Metron is searched when you
submit (not per keystroke) by series name and number. Results show cover, volume
year and cover date, so `Captain America #1` is resolved by looking at it
rather than by picking a year. Rows already in your catalog show "in N runs" and
"already in this run" states, not a second Add.

Tapping **Add** (or selecting several, then **Add N**) goes through the same
staged review and insert as 1.3. A new issue is created with `metron_id`,
`cover_date` / `cover_url` (source `metron`), and Metron's label normalised to
the bulk-entry grammar. Then the placement is appended, or inserted after a
chosen issue. Metron is called server-side only, rate-limited to its 20/min, and
cached with the same cache the enrichment script uses. When Metron is down or
returns nothing, the screen offers **Type it instead** with the query
pre-filled.

Search has visible states, each `role="status"`: *loading* between submit and
results, *rate-limited* with a `Retry-After` countdown (*Metron is busy, retrying
in 40s · Type it instead*), and *error*. The same insertion preview as 1.3 sits
below the result list.

**Check:** with a recorded Metron fixture: a search for `thor 337-340` returns 4
results in order; adding them creates 4 `issues` rows carrying `metron_id` and
`cover_date_source = 'metron'`, plus 4 placements; re-searching shows all 4 as
"already in this run"; an issue already in another run is reused, not
duplicated. A Metron failure renders the freeform fallback and writes nothing.
No page render calls Metron (assert through a mocked client that counts calls).
A mocked 429 with `Retry-After: 40` renders the rate-limited status line with
the countdown and a working *Type it instead*, and makes no second request
before it elapses.

### ☐ 1.4 Books bulk entry · M
Same shape: paste `Title — Author` or `Title (Series #N)`, match against the
catalog, create what's missing, flag near-duplicates by trigram. This is the
*Paste a list* path of 1.4c.

**Near-duplicate means `pg_trgm` `similarity(title, pasted title) >= 0.4`**
(owner, D-25), and only an exact match on title and author counts as the same
book. A flagged line shows its closest match and defaults to *create new*;
nothing is merged without the owner's accept. The trigram index is
`books_title_gin_trgm` (`etl/views.sql`).

**Check:** paste a fixture of 15 lines where 9 exist and 6 don't; assert 6
inserts and 9 matches, zero duplicates. A line one letter off an existing title
(similarity ≥ 0.4) is flagged with that match and is not merged.

### ☐ 1.4c Add a book by search or by hand, to a destination · M
Requirement change, Sept 2026. ARCHITECTURE 2.15. One add sheet, reached from
Add books, a shelf's **+ Add to shelf**, the plan, and the master list's *To
read* filter, opened with that destination preselected. Mockups: "Add books"
and "Shelves".

- **Search**: your library first, then Open Library live on submit. The result
  carries page count, year and cover, so word count is estimated
  (`word_count_source = 'estimated'`).
- **By hand**: title and author required; series, position, pages and words
  optional. A typed word count is `stated`.
- **Then**: the `books` row is created, or reused if it matches (plus `authors`
  / `book_series` when new), and then the destination row. One transaction.
- **Add to** names the destination before you search, and every result's
  primary button names it too (*Add to Someday*). The destinations are the four
  to-read levels (D-37) plus a shelf: **Someday** (`book_status = to_read` and
  no plan row; the default, and what *To read* used to mean), **On deck**, a
  **year or quarter**, and **Shelf…**. They arrive in three steps, because two
  need things later tasks build: this task ships *Someday* and *Shelf*; 1.7's
  check enables **On deck** (it needs the `on_deck` period); 2.3's check
  enables **Year or quarter…** (R3-08: the picker it opens is a Phase 2
  component, and a private one built here would be duplicated there). 5.7 adds
  *Coming out* (a `releases` row with a date or none) the same way.

A by-hand record starts thin: until enrichment (4.2) fills it, its cover renders
a dashed outline and its row says *metadata pending* (`data-enrich="pending"`).
The same treatment applies to freeform issues in 1.3.

**Check:** adding an Open Library result to the Cosmere shelf creates one
`books` row with `open_library_id` and one `shelf_books` row; adding the same
book again, from search or by hand with the same title and author, reuses it
and says so; a by-hand book with no pages saves with null word count and still
lands in Someday (`to_read`, no plan row); an Open Library failure leaves By
hand working and writes nothing. (*On deck* is asserted in 1.7 and *Year or
quarter…* in 2.3, not here.)

### ☐ 1.4b Quick-capture inbox · S
One text field, zero required fields, optional books/comics tag. Reachable from
anywhere. Unresolved items list on the dashboard with a count; resolving routes
into bulk add or New Run. FEATURES.md #21.

The kind control is **Books · Comics · Watch · Unsure**; resolving a Watch note
opens `/watch/add` pre-filled. The inbox count shows as a chip on every
dashboard's lede and as `Inbox (N)` in the desktop sidebar.

**Check:** test that an inbox row saves with only `raw_text` set, and that
resolving it links `book_id` or `run_id` and stamps `resolved_at`. A note tagged
Watch resolves into a `/watch/add` URL carrying its text.

### ☐ 1.4d Promote the wishlist into Someday · S
D-39. `wishlist` holds 497 lines from the workbook's old To-Read tab that never
became books (`First Law - Joe Abercrombie`, with a genre; none links a
`book_id`). Nothing shows them. This task runs them once through 1.4's
paste-a-list review, so each becomes an ordinary Someday book (D-37:
`book_status = to_read`, no plan row) or is dismissed. Depends on 1.4.

- **A one-off screen**, `/books/add?from=wishlist`: the unresolved lines
  (`book_id IS NULL`) pre-filled into the *Paste a list* review, in workbook
  order, grouped by genre. Every line gets 1.4's treatment: matched against
  your library, then flagged when a title is within `similarity >= 0.4`
  (D-25), else proposed as new. Nothing is created without your accept, and a
  line can be edited before it is accepted.
- **The parser takes the sheet's form.** The lines use `Title - Author` with a
  plain hyphen, not 1.4's em dash; both parse. A line that names a series
  rather than a book (*First Law*, *The Warlord Chronicles*) is flagged
  *series?*, and you edit it to a book or dismiss it.
- **Accepting** creates or reuses the `books` row, writes `book_status =
  to_read` if the book has no status yet, and sets `wishlist.book_id`. One
  transaction per line. **Dismissing** deletes the line; the nightly backup
  still holds it.
- **When to run it.** The screen works on any database, but the promotion is
  done on production **after Step 14's final load** (OWNER-CHECKLIST): a load
  truncates `books` and would erase anything promoted before it. The table and
  `extract.py`'s `wishlist.csv` go in a later `chore/` PR, once the screen
  shows nothing left (D-39).

**Check:** a fixture of five wishlist lines — one matching an existing book,
one a letter off an existing title, one series name, two new — shows one match,
one near-duplicate flag, one *series?* flag and two proposed creations, and
writes nothing until accepted. Accepting all but the series line creates two
books at Someday (`to_read`, no plan row), links all four `wishlist.book_id`
values, and leaves an existing book's status untouched. `Title - Author` and
`Title — Author` parse the same. A dismissed line is gone from the screen and
from the table.

### ☐ 1.5 Dated reading log · M
**Precision is already in the schema** (migration `0004`, ARCHITECTURE 2.17):
`book_status.finished_on` is a `date` and `finished_on_precision` exists, and
`issue_progress.completed_at` is nullable with `completed_at_precision`. This task
does not retype or add those columns (R3-05); it **adds `finished_on_precision` to
`read_events`** and builds the UI.

Make `issue_progress.completed_at` user-editable. Backfill existing
`finished_year` values to `YYYY-07-01` with precision `approximate`, never `exact`
(and leave rows with no year at `none`).

**`finished_year` goes; the year is derived (D-21, S-05).** After the backfill
this task drops `book_status.finished_year`, and every reader moves to
`extract(year FROM finished_on)`: the `books_by_year` view and the
`status_user_year` index (`etl/views.sql`), `listBooks`, its year filter and
`readWithoutYear` (`src/db/queries.ts`, the R2-08 *No year* chip — a `read`
book with precision `none`), the year cell in `src/app/books/page.tsx`, and
`saveBookStatus` (`src/db/writes.ts`), which takes a finish date and precision
instead of a year. `etl/extract.py` emits `finished_on` (`YYYY-07-01`) and
`finished_on_precision` (`approximate`, or blank + `none` with no year) instead
of `finished_year`, so the cutover load needs no backfill (standing rule 4
applies). Otherwise a book finished through the new control has a date and no
year, and silently drops out of its year chip and 2.2's *year so far*.

Add `read_events` as the log and project `book_status` / `issue_progress` from
it, so a second read appends rather than overwrites. FEATURES.md #22 — this
must land before real data accumulates. `read_events(…, finished_on date,
finished_on_precision text, reread_of)` uses the same pairing CHECK as the other
two tables. Comic events carry `placement_id`, not `issue_id` (0.8a). Reading the
same comic in a second run is a first read of that placement, and `reread_of`
links repeat reads of one placement. The `book_id` / `placement_id` pair with
`CHECK (num_nonnulls(book_id, placement_id) = 1)` (FEATURES Part 5) is
deliberate: one log for both media, kept honest by the CHECK. The shelves rule
in CLAUDE.md is about shelves, not this table.

**Reversibility.** `drizzle-kit` produces no down migration, so this task ships
`drizzle/down/<tag>.sql` by hand and its test runs up → down → up asserting row
values survive (CLAUDE.md, *Migrations that drop or retype*). Unlike
`drizzle/down/0004_date_precision.sql`, this down must be **lossless**: the
down restores `finished_year` from `finished_on`, and a precision-`none` row is
still `none` with a NULL date after the round trip (S-10).

**The status control moves here from 3.4** (R1-03). Nothing in Phases 0–2
otherwise changes a book's status: the books page only *filters* by it
(`/books?status=reading`) and `/api/progress/book` has no caller, so "I finished
a book" — a weekly flow — could not complete. This task owns the transition
`to_read → reading → read | dnf` plus the finish date, on the master-list row
and the book detail sheet, writing through `read_events`. It is also the caller that
fixes R0-C1: the POST must not null `finishedYear`/`rating` on an unrelated
status change. Rating, notes and the top-books reorder stay in 3.4.

**The finish-date control** (M-13, mockup `blist`, second frame): choosing
*Read* opens *Finished* with **Today · Pick a date · Year only · No date**.
Today and Pick a date write an `exact` date; *Year only* writes `YYYY-07-01`
with precision `approximate` (D-21); *No date* writes NULL with precision
`none`. The same control sits in the book detail sheet. There is no *Spread*:
that is for ranges of issues (1.1).

Two surfaces depend on it inside HORIZON: 2.2's empty state offers *Start the
first Q-current book* (sets `reading`), and 1.9's Done tab and 2.2's *year so
far* read `read`.

**Check:** test asserts a book finished 2024-03-11 appears in both a March 2024
query and a 2024 query; that reading it again creates a second `read_events`
row with `reread_of` set and leaves the first intact; and that `book_status`
still reports one current status. A backfilled year lands as `YYYY-07-01` with
precision `approximate`, and a date with the wrong precision violates the CHECK.
Test that marking a book `read` from the master list writes the event and leaves
an existing rating intact (R0-C1), and that `to_read → reading → read`
round-trips through the UI. A book marked read through the UI on 2026-10-02
appears under the 2026 year chip and in `books_by_year` for 2026; a `read` book
with no date appears under *No year*. Choosing *Year only* for 2019 in the
finish-date control stores `2019-07-01` / `approximate`, never `exact`, and
*No date* stores NULL / `none`. `finished_year` no longer exists. Up →
down → up preserves the rows, including their precision.

### ☐ 1.7 One period column on `reading_plan` · M
Replace `planned_year` / `planned_quarter` with a single `period text NOT NULL`,
checked against `^[0-9]{4}(-Q[1-4])?$` or the literal `on_deck`. The year is
`left(period, 4)`, so a year is what its quarters roll up to and cannot
disagree with them. A bare `2027` is a legitimate state — committed to the
year, no quarter chosen. **There is no month period** (D-38): a quarter is the
finest grain the plan has. **The plan starts empty** (R0-04): extract no longer
writes the workbook's To-Read tabs as plan rows (`--with-plan` restores that),
so every entry is added in the app. ARCHITECTURE 2.9.

**The four to-read levels (D-37).** Every `to_read` book sits at exactly one:

| Level | Stored as | Ordered | Counts against capacity |
|---|---|---|---|
| Quarter | `period = '2027-Q1'` | yes, by `ordinal` | that quarter, and its year |
| Year | `period = '2027'` | no | that year (the rail's fifth lane) |
| On deck | `period = 'on_deck'` | no | nothing |
| Someday | no `reading_plan` row | no | nothing |

Someday is derived, never stored: it is every `to_read` book with no plan row,
so 1.4c's default destination and 2.3's *Someday* chip both mean "no row". Add a
`to_read_level` view, one row per `to_read` book with its level and period (a
book with several plan rows takes its earliest: quarters and years by date,
then `on_deck`), so nothing classifies books in app code.

**What a two-year book becomes** (one-way door). `reading_plan`'s key today is
`(user_id, book_id, planned_year)`, so a book can hold a 2026 and a 2027 row. The
new key is `(user_id, book_id, period)`: the same book may hold `2026` and `2027`
as two rows, each preserved as its own period, and nothing collapses them. Reads
that want one row per book take the earliest period (as `listBooks` does now).
Add a `plan_period` view exposing `year`, `quarter`, `level` (`quarter` |
`year` | `on_deck`) and `ordinal`, so nothing parses the string in app code.

**Quarters are ordered; nothing else is.** `reading_plan` gains `ordinal
integer`, NULL exactly when the period is not a quarter (`CHECK ((ordinal IS
NULL) = (period !~ '-Q'))`), with `UNIQUE (user_id, period, ordinal) DEFERRABLE
INITIALLY DEFERRED`: contiguous from 1 within each quarter, the same shape as
1.10's `run_queue`. A year reads as its four quarters in order, each in its own
order (D-37). Bare-year rows and On deck have no stored order; each surface that
lists them states its sort. The order is authored, so it is stored. The write
helpers land here, and every later task uses them rather than writing periods or
ordinals itself: placing a book in a quarter **appends** (max + 1); taking it out
of a quarter, to any other level, closes the gap; **reorder** and **move to top**
rewrite one quarter's ordinals in one transaction; moving to Someday deletes the
plan row and leaves `book_status` alone. The migration numbers existing quarter
rows by `books.title`, then `book_id`; `extract.py --with-plan` numbers them in
workbook row order.

**Months go (D-38).** `reading_settings.plan_granularity` is dropped with its
check. Nothing has set it to anything but `quarter` (its screen, 2.0, is
unbuilt). With it go the Quarter | Month toggle, the month rail and the monthly
capacity, in every later task.

**Reversibility.** `drizzle/down/<tag>.sql` restores `planned_year` /
`planned_quarter` from every quarter and year row and re-adds `plan_granularity`
at `quarter`. It **refuses** (raises) while any `on_deck` row exists, because
the legacy shape cannot hold a plan entry with no year, rather than dropping it
silently. `ordinal` is the one thing it drops: the legacy columns have nowhere
to keep an order.

**The add sheet's flip.** 1.4c ships *Someday* and *Shelf*; this task enables
**On deck** on it: the book and its `on_deck` plan row in one transaction.

Like 1.5, this must land before real planning data accumulates.

**Check:** test that `2027-Q1` reads back as year 2027, quarter 1, level
`quarter`; `2027` with a null quarter and level `year`; `on_deck` with a null
year and level `on_deck`; that `2027-Q5`, `2027-03` and `someday` are rejected by
the constraint, and so are a quarter row with a null ordinal and a year row with
one. `to_read_level` puts a `to_read` book with no plan row at `someday`, and a
book planned both `2027` and `on_deck` at `year`. The migration composes the
legacy columns without losing a row (a fixture with a two-year book keeps both
rows), and up → down → up restores them, asserting row values; the down raises
while an `on_deck` row exists. Ordinals: adding three books to `2027-Q1` gives
1–3; adding one to `2027-Q2` gives it 1 there; moving Q1's #2 to Q2 leaves Q1 at
1–2 and makes it Q2's 2; moving a quarter book to `2027` or `on_deck` gives it a
null ordinal and closes the gap; *move to top* on Q1's #2 gives a contiguous 1–2
with it first. Two concurrent reorders of one quarter never leave duplicate
ordinals, and after up → down → up every quarter is 1…N again.
`plan_granularity` no longer exists. Adding a book *On deck* from the add sheet
writes the book and its plan row in one transaction.

### ☐ 1.8a Design tokens and control states · M
D-31; Review N P0 (UX-N01, N02, N03, N04, UX-X01, and the token half of N19 and
N20). **Build before 1.8**: every later UI task inherits these values, and a
screen built on the old set is rework. `design/tokens.css` is the source; STYLE_GUIDE
§4–§6 and §10 are the reasons and the measured contrast.

**Move the tokens, don't reinvent them.** `tokens.css` goes into
`src/app/globals.css` **and** into `design/mockups.html`'s `.app` token blocks in
the same PR, because `npm run test:tokens` fails when the two differ. The
selectors change on the way in: `tokens.css`'s `.app,:root{…}` becomes
globals' `:root{…}`; its `.app[data-theme="dark"]{…}` becomes both
`:root[data-theme="dark"]` and the `prefers-color-scheme: dark`
`:root:not([data-theme="light"])` block, identical. The `@media (min-width:900px)`
telescope overrides, the glass fallback (`@supports not (backdrop-filter)` and
`prefers-reduced-transparency`) and the reduced-motion block move as written.
Additions and value changes only: no token or class is renamed or removed, and
the `--mark` / `--held` aliases stay (SG §13).

- **Colour.** The retuned light neutrals (UX-N19), the dark depth ladder with
  `--sunk` below `--surface` (UX-N03, SG-D2), and the new `--overlay`,
  `--toast-bg` / `--toast-ink` (SG-D3), `--halo` (the telescope head, nothing
  else), `--focus-ring`, `--glass-*`, `--scrim` (replacing the moveplan literal,
  L-01) and `--hatch` / `--hatch-settled`. Identity hues `--t*`, `--g*`, `--m-*`
  do not change.
- **Scales.** Radius `--r-cell … --r-full` (six values; UX-N04), spacing
  `--sp-0-5 … --sp-10` on a 4px base (UX-N20), type `--fs-*` (the nine styles in
  STYLE_GUIDE §5; UX-N02), `--row-h`, telescope `--tele-*`, motion `--dur-1…4`
  and `--ease-out` / `--ease-in`.
- **11px floor, app-wide** (UX-X01, extending C05 beyond the telescope). A label
  too long for its box is dropped and carried by the accessible name, never
  shrunk.
- **Three elevation tiers** (STYLE_GUIDE §4.1, §7; UX-N04). Grounded surfaces
  (groups, telecard, hero, inputs, buttons) get a ring and at most `--sh-1`;
  `--sh-2` is for menus, popovers, toasts and a drag ghost; `--sh-3` for sheets,
  dialogs and the palette. Dark depth comes from tone plus the 1px inner top
  highlight in the dark `--sh-*` values.
- **The control-state matrix** (UX-N01; drawn in `design/Specimen.dc.html` B5).
  Every interactive class (`.btn` and its variants, `.iconbtn`, `.chip`,
  `.seg`, `.bar .tab`, `.side a`, `.row`, `.switch`, `.stepper button`) has a
  hover rule under `@media (hover:hover)`, a pressed rule (1px down, `--dur-1`),
  a `:focus-visible` rule using `--focus-ring`, and an `[aria-disabled="true"]`
  rule. The reduced-motion block also stops `animation` on everything but `.spin`.
- **The docs follow the values.** The `--faint` and `--faint-deco` hexes in
  CLAUDE.md, `.claude/rules/ui.md` and ARCHITECTURE §4 change to `tokens.css`'s.
- **The mockup re-renders.** Every frame picks up the new values. Capture the
  dark phone and desktop frames of `telescope`, `queue` (lift), `planmonth`,
  `rebalance`, `path`, `session` and `palette`, list them in
  `design/mockups-index.md`, and close *Not shown* #11 (UX-X04).

**Extend `scripts/check-tokens.mjs`** (it stays one script inside `test:tokens`):

- **Elevation order** by relative luminance: dark `page < sunk < surface < raise
  < overlay`; light `sunk < page < raise < surface`, with `overlay = surface`
  (STYLE_GUIDE §6). The audit's N03 check wanted one order for both themes; the
  light values do not follow it, and the style guide's is the measured one.
- **Text tokens on every surface.** `--ink`, `--ink-2`, `--muted`, `--faint`,
  `--brand`, `--brand-ink`, `--ready`, `--blocked` and `--danger` clear 4.5:1 on
  `--page`, `--surface`, `--raise`, `--sunk` and `--overlay`, both themes.
- **Paired fills** in STYLE_GUIDE §6 clear 4.5:1 (the `-soft` pairs, the `--on-*`
  pairs, `--muted` on `--sunk`, the toast pairs).
- **Outlines.** `--faint-deco` clears 3:1 on `--surface`, `--raise` and
  `--overlay` (SG-D8).
- **Glass, worst case.** `--glass-bg` composited at its own alpha over `#000`
  (light) and `#fff` (dark): `--ink`, `--ink-2`, `--muted` and `--brand` clear
  4.5:1 on the result. `--ready` does not have to, and no rule may put
  `--ready` text on glass (SG-D12).
- **No sub-11px text** in `globals.css` or the mockup's `<style>` block: every
  `font-size` and `font` shorthand resolves to 11px or more.

**Check:** `npm run test:tokens` passes, and is proven to fail three ways: dark
`--sunk` set back to `#232935` (elevation), `--faint-deco` set back to `#98a1b0`
(outline contrast), and a `font-size:10px` rule added to `globals.css`. A test
parses `globals.css` and asserts every class in the state-matrix list above has a
`(hover:hover)` hover rule, an `:active` rule, a `:focus-visible` rule and an
`[aria-disabled="true"]` rule. `grep -oE 'border-radius:[^;]+' src/app/globals.css
| sort -u` returns only `var(--r-*)` values and `50%` (circles). Screenshot `/comics` at 360px in both
themes before and after: the layout is unchanged, only the values move.

### ☐ 1.8 App shell · M
Depends on 1.8a (tokens and control states).
The chrome every dashboard sits in. Split in two (R3-12): this task is the shell
(nav, redirect, sync pill, skeletons, markup rules); **1.8b** is the thumb bar and
the token contrast checks. Tab bar at the top on phone, a navigation rail on a
tablet, the sidebar on desktop (breakpoints below, D-33). `/` redirects
to the medium you last touched; `/comics`, `/books` and `/watch` are the
dashboards; the list screens move to `/comics/runs` and `/books/list`.
Tokens and classes are already in `src/app/globals.css`, and the token drift
(R0-08) is fixed there: `--faint #606979`, `--faint-deco`, `--blocked #8a560c`,
`--rule-2`.

**A stale session goes to `/login`, not a 500** (R2-11). Landed: `requireUserId()`
redirects and route handlers answer 401 through `apiUserId()`. This task keeps it
true for every new page and route it adds.

**The list screens keep R2's honest counts when they move** (S-L6). `/books`
becomes `/books/list` here and keeps what R2-06 and R2-08 fixed: one row per
book, the printed *500 of 1,478* total (never `books.length` alone), and the
*No year* chip. The comics run list keeps printing the real total beside any
limited list (R2-05). The query tests exist; this task adds a render test that
the printed total is the query's total, not the row count.

**Last-touched medium is a cookie** (R1-13), written by the three dashboard
routes and read in `/`'s route handler, so the redirect runs on the server with
no flash. Not `localStorage` (the server cannot read it) and not a column on
`users` (a write on every page view). No schema change.

**Nav renders only routes that exist** (R1-06). The phone search icon is 6.1,
Tracks is 5.2, Shelves is 5.1, Top books is 6.x, Stats is 6.2 and Settings is
2.0 — shipping the full chrome in Phase 1 means the most prominent control in
the phone header dead-ends for two phases. Drive both bars from one
`NAV_ITEMS` list with an `enabled` flag; a disabled item is not rendered at all,
and its task turns the flag on. Include the flip in each of those tasks' checks.

**A failed write is never silent** (R1-07). The offline queue is 6.4, so until
then an optimistic mark that fails **reverts the tick** and raises the error
toast with *Retry* — it does not stay green. The sync pill renders `online` and
`offline` only; the `queued` state and its per-row `queued` tag arrive with 6.4
and are not faked before then.

Chrome details, from the audit:

- **One phone bar**: `Ledger · Comics · Books · Watch` plus a 44px search icon
  (`aria-label="Search (Ctrl K)"`), `<nav aria-label="Media">`, current medium
  `aria-current="page"`, on every screen. No Home tab.
- **Desktop sidebar**, per medium: *Dashboard · Status · list · Add*, plus Runs
  and Tracks (comics), Plan · Shelves · Top (books) and Franchises (watch); a
  global `Inbox (N)`; neutral 16px line icons, never track hues.
- **Sync pill** (`online · offline · queued`, `role="status"`) in the header and
  sidebar footer; queued writes are shown, never silent (6.4 builds the queue).
- **Skeletons** at the exact dimensions of the telecard, run rows, plan rail
  and season rows, with the shimmer off under `prefers-reduced-motion`, for the
  Neon cold start.
- **Tokens**: the colour tokens landed (above), including the D-24 identity
  hues (`--t2` fuchsia, `--t3` lime, `--t4` gold) and the `--on-brand`,
  `--on-ready`, `--on-danger`, `--on-muted` and `--toast-link` tokens for text on
  a filled control (M-02). No component writes `color:#fff`; `npm run
  test:tokens` fails if `globals.css` does. Still to do here: per-medium
  accents `--m-comics/books/watch` on the active tab underline and `h1` kicker,
  a `.unit` badge beside each dashboard `h1`; genre hues split into `--g1`–`--g8`.
  Copy `--m-*` and `--g*` from `design/mockups.html` exactly; `test:tokens`
  checks every identity hue sits ΔE2000 15 or more from `--ready`, `--blocked`
  and `--danger` in both themes (D-24).
- **Markup rules**: a navigable row is `<article class="row"><a class="row-link"
  href>` with a stretched-link overlay and secondary buttons outside the anchor;
  segmented controls, chips and switches are real buttons; one `<h1>` per page;
  `.bar` is the app header only (meters are `.emeter`).

From the style guide (D-31; STYLE_GUIDE §7–§9, Review N):

- **Glass chrome, and only chrome** (SG §8, SG-D12). The sticky `.bar` and the
  desktop `.side` use `--glass-bg` with `backdrop-filter: blur(var(--glass-blur))
  saturate(var(--glass-sat))`, a 1px `--glass-edge` and `--glass-hi`; they fall
  back to solid `--surface` without `backdrop-filter` or under
  `prefers-reduced-transparency`. No `--ready` text on glass: the sync pill is a
  6px dot (`--ready` online, `--blocked` offline) plus `--ink-2` text. Rows, the
  telescope, the plan rail, badges, meters and the toast are never glass.
- **One sticky stack** (UX-N05, F1). `--bar-h` is the header's height (64px on
  the phone, 44px targets included). Nothing but `.bar` is sticky at `top:0`;
  everything else that sticks (the offline strip here, the era chips in 3.6, the
  run-list track headers in 2.9) sits at `top: var(--bar-h)` or below it.
- **Blue means position or the primary action, nothing else** (SG-D4, D6, D7).
  A selected filter chip is neutral inverse (`--ink` on `--page`); a selected
  segment is a raised pill (`--surface` + `--sh-1`) on a `--sunk` track; *All N*
  is a quiet `--brand` text link, not a filled pill; card kickers are mono
  `--faint` caps. Section heads `h3.s` are 12/16 600 caps `--ink-2`, count in
  mono 11 `--muted` (SG-D5).
- **Drawn icons** (UX-N09). One outline set at 1.5px stroke (Lucide or
  Heroicons), as an inline SVG `<symbol>` sprite, neutral `--muted`. The search
  control is a drawn magnifier, never U+26B2. The readiness glyphs `⊘ ○ ● ◐ ✓`
  stay text, pinned with `font-variant-emoji: text`.
- **Widths** (UX-N07, UX-N08, D-33). Four layouts, three breakpoints:

  | Width | Navigation | Content | Dashboard verbs |
  |---|---|---|---|
  | under 768px (phone) | top media bar + 44px search | one column | bottom thumb bar |
  | 768–1023px (tablet) | 72px navigation rail: the media switch, then the medium's items, each an icon over an 11px label (touch has no tooltips); no top media bar | one column; what the desktop puts in its side rail stacks below | bottom thumb bar |
  | 1024–1279px | sidebar collapsed to a 64px icon rail, a tooltip and `aria-label` on each | main column plus the side rail | page header, primary last |
  | 1280px and up | 224px sidebar | main column plus the side rail | page header, primary last |

  The run detail keeps the bottom thumb bar at every width (D-25). The width
  sets the default sidebar state; 6.14 adds the toggle that overrides it. 360px
  is drawn, not assumed: the media bar fits without truncating *Watch*. The
  desktop content column is centred, not pinned to the sidebar (S4). The mockup
  gains an 834px tablet frame for `home`, `spine`, `bdash` and `status`, and a
  360px frame for the same four.

**Check:** screenshot at 360px, 834px and 1280px; assert no horizontal scroll
exists at any of them. At 834px the page renders the navigation rail, no top
media bar and no sidebar; each rail item shows a visible text label and is at
least 44px tall; every dashboard renders `.actionbar`. At 1100px the sidebar is
64px wide and each item has an accessible name. At 360px *Watch* renders untruncated in the media bar, and the
phone `/comics` has at most one solid `--brand` fill above the fold. No computed
`color` inside `.bar` or `.side` equals `--ready`. With the page scrolled 400px,
every sticky element other than `.bar` has a computed `top` of at least
`--bar-h`. The rendered HTML contains no U+26B2. Test that `/` redirects to the last-touched medium and to
`/comics` for a user with no history. Test that every phone route renders
exactly the same media nav. Test that a request carrying a garbage `rt_session`
cookie redirects a page to `/login` and answers a route handler 401 (R2-11). An
axe-core run over each dashboard reports no `nested-interactive`, `button-name`
or `link-name` violations.

### ☐ 1.8b Thumb bar and contrast · S
Depends on 1.8. Split out of it (R3-12).

The **thumb bar**: on every dashboard **and on the run detail** (`Mark #141 read ·
Mark through… · +`, FEATURES 2c → Run detail); this task owns the component
and its placement on both, 1.1 fills *Mark through*. The left slot is always
the medium's mark verb (`Mark #141 read`, `Log progress`, `Mark S2 watched`); `.btn` in it is 44px, `.iconbtn`
and the sheet close are 44px. `+ batch` opens the **batch sheet**: *Mark next
N* (stepper), *Mark through…*, *Log a session*. The undo toast is
`role="status" aria-live="polite"` and lasts 8 seconds, paused on hover or
focus.

`.actionbar` is fixed to the bottom of the viewport with a 44px minimum target and
`env(safe-area-inset-bottom)` respected.

**Slots** (D-25): 1 is the medium's mark verb, primary; 2 is the medium's second
verb (`+ batch` comics, `✓ finished` books, `+ Add` watch; `Mark through…` on the
run detail); 3 is search (`aria-label="Search (Ctrl K)"`) on dashboards and the
status screen, `+` *Add issues* on the run detail. **At 1024px and wider the
three dashboards move the same verbs into the page header, primary last, and
render no bottom bar; the run detail keeps the bottom bar at every width.** A
tablet (768–1023px) keeps the bottom bar on the dashboards too: it is a touch
device held in two hands (D-33, amending D-25's 900px).

**The mark verb names the issue, never the reading-order position** (M-10):
*Mark #141 read* is allowed only when the run spans one series; otherwise the
full label, *Mark X-Men (2019) #8 read*, truncated with a `title`. The same
rule applies to *Resume* on the run hero.

From the style guide (D-31; STYLE_GUIDE §9, Review N):

- **The bar.** Glass, like the header (1.8). The primary slot is `flex:1`, 44px,
  `--brand` / `--on-brand`, and truncates with an ellipsis; `+ batch` is 44px
  with a 1px `--rule-2` ring; search is 44×44 with the drawn magnifier.
  `padding-bottom: max(12px, env(safe-area-inset-bottom))`, so the Android
  gesture bar never covers the verb (F2).
- **The toast sits above the bar, one at a time** (UX-N05, F3). It is pinned at
  `bottom: calc(var(--actionbar-h) + 8px + env(safe-area-inset-bottom))`. A new
  toast replaces the old one and commits the old one's action. It uses
  `--toast-bg` / `--toast-ink` with Undo in `--toast-link` 700 (SG-D3), and a 2px
  `--brand` countdown bar runs along its bottom edge over the 8 seconds and
  pauses with the timer.
- **The mark sequence** (UX-N21). The `.chk` scales .92→1 as `--ready` fills
  (`--dur-2`), the ✓ draws in, then the spine `.emeter` and the telecard's run
  segment grow (`--dur-4`, `--ease-out`) and the `n / N` count ticks in
  tabular numerals with no layout shift. No bounce, no confetti. Under reduced
  motion every step is instant.

**Check:** screenshot at 360px; assert the primary action button is within the
bottom 96px. At 360px the toast's bounding box does not intersect the primary
`.actionbar .btn`; two marks in a row leave exactly one toast on screen and the
first mark committed. Under emulated `prefers-reduced-motion` the `.chk`'s
computed `transition-duration` is `0s`. `getComputedStyle` reports at least
44px for every `.actionbar .btn` and `.iconbtn`, and a contrast script reports at least 4.5:1 for every
rendered text node's computed colour against its computed background (not a list
of token pairs: a literal `#fff` on `--brand` is 2.51:1 in dark mode, M-02) and 3:1
for the unchecked control ring, in both themes; `npm run test:tokens` passes. At
1280px no dashboard renders `.actionbar` and the header holds the primary verb; at
834px every dashboard renders it, with the primary action inside the bottom
96px; the run detail renders it at all three widths. On a fixture run spanning two series the
thumb bar's verb contains the series name.

### ☐ 1.10 Comics Up next queue · M
Requirement change, Sept 2026. ARCHITECTURE 2.16, FEATURES Part 2i. One
ordered list of runs per user, open-ended: add, reorder, remove. No years,
quarters or capacity — do not add them. Mockups: "Comics — v4" (the Up next
section) and "Status — in flight, up next, done". Depends on 0.8.

- `run_queue(user_id, run_id, ordinal, added_at)`, with primary key
  `(user_id, run_id)` and `UNIQUE (user_id, ordinal) DEFERRABLE INITIALLY
  DEFERRED`. Ordinals are contiguous from 1. Reorder and remove rewrite them in
  one transaction.
- `run_queue_state` view: the queue joined to `run_progress` and
  `run_readiness`, carrying state (`unstarted` / `reading` / `read`),
  readiness and the blocked-by count. The dashboard and the status screen both
  read it.
- **Add** from the run detail (*+ Up next*, which appends, and *Read next*,
  which goes to the top), run-list rows, the dashboard's *Unlocked and waiting*
  rows, and the status screen's *Ready, not queued*. A run that's already
  queued shows *In Up next · #3* rather than the button. Placeholder and
  soft-deleted runs can't be queued.
- **Reorder** by drag handle (long press on the phone) and *Move to top*.
  **Remove** from the row menu, with the 1.2 undo toast.
- **Dashboard:** an *Up next* section between *Also in flight* and *Unlocked
  and waiting*, showing the first five unstarted queued runs, *Start* on the
  first and *All N* to the tab. Each row is **the same queue row** as the
  status tab (M-08): the named `button.drag` reorder handle and the `⋯` row
  menu, so the dashboard's queue is keyboard-operable too. When the queue is empty: "Nothing queued —
  pick from N ready runs" (N computed, see 2.4), which links to *Ready, not
  queued*.
- ***Start* navigates, it never writes** (R1-08). It goes to
  `/comics/[runId]#p-1` — the run's first unread placement. The only controls
  that write progress are the spine's `.chk` and the thumb bar's mark verb, so a
  mistap on the dashboard cannot silently start a run. (Watch's equivalent is
  named for its target, *Start S1*, 8.7.)
- Starting or finishing a queued run changes nothing in `run_queue`. The view
  moves it between tabs, and unmarking a run back to zero restores it to its
  old place.

The queue is keyboard-operable: the drag handle is `<button class="drag"
aria-label="Reorder Simonson — Thor, position 2 of 12"
aria-describedby="dnd-help">`; Space lifts, arrows move, Space drops, Esc
cancels, announced through an `aria-live` region. The row menu offers *Move to
top · Move up · Move down · Remove*. Below the queue, *Ready, not queued* is its
own group with **+ Up next** per row. Mockup: `queue` (Up next, lifted row with menu, Done → Stopped, empty queue).

**Check:** adding three runs gives ordinals 1–3; *Read next* on a fourth puts it
at 1 and shifts the rest; moving #3 to the top gives a contiguous 1–4; removing
#2 leaves 1–3 with no gap, and undo restores the exact prior order. Marking one
placement of a queued run moves it out of the dashboard's Up next and into In
flight while its `run_queue` row is unchanged. Queuing a blocked run succeeds
and `run_queue_state` reports its blocked-by count. Queuing a placeholder is
rejected. Two concurrent reorders never leave duplicate ordinals. The documented
keyboard sequence (Space, Down, Down, Space) moves a row from position 2 to 4
with contiguous ordinals, and Esc mid-lift leaves the order unchanged.

### ☐ 1.9 Status screens: In flight · Up next · Done · M
Requirement change, Sept 2026. ARCHITECTURE §4. `/comics/status` and
`/books/status`, a single component with three tabs in this order and with these
names. The tab is in the URL (`?tab=inflight|next|done`). Film and TV follow in
8.8. Mockup: `design/mockups.html` → "Status — in flight, up next, done".
Depends on 0.8a, 1.8 and 1.10 — build the queue first.

| Tab | Comics | Books |
|---|---|---|
| In flight | Runs partly read, most recently touched first, each with its resume pointer (1.6) and a one-tap *Read #N* | `book_status = reading`, with words left |
| Up next | The queue (1.10) in your order, unstarted runs only, draggable. Then *Ready, not queued*: `ready_all` then `ready_hard` runs in track → block order, each with **+ Up next**, cost and leverage once 2.6 lands | The plan by level (D-37): each quarter in date order, its rows in `ordinal` order and reorderable with 1.10's queue row — the named `button.drag` handle and the `⋯` menu (*Move to top · Move up · Move down*) — within that quarter only (moving elsewhere is 2.3's sheet); after a year's quarters, its bare-year lane (unordered, by title; grey until 2.8); then **On deck** (unordered, by title). Someday is not listed: a closing row, *Someday · N books*, opens the master list's *To read* filter at that level |
| Done | Finished runs, latest `run_state.finished_at` first, **undated last** (`NULLS LAST` — every pre-cutover read is precision `none`, S-14) | `read`, grouped by year finished, *No year* last; DNF collapsed under *Stopped* |

Every progress meter fills with `--ready` (D-26), on this screen and every other;
there is one `.meter` style.

**The master list learns the levels.** For the *Someday* row to land somewhere,
this task gives `/books/list`'s *To read* filter a level control — *All ·
Quarter · Year · On deck · Someday* — read from 1.7's `to_read_level`, with
`?level=` in the URL.

Each tab label carries its count. Apart from the queue's order and each
quarter's order, nothing is stored; every row comes from `run_queue_state`,
`run_progress`, `run_readiness`, `plan_period`, `to_read_level` and
`book_status`. The dashboard headers *Also
in flight*, *Up next* and *Unlocked and waiting → All N* link to the matching
tab, N computed.

**The bare-year lane is neutral until 2.8** (R1-10). Amber means a decision you
have not made, and it must clear when you make one — but nothing in Phase 1 can
give a plan row a quarter (2.3 is the picker, 2.8 is the bulk flow). So in this
task the lane renders grey with its count and no button. It turns amber and
gains *Place them* when 2.8 lands; put the flip in 2.8's check.

Tabs are `role="tablist"` links (`<a role="tab" href="?tab=next"
aria-selected>`) with arrow-key navigation. The resume button is labelled with
its target (*Read New Mutants (2019) #9*), truncated with a `title`. DNF and
dropped items sit in a collapsed `<details class="stopped"><summary>Stopped ·
3</summary>` at the foot of Done. Every tab has an empty state with exactly one
primary action (FEATURES Part 2c). Books *Up next* is empty until a book is put
On deck (1.7) or planned (2.3): the plan starts empty (D-13), and 1.4c alone adds
only to Someday. So its action in this task is **Add a book** (the 1.4c sheet),
never a link to a picker that does not exist yet; 2.3 changes it to *Plan a
book* (S-L5).

**The tab strip** (STYLE_GUIDE §9, UX-N22): 44px tabs, counts in mono 11, the
selected tab `--ink` 600 with a 2px `--m-*` underline, the rest `--muted` 500.
The underline is one element per tablist that slides between tabs (`--dur-2`);
under reduced motion it moves without easing. **Every tab's empty slate is
drawn** (UX-X07): nine in all, three per medium, each with the FEATURES Part 2c
copy and one primary action. The mockup has comics' three; this task adds
books' three and 8.8 adds watch's, closing *Not shown* #6.

**Check:** seeded test: a run with 3 of 10 placements read is in In flight and
not in Up next, even if it is queued; queued unstarted runs appear first, in
queue order; a ready run that isn't queued appears under *Ready, not queued*
and not above it; a queued blocked run appears in the queue with its amber
badge; an unqueued blocked run appears in neither section; a run with all placements read
is in Done; a run whose issues are all read *in other runs* is not in Done
(0.8); a run finished with undated reads sorts below one finished last week. A book planned `2027` appears after 2027's quarters and before
On deck, with no drag handle. Three books planned `2027-Q1` render in ordinal
order, and the keyboard sequence (Space, Down, Space) on the first leaves that
quarter at a contiguous 1–3 with it second; a lift never carries a row into
another quarter. A `to_read` book with no plan row is not on the tab, is counted
in *Someday · N books*, and appears when that row opens the master list at
`?status=to_read&level=someday`.
A DNF book appears only under Stopped. Tab counts equal row counts.
Each tablist contains exactly one underline element. Screenshot at 360px,
including every empty tab.

### ☐ 1.11 Slow down failed sign-ins · S
`POST /api/login` compares the passcode and answers at once, so nothing slows
a guessing loop (R2-12). D-23 made a four-or-more-word `APP_PASSCODE` the
defence and ruled out a throttle task. The owner reversed that half on
2026-10-02 (D-36). **Built in Phase 1's last sitting, with 2.11a, before
cutover**: from Step 14 the database is the only record. Today every
deployment, production included, also sits behind Vercel Authentication
(START-HERE 10e); this task must not assume that stays on.

- A failed sign-in waits one second before its `303` to `/login?error=1`. The
  wait is the same for a wrong passcode, an empty one and a wrong-length one.
  A correct one is never delayed.
- Stateless: the wait lives in the route handler, never in an in-memory
  counter, which a serverless instance does not keep and another instance
  never sees. Parallel requests can still guess in parallel, and the passphrase
  stays the defence against that. A per-client lockout would need a table: a
  schema change, so ask the owner first, and it is not part of this task.
- 6.13 replaces the passcode with real sign-in and keeps this delay on every
  failed credential.

**Check:** a vitest drives the route handler with fake timers. A wrong
passcode's response is still pending at 999 ms and resolves at 1000 ms, to
`/login?error=1` with no `rt_session` cookie. An empty one and a wrong-length
one behave the same. A right passcode resolves without advancing the timers
and sets the cookie. No test waits on a real clock.

---

## Phase 2 — The pace engine

### ☐ 2.0 Settings · S
R1-05. The screen that owns `reading_settings`, and the reason 2.1 onward have
inputs at all. Nothing in any phase built it, and it was missing from
ARCHITECTURE's route table; every capacity figure on the books dashboard, the
plan rail, the move sheet and the rebalance sheet reads from it, so without this
they are stuck on a seeded guess. Mockup: `settings`.

`/settings`: minutes a day and words a minute. There is no plan granularity:
the plan is quarters only (D-38), and 1.7 drops `plan_granularity`. The 0.3
migration creates the table; this task seeds one row per user (45 min/day, 185
wpm — the workbook's figures) and lets it be edited. Controls are real (FEATURES 2c → Settings): the minutes stepper is two
labelled buttons around an `<output>`, switches are `role="switch"`. The volume
map line reads *67 rules · 61 series*. They look as STYLE_GUIDE §9 draws them: a
36×20 switch (on: `--brand` track, `--on-brand` knob; off: `--sunk` with a
`--faint-deco` ring and a `--muted` knob) in a 44px row; a `role="group"` stepper
of 32px buttons on `--sunk` with a mono `<output>`.

Later tasks extend this screen and do not create it: 2.1b adds *Measured from
sessions* and **Use these**, 6.11 adds the density toggle. (2.7's stretch-year
acceptance is its own `plan_acceptance` table and banner, not a Settings field —
R3-14.)

**Check:** test that a user with no row gets the seeded defaults and that 2.1's
capacity view reflects an edit — changing 45 to 60 min/day moves the 2027 figure
— without a redeploy. The stepper is a button group with an accessible name, and
the page has one `<h1>`.

### ☐ 2.1 Capacity view · M
Depends on 1.7 and 2.0.

`reading_settings` (minutes/day, words/minute) plus a view summing planned word
counts per year and per quarter against capacity. A bare-year row counts against
its year and no quarter; On deck and Someday count against nothing (D-37). Word counts
missing a `stated` value fall back to `page_count × 275`, marked `estimated`.
Annual capacity is minutes/day × words/minute × the days in the year (45 × 185
× 365 = 3,038,625 words; a quarter is a quarter of that, ≈ 760k).

**Check:** test with 45 min/day at 185 wpm over 2027 and a fixture plan of
3.58M words returns 118% ± 1% (3,585,000 / 3,038,625), and reports what share
rests on estimates. (The check once said 4.1M, which is 135%: S-06.)

### ☐ 2.1b Reading sessions — after-the-fact entry · S
Depends on 2.0.

**Scope cut by D-8** (was M). The point of this task is honest *input* to the
capacity engine: two numbers the owner typed once, replaced by observed ones.
That needs a way to record a session and a way to apply the result — not a
timer. The start/stop timer, the timer chip and the *Tonight* card defer to
**6.12**, which keeps the argument and drops the surface area.

In scope: a session sheet with an **after-the-fact minutes entry** ("read 35
minutes"), attach-to (book or run) and a delta (pages or issues); `/session`;
Books' *Log progress* and the batch sheet's *Log a session* open it.
`Recalculate from sessions` in Settings (2.0) replaces the typed wpm and
minutes/day with observed values behind an explicit **Use these**, and the
capacity card flags when the setting has drifted from reality. Mockup:
`session` — build the right-hand entry path, not the timer. FEATURES.md #20.

Out of scope, deferred to 6.12: the start/stop timer and its persistence, the
**timer chip** in the thumb bars and sidebar footer, the **Tonight** fit card,
and *Estimated time to finish* on the run hero and in-flight rows. Those last
two were already gated behind "at least five sessions exist", so nothing
regresses by moving them: with no timer there is no runaway-session problem to
solve in HORIZON (R1-12 defers with them).

**Check:** test that 10 sessions totalling 400 minutes over 20 days with known
word counts computes minutes/day and wpm within 1% of hand-calculated values,
and that Settings shows the drift rather than silently overwriting — **Use
these** is the only thing that changes the stored setting. A session entered
with implausible minutes still saves but is shown, not hidden, in the
*Measured from sessions* list.

### ☐ 2.2 Books dashboard · M
Five slots in this order, per `design/mockups.html` → "Books — v4": reading now;
the plan rail; the unplaced-entries card; capacity; the year so far. Depends on
1.7, 1.8 and 2.1. Split (R3-12): **the plan rail is its own task, 2.2b**; here it
is a placeholder slot in the right position, so the five-slot order is real.

- **Reading now** — cover, word count, words left, and time left expressed in
  evenings at the user's own session length. Never a date. **Before any sessions
  exist** the evenings figure comes from the 2.0 setting (45 min/day at 185 wpm)
  and says so in the `.prov` line — *at your set pace*; once 2.1b has sessions it
  reads *at your measured pace*. It is never blank and never hidden.
- **The plan rail** — slot in position two; built in 2.2b.
- **Unplaced entries** — a `.decide` card, amber, with "Place them" (task 2.8).
- **Capacity** — the 118% figure, its assumptions stated underneath, genre
  breakdown, and the overage segment hatched rather than red. Rebalance and
  Accept are buttons here (task 2.7).
- **The year so far** — four figures and one link to stats. Nothing else.

**The capacity number is amber past 100%, never red**, and the word "behind"
does not appear anywhere on this screen.

**Check:** screenshot at 360px and 412px — no horizontal scroll, the capacity
rule and every quarter label legible, the primary action inside the bottom 96px.
The plan-rail assertions live in 2.2b. Nothing on the screen resolves to `--danger`.
Empty state: with nothing reading, the hero offers *Start the first Q-current book*:
the current quarter's lowest-ordinal book that is still `to_read` (D-37), named
on the button.

### ☐ 2.2b The plan rail · M
Depends on 2.2 (the slot) and 1.7. Split out of 2.2 (R3-12).

A quarter is a column, a book is a block sized by its word
  count, and a dashed rule across all four columns is the quarterly capacity
  (760k at the current settings). Blocks stack from the foot of the column in
  the quarter's `ordinal` order (D-37), so the cumulative total crosses the rule
  at the end of your order: blocks whose cumulative total crosses the rule are
  hatched, and they are always the books you ranked last. Every block is a `<button>` with an accessible name (*Piranesi, 65k
  words, estimated, Q1 2027*) and at least a 24×24px hit area, merging sub-24px
  neighbours into a `+N · Nk` stack button; estimated counts (`data-wc="estimated"`)
  have a dotted top edge and a `~` prefix, with a legend tag. There is no month
  layout (D-38). A fifth lane behind a dashed border holds `plan_period` rows
  whose period is a bare year; it has no order (D-37) and stacks largest at the
  foot. On deck and Someday are not on the rail, because they count against no
  capacity. Tapping a block opens the picker sheet from 2.3.

**One rail markup** (M-07), the same on the dashboard and the plan page (2.10): `button.qb` with the book's genre hue in `--hue` (one book, one
hue), `.over` for a block past the rule, `.un` for a fifth-lane entry (a button,
not decoration), `data-wc` for estimated counts. No inline fills. Quarter footers
carry an amber *over Nk* badge or a grey *Nk room* badge — never green (M-06).
**On the phone the footer shows only the amber overage** (`+132k`); the grey
room badge is desktop only, because *56k room* wraps in a 62px column (SG-D11).

**Geometry** (STYLE_GUIDE §3; `design/Plan Rail Spec.dc.html` A4.1, A4.2): the rail
is 230px tall on the phone and 300px on desktop, scaled so 1000k fills a quarter
column; columns sit 6px apart on the phone, 10px on
desktop. The fifth lane is 52px on the phone and 150px on desktop (*2027 · no
quarter*), with a 1px dashed `--blocked` left border and `.un` blocks in
`--blocked-soft` with a dashed `--blocked` ring. A block is radius 3 with a 3px
`--hue` left edge on `--reading-soft`, gap 2. Only **the part of a block above
the rule** takes `--hatch` over `--blocked-soft`, and that block's ring turns
`--blocked`; its label sits on a `--surface` chip over the hatch. The capacity
rule is 1.5px dashed `--ink-2`. Two or more adjacent sub-24px blocks merge into
one stack button (`--raise`, dashed `--faint-deco`, `+N` over `Nk`, height the
sum or 24px, whichever is larger); a lone sub-24px block keeps its drawn height
and gets a 24px `::after` hit area.

**Check:** a quarter whose books total 892k against a 760k capacity renders
exactly the blocks past 760k as hatched, and those are the quarter's highest
ordinals; moving the last hatched book to the top of the order renders it plain
and leaves the quarter's total unchanged. A book with `period = '2027'`
renders in the fifth lane and in no column. A block straddling the rule is
hatched above the rule and plain below it. Every interactive element inside
`.planrail` measures at least 24×24 CSS px, an estimated book renders the dotted
edge and `~` label, the rail renders without horizontal page overflow at 360px,
and no *Quarter | Month* control renders anywhere. At 360px no quarter footer renders a *room* badge; at 1280px an
under-capacity quarter does. Nothing resolves to `--danger`. Screenshot at 360px
and 412px.

### ☐ 2.3 Plan editor · M
Depends on 1.7 and 2.1.

One picker sheet, three entry points: **Move** on a plan-page row, **Plan
for…** in the master list, and **Year or quarter…** when adding a new book (same
sheet, minus the "currently planned" badge). Mockup: `design/mockups.html`,
"Move / add to plan".

Sheet contents: the four to-read levels (D-37). One row of chips: the next five
years, then **On deck** and **Someday**. Choosing a year opens a second row:
**No quarter yet** (a bare-year entry) and **Q1–Q4**. There is no month step
(D-38). Each year and quarter chip shows that period's current word total so the
choice is made with the budget visible, not checked after the fact. A live
preview card shows the target's total after the move (Q3 with a 118k book: *533k
of 760k*) and turns **amber** if it would go over capacity (*Q1 → 1,010k of 760k
· over 250k*), offering *Accept as a stretch year* — never red. The mockup's
Q1–Q4 chips (892k, 704k, 415k, 268k) are sample data; the seed has no plan
(D-13), so tests build their own. **On deck** and **Someday** skip the quarter
row and show no budget, because neither counts against capacity. **Someday**
is how a book leaves the plan: it deletes the plan row and keeps the book
`to_read`, never deletes the book, and pushes an undo entry onto the 1.2 stack
like every other row-removing action. The primary button names the target
(*Move to Q3 2027*, *Move to Someday*).

**Order (D-37).** Every write goes through 1.7's helpers: a book placed in a
quarter, from Move or from *Year or quarter…*, joins the **end** of that
quarter's order, and a quarter it left closes up. Bare-year and On deck entries
take no position. The sheet does not ask for one; a quarter's order is changed
on the Up next tab (1.9). Undoing a move restores the exact prior order.

**Check:** test that moving a 150k-word book from 2027 Q1 to 2028 Q2 changes
both periods' totals correctly and that the preview reflects the destination
period before the move is confirmed. The moved book takes 2028 Q2's last
ordinal, 2027 Q1 stays contiguous, and undo puts it back at its old position.
Test that On deck and Someday need no year or quarter; that Someday clears the
book's `reading_plan` row without touching `book_status`; that *No quarter yet*
writes a bare year; and that the sheet writes one `period` value, never a year
independent of a quarter and never a month. **Flip (R3-08):** 1.4c's add sheet
now offers *Year or quarter…* through this picker, and adding a book to a year
or quarter writes its `book_status` and `reading_plan` rows in one transaction;
1.9's empty Books *Up next* action becomes *Plan a book*.

### ☐ 2.4 Comics dashboard · L
Five slots in this order, per `design/mockups.html` → "Comics — v4": the
telescope (2.5); also in flight; **up next** (the queue from 1.10, first five);
unlocked and waiting, each row with **+ Up next**; rest of this block; the
frontier (2.6). Depends on 1.6, 1.8, 1.10, 2.5b and 2.6.

Candidate run rows carry **cost and leverage**, not tier: "costs 44 · opens 2",
and an owned-edition tag where one exists. Blocked runs keep the amber badge
stating what is missing. There is no progress bar against the catalog anywhere
on this screen; the 76-of-10,285 figure appears once, in `.prov` grey, at the
foot — at every width, never in the lede (M-12).

**`<RunStateBadge state hardLeft softLeft>`** (`src/components/RunStateBadge.tsx`)
renders the five states of the `run_state` view (already in `etl/views.sql`)
everywhere a run appears — dashboard, run list, status, search, queue — with a glyph as well as colour and an `aria-label`
with the full sentence (ARCHITECTURE §4):

| State | Badge | Colour |
|---|---|---|
| `blocked` | `⊘ N runs first` | amber |
| `ready_hard` | `○ ready · N soft unread` | green outline |
| `ready_all` | `● ready` | green fill |
| `reading` | `◐ n / N`, no prerequisite badge | blue |
| `read` | `✓ read · date`, or `✓ read` when `finished_at` is NULL (undated reads, S-14) | grey |

Badges are mono 11/14 600, radius 6 (`--r-sm`), 4×8 padding; `blocked`,
`ready_hard` and `read` carry a 1px ring, and `blocked` is a button that opens
*Why blocked?* (STYLE_GUIDE §9). The telecard itself is radius 16, a 1px `--rule`
ring, a 3px identity stripe and `--sh-1`, no longer `--sh-2` (UX-N04); its kicker
is mono `--faint` caps (SG-D7, UX-X06).

The frontier tile *one soft prereq short* takes the `ready_hard` outline. The
telecard's foot row, when the next block has no name, shows *Block 3 has no name
yet* with a **Name it** button. Empty state: with no queue, *Pick from N ready
runs*; with no run in flight, the telecard shows the track rail and *Start the
top of Up next*; with neither a run in flight nor a queue, the telecard's one
action is *Pick from N ready runs*, linking to *Ready, not queued* (M-11, mockup
`states`). Also on the dashboard: a "Since Tuesday: 14 issues marked, 1
book finished" line and the inbox chip.

**Every readiness count is computed** (R1-02, D-7). *Unlocked and waiting → All
N*, *Pick from N ready runs* and the frontier tiles take their numbers from
`run_state`; no literal appears in copy. The reviewed mockups say 41, but in the
current extract **most runs carry a hard prerequisite** (172 of 258 were
`blocked` on 2026-09-23 — a snapshot, not a number to test against), so
*Unlocked and waiting* is a much shorter list than the mockup draws. That is a
data fact, not a layout change — the slot keeps its position and its design, and
the list should grow once the prerequisite audit (2.11a + OWNER-CHECKLIST, D-20)
reclassifies over-hard edges.

**Check:** screenshot at 360px. Test that a run whose readiness is
`ready_hard` renders the green-outline `○ ready · 1 soft unread` badge and still
appears in Unlocked and waiting; that a blocked run appears only in the dimmed
state with its true cost; and that no element on the page renders `--danger`.
Snapshot test of `<RunStateBadge>` for all five states, driven by a fixture
that puts one run in each state (never by naming a real run — the seed moves
under the audit, S-11): the `ready_hard` run renders outlined green, the
`blocked` one amber, an undated `read` run `✓ read` with no date, and no
`reading` row carries a prerequisite badge, and the telecard's `reading` badge is
`◐ n / N` like every other (M-04). The phone and desktop telecard badge
markup is identical. At 1280px the page text contains the catalogue total once.
With no run in flight and an empty queue, the telecard's button links to *Ready,
not queued*.

### ☐ 2.5 The telescope · M
Split (R3-12): **2.5 is `layout.ts` and its unit tests** (pure geometry, no DOM);
**2.5b** draws the rails and the ladder from it. The comics "now" slot: three
**horizontal** rails stacked top to bottom — the track's blocks, the block's runs,
the run's issues — with brackets connecting the highlighted cell of each rail to
the full width of the next. A head marker sits at the resume pointer.
Underneath, a ladder naming what the picture shows: track and block ordinal,
block name and run ordinal, run and issue position. DIAGRAMS 3b.

**Horizontal at every width, phone portrait included** (D-31, SG-D1). A rail is
a `role="slider"`, and on a phone a vertical rail's drag is the same gesture as
page scroll; a horizontal one has no competing gesture, takes about 124px of
height instead of about 354, and moves *Also in flight* above the fold. The
algorithm does not change; the axis does. Spec: `design/STYLE_GUIDE.md` §2,
drawn in `design/Telescope Spec.dc.html` (A1.1–A3.3) by `design/Telescope.dc.html`,
whose `alloc()` is the reference implementation to port.

**No new tables and no new views.** `block_progress` ordered by `block_number`
is the track rail; `run_progress` joined to `block_position` and ordered by
`run_ordinal` is the block rail; `run_progress` plus the resume pointer is the
run rail; `block_position` supplies both ordinals for the ladder.

The real work is legibility, not data: a minimum cell width so a 6-issue run
beside a 381-issue one does not vanish, ruler ticks on the issue rail at a
readable interval rather than one hairline per issue, and a run with no block
falling back to a two-rail view without breaking (the 2026-09-23 extract has
none, so the tests build one).

**Geometry** (ARCHITECTURE §4, DIAGRAMS 3b) lives in
`src/components/telescope/layout.ts`, exporting
`allocate(counts, W, gap = 2, min = 14)`, `overflow(counts, head, W, gap, min)`
and `niceStep(total, W)`. Both layout functions return items with an `x` and a
width `w`: a cell `{ i, x, w, floored }`, or a stub `{ stub: true, from, to,
count, sum, x, w }`.

- `W` is the rail's width: the frame minus page gutters, card padding and the
  rail-key gutter (`--tele-gutter`, 44px phone / 72px desktop). It is 250px at a
  360px frame, 282 at 390 and 832 at 1000.
- `min` is 14px on the phone, 16px on desktop (`--tele-min`). Each cell gets
  `min`, then a proportional share of what remains:
  `w = min + count/total × (avail − n·min)`, `avail = W − gap·(n−1)`.
- A cell is **floored** when its proportional share, `count/total × avail`, is
  under `min`: it is drawn wider than its data, and says so (SG-D10).
- When `n · min > avail`, `overflow` keeps the head cell and two neighbours
  either side (the window shifts at an edge so five are always kept) at `min`
  or wider and folds the rest into at most two stubs, one before and one after,
  each `min` wide. A stub carries its run or block count and summed issue count
  as data; they are rendered in its accessible name, the ladder and the popover,
  not as inline text (SG-D9).
- Ticks are `niceStep(total / floor(W / 6))` from 1, 2, 5, 10, 20, 50, 100, a
  major tick every fifth, and the legend prints the computed value.
- Read state is run-length segments read from the `run_read_segments` view
  (`etl/views.sql`: `is_read`, `from_ordinal`, `to_ordinal`, `len`, already built
  and tested); `src/db/queries.ts` only selects from it. A second grey dashed
  layer marks placements `issue_read_runs` reports read elsewhere, which arrives
  with 0.8 (that task changes the view's predicate to the placement).
- The head label reads `42 / 381 · #141`, ordinal first, on the rail and in the
  ladder.
- **Inline labels are fitted, not squeezed** (STYLE_GUIDE §2.4). Candidates are
  tried longest first (track: `1 · Foundations` → `1`, an unnamed block `block 3`
  → `3`; block: `Claremont · 381` → `Claremont` → `381`) and the first whose
  `chars × 5.9px` (sans) or `× 6.7px` (mono) `+ 12px` fits is used; if none fits
  the cell has no text and its name lives in the ladder, the `<title>`, the
  `aria-label` and the popover. `layout.ts` exports the fitter as `fitLabel`.
- Text is HTML or CSS-px (11px minimum), colours are classes, the `<svg>` has a
  `<desc>`, the ladder is `role="list"`. Each cell is an `<a href>` with a
  `<title>`; each rail is a `role="slider"` that scrubs by drag and arrow keys
  and navigates to `/comics/[runId]#p-[ordinal]` on release. The ordinal is the
  one `run_read_segments` numbers by (`ROW_NUMBER` over live placements by
  `sequence`), and the spine row with `id="p-[ordinal]"` shows the same number
  in its ordinal gutter (3.6b), so the reader lands on the number they scrubbed
  to.
- Variants: `data-rails="2"` (no block), `data-state="empty"` (no run in flight),
  the fully-read run, and the 641-issue Krakoa density. Their rules are in
  ARCHITECTURE §4 *Rail count and fallbacks*.
- Coarse-rail header: **TRACK · prerequisite order** (watch, 8.7: **FRANCHISE ·
  release order**).

**Check:** unit tests for `layout.ts`, fixtures built in the test:
(a) `allocate([6, 381], 282, 2, 14)` gives widths 17.9 and 262.1 (±0.1) and marks
the 6-issue cell floored; at `W = 832, min = 16` it gives 28.4 (still floored)
and 801.6.
(b) A 60-cell rail at `W = 282` with the head at index 27 renders exactly five
cells (indices 25–29) and two stubs, the first folding 25 cells and the second
30, each stub's `sum` equal to its folded counts' total; with the head at index 0
it still keeps five cells and folds the rest into one stub.
(c) Widths plus gaps equal `W` ± 0.5px for every rail in (a), (b) and the
seven-block track `[664, 214, 301, 268, 352, 211, 170]`.
(d) `niceStep` returns one of 1, 2, 5, 10, 20, 50, 100: 10 for 381 issues at
`W = 282`, 5 at `W = 832`, 20 for 641 at `W = 282`.
(e) `fitLabel` returns `1 · Foundations` for a 120px cell, `1` for a 20px one,
and the empty string when not even the number fits.

### ☐ 2.5b The telescope — SVG and ladder · M
Depends on 2.5 and 0.8a. Draws the three rails and the ladder from `layout.ts`'s
output, with the head marker, read-state segments and the variants listed in
2.5, as STYLE_GUIDE §2.1 and §2.5–§2.8 specify:

- **Geometry sheet.** Tier rails (track, block) are 18px tall on the phone and
  20px on desktop (`--tele-rail`); the run rail 24 / 28 (`--tele-run`); brackets
  16 / 20 deep (`--tele-bracket`). Cells are radius 3 (`--r-cell`) with a 1px
  inset `--faint-deco` edge on `--sunk`. The rail keys *TRACK · BLOCK · RUN* sit
  in the fixed left gutter, so no label can collide with a bracket.
- **Head.** The head cell gets a 1.5px inset `--brand` ring plus `--halo`, the one
  glow in the system. On the run rail the head is a 2px `--ink` line running 4px
  above and below the rail with a 2px `--surface` halo, and a 20px pill (mono
  11/20 600, `--brand-soft` / `--brand-ink`, 1px `--brand` ring) centred on it and
  clamped inside the rail.
- **Brackets** are trapezoids from the head cell's edges to the full width of the
  rail below: `--brand` at 8% fill, 1px edges at 50%, `aria-hidden`.
- **Segments.** A read segment is full rail height in `--ready` with 3px outer
  corners; a read-elsewhere placement is an inset box (3px top and bottom) with a
  1px dashed `--muted` edge and no fill; unread is a gap.
- **Track and block cells** fill from the left with their own share read. A
  partly filled cell's label starts after the fill (`padding-left = fill + 6px`)
  so text never straddles green and grey; a full cell's text is `--on-ready`.
  A floored cell carries a centred 4px dot (`--muted`, or `--on-ready` over a
  fill) and the legend reads *• shown at minimum width*.
- **Stubs** are `min` wide, `--surface` with a 1px dashed `--faint-deco` edge.
  The accessible name is *+25 runs · 687 issues — open list*; hover or focus
  shows a popover (*+30 runs after · 843 issues · Enter opens the block list
  sheet*); activating one opens the block's run list as a sheet (the intercepted
  route), scrolled to the first folded run. The ladder's BLOCK row reads
  *run 28 of 60*.
- **States** (STYLE_GUIDE §2.8; `Telescope Spec` A3). Hover, pointer only: the
  cell lifts to `--raise` with an `--ink-2` edge and a tooltip on `--overlay`
  (`--sh-2`); the phone has no hover, and the same text is in the ladder and the
  accessible name. Pressed: `--line` fill, 1px down, `--dur-1`. Focus:
  `--focus-ring`; the rail's slider focus rings the whole run rail. **Scrub**:
  dragging or arrowing draws a dashed 2px `--brand` ghost head and a pill on
  `--overlay` reading `200 / 381 · #299`; the brackets' lower edges follow the
  ghost's cell (`--dur-3`, `--ease-out`); the real head does not move until a
  mark. On a mark the new segment grows over `--dur-4`. Under reduced motion the
  ghost jumps and nothing eases.
- **Keys.** Arrow keys step one cell (run rail: one issue; Shift+arrow: one tick).
- **The mockup follows** (standing rule 6): `design/mockups.html`'s telescope
  frames on `home`, `telescope`, `krakoa`, `watchlist`, `dashextras` and `states`
  are redrawn horizontal in this PR, from the same geometry, and the vertical
  drawings are removed.

**Check:** on a fixture (not the seed, which changes under the audit — S-11): a
track of 7 blocks whose block 1 holds 5 runs, the second of them 381 issues with
41 read. The ladder reads "block 1 of 7", "run 2 of 5", "issue 42 of 381", and
the rail pill `42 / 381 · #141`. Render it for a run with `block_id IS NULL` and
assert two rails, no crash, the same bracket depth and run-rail height as the
3-rail render, a ladder with no BLOCK row, and an italic *no block* cell as the
track rail's head. Render it for a block containing a 6-issue run and assert
that cell is at least 14px wide at 390px and carries the floored dot. A 60-run
block renders two stubs whose accessible names state their run and issue
counts. Screenshot at 360px. A run with a gap in its reads renders two green
segments and a grey dashed one at the read-elsewhere placement. A fully read run
renders a solid green run rail, no head marker and a grey `✓ read` badge.
Releasing a scrub on the run rail at 200 navigates to `#p-200`, and once 3.6b
has landed, the target row's gutter reads 200. With
no run in flight the telescope renders the track rail only, no brackets and one
primary button. Tabbing through the phone frame reaches track, block and run
cells in order, each with the `--focus-ring`, and no text renders below 11px at
390px. At 360px the telescope's rails fit without horizontal overflow.

### ☐ 2.6 Unlock cost, leverage and the frontier · M
Three views the comics dashboard needs, all derived, none stored. Supersedes and
absorbs the old 6.2b.

- `run_unlock_cost` — per user, **the issues still left to read** to finish
  this run (D-22): the run's own unread placements plus the unread placements of
  every run in `run_ancestors()`. `run_ancestors()` excludes the run itself
  (R2-04), so the run's own share is added explicitly. It shrinks as you read: a
  ready run whose prerequisites are all read costs exactly its own unread count.
- `run_leverage` — how many runs a given run is a direct prerequisite for, and
  how many transitively. The direct count equals the number of `prereqs` rows
  naming it (`claremont-xmen` was 13 on 2026-09-23).

**The 4,642 figure is withdrawn** (R1-01, D-7). It was computed when
`ewing-defenders` had a 98-run closure; on 2026-09-20 the graph gave it 160
ancestors because a cyclic component (103 runs then, 74 on 2026-09-23) made
every member reachable from every other. A check asserting a literal would be
"fixed" by bending the view until it matched. **Costs are only meaningful once
the prerequisite audit is done** (2.11a + OWNER-CHECKLIST, before cutover,
D-20). The closure is correct as written; until the audit the number it yields
is a property of a broken graph, not of the view.
- `frontier` — per user: runs fully ready, runs one soft prereq short, tracks
  never started, and editions owned that cover a ready run. Plus the cheapest
  block to close (fewest issues remaining to finish an entire block) and the next
  event on the path with its distance in issues.

Two surfaces read them. **Why blocked?**: the amber `⊘ N runs first` badge is a
button that opens `/comics/[runId]/path` (an intercepted sheet) listing the
cheapest ordered chain — run, own cost, running total, hard/soft — with *+ Up
next all*, computed from `run_ancestors()`. **Unlock preview**: the `opens N`
tag is an `aria-expanded` button that expands the runs it opens, marking which
become `ready_all` and which stay `ready_hard`. Mockup: `path`.

**Check:** relational, not literal (D-7). On a purpose-built fixture — A ← B ← C
plus one soft edge — `run_unlock_cost(A)` equals A's unread placements plus B's
and C's; a run with no prerequisites costs exactly its own unread count; marking
one issue of B read lowers A's cost by one; a fully read run with read
prerequisites costs 0. Against the full seed: every run's cost equals its own
unread count plus the unread counts summed over `run_ancestors()`, no run appears
in its own ancestor set, and the closure query runs in under 200ms across every
run. Each run's direct `run_leverage` equals its count of `prereqs` rows.
`frontier` counts change correctly when the last issue of a prerequisite run is
marked read. The path for `ewing-defenders` ends at the run itself, its running
total equals that run's `run_unlock_cost`, and soft links are marked skippable;
the unlock preview for `claremont-xmen` lists as many runs as its direct
leverage, split by resulting state.

### ☐ 2.7 Rebalance, and accepting an overage · M
The catch-up affordance, one tap from the books dashboard. A sheet with four
peers, not three ways to shrink the plan:

1. **Move the overage into the next year** — and show what the next year then
   holds. The overage moves; it does not leave.
2. **Move it to On deck** — out of the year and its capacity, still next in
   line (D-37). Longest titles suggested first; nothing deleted.
3. **Even out the quarters** — same books, redistributed. Fixes the shape, not
   the total.
4. **Accept it as a stretch year** — persisted as a row in a new table,
   `plan_acceptance(user_id → users, year int, accepted_at timestamptz NOT NULL,
   accepted_total bigint NOT NULL)`, primary key `(user_id, year)` (R3-14). A row
   rather than a column on `reading_settings` because acceptance is per year and
   keeps its own date and figure; a later change that pushes the year past
   `accepted_total` re-raises the flag by comparing to it. *Undo acceptance* deletes
   the row. This task's migration creates the table.

**Order (D-37).** The overage is the books past each quarter's rule, which are
the end of that quarter's order (2.2b), so options 1 and 2 offer the books you
ranked last. A book moved into a quarter joins the end of it. *Even out the
quarters* keeps the year's order: it reads Q1's books in ordinal order, then
Q2's, and so on, and refills the quarters in that sequence.

Accepting turns the amber to a settled grey card stating what was accepted and
when, with an Undo. **Persistence is the whole feature** — an indicator that
comes back next week is one the user learns to ignore.

The sheet's four options are equal-weight buttons, each showing a before/after
delta (*2028 then holds 45 books*). Once accepted, the banner reads *2027
accepted as a stretch year on 14 Sep · Undo* in a calm state, on the dashboard
and the plan page. Mockup: `rebalance` (the sheet and the settled state); the legacy red classes `.capnum.over` and `.pace
.big.behind` are deleted. **Settling keeps the data honest** (`Plan Rail Spec`
A4.2): the overage is still drawn, but its hatch turns from `--hatch` to the grey
`--hatch-settled` and the legend reads *over, accepted (settled)*; only the held
state clears.

**Check:** test that accepting 2027 at 118% stores the acceptance with a date and
that the dashboard renders `.decide.settled` rather than `.decide`, and the
over-rule part of each block uses `--hatch-settled`, not `--hatch`; that Undo
removes it; that a later change pushing 2027 past the accepted total re-raises
the flag; and that "even out the quarters" leaves the year's book count
unchanged and never puts a book ahead of one that was ahead of it before.

### ☐ 2.8 Place the unquartered · M
Plan rows with a year and no quarter — a bare `2027`. The plan starts empty (R0-04), so this flow serves whatever the owner has added without choosing a quarter; the count is always derived from `plan_period`, never a literal. A bulk flow on the books
dashboard: one book at a time, largest first (the lane has no order, D-37), four quarter
buttons each showing that quarter's current word total, plus Skip and Stop. A
placed book joins the end of that quarter's order. It never leaves the dashboard. Mockup:
`bdash`, third frame (the sheet and its closing card).

The end state is honest, not congratulatory: placing every unplaced book of a year
does not make that year fit, and the closing card says so when it doesn't.

**Check:** the bare-year lane turns amber and gains *Place them* here (1.9 rendered it grey). Test that placing a book writes `period = '2027-Q3'` with Q3's next ordinal,
that the fifth lane's count drops by one; that Skip advances without writing; that
stopping mid-way leaves the remainder untouched; and that the closing card
states the year is still over capacity when it is.

### ☐ 2.9 Run list, grouped track → block · M
Two levels of grouping, always — settles HANDOFF §8 open question 5. Track
headers carry the hue and the runs-read count; block bands inside carry the
block's issue count and read count and reuse the spine's era-band component.
Depends on 2.6.

Every row carries `costs N` and `opens N` from `run_unlock_cost` and
`run_leverage` instead of a tier badge; tier moves to the sort control alongside
unlock cost, leverage, issue count and start year. Cost badges are amber, never
red. Blocked rows keep the dimming and gain the count of runs in the way. Runs
with `block_id IS NULL` (none in the 2026-09-23 extract, but the schema allows
them) group under **No block** at the foot of their track.

The blocked switch reads *Show N hard-blocked* (N computed) and hides `blocked`
runs only; `ready_hard` rows are never hidden by it. **N is most of the list,
not 27** (R1-02): on 2026-09-23, 172 of 258 runs were `blocked`, so the switch
hides most of the list rather than a tail of it. Default it to **shown** — a
filter that removes two-thirds of the catalog by default is one the owner will
not remember turning on. Revisit the default once the prerequisite audit (D-20)
has reclassified over-hard edges.

A toolbar row above the controls holds **saved views** — named URL-param filters
(*Ready · owned · under 60 issues · X-Men or Thor*) — with *Save view* in the
desktop filter rail. This task owns saved views for both lists; 6.10 adds only
the master list's *Fits Q2* chip and *Pick one* and does not rebuild them.
Block bands use the `.emeter` meter, which must render at 5px on desktop. Rows
carry the five-state badge from 2.4.

**Long lists keep their bearings** (UX-N16). The track header is sticky at
`top: var(--bar-h)` (1.8's sticky stack), so the track you are scrolling through
stays named. A partly read row says what is left (*108 left*), not a fraction
(*11 / 25*). The sort control is a `.select` in the controls row with the five
orders above.

**Check:** test that a track with four blocks renders four bands in
`block_number` order and that a block-less run appears in the No block group;
that sorting by unlock cost puts a 13-issue run with a large unread closure
below a 44-issue run whose prerequisites are all read (fixture); that the
blocked switch hides **exactly** the rows
whose `run_state = 'blocked'` and no others, whatever that count is (D-7); and
that no element renders `--danger`. Screenshot at 360px. On the
desktop frame every block band shows a 5px-high `.emeter`, and hiding
hard-blocked runs leaves every `ready_hard` row in place. On the phone, scrolled
to the middle of a track, that track's header is fully visible below `.bar`.

### ☐ 2.10 Plan page as the full-size rail · M
Same geometry as the books dashboard, taller, with each block's title and word
count legible inside it. Depends on 1.7, 2.1 and 2.2.

Only the quarter in focus expands to rows with Move on each, in that quarter's
`ordinal` order (D-37), the same order its blocks stack from the foot of the
column; the other three are summary rows carrying their total, book count and
room. A block dropped on another quarter (desktop drag, below) joins the end of
its order, and one dropped on the fifth lane takes none, like Move; reordering
inside a quarter stays on the Up next tab (1.9). The fifth lane is a drop
target as well as a list. One consolidated empty state — "893k of room across
Q2–Q4" with Suggest — instead of one per empty quarter. Over-budget badges are
amber.

The desktop plan rail supports drag-to-move: a ghost block and a live readout
(*Q3 +118k → 533k / 760k*) before release, with the Move sheet as the keyboard
and phone alternative. As drawn in `Plan Rail Spec` A4.4: the ghost is rotated
−1.5° on `--sh-2` with a 2px dashed `--brand` outline, the source slot keeps a
dashed placeholder, and the readout is an `output.dropdelta` with `aria-live`.
Hover on a block shows a popover with name, words and the estimated flag. Drag
and hover need a mouse or trackpad (`(pointer:fine)`); phone and tablet keep
the tap to the Move sheet (D-33). The estimated-count treatment from
2.2 applies here too, including on plan rows, master-list `.rm` values and the book
detail Words field.

**Check:** test that the sum of the rendered block heights in a quarter equals
that quarter's word total to the pixel rounding; that a book crossing the
capacity line renders hatched and the one below it does not; that expanding Q2
collapses Q1; and that the rail and the dashboard render identical totals from
the same query. Screenshot at 360px and 1280px.

### ☐ 2.11a Prerequisite cycle check · S
D-7, and the loader half of R0-01. Split from the old 2.11 (R3-15; every other mention of "2.11" in the docs means this task plus the owner checklist): what is left
here is agent work with a pass/fail check; the judgement calls about 230 hard
edges are the owner's, in `docs/OWNER-CHECKLIST.md`, and no task waits on an
agent guessing them.

**Built before cutover, in Phase 1's last sitting (D-20)**, although it is
numbered here. It depends on nothing in Phase 2, and the owner needs its output
to do the audit in `Comics.xlsx` before the sheet is frozen at Step 14.

Add the loader check D-2 left open. `etl/extract.py` runs a Tarjan pass over the
extracted prereq edges (all edges, hard and soft) and reports every component
larger than one, naming its runs (hard edges first in the message):

- **By default it reports and carries on**: one `prereqs,prereq cycle` row per
  component in `unresolved.csv` and a red count on the console. The audit takes
  weeks, and `npm run rebuild` must keep working meanwhile (0.8a's check runs it).
- **`--fail-on-cycle` exits non-zero** instead. START-HERE Step 14's final
  extract uses it, so cutover cannot load a cyclic graph. After cutover the
  loader never runs again, and 3.3 holds the invariant in the app.

**Check:** `py -m unittest` covers a fixture whose PREREQS contain a cycle and
asserts that extract writes the `prereq cycle` rows and exits 0 by default, and
exits non-zero naming the runs with `--fail-on-cycle`. Against the real
workbook, once the owner has finished the checklist, `npm run extract --
--fail-on-cycle` passes: a Tarjan pass over `prereqs.csv` finds no component
larger than one, and no run appears in its own `run_ancestors()` (the view
already excludes it, R2-04, so a cycle can no longer hide behind that). Record
the resulting ready / blocked counts in HANDOFF so the dashboards' prose matches
the data.

**2.4, 2.6 and 2.9 render numbers that are wrong until the owner's checklist is
done.** They are buildable without it (D-7: their checks are relational).

---

## Phase 3 — Editing

### ☐ 3.1 Inline field editing · M
Click a field, type, blur to save. No modals, no save buttons. Optimistic with
rollback, same pattern as `IssueRow.tsx`.

**The editable fields are an allow-list, by entity** (R3-16). Anything not listed
is not editable inline, and the PATCH route rejects any other key with 400:

| Entity | Screen | Editable fields |
|---|---|---|
| Run | `/comics/[runId]` hero | `title`, `why` (sets `why_source = 'hand'`), `notes`, `tier` |
| Placement | run spine row | `type`, `notes` |
| Issue | issue sheet | `story_title` (source `hand`), `cover_date` (source `hand`) |
| Book | `/books/[id]` and master-list row | `title`, `series_position`, `genre`, `page_count`, `word_count` (source `stated`), `notes` |

Never inline-editable, because they are derived or per-user: anything in
`run_span`, `run_credit_line`, `run_progress`; `book_status` (its own control, 1.5);
`issue_progress`; `reading_plan` (2.3's picker); any `*_source` column directly.

**One `.editable` field, six states** (UX-N06; FEATURES Part 3 §1): *idle*;
*hover*, desktop only, a 16px pencil in `--muted`; *editing*, a 2px `--brand`
ring with Esc and Enter hints; *saving*, an inline `.spin`; *saved*, a ✓ that
fades after 1.5s; *error*, a `--danger` ring and message, the value reverted, and
**Retry**. The error state is the only red, and it never appears on a dashboard
field. The book Words field carries its `stated | estimated` flag in every
state. The mockup draws the six on `bookdetail` (Words) and `spine` (the run
*why*, an era name) in this PR.

**Check:** test asserts a failed PATCH restores the prior value in the DOM and
renders the error state with a working Retry; that Esc while editing restores the
value without a request; and that no `.editable` inside a dashboard route renders
`--danger`.

### ☐ 3.2 Create and edit runs · M
Including track assignment. New runs get a slug ID derived from the title,
editable, uniqueness-checked. **No series, year, writer or artist fields** — the form shows
`run_span.series_issues`, the year span and `run_credit_line` read-only, and
they fill in as issues are added and credited (tasks 0.6 and 0.7). The mockup's
New run screen shows this as a read-only "Credits — fills in from issue
credits" row.

**Hand-edited only here.** The why field is typed by the owner and saving stores
`why_source = 'hand'`. **"Draft why" moved to 7.5** (R3-17): it needs 7.1's
`proposals` table and Anthropic client, and Phase 7 is gated after Phase 4, so
pulling them forward would have this task build a half of 7.1 that 7.1 then
presents as new. 7.1 owns the table and the client; 7.5 adds the button.

**Check:** create a run, assign two tracks, assert it appears under both filters;
assert saving a why stores `hand`, and that nothing in this task calls Anthropic.

### ☐ 3.3 Prereq editor · M
Add and remove edges, hard or soft, with **cycle detection**. After cutover this
is the only thing that keeps the graph acyclic (2.11a's loader check no longer
runs), so it rejects any edge, hard or soft, that would close a cycle of any
length: the same invariant as 2.11a, "no strongly connected component larger
than one". The message names the runs in the cycle it would create.

**What the editor looks like** (UX-N14): editing an existing run's prerequisites
is search to add, a hard/soft segmented control per edge, and *Remove*. A
rejected edge shows *Adding Claremont — X-Men would create a loop* with the loop
drawn as a short path (the `path` component: *X-Men → Excalibur → X-Men*).
`--danger` marks only the rejected control and its message; nothing was written.
The mockup's `newrun` gains an edit-mode frame and a cycle-error frame.

**Check:** test asserts adding A→B when B→A exists is rejected with a clear
message, and that adding A→D when D→C→B→A exists (a four-run cycle, soft edges
included) is rejected naming all four.

### ☐ 3.5 Detail sheets — books and issues · M
`/books/[id]` and `/comics/[runId]/[issueId]` as **intercepted routes**: a
bottom sheet on phone and tablet and a centred modal on desktop when arrived at from a
list, a full page on direct load or refresh. Not a hover preview — hover does
not exist on Android, which is the primary device. FEATURES.md Part 2f;
mockups "Book detail sheet".

Content: summary, genre, year, page and word count with the
`stated`/`estimated` flag, notes, shelf membership, plan placement, reread
history. The run page stays a full page — too dense for a sheet.

**How the sheet moves and stacks** (UX-N10, N12, N25; STYLE_GUIDE §7):

- It is `--overlay`, radius 16 at the top, a 36×4 grab handle, a 44px close,
  over `--scrim` (which may blur 2px). The sheet itself is never glass.
- Phone: it enters `translate-y-full → 0` over `--dur-4` `--ease-out` while the
  scrim fades in over `--dur-3`; it follows a drag 1:1 and dismisses past 30% of
  its height or a flick over 0.5px/ms, otherwise springs back; exit is
  `--dur-3` `--ease-in`. A tablet (768–1023px) gets the same bottom sheet,
  centred and at most 640px wide (D-33). Desktop modal (1024px and up): opacity
  and `scale(.98 → 1)` over `--dur-2`. Reduced motion: an opacity-only change.
- **One sheet at a time** (D-34). A sheet opened from inside a sheet *replaces*
  it, with a back chevron naming where you came from (*‹ Uncanny X-Men #141*);
  it is a route push, so Back unwinds one level. Two sheets are never on screen
  together.
- As a progressive enhancement, the row's cover morphs into the sheet's hero
  cover through the View Transitions API (`view-transition-name: cover-{id}`);
  without support it is the plain enter. Dismissing restores the list's scroll
  position (already in the check).
- **Read again** (the book half of UX-N24): a read book's *History* offers *Read
  again*, which starts a `read_events` row with `reread_of` set (1.5). Runs get
  no second pass: a reread inside a run is a note on the placement (D-19).

The issue sheet lists **every run that places the issue, with its position and
its read state in that run** (0.8). Read runs show a green tick and a date,
unread runs a grey ring, and the run you came from is marked *this run*. Each
line can mark that placement read, so a reader can deliberately carry a read
across runs one at a time. Nothing marks them all.

Adds `books.summary`, `books.subjects` and `issues.story_arc` — fields the
enrichment APIs already return and the app currently discards. Issue credits
(`issue_credits`) and `issues.story_title` already exist from task 0.7, and the
story arc is in every Metron detail page `enrich_comics.py --details` cached, so
it costs no requests.

The issue sheet uses the shared layout — hero, story title, credits by role,
story arc, *Your record* (a table of placements: run · position · read state ·
date, each row with its own `aria-pressed` toggle, no *mark all*), and
collecting editions. The spine's grey `+N` hint and every issue row link to it.
The master list's collapsed row is a summary; its full record is this sheet, not
a separate page. DNF, when chosen in the status editor, is grey. Mockup:
`issuedetail`.

Credits on the sheet are selective; the table is not. All six roles stay in
`issue_credits`. The sheet shows **Writer, Penciller** (role `artist`) and
**Inker** (only when the issue has one) by default, and **Cover** only when the
cover artist differs from the penciller. Colorist and letterer sit under a
*More credits* disclosure. `run_credit_line` is unchanged (writer and artist
only). Check: an issue whose cover artist is its penciller renders no Cover
row; one with a different cover artist renders it; an issue with no inker
credit renders no Inker row; colorist and letterer are inside the disclosure.

**Dates on the issue sheet** (Oct 2026, spine v2; mockup `issuedetail`). The
phone spine row does not carry a release date (3.6b), so the sheet is where a
phone reader finds it. A *Dates* group lists **Cover date** (`issues.cover_date`,
`Mon YYYY`) and, when it differs, **Published**, the on-sale date. Both are grey
catalogue facts. The cover date exists today. **The publication date does not:**
it needs `issues.store_date` plus a `store_date_source` (`metron | hand`, the same
CHECK pair as `cover_date`), filled from Metron's `store_date` by
`enrich_comics.py` into `cover_dates.csv`, and it is a schema change. **Stop and
ask the owner before adding it.** Until it is approved, only the cover date row
renders. Links to reading sources, if they ever arrive, go on this sheet and
nowhere else (STYLE_GUIDE §12, *Considered, not adopted*).

**Check:** test that the back button dismisses the sheet and restores list
scroll position; that a direct visit to `/books/{id}` renders the full page;
that a book with no summary renders without a layout shift; and that the sheet
and the master list's inline editor write status through the same code path.
Test that an issue placed in three runs, read in one, lists three runs with one
read, and that marking a second from the sheet writes exactly one
`issue_progress` row. Opening *Why blocked?* from inside an issue sheet leaves
exactly one sheet in the DOM, and Back returns to the issue sheet. An issue
with a `cover_date` renders *Cover date* in `Mon YYYY`. An undated issue
renders no *Dates* group and no `—`.

### ☐ 3.4 Book ratings and top-books reorder · S
Rating, notes, and the top-books rank reorder. **Status and finish date moved to
1.5** (R1-03) — they are a daily-use flow and could not wait for Phase 3.

**Check:** test that setting `year_rank = 3` demotes whatever held rank 3.

### ☐ 3.6 Eras on the run detail · M
The era bands in `design/mockups.html` → "Run detail — eras" have no data behind
them: the workbook has no era column and `etl/extract.py` never mentions one.
Depends on the `eras` table from 0.3.

Add, remove, rename and reorder eras on a run; drag an issue boundary to move it
between eras. `era_progress` mirrors `block_progress` so the spine renders each
band's count and bar from a view rather than counting in the component. A run
with no eras renders a flat spine — that is the default and it is not an empty
state.

Eras are named, blocks are numbered: an era is a story, a block is a position.
Do not give eras a number field.

Spine navigation, once eras exist: each era header is a `<button
aria-expanded aria-controls>` with a chevron; finished eras of a run over 100
issues collapse to *38 / 38 · all read · Show*; a sticky `<nav class="erachips">`
of chips under the hero (*Phoenix ✓ · DoFP 4/22 · Brood 0/19*) jumps between
them; on a run of 300+ rows a `<nav class="minimap">` (sticky right edge on the
phone, in the desktop rail) shows era boundaries, green read stretches and grey
dashed read-elsewhere ticks. Mockups: `spine` (header, chips) and `krakoa` (minimap).

The sticky pieces join 1.8's stack (UX-N05, F1): the era chips sit at `top:
var(--bar-h)` and the minimap below them, never at `top:0` under the header. An
era header is a `--raise` band with a 52×5 `.emeter`, a mono count and a
chevron; it expands with `grid-template-rows: 0fr → 1fr` over `--dur-3` and the
chevron turns 90° over `--dur-2` (UX-N10). Spine rows have `--line` dividers and
no zebra striping; the green ticks are the rhythm (STYLE_GUIDE §5).

**Check:** test that reordering eras renumbers `ordinal` contiguously; that
deleting an era sets its placements' `run_issues.era_id` to null rather than
deleting them (an era is a stretch of one run's reading order, so it belongs on
the placement, not the issue);
that `era_progress` returns 4 of 22 for a seeded era with 22 issues and 4 read;
and that a run with zero eras renders every issue in document order with no
band. Screenshot the run detail at 360px with and without eras. On the phone,
scrolled 400px, the era chips are fully visible below `.bar`.

### ☐ 3.6b Spine rows — ordinal gutter and release dates · S
Oct 2026, spine v2. Depends on 0.8b (the row markup) and 3.6 (eras). The specs
are in STYLE_GUIDE §5.1 (row anatomy, the gutter, the truncation budget and the
date column), and the mockups are `spine` and `krakoa`.

**The ordinal gutter.** Each spine row leads with its placement's ordinal: a
24px column on a phone and 32px from the 900px step (`--ord-w`), 11/14 mono
`--muted`, tabular and right-aligned, before the `.chk`. The `data-next` row's
ordinal is `--brand-ink` 600. The number is the `ROW_NUMBER() OVER (ORDER BY
sequence)` over the run's live placements, which is what `run_read_segments`
uses and what the head pill `42 / 381 · #141` shows. Compute it in
`src/db/queries.ts` and never store it. It is **not** the raw `sequence` that
0.8b's row prints in its trailing column today: that column becomes the cover
(4.3), and its number moves here (SG-D14).

- The gutter is `aria-hidden`. The ordinal joins the row's accessible name
  through a visually hidden prefix on the label: *42 of 381, Uncanny X-Men
  #141*. The `.chk` keeps *Mark Uncanny X-Men #141 read in this run*: the
  mark verb names the label, never the ordinal (M-10).
- Each row carries `id="p-[ordinal]"`, the target of 2.5's scrub release and
  1.10's links.
- Era headers carry no ordinal. Compact density (6.11) keeps the gutter.
- A run of 1,000 or more placements sets `data-ord-digits="4"`, which widens
  the phone gutter to 32px.

**The release date** (`issues.cover_date`, as `Mon YYYY`, grey, never a
progress signal; blank when undated):

| Width and density | Shown |
|---|---|
| Under 1024px, comfortable | Not on the row; in the issue sheet (3.5) only |
| 1024px and up, comfortable or compact | A right-aligned 56px column before the cover (`--rdate-w`), 11/14 mono `--muted`, one line |
| Any width, with the run's *Show release dates* on | An `.inote`-style caption (12/16 `--muted`, date in mono) after the note, or on its own line |

*Show release dates* is off by default and is meant for runs whose reading order
is not publication order. **Open question; stop and ask before building it.** It
is a per-user choice about one run, so it cannot be a column on `runs`
(CLAUDE.md: never add a per-user boolean to a catalog table). The options are
a per-user per-run table, which 3.6c's *Hide read* could share (a schema change,
and it joins `src/db/export-tables.ts`), or no setting at all: show the caption
automatically when the run's cover dates are not monotonic in `sequence`, which
a view can derive.

**Check:** render test on a fixture run of five placements where the second is
soft-deleted. The gutter reads 1–4 contiguously, matches `run_read_segments`'
ordinals, and each row's `id` is `p-` plus that number. The head row's ordinal
has the `--brand-ink` class and no other row's does. Each row's accessible name
starts *N of 4,*, and no `.chk` name contains the ordinal. Era headers render no
`.ord`. At 1280px every row with a `cover_date` has an `.rdate` reading `Mon
YYYY`, and an undated one has an empty cell. At 390px no row renders `.rdate`.
Screenshot the spine at 360px with `Marvel Graphic Novel (1982) #5` and
`Astonishing X-Men (2004) Annual #1` as labels. Both truncate the series with
an ellipsis and keep `#5` and `#1`, no row is taller than 48px when it has one
line of text, and the page has no horizontal overflow. Record the label width
measured at 360px in the PR; STYLE_GUIDE §5.1 estimates 196px.

### ☐ 3.6c Hide read in this run · S
Oct 2026, spine v2. Depends on 0.8a (read state per placement, done), 3.6 (era
collapse) and 3.6b (the gutter). The spec is in STYLE_GUIDE §9 *Hide read*, and
the mockups are `spine`, `krakoa` and `states`.

A *Hide read* chip sits in the spine's sticky toolbar beside the era chips, never
in the thumb bar. It is a real `<button aria-pressed>`, and when on it is D4's
neutral inverse (`--ink` / `--page`), never a `--brand` fill.

- It hides rows whose **placement in this run** is read. A row whose issue is
  read only in another run stays visible, with its grey hint (ARCHITECTURE
  2.14).
- Finished eras still collapse. Inside a partly read era, each contiguous
  stretch of hidden rows becomes one stub row in its place: a 44px dashed
  `--faint-deco` row on `--surface`, reading *+3 read · Show*. It is a `<button
  aria-expanded>` named *3 read issues hidden, 39 to 41. Show*, and it reveals
  that stretch only (SG-D15). The stretches are `run_read_segments`' read
  segments clipped to the era, so the app does no counting of its own.
- The gutter keeps the real ordinals, so the gap shows what is hidden.
- A row ticked while the toggle is on stays visible until the undo toast closes
  or the page is left, then folds into its stub. Range marks (1.1) behave the
  same way.
- When no issue row is visible, the list is the empty slate: *All 381 read in
  this run*, *Hide read is on.*, and one primary action, *Show all 381*, which
  turns the toggle off. Collapsed era headers stay under it.
- The minimap and the telescope keep drawing the whole run.

**Persisted per run, per user. Open question; stop and ask before building
it.** The spine is server-rendered, so the first paint must already be
filtered, which rules out `localStorage` (it would flash every hidden row and
shift the page). The options:

- a per-user per-run preferences table, which 3.6b's *Show release dates*
  could share. It is a schema change, it goes into `src/db/export-tables.ts`'
  `USER_TABLES`, and it is never a column on `runs`.
- a cookie listing the run ids with the toggle on: no schema change, but it is
  per device, not per user, and it has a size ceiling.

**Check:** fixture run with an era of 22 placements: ordinals 1–3 and 7 read
here, ordinal 5 read only in another run. With the toggle on, the era renders
two stubs (*+3 read* before ordinal 4, *+1 read* between 6 and 8), row 5
with its `read in …` hint, and rows 4, 6 and 8 onward. The gutter reads 4, 5, 6,
8. Activating the first stub reveals 1–3 and leaves the second stub closed. The
toggle's `aria-pressed` is `true`. Reloading the page keeps the toggle on for
that run and off for a second run that never had it turned on. Ticking row 4
leaves it visible until the toast closes, then it joins the first stub, which
reads *+4 read*. A fully read run with the toggle on renders the slate with
exactly one primary button, and pressing it sets `aria-pressed="false"` and
renders every row. No element in the toolbar has a `--brand` background.

### ☐ 3.7 Archive and restore · S
FEATURES Part 3 §3, *archive, don't delete*; Review N UX-N15. Depends on 0.4
(soft delete) and 3.2. 0.3 and 0.4 give runs, placements and books a
`deleted_at` and filter it everywhere; no task gave the user the control. This
one does, on the run list and the book master list.

- **Archive** sits in each row's and each detail page's `⋯` menu. It is grey, not
  red: nothing is deleted, and `--danger` stays for *Remove* and *Drop*. It
  raises the undo toast (1.2).
- A **Show archived (N)** switch at the foot of `/comics/runs` and `/books/list`
  shows archived rows at reduced opacity, each with **Restore**.
- Restoring clears `deleted_at`; reading history was never touched, so it comes
  back as it was.

**Check:** test that archiving a run with read placements hides it from the run
list, the dashboards and the status tabs; that restoring it brings it back with
every `issue_progress` row intact; that Undo on the toast restores it the same
way; and that no archive or restore control renders
`--danger`. Both lists show the switch with the right count.

---

## Phase 4 — Enrichment

### ☐ 4.1 Metron backfill · M
`etl/enrich_comics.py`. Resolve `issues.label` to a Metron issue, store
`metron_id`, `cover_url`, `cover_date`. Respect 20 req/min and 5,000/day, honor
`Retry-After` on 429, cache to SQLite, resumable. **Never overwrite a
hand-entered value.**

**Mostly done in 0.6 and 0.7:** the script backfills `metron_id`, `cover_date`
and `cover_url`, proposes label corrections, and with `--details` fills story
titles and credits — all into sidecar CSVs that extract folds into the load.
What remains is the after-cutover shape: once the database is the source of
truth there is no re-extract, so enrichment must write to `issues` and
`issue_credits` directly for issues added in the app, with the same rule that a
`hand` value is never replaced.

**Label renames after cutover** (R2 out-of-horizon, S-L3). An accepted label
review changes `issues.id`, which is the label's slug (D-15). With no re-extract,
this task's write path renames in one transaction: `issues.id` and `label`, then
every row that references the old id (`run_issues.issue_id`, `issue_credits`,
and anything added since). Progress keys on the placement from 0.8a, so it does
not move. A rename whose new slug already exists is refused, never suffixed.

**Check:** dry run against 50 issues reports match rate and writes nothing.
Then a real run of 200 with the cache warm.

### ☐ 4.2 Open Library and Hardcover backfill · M
Page counts, covers, ISBNs from Open Library; series position from Hardcover.

**Check:** dry run over 100 books; report match rate and conflicts against
existing `series_position`.

### ☐ 4.3 Covers in the UI · S
Lazy-loaded, aspect-locked, graceful when null. Do not let a missing cover
shift layout.

Rows created freeform and not yet enriched render `data-enrich="pending"`: a
dashed cover outline and a *metadata pending* line, on the spine, the master
list and book detail.

**A missing cover is neutral** (UX-X05, M-01, L-01). The placeholder is `--sunk`
with mono initials in `--muted` and a faint ring (dark: white at 10%); the
mockup's `.k1`–`.k8` gradient covers, including the red `.k2`, go. A row carries
its track or genre hue once — the `.edge` stripe or the tag, not both.

**Spine rows get real covers** (Oct 2026, spine v2; STYLE_GUIDE §9 *Cover in a
row*; mockups `spine`, `krakoa` and `states` → *Covers in a row*). The source is
`issues.cover_url`, which already exists. Metron's issue-list `image` goes to
`etl/data/issue_details.csv` through `enrich_comics.py` and is loaded by extract;
it is never hand-entered, and nothing new is stored.

- The box is fixed at 28×42, and 20×30 in compact (`--cv-row-w` /
  `--cv-row-h`, SG-D13). That keeps the 48px row: `.cv.s` at 36×54 made spine
  rows 54px tall. It has radius `--r-cell` and a 1px inset `--rule` ring.
- The `<img>` has `loading="lazy"`, `decoding="async"`, explicit `width` and
  `height`, and `alt=""`, because the label beside it carries the name.
- A cover never glows and is never tinted: covers are data, shown as they are.
- States: loading is a `--sunk` skeleton of the same box. No `cover_url` gives
  the neutral text placeholder (the issue number, `141`, `GN5`: SG-D14 moved
  the ordinal to the gutter). A freeform row gets `data-enrich="pending"`.
  Under `prefers-reduced-data: reduce`, or with **Settings → Appearance → Show
  covers** off (default on, beside 6.11's density toggle), it is always the
  placeholder and no image is requested.
- The next-issue strip (1.6) uses the same rules.

**Open questions; stop and ask:**

- **Hotlink or cache.** `cover_url` points at Metron's image host. An `<img>`
  is not an API call, but a page render would then depend on a third party's
  image server. The options are hotlinking, or `next/image` with a
  `remotePatterns` entry so Vercel caches small resized copies. The second
  needs a config change and has a cost. Read
  `node_modules/next/dist/docs/` for the version-16 image API first.
- **Where *Show covers* is stored.** A `reading_settings` column is a schema
  change; a cookie is per device. Turning covers off to save data is arguably a
  per-device choice.

Glass is unchanged. Covers scrolling under the header are the worst case D12
was already sized for (STYLE_GUIDE §8).

**Check:** Lighthouse CLS under 0.1 on the books page. No cover placeholder
renders a gradient or an identity hue, and no row renders both an `.edge` and a
`.tag .sq`. On the spine, a row whose issue has a `cover_url` renders one
`<img loading="lazy" alt="">` inside a 28×42 box, and a row without one renders
the issue number in the same box. Swapping one for the other changes no row's
height (CLS under 0.1 on a 381-row spine). With `prefers-reduced-data: reduce`
emulated, or *Show covers* off, the spine makes zero image requests. No cover
element carries a `box-shadow` that resolves to `--halo`.

---

## Phase 5 — Remaining surfaces

- ☐ 5.1 Shelves (books only): create, add items, reorder · M. **+ Add to
  shelf** opens the 1.4c sheet with the shelf preselected: search your library
  and Open Library, or add by hand. A book not yet in the catalog is created
  first, then shelved.
- ☐ 5.2 Tracks page from `track_progress` · S. `/comics/tracks`: 37 tracks, each
  drawn as a row of its blocks (D-29: cells sized by each block's issue count,
  14px floor, each filled by its own share read, `read / total` as text, counting
  `DISTINCT issue_id`), a *never opened · 24* group,
  and a link to the run list pre-filtered by track. The sidebar's Tracks link
  targets it. Mockup: `tracks`.
- 5.3 — removed 2026-09-24 (review M-O3): it duplicated 3.6, which builds add,
  remove, rename, reorder and boundary drag for eras. The number is not reused.
- ☐ 5.4 Ratings and post-read notes on runs · S. **The finish moment**
  (UX-N13, FEATURES #8/#11): marking a run's last placement, or setting a book
  to *Read* (3.4 owns the book rating), shows a calm closing card in place of
  the toast — rating (five 44px targets), a one-line note, *Skip*. The rating
  control never fills `--ready`; it is an opinion, not progress. No celebration.
- ☐ 5.5 DNF with a reason field · S. DNF opens the same closing card as 5.4
  with a reason field instead of a rating; DNF stays grey (UX-N13).
- ☐ 5.6 `edition_issues` parser: `"Avengers #500-503 and Avengers Finale"` into join rows · M
- ☐ 5.7 **Books coming out** · M. D-35; FEATURES B1, B5; Review N UX-N26.
  Depends on 1.4c and 1.8. `/books/releases`: the books you want when they
  come out, read from the `releases` table (`book_id`, `release_date`; the
  workbook's *Coming Out* tab, 44 rows on the 2026-09-23 extract) that only the
  v1 home page ever showed, and that page goes when 1.8 makes `/` a redirect.
  - **What counts as wanted, with no new column:** a `releases` row whose book
    has no `book_status` row for you. **Got it** writes `book_status = to_read`
    (the book moves to Someday and off this one) and raises the undo
    toast. If the owner wants a separate per-user *want* row instead, that is a
    schema change: ask before building (CLAUDE.md).
  - **The list:** *Out now* first (a release date on or before today, not yet
    got), then one group per month, then *No date yet*. Each row: cover, title,
    author, series position, the date in mono, and **Got it**. The month
    grouping is the calendar view FEATURES B5 asked for; a month grid is not
    built.
  - **Adding:** 1.4c's add sheet gains a *Coming out* destination with a
    release-date field (a date, or *no date yet*). The book row is created or
    reused as usual, then the `releases` row.
  - **Notify me is in the app, not a push:** the books dashboard's rollup slot
    gains a line, *2 out now · 3 coming this month →*, linking here, so the
    five slots keep their order. The digest email stays 6.7.
  - The sidebar and navigation rail gain *Coming out* under Books (flip its
    `NAV_ITEMS` flag, R1-06); add `/books/releases` to ARCHITECTURE's route
    table. The mockup gains a `releases` screen, phone, tablet and desktop, with
    its empty state (*Nothing coming out · Add a book*).
  - **Check:** a released-yesterday book with no status renders under *Out now*;
    one due next month under that month; *Got it* writes one `to_read` row and
    removes the row from the list, and Undo restores it; a book already `read`
    never appears. The dashboard line's counts equal the list's. Screenshot at
    360px, 834px and 1280px.
- ☐ 5.8 **Comic issues coming out, for the runs you follow** · M. D-35 (this
  reverses FEATURES' *Not building: upcoming-issue tracking*). Depends on 1.3b,
  1.3c and 5.7 (the screen pattern). `/comics/releases`: new issues in a series
  you follow, offered for adding to a run. **Nothing reaches `issues` or
  `run_issues` without your explicit accept** (CLAUDE.md: Metron-proposed
  labels pass the bulk-entry parser and an accept, like AI labels).
  - **Settle the schema with the owner first** (CLAUDE.md, stop and ask). It
    needs a per-user follow — which Metron series, and the run new issues go
    to (proposed: `series_follows(user_id, metron_series_id, series_label,
    run_id)`) — and somewhere to hold what Metron reported before you accept
    it, which is not `issues` (proposed: a cache table keyed by Metron issue id,
    with the label, store date and cover, plus a per-user dismissal). Every new
    table goes into `GET /api/export` (standing rule 7).
  - **Following:** the run hero's `⋯` menu offers *Follow new issues of X-Men
    (2019)* for the series of the run's last placement; `/comics/releases`
    lists what you follow, each with *Unfollow*.
  - **Checking is a search you start, never a page render** (CLAUDE.md: the one
    live path is an add flow). The screen renders from the cache with *Checked
    3 days ago · Check now*; *Check now* asks Metron for each followed series'
    issues with a store date from 30 days ago onward, through 1.3b's
    server-side client, rate limit, cache and rate-limited state. A daily cron
    is a later option, alongside 6.7, not this task.
  - **The list:** *Out now*, *This month*, *Later*. Each row: cover, the label in
    the bulk-entry grammar, the store date, the run it would join, and **Add to
    Claremont — Uncanny X-Men**, which opens 1.3b's staged review with the
    issue appended after the run's last placement (change the run or the
    position there). *Not for me* dismisses it for you. An issue already placed
    in that run never appears.
  - The comics dashboard's rollup slot gains *2 new issues out →*; the sidebar
    and rail gain *Coming out* under Comics; add `/comics/releases` to
    ARCHITECTURE's route table; the mockup gains the screen and its empty state
    (*Follow a series from a run's ⋯ menu*).
  - **Check:** with a recorded Metron fixture, *Check now* for one followed
    series stores its three upcoming issues and writes nothing to `issues`;
    accepting one through the review creates exactly one `issues` row (with
    `metron_id`) and one placement at the end of the followed run, and it leaves
    the list; *Not for me* hides an issue for that user only; no page render
    calls Metron (the mocked client counts calls). A mocked 429 renders the
    rate-limited line and makes no second request before `Retry-After`.

---

## Phase 6 — Polish, in any order

- ☐ 6.1 Global search, `Ctrl+K`, across runs, issues, books, series, events · M.
  The overlay also takes verbs: a `>` prefix lists *Actions on this screen*
  (`> mark through #160`, `> move Piranesi Q3`, `> queue Priest BP top`) above
  *Results*, and results are grouped Comics · Books · Watch. The shortcut shows
  in the sidebar; on the phone the trigger is the 44px search icon.
- ☐ 6.2 Stats and year in review — depends on 1.5 and 2.1b · L
  Five charts per FEATURES.md Part 2d: books/year with plan overlaid, genre mix
  planned vs read, track completion (block rows, D-29), reading velocity, publication-decade
  coverage. No streaks.
- ☑ 6.2b **True unlock cost** — moved to 2.4/2.6, where the comics dashboard
  needs it. What remains here is the run-list *sort* by unlock cost and by
  leverage, once the views from 2.6 exist · S
- ☐ 6.3 Prereq graph visualization · M
- ☐ 6.4 PWA: manifest, service worker, queued offline writes · M. Drives the
  sync pill from 1.8 (*Offline · 3 marks queued*); a queued write is never
  silent. **Undoing a queued write removes it from the queue** and makes no
  network call (UX-X02, F8). The failure toast is `role="alert"` (*Couldn't
  save #141, kept offline · Retry*); `queued → online` shows *Synced ✓* for 2s,
  the pill's dot cross-fading amber to green. The mockup's `states` gains three
  frames: failed, retrying, undone while queued.
- ☐ 6.8 Events page with your read-it/skip verdicts · S
- ☐ 6.10 Master list: a *Fits Q2 · 56k* chip and a *Pick one* button (one
  highlighted row with *Another* and *Plan for…*), plus saved views (as 2.9) · S
- ☐ 6.11 Density toggle in Settings → Appearance: `.app[data-density="compact"]`,
  desktop only, 32px rows, `.chk` min-height 2rem · S. Compact sets `--row-h`
  to 32px (1.8a), a 16px check ring and 13/18 mono labels (STYLE_GUIDE §5).
- ☐ 6.12 **Reading-session timer** — deferred from 2.1b by D-8 · M. The
  start/stop timer, the **timer chip** in the thumb bars and desktop sidebar
  footer, and the two surfaces gated behind five sessions: the dashboards'
  **Tonight** fit card (*6 issues of Claremont · or the rest of …*, one evening
  ahead only) and *Estimated time to finish* on the run hero and in-flight rows.
  Mockups `session`, `dashextras`. 2.1b already ships after-the-fact entry, so
  this is the convenience, not the capability.

  Two things to settle when it lands (R1-12): a running timer is **a row**
  (`started_at`, nullable `ended_at`), not local state, so starting it on the
  phone and stopping it on the desktop works; and stopping one past a threshold
  (4h is the suggestion) opens the sheet with the minutes editable and
  unconfirmed, so a timer left running overnight cannot silently set
  minutes/day through *Use these*.
- ☐ 6.13 **Better sign-in than one passcode** (D-23) · M. Until then the app
  is protected by `APP_PASSCODE` set to four or more random words (a START-HERE
  Step 14 gate, R2-12). Replace it with username + password (hashed, e.g.
  argon2/bcrypt) or another method chosen when the task starts — decide the
  method with the owner first. Keep what R2-11 fixed (a bad or stale session
  redirects to `/login`; route handlers answer 401), keep 1.11's one-second
  wait on every failed credential (D-36), and keep `GET /api/export`
  behind it. **Check:** a wrong credential is refused and a right one signs in,
  an old `rt_session` cookie is rejected after the switch, and every page and
  route handler still refuses an unsigned request.
- ☐ 6.14 **Sidebar toggle** (UX-N08) · S. 1.8 sets the sidebar's state by width
  (D-33: collapsed 64px at 1024–1279px, 224px from 1280px); this adds the
  toggle that overrides it, desktop only. A button with `aria-expanded`, a
  `--dur-3` width transition over `grid-template-columns: var(--side-w) 1fr` so
  the main column reflows without a jump, and the choice kept in `localStorage`
  (not the database). Collapsed, the sync pill and timer chip are icon-only
  with an `aria-label`. The tablet's navigation rail (768–1023px) has no toggle.
  **Check:** `/comics` at 1280px renders in both states with no horizontal
  overflow, and the choice survives a reload.
- ☐ 6.5 Keyboard shortcuts: `j`/`k`/`x`/`/` · S. The keyboard layer (UX-N23):
  a focused-row state on desktop (2px `--brand` ring at half strength on
  `--raise`), a `?` sheet listing `j/k`, `x`, `Shift-x` (range), `/`, `Ctrl K`
  and `g c` / `g b` / `g w`, and the `?` hint beside `Ctrl K` in the sidebar
  footer. **Desktop mark reach** (UX-X03, F6): the header verbs stay (D-25), and
  with a mouse or trackpad (`(hover:hover) and (pointer:fine)`) a spine or queue
  row also reveals a small *Mark read* button on hover or focus, with `x` as its
  shortcut. Phone and tablet are unchanged: their check is already one tap.
- ☐ 6.6 Goodreads and StoryGraph CSV import · M
- ☐ 6.7 **Release digest email** — Vercel cron plus Resend free tier. Last, by your call · S
- ☐ 6.9 **Revisit the theme** — do this near the end, once every screen exists
  and you have lived with it on a phone for a few weeks · M

  **Partly done by Step 3 (D-31, 2026-09-30):** the style guide retuned the
  neutrals and rebuilt dark depth (task 1.8a), keeping the four meanings and the
  identity hues. What this task still owes is the lived-with pass, the CVD check
  on the eight identity hues and `--brand` distance (M-O2). Run the prompt below
  against `globals.css` as it then stands.

  The v4 palette was inherited from v3 and reconciled rather than designed. It
  works, and it has never been tested against a full app. Once the surfaces are
  all built, put the question properly. Paste this at a fresh session, with
  `design/mockups.html` and `src/app/globals.css` attached:

  > I have a finished single-user reading tracker — comics, books, and a film
  > and TV watchlist. Plain CSS custom properties, no Tailwind, no build step,
  > light and dark, and an Android phone at 360–412px is the primary device.
  > The current palette is attached in `src/app/globals.css` and every screen
  > is in `design/mockups.html`.
  >
  > The colour system carries exactly four meanings and I want to keep the
  > meanings, not the hexes: read/done, where-you-are and the primary action,
  > *held* (a hard prerequisite unread, or a decision I have not made — over
  > capacity, no quarter chosen), and destructive/invalid. Nothing on a
  > dashboard is red. On top of that there are eight identity hues for comic
  > tracks and book genres, which appear as a row's left edge, as tags, as
  > sidebar dots, and as segments of a stacked capacity bar.
  >
  > Give me **three** complete palettes as drop-in `:root` and dark-mode token
  > blocks, using my existing token names. They should differ in temperature and
  > in how much chroma the surfaces carry, not in decoration. For each one:
  >
  > 1. Say in one paragraph what the palette is for and what it refuses to do.
  > 2. Show the four state colours and the eight identity hues rendered on my
  >    real components — a run row, a status badge set, the capacity bar, the
  >    telescope, the plan rail — in both themes.
  > 3. Prove the identity hues are distinguishable: run a CVD check on the eight
  >    as an ordered set, report worst adjacent pair ΔE for deutan, protan and
  >    tritan, and state the contrast of every state colour against both
  >    surfaces. Fix anything under 3:1 rather than telling me about it.
  > 4. Confirm the four state colours do not collide with any identity hue, and
  >    say which pairs are closest.
  > 5. List what you changed from my current palette and why. If a current value
  >    is already the right answer, keep it and say so.
  >
  > Do not give me one real proposal and two strawmen. Also tell me if the
  > honest answer is that the current palette should stay.

---

## Phase 7 — AI-assisted curation (after Phase 4, not before)

Every task here shares one non-negotiable: **the model proposes, Metron
verifies, the user approves.** No AI output reaches `issues` or `runs` without
passing the bulk-entry parser, an existence check, and an explicit accept.

### ☐ 7.1 Proposals table and API plumbing · M
`proposals` table: id, kind, target_id, prompt, raw_response, parsed_json,
status, created_at, decided_at. Server-side Anthropic client, `ANTHROPIC_API_KEY`
in env, never shipped to the browser. Rate limited per user.

**Check:** test asserts a proposal round-trips and that no code path returns the
API key to a client component.

### ☐ 7.2 Verification gate · M
Every proposed issue label goes through the 1.3 parser, then a Metron existence
check. Output classifies each line as `verified`, `unverified`, or `malformed`.
Unverified is shown, never silently dropped.

**Check:** fixture with 10 proposed labels, 3 of them fabricated; assert exactly
3 are flagged unverified and 0 are written.

### ☐ 7.3 Review a run's reading order · M
Ground the prompt with the run record, its current issues, its track siblings,
and its existing prereq edges. Render the response as a diff — insert, remove,
reorder, reclassify — accept per row.

The diff is a table (ARCHITECTURE §4, *Review tables*), one row per proposed
operation, with columns **Kind** (glyph: `+` insert, `⇅` move or link, `−` remove
or make optional, `?` unverified), **Change**, **Why** (one reason per row),
**Check** (`verified` / `unverified` / `malformed`, from 7.2) and **Decision**
(a `role="radiogroup"`: *Insert · Skip*, *Apply · Skip*, *Make optional · Remove
· Keep*, *Accept anyway · Drop*). Unverified rows default to *Drop*; the sticky
bar counts the accepted writes (*Apply 3 accepted*) and *Discard* writes nothing.
Only *Remove* and *Drop* may use `--danger`.

**Check:** golden test against a fixture run; assert the response parses into
structured operations and that accepting zero rows writes nothing. An unverified
row is pre-set to Drop, and the button count equals the accepted rows.

### ☐ 7.4 Review a block or track · M
Wider scope: gaps between runs, ordering, missing prereq edges, misfiled runs.

**Check:** run against a track with a deliberately removed prereq edge; assert
the edge is proposed.

### ☐ 7.5 Draft a new run from scratch · L
Writer, character, or era in; a full draft run record plus issue list out,
through 7.2 and into the same review table as bulk entry.

**Also owns *Draft why*** (moved from 3.2, R3-17): a button beside the why field on
the run form calls a server route that sends the run record, its issue labels,
tracks and prereq edges to Claude through 7.1's client and `proposals` table, and
fills the field with 2–4 sentences: why it matters, what it is about, the
creators, the legacy. The draft is editable; saving it untouched stores
`why_source = 'claude'`, saving after any edit stores `'hand'`. Never auto-saves,
never overwrites a `hand` why.

**Check:** draft a run whose real composition you can verify by hand; report
what share of proposed issues passed the Metron check. Assert a saved-untouched
why draft stores `claude`, an edited one stores `hand`, and the draft route never
replaces a `hand` why.

### ☐ 7.6 Release digest email · S
Vercel cron plus Resend free tier. Last thing in the backlog, by your call.

---

## Phase 8 — Watchlist: film and television

Self-contained. Needs only phase 0, so it can be pulled forward any time —
useful as a change of pace between the heavier comics phases. Three levels:
films and shows, seasons beneath shows, franchises above both. **No episode
tracking.**

### ☐ 8.1 Schema and TMDB client · M
`titles`, `seasons`, `franchises`, `franchise_titles`, `title_status`,
`season_status`, `watch_events`, `shelf_titles`, `shelves.kind`. Plus the
`show_progress` and `franchise_progress` views.

Server-side TMDB client, `TMDB_API_KEY` in env, never shipped to the browser.
`/configuration` fetched once and cached for image base URLs. **TMDB
attribution in the footer** — a condition of the free tier.

Two additions from the audit: `franchises.hue` (nullable, else a deterministic
hash to `--t1..t8`) so a franchise keeps one colour across the dashboard,
franchise page and detail; and dropped-show storage — `title_status` accepts
`kind = 'tv'` only with `status = 'dropped'`, and `show_progress.state` becomes
`unknown | to_watch | watching | watched | dropped`, reading `title_status` first
(DIAGRAMS §8b, ARCHITECTURE 2.5b). Update `etl/views.sql` in the same PR.

**Check:** test that a `/search/multi` response parses into `titles` rows for
both a film and a show; that `/tv/{id}` populates the full `seasons` array in
one call; and that no code path returns the API key to a client component. A
show with a `dropped` row reports `dropped` even with seasons watched, and a
`watching` `title_status` row for a show is rejected.

### ☐ 8.2 Search and add · M
One search box across films and shows. Results show poster, year, and kind so
`Dune` (1984), `Dune` (2021) and `Dune: Prophecy` are distinguishable. Adding a
show creates its season rows from the same response. Status set at the moment of
adding. Already-tracked titles show status and an Open button, not Add.

First run: the empty watchlist is a full-width TMDB search with three example
queries and the TMDB attribution, never a "no items" message. Each show result
has a *Watched through* stepper (*none · S1 · S2 · S3*) so an already-seen show
is added with its seasons marked; loading, rate-limited and error states match
1.3b, except that the error and empty-result states offer **Save to inbox**, not
*Type it instead*: watch has no freeform path (D-28). The note is a 1.4b capture
row of kind Watch carrying the query. Neutral grey genre chips carry a text label.

**Check:** test that adding a show with 2 seasons creates 1 `titles` row and 2
`seasons` rows from a single TMDB call, and that re-adding updates rather than
duplicating. With TMDB mocked to fail, *Save to inbox* writes one inbox row of
kind Watch whose text is the query, and no `titles` row.

### ☐ 8.3 Lists and season progress · M
To-watch, watching, watched, dropped. Show rows display derived progress from
`show_progress` — "2 of 3 seasons" and the next unwatched season — never a
stored status. Inline status, date, and rating at both title and season level.

**Check:** test that marking every season watched flips the show's derived state
to `watched` with nothing written to `title_status`; that marking one of three
gives `watching` with `next_season = 2`; and that a film with no seasons still
reports correctly from `title_status`.

### ☐ 8.4 Detail sheets — film, show, season · M
`/watch/[id]` and `/watch/[id]/season/[n]` as intercepted routes: a sheet over
the list when arrived at from the list, a full page on direct load or refresh.
Show detail includes the season list with per-season status. FEATURES.md Part
2f; mockups "Show detail — seasons".

**Check:** test that the back button dismisses the sheet and restores list
scroll position; that a direct visit to `/watch/tv-1396` renders the full page;
and that the sheet renders from cached `titles` and `seasons` with no TMDB call.

### ☐ 8.5 Franchises · M
Create, nest one level, and add titles. Films auto-populate from TMDB
`belongs_to_collection` via `/collection/{id}`; **cross-media franchises are
hand-curated**, since TMDB has no TV equivalent and nothing links films to
shows. Franchise page lists members in release or chronological order with
combined progress.

The franchise page puts the order toggle (*Release · Chronological*) above the
tree it reorders; child rows are links (`<a class="row" href="/watch/[id]">`);
a title with a null `chronology_ordinal` shows in an *unplaced in chronology*
group when Chronological is chosen.

**Check:** test that adding a film in a TMDB collection offers to create or join
that franchise; that a hand-made franchise accepts both a film and a show; and
that `franchise_progress` counts a fully-watched show as watched via
`show_progress`.

### ☐ 8.7 Watch dashboard · M
`/watch` becomes a dashboard and the list moves to `/watch/list`. Same five
slots as comics and books. Depends on 8.3.

- **Now** — seasons with `season_status = 'watching'`, with a two-rail telescope:
  the series' seasons, and the series' position in its franchise. Two levels, so
  the component drops a rail and keeps the bracket — the same horizontal 2-rail
  geometry as comics' no-block fallback (2.5, ARCHITECTURE §4). No episode rail — episodes
  are deliberately not tracked.
- **Up next** — five rows from `show_progress` and unwatched films, with a
  film/TV toggle and genre chips. **No period control**: there is no watch plan
  to put anything into, and that absence is a design decision, not an omission
  (ARCHITECTURE §4).
- **What's reachable** — seasons ready, shows never started, films waiting,
  franchise in progress, title waiting longest.
- **2026 so far** — films, seasons, series finished, ranked.

The telecard stripe is the franchise hue (8.1), the coarse rail is headed
**FRANCHISE · release order**, and the unit badge reads *seasons*. The up-next
button says **Start S1** (or `Start S{next_season}`), not a bare *Watch*; a
film's says **Start**. Like comics' *Start* (1.10, R1-08), both navigate — to the
show's next season or the film's detail — and never write; marking is the thumb
bar's job. A show
in Now and the same show's detail must agree on its state — the mockup's Andor
is mid-show (S1 watched, S2 up next) on both.

**Check:** test that a show with season 1 watched and season 2 watching appears
once in Now and not in Up next; that a show with every season watched appears in
neither; that the genre filter narrows the queue without changing its order; and
that the franchise rail renders 7 of 14 for a seeded Star Wars franchise.
Screenshot at 360px.

### ☐ 8.8 Watch status: In flight · Up next · Done · S
`/watch/status`, the 1.9 component with film and TV rows. Depends on 1.9 and
8.3.

- **In flight**: shows whose `show_progress.state` is `watching`, with next
  season, and films with `title_status = watching`.
- **Up next**: `to_watch` films and shows, oldest added first, with the
  dashboard's film/TV toggle and genre chips.
- **Done**: `watched`, with show state derived, most recent first. `dropped`
  collapsed under *Stopped*.

*Stopped* holds `dropped` shows and films as `<details class="stopped">`, each
with a grey `dropped` badge. Each tab's empty slate is drawn, with the FEATURES
Part 2c copy and one primary action; the mockup gains watch's three (UX-X07,
see 1.9).

**Check:** a show with 1 of 3 seasons watched is in In flight only; a show with
all seasons watched is in Done with nothing written to `title_status`; a
dropped film appears only under Stopped; the genre filter narrows Up next
without reordering it.

### ☐ 8.6 Title shelves · S
`shelves.kind = 'titles'` with `shelf_titles`. Same UI as book shelves.
Distinct from franchises: a franchise is a fact about the work, a shelf is your
opinion.

**Check:** test that a book cannot be added to a title shelf, and vice versa.

---

## Standing rules for every task

1. Plan mode first if the task touches more than two files. Skip it if you could
   describe the diff in one sentence.
2. No task merges without a test that would have failed before it.
3. Migrations are forward-only and reversible; never edit a migration that has
   been applied to production.
4. Never touch `etl/extract.py` output format without re-running it against both
   workbooks and diffing the CSVs.
5. Run an adversarial review before merging anything in Phase 1 or 3 — a
   subagent that sees only the diff and the task's acceptance criteria. Tell it
   to report gaps affecting correctness, not style preferences.
6. A UI task meets the UX floor in the header above, and if it changes what a
   screen looks like it changes `design/mockups.html` and
   `design/mockups-index.md` in the same PR. Anything the mockup cannot show yet
   is listed under *Not shown* in the index rather than silently skipped.
7. A task that creates a table adds it to `GET /api/export`
   (`src/db/export-tables.ts`) in the same PR, user-scoped if it has a `user_id`;
   `test/export-tables.test.ts` fails otherwise (D-17, S-12). `users` stays out.
