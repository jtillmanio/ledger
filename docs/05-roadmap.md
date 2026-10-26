# 05 — Roadmap

The build plan, phase by phase. **The checkboxes here are the source of truth
for project status**, and each entry's **Check:** is the contract for its work.
`.claude/kit.json` runs the kit in roadmap mode (`workflow.roadmap`):
`/new-task <IDs>` copies an entry's **Check:** verbatim as the task's first
acceptance criterion, and the PR that finishes the task ticks its box here.
`docs/STATUS.md` is a rollup of these boxes, never a second source.

One task per Claude Code session. Each is scoped to fit in a single context
window and ends with a check that returns pass or fail: without one, "looks
done" is the only signal available and you become the verification loop.

- **Legend.** ☐ todo · ☑ done · size: S = under an hour, M = a sitting, L = a
  weekend.
- **IDs are permanent.** Decisions, reviews, branches, commits and task files
  cite them (`task/1.3-bulk-entry-parser`, a task file titled `1.3 …`), so an
  ID is never renumbered or reused. Build order is not ID order: the
  milestones in [06-tasklist.md](06-tasklist.md) put the IDs in the order
  they are built, and say why.
- **A done entry is short.** It keeps its line, its **Check:** and where it was
  built. The entry as it was written is in
  [archive/TASKS.md](archive/TASKS.md) and its task file.
- **Print one entry** with `powershell -NoProfile -File scripts/task.ps1 <id>`
  (`scripts/task.sh` in bash) rather than reading this file whole.
- **An entry with no Check** (some of Phases 5–7) gets one written and agreed
  with the owner, here, before `/new-task` converts it (follow-up from PR #57).
- **A UI task** meets the UX floor (design §10) and follows design §2 on which
  design file wins. Figures in the mockups are sample data (D-7): no Check
  asserts a figure copied out of a mockup or out of prose.
- **Every task** follows the standing rules
  ([06-tasklist.md § Standing rules](06-tasklist.md#standing-rules-for-every-task)).

Document names in short form: *product* is [01-product.md](01-product.md),
*architecture* [02-architecture.md](02-architecture.md), *data model*
[03-data-model.md](03-data-model.md) (its decisions keep their numbers, 2.1–2.21),
*design* [04-design.md](04-design.md), *roadmap* this file, *tasklist*
[06-tasklist.md](06-tasklist.md).

## Phases

| Phase | Goal | Milestones | Done |
|---|---|---|---|
| [0 Foundation (prerequisites for everything else)](#phase-0--foundation-prerequisites-for-everything-else) | Every later check has a runner, CI and a schema that can hold per-run read state; the app is measured on every preview. | M1, M2 (0.11 in M6) | 12 / 13 |
| [1 Daily use (build before anything clever)](#phase-1--daily-use-build-before-anything-clever) | Everything needed to stop using the Sheets: marking, adding, the inbox, dates, the shell and clean book data. **Cutover (START-HERE Step 14) waits for all of Phase 1, plus 2.11a and 1.11.** | M3–M9 | 26 / 34 |
| [2 The pace engine](#phase-2--the-pace-engine) | Answer "is 2027 overcommitted" and "what does this run really cost": the pace engine, the books and comics dashboards, the telescope and unlock cost. | M10–M12 (2.11a in M7) | 0 / 16 |
| [3 Editing](#phase-3--editing) | Maintain the catalog in the app: inline edits, runs, prerequisites, eras, detail sheets and adding at scale. | M13–M15 | 0 / 14 |
| [4 Enrichment](#phase-4--enrichment) | Metron, Open Library and Hardcover backfill, and real covers. A prerequisite for Phase 7. | M16 | 0 / 4 |
| [5 Remaining surfaces](#phase-5--remaining-surfaces) | The remaining list and detail surfaces: shelves, tracks, editions, releases and series pages. | M17, M18 | 0 / 12 |
| [6 Polish, in any order](#phase-6--polish-in-any-order) | Polish, in any order. | M19–M21 (6.2b in M12) | 1 / 17 |
| [7 AI-assisted curation (after Phase 4, not before)](#phase-7--ai-assisted-curation-after-phase-4-not-before) | Claude proposes, Metron verifies, you approve. Only after Phase 4. | M22 | 0 / 8 |
| [8 Watchlist: film and television](#phase-8--watchlist-film-and-television) | Films, shows, seasons and franchises. Needs only Phase 0, so it can be pulled forward. | M23, M24 | 0 / 10 |
| [9 Music](#phase-9--music) | A fourth medium, last (D-75). | M25 | 0 / 7 |

Unscheduled ideas, each behind an open question, are under *Later*. The 2026-10-20 intake placed 25 owner additions across these phases, and the 2026-10-26 books intake added 1.21–1.23, 4.4 and L-4 and amended 1.18 and 5.1 (product § Owner additions).

---

## Phase 0 — Foundation (prerequisites for everything else)

**Goal:** Every later check has a runner, CI and a schema that can hold per-run read state; the app is measured on every preview. **Milestones:** M1, M2 (0.11 in M6).

### ☑ 0.1 Test harness · S
Vitest and a guarded test database: `TEST_DATABASE_URL` only, the schema from the migrations, and `npm run test:all` running every suite. The entry as built: [archive/TASKS.md](archive/TASKS.md).

**Check:** with `TEST_DATABASE_URL` set, `npm run test:all` passes; with it unset,
`npm test` fails immediately naming the variable. **This task blocks every other
task.** The owner sets `TEST_DATABASE_URL` once (START-HERE).

### ☑ 0.2 CI · S
One CI job, `check`, runs the typecheck, lint, test-database reset, every suite and the build on each PR, with `TEST_DATABASE_URL` and nothing else. Done 2026-09-30. The entry as built: [archive/TASKS.md](archive/TASKS.md).

**Check:** open a throwaway PR, confirm the `check` job goes green and that
breaking a view definition turns it red.

### ☑ 0.3 Schema additions · M
Migration `0005_schema_additions`: `reading_settings`, `eras`, `volume_rules`, typed `shelves` with `shelf_books`, the book metadata columns and `deleted_at`. Done 2026-10-01. The entry as built: [archive/TASKS.md](archive/TASKS.md).

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
Every read filters `deleted_at IS NULL`, with partial indexes; a soft-deleted placement keeps its read mark. The entry as built: [archive/TASKS.md](archive/TASKS.md).

**Check:** a test that soft-deletes a run and asserts it disappears from
`listRuns` but its issues and prereq edges still exist. A second test soft-deletes
a placement that has a progress row and asserts the row survives, and that
restoring the placement brings the read mark back. A third soft-deletes a
placement, re-adds the same issue to the run, and asserts one `run_issues` row
(the original id, `deleted_at` NULL) and the progress row intact.

### ☑ 0.5 Volume-year normalization · S
`volume_map.csv` (66 approved rules) applied by extract, with trailing-year labels reordered. The entry as built: [archive/TASKS.md](archive/TASKS.md).

**Check:** re-ran `etl/extract.py --volume-map`, diffed `issues.csv` against
the previous extract — zero labels changed, row count held at 10,131. Only
`volume_map.csv` itself changed (two stale rows removed; 67→66 rules, 61→60
series).

### ☑ 0.6 Derived run span, cover dates, reviewed whys · M
`run_span` derives a run's series and years from its issues; cover dates and reviewed whys come from sidecars. The entry as built: [archive/TASKS.md](archive/TASKS.md).

**Check:** `etl/test_views.sql` passes (series grouping, point issues, freeform
labels, publication-span years, an issue edit changing the span, both CHECK
constraints); `py -m unittest discover -s etl -p "test_*.py"` passes (label
parsing, volume choice, hand dates never overwritten, cache makes a re-run free,
dry run writes nothing, why decisions). Both run under `npm run test:all` (0.1); they
are not ported to vitest.

### ☑ 0.7 One issue per comic, credits, story titles, label review · M
One `issues` row per comic, placed by `run_issues`; `creators`, `issue_credits`, story titles and the label review (migration `0003`). The entry as built: [archive/TASKS.md](archive/TASKS.md).

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
Read state keys on the placement: `issue_progress.placement_id`, `issue_read_runs`, per-run rollups (migration `0007_placement_progress`). Done 2026-10-02. The entry as built: [archive/TASKS.md](archive/TASKS.md).

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

### ☑ 0.8b Read state per run — the spine · S
The spine's grey *read in …* hint for an issue read in another run. Done 2026-10-02. The entry as built: [archive/TASKS.md](archive/TASKS.md).

**Check:** render test: B's spine row carries `read in A`; a row read here shows no
hint, a row read only elsewhere shows it, and every `.chk` has an accessible name
and `aria-pressed`.

### ☑ 0.9 Page performance — measure, find the cause, fix it · M
Slow navigation measured and fixed: each page's queries in one wave, run-filtered views, a `loading.tsx` per data route, and the performance budget (architecture § Operational posture). Done 2026-10-04. The entry as built: [archive/TASKS.md](archive/TASKS.md).

**Check:** the PR carries the before/after table for the routes above, cold and
warm, on the preview. The per-page query count is recorded and the guard test
passes. `EXPLAIN` output for any view changed shows the run filter applied early.
`/verify` is green and the migration checks pass unchanged (no schema change
unless the owner approved one).

### ☑ 0.10 Lighthouse on every preview · M
`.github/workflows/lighthouse.yml` measures every preview against `scripts/perf/budget.json`. Done 2026-10-07. The entry as built: [archive/TASKS.md](archive/TASKS.md).

**Check:** on this task's own PR the workflow runs against the PR's preview,
posts the table and attaches the reports as artifacts. On a throwaway branch, a
`<Link href="/api/export">` put back in the nav fails the job with that request
named, and removing it turns the job green. A `workflow_dispatch` run with a URL
works. Neither secret appears in any log, and no report leaves GitHub.

### ☑ 0.11 Browser test harness — Playwright and axe · M
Playwright and axe in Chromium at six widths, light and dark: `npm run test:e2e` (D-72). Task file: [TASK-013-browser-test-harness.md](tasks/archive/TASK-013-browser-test-harness.md).

**Check:** `npm run test:e2e` signs in with the test passcode and loads a seeded
run's spine at 360, 390, 412, 768, 1024 and 1280px, light and dark, and passes.
A fixture page with an unnamed `<button>` makes the axe step fail on
`button-name`. The no-horizontal-scroll helper fails on a fixture that
overflows at 360px. CI runs the suite on the PR against `TEST_DATABASE_URL`
only, and `git.md`'s *Test on the branch* lists it.

### ☐ 0.12 A redeploy of a skipped preview builds · S
Found on PR #76 (task 1.4, 2026-10-12). Not in a sitting: a `chore/` branch
whenever it bites next. `scripts/vercel-ignore.mjs` says *a redeploy changes
nothing, so it always builds*, but Vercel's `VERCEL_GIT_PREVIOUS_SHA` is the
branch's last **successful** deployment, not the commit being redeployed. A
commit whose own build was skipped (docs-only since the last build) is skipped
again on **Redeploy**, because the diff against that older deployment is still
docs-only. On PR #76 the owner's Redeploy of `1726706` was cancelled exactly so,
against `dfefc67`. Harmless while the earlier deployment holds the same app
code, as it did there; it leaves no way to force a build, such as one that picks
up a changed environment variable.

- **What.** Give a redeploy a route to build. That might be an environment
  variable or a deployment property the script reads, if Vercel exposes one, or
  a documented way to force a build (START-HERE). Fix the header comment to say
  what the script actually compares against.

**Check:** a redeploy, or the documented force route, of a commit whose own
build was skipped builds it. A docs-only push after a build is still skipped.
`scripts/vercel-ignore.mjs`'s header says what `VERCEL_GIT_PREVIOUS_SHA` is.
*(Check proposed by task 1.4's close-out; the owner agrees it by merging PR #76
or edits it first.)*

---

## Phase 1 — Daily use (build before anything clever)

**Goal:** Everything needed to stop using the Sheets: marking, adding, the inbox, dates, the shell and clean book data. **Cutover (START-HERE Step 14) waits for all of Phase 1, plus 2.11a and 1.11.** **Milestones:** M3–M9.

**Build order.** The entries below keep the order they were written in,
which is not the order they are built in. The IDs predate the reviews that fixed the order (R3-10, R3-12,
D-20, D-31), and decisions, reviews, branches and commits cite them, so they
stay. Milestones M3–M9 in [06-tasklist.md](06-tasklist.md) are START-HERE's
sittings 3–9: the order each is built in, and why.

### ☑ 1.2 Undo · S
An undo stack in memory, `Ctrl+Z` and an undo toast for marks, ranges and status changes. Task file: [TASK-001-undo.md](tasks/archive/TASK-001-undo.md).

**Check:** test asserts mark → undo restores exact prior state, including
`completed_at`. Test that an entry pushed with an arbitrary inverse closure runs
it on undo, so the stack is not coupled to progress rows. A mark's toast reads
the label, then the run's new read count *of* its total *in* the run's title.

### ☑ 1.1 Range marking · M
Range marking through the range sheet and `POST /api/progress/range`, with five date modes and one undo. Task file: [TASK-002-range-marking.md](tasks/archive/TASK-002-range-marking.md).

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

### ☑ 1.6 Resume pointer · S
A derived resume pointer per run in progress, and the spine hero's next-issue strip. Task file: [TASK-003-resume-pointer.md](tasks/archive/TASK-003-resume-pointer.md).

**Check:** test with a run where issues 1-5 and 7 are read; assert the pointer
returns issue 6. Mark issue 6 read in a different run holding it and assert the
pointer still returns 6. Render the spine hero for that run and assert that the
strip names issue 6 with its ordinal and its placement note, that its link's
accessible name starts *Next: 6 of*, and that it contains no element styled
`--brand` other than the Resume button. Mark every placement read and assert
that the strip is gone and the fully-read badge is rendered.

### ☑ 1.3 Bulk issue entry — parser and validation · M
The pure bulk-entry parser and its validation rules. Task file: [TASK-004-bulk-entry-parser.md](tasks/archive/TASK-004-bulk-entry-parser.md).

**Check:** unit tests for the parser against a fixture of 40 lines covering
every rule above, including the 8-volume Captain America case; `#1-12` expands to
12 in order; a line already in the run is flagged *skip*. No database is touched.

### ☑ 1.3c Bulk issue entry — review table and insert · M
The review table and the insert for pasted labels. Task file: [TASK-005-bulk-entry-review-insert.md](tasks/archive/TASK-005-bulk-entry-review-insert.md).

**Check:** integration test that pastes 24 lines into an empty run and asserts 24 issues in order, and that
a line matching an existing label adds a placement without a second `issues`
row. Test that the count in the header equals expanded lines minus duplicates
for the fixture paste (10 − 1 = 9), and that choosing *Insert after #336* places
the new sequences after it and renumbers later ones without touching their
progress rows. Pasting a label whose placement in this run was soft-deleted
restores the original row (same id, progress intact) and inserts nothing.

### ☑ 1.3b Add issues from a Metron search · M
Add issues from a live Metron search: your catalog first, responses cached. Task file: [TASK-006-metron-search-add.md](tasks/archive/TASK-006-metron-search-add.md).

**Check:** with a recorded Metron fixture: a search for `thor 337-340` returns 4
results in order; adding them creates 4 `issues` rows carrying `metron_id` and
`cover_date_source = 'metron'`, plus 4 placements; re-searching shows all 4 as
"already in this run"; an issue already in another run is reused, not
duplicated. A Metron failure renders the freeform fallback and writes nothing.
No page render calls Metron (assert through a mocked client that counts calls).
A mocked 429 with `Retry-After: 40` renders the rate-limited status line with
the countdown and a working *Type it instead*, and makes no second request
before it elapses.

### ☑ 1.4 Books bulk entry · M
Paste a list of books, with trigram near-duplicates flagged. Task file: [TASK-007-books-bulk-entry.md](tasks/archive/TASK-007-books-bulk-entry.md).

**Check:** paste a fixture of 15 lines where 9 exist and 6 don't; assert 6
inserts and 9 matches, zero duplicates. A line one letter off an existing title
(similarity ≥ 0.4) is flagged with that match and is not merged.

### ☑ 1.4c Add a book by search or by hand, to a destination · M
One add sheet for books: Open Library search or by hand, to a destination. Task file: [TASK-008-add-book-search-hand.md](tasks/archive/TASK-008-add-book-search-hand.md).

**Check:** adding an Open Library result to the Cosmere shelf creates one
`books` row with `open_library_id` and one `shelf_books` row; adding the same
book again, from search or by hand with the same title and author, reuses it
and says so; a by-hand book with no pages saves with null word count and still
lands in Someday (`to_read`, no plan row); an Open Library failure leaves By
hand working and writes nothing. (*On deck* is asserted in 1.7 and *Year or
quarter…* in 2.3, not here.)

### ☑ 1.4b Quick-capture inbox · S
The quick-capture inbox (`inbox`, migration `0010`) and its resolve flow. Task file: [TASK-009-quick-capture-inbox.md](tasks/archive/TASK-009-quick-capture-inbox.md).

**Check:** test that an inbox row saves with only `raw_text` set, and that
resolving it links `book_id` or `run_id` and stamps `resolved_at`. A note tagged
Watch resolves into a `/watch/add` URL carrying its text. `/inbox` lists only
unresolved notes, newest first, and the dashboard chip and `Inbox (N)` link to
it.

### ☑ 1.4d Promote the wishlist into Someday · S
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

### ☑ 1.5 Dated reading log · M
Finish dates with their precision, `read_events` and *Change date…* (migration `0011`). Task file: [TASK-010-dated-reading-log.md](tasks/archive/TASK-010-dated-reading-log.md).

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

### ☑ 1.7 One period column on `reading_plan` · M
`reading_plan.period` with ordered quarters, and four to-read levels (migration `0013_plan_period`). Task file: [TASK-011-plan-period-column.md](tasks/archive/TASK-011-plan-period-column.md).

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

### ☑ 1.8a Design tokens and control states · M
`design/tokens.css` (palette 1c) in `globals.css`, the control-state matrix and the extended `test:tokens`. Task file: [TASK-012-tokens-control-states.md](tasks/archive/TASK-012-tokens-control-states.md).

**Check:** `npm run test:tokens` passes, and is proven to fail three ways: dark
`--sunk` set back to `#232935` (elevation), light `--faint-deco` set to `#98a1b0`
(outline contrast; 1c's is `#878b9c`), and a `font-size:10px` rule added to `globals.css`. A test
parses `globals.css` and asserts every class in the state-matrix list above has a
`(hover:hover)` hover rule, an `:active` rule, a `:focus-visible` rule and an
`[aria-disabled="true"]` rule. `grep -oE 'border-radius:[^;]+' src/app/globals.css
| sort -u` returns only `var(--r-*)` values and `50%` (circles). Screenshot `/comics` at 360px in both
themes before and after: the layout is unchanged, only the values move.

### ☑ 1.8 App shell · L
The app shell: the phone media bar, the tablet rail, the desktop sidebar, local icons and `Inbox (N)` (PR #109). Task file: [TASK-014-app-shell.md](tasks/archive/TASK-014-app-shell.md).

**Check:** screenshot at 360px, 768px, 834px and 1280px; assert no horizontal scroll
exists at any of them. At 768px and 834px the page renders the navigation rail, no top
media bar and no sidebar; each rail item shows a visible text label and is at
least 56px tall; every dashboard renders `.actionbar` with 48px controls and 12px of padding above and below them (amended by D-78). The rendered
HTML references no external host for an icon, font or script, and every `<svg>`
inside a button is `aria-hidden` while the button has a name. At 1100px the sidebar is
64px wide, each item has an accessible name, and focusing an item from the
keyboard shows its tooltip at once. At 1280px the sidebar is 224px wide; at
1440px the content box is 1056px wide and centred in the space beside it. At
1024px and up no dashboard renders the *in inbox* chip and the sidebar's Inbox
shows the count. At 360px *Watch* renders untruncated in the media bar, and the
phone `/comics` has at most one solid `--brand` fill above the fold. No computed
`color` inside `.bar` or `.side` equals `--ready`. With the page scrolled 400px,
every sticky element other than `.bar` and, from 1024px, the dashboard's `.pagehead` band has a computed `top` of at least
`--bar-h` (amended by D-78). The rendered HTML contains no U+26B2. Test that every phone route renders
exactly the same media nav.

### ☑ 1.8c Dashboard routes and the `/` redirect · M
`/comics`, `/comics/runs`, `/books/list`, and `/` redirecting to the last medium touched (PR #108). Task file: [TASK-026-dashboard-routes-redirect.md](tasks/archive/TASK-026-dashboard-routes-redirect.md).

**Check:** Test that `/` redirects to the last-touched medium and to `/comics`
for a user with no history. Test that a request carrying a garbage `rt_session`
cookie redirects a page to `/login` and answers a route handler 401 (R2-11). A
render test asserts that `/books/list` and `/comics/runs` print the query's
total, not the row count, for a fixture where the two differ, and no
same-origin link on any page answers 404.

### ☑ 1.8e Tablet frames to the feel pass · S
Depends on 1.8. Added at 1.8's close-out (owner, 2026-10-20), to be built next.
1.8's four 834px frames (`home`, `spine`, `bdash` and `status` in
`design/mockups.html`) draw the shell's geometry (the 72px rail, 32px padding,
the 40/44 title, the 48px thumb bar) around the phone's content reflowed into
one column. This task redraws their bodies to the feel pass: STYLE_GUIDE 14.5 and
Feel Review 10c, with `design/screenshots/tablet/01-comics-768-dark.png` and
`02-comics-768-light.png` as the picture for `home` (the Now hero, the Up next
shelf, the position telescope). `spine`, `bdash` and `status` have no tablet
PNG, so they follow 14.5's text. The mockup and its index only: no app code, and
the dashboards themselves are built by their own tasks (2.x). 1.8 capped the
telescope's width in the 834 frame's CSS (`svg.tele`) for the old drawing; the
redraw removes the cap.

**Check:** At `data-vp="tab"`, each of the four 834px frames' `.frame-in` has
`scrollWidth` equal to `clientWidth`. `home`'s frame draws the hero with its
cover 150px wide and 225px tall beside the number, run and lens (not stacked
above them); the Up next shelf shows five covers with a 16px gap; *Since
Tuesday* and *Also reading* share one row; the telescope is horizontal, with its
ladder in three columns. In `home` and `bdash` the side-rail blocks sit below
the main column as two columns in a 1.5 : 1 ratio. Each frame's thumb bar is
48px tall and its rail 72px wide. `design/mockups-index.md` still lists the four
frames, and its *Viewport frames* note no longer says the body is not redrawn.

### ☑ 1.8d Failed writes, skeletons and row markup · M
Task file: [TASK-027-failed-writes-skeletons-markup.md](tasks/archive/TASK-027-failed-writes-skeletons-markup.md). Split out of 1.8 (owner, 2026-10-19). Depends on 1.8, because the axe run
covers the finished chrome. From 1.8's text, this task owns *A failed write is
never silent* (the revert and the error toast; the sync pill is 1.8's), the
**Skeletons** bullet and the **Markup rules** bullet. The telecard, plan rail
and season rows have no loaded component yet (2.5b, 2.2b, 8.7), so their
skeletons are measured against fixtures built from the mockup's markup. 1.8b
then places the error toast above the thumb bar.

**Check:** A spine tick whose write fails (a mocked 500) reverts the tick and
raises the error toast with *Retry*, and *Retry* re-sends the same request.
Skeletons for the telecard, run rows, plan rail and season rows render within
2px of the loaded geometry at 360px, and their shimmer stops under
`prefers-reduced-motion`. An axe-core run over each dashboard reports no
`nested-interactive`, `button-name` or `link-name` violations.

### ☑ 1.8b Thumb bar and contrast · S
Depends on 1.8 and 1.8d (the error toast it places). Split out of 1.8 (R3-12).

The **thumb bar**: on every dashboard **and on the run detail** (`Mark #141 read ·
Mark through… · +`, design §14 → Run detail); this task owns the component
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
render no bottom bar; the run detail keeps the bottom bar at every width.**
The header's buttons are 44px with `--r-md`, in DOM and visual order *Search ·
+ batch · Mark #141 read* (books *Search · Finished it · Log pages*; an empty
state *Search · Start {next}*, with no batch or finish verb because nothing is
in hand). A primary label that does not fit truncates with an ellipsis and
keeps the full text in its accessible name. On the run detail at 1024px and up
the bar is glass across the content area with its buttons held to the 720px
column, 48px, primary first (STYLE_GUIDE §14.6). A
tablet (768–1023px) keeps the bottom bar on the dashboards too: it is a touch
device held in two hands (D-33, amending D-25's 900px).

**The mark verb names the issue, never the reading-order position** (M-10):
*Mark #141 read* is allowed only when the run spans one series; otherwise the
full label, *Mark X-Men (2019) #8 read*, truncated with a `title`. The same
rule applies to *Resume* on the run hero.

From the style guide (D-31; STYLE_GUIDE §9, Review N):

- **The bar.** Glass, like the header (1.8). The primary slot is `flex:1`, 44px
  (48 on a tablet), radius `--r-lg` 12 (FP-D10), `--brand` / `--on-brand`, and
  truncates with an ellipsis; `+ batch` is 44px
  with a 1px `--rule-2` ring; search is 44×44 with the drawn magnifier.
  `padding-bottom: max(12px, env(safe-area-inset-bottom))`, so the Android
  gesture bar never covers the verb (F2).
- **The toast sits above the bar, one at a time** (UX-N05, F3). It is pinned at
  `bottom: calc(var(--actionbar-h) + 8px + env(safe-area-inset-bottom))`. A new
  toast replaces the old one and commits the old one's action. It uses
  `--toast-bg` / `--toast-ink` with Undo in `--toast-link` 700 (SG-D3), its
  second line in `--toast-muted` (1.2's copy), and a 2px
  `--brand` countdown bar runs along its bottom edge over the 8 seconds and
  pauses with the timer. It enters with a 12px rise over `--dur-4`.
  At 1024px and up a dashboard has no bar to clear, so the toast sits at the
  bottom centre of the content box, 24px up; on the run detail it stays above
  the bar (STYLE_GUIDE §14.6).
- **The mark answers back** (P2; D-40, FP-D7; STYLE_GUIDE §14.3; Feel Review §3,
  and `design/LedgerComics.dc.html`, where it is live). One small client
  component wraps the thumb bar's mark button and owns four states, calling the
  existing optimistic mark action — it adds no second write path:

  | t | State |
  |---|---|
  | 0 | **Press.** Scale .97, brightness .88, `--dur-1`. The write goes out optimistically. |
  | 120ms | **Confirm.** The button turns `--ready` / `--on-ready` and reads *✓ #141 read*. The counts on screen tick (each number rises 70% with a fade, `--dur-4`), the run rail's segment grows and its head pill slides (`--dur-4`), and the toast enters. On the dashboard (2.4) the lens cell fills (scale .5 → 1.12 → 1, `--dur-4`) and a `✓ read` stamp lands on the hero cover. |
  | + `--dur-hold` | **Hold.** The green stays for 600ms. This is kept under reduced motion. |
  | 1.3s | **Next.** The next issue slides in from 20px right; if it is read elsewhere it carries the dashed grey hint, never green. The button returns to `--brand` with the next label. On the dashboard the marked cover joins the *Since Tuesday* stack. |

  Keyframes for the cell fill, count tick, cover slide, toast enter and toast
  countdown live in `globals.css`, all on `--dur-*` and `--ease-out`. Under
  reduced motion every state still appears, in the same order, with no movement.
  A failed write reverts the tick and raises the error toast (1.8d, R1-07): the
  green never holds over a failure. It replaces UX-N21's `.chk` sequence on the
  thumb bar; a spine `.chk` tap keeps the `.chk` fill (`--dur-2`). The component
  is used on the dashboards and the run detail.

**Check:** screenshot at 360px; assert the primary action button is within the
bottom 96px. At 360px the toast's bounding box does not intersect the primary
`.actionbar .btn`; two marks in a row leave exactly one toast on screen and the
first mark committed. Under emulated `prefers-reduced-motion` the `.chk`'s
computed `transition-duration` is `0s`. `getComputedStyle` reports at least
44px for every `.actionbar .btn` and `.iconbtn`, and a contrast script reports at least 4.5:1 for every
rendered text node outside an inactive control (`aria-disabled` or `:disabled`, WCAG 1.4.3) by its computed colour against its computed background (not a list
of token pairs: a literal `#fff` on `--brand` is 2.51:1 in dark mode, M-02) and 3:1
for the unchecked control ring, in both themes; `npm run test:tokens` passes. At
1280px no dashboard renders `.actionbar` and the header holds the primary verb; at
834px every dashboard renders it, with the primary action inside the bottom
96px; the run detail renders it at all three widths. At 1280px a dashboard's toast is
centred on the content box with its bottom edge 24px above the viewport's, and
at 1100px a primary verb whose label is truncated keeps the full label as its
accessible name. On a fixture run spanning two series the
thumb bar's verb contains the series name. **The mark storyboard:** with a
fake clock, a mark shows press at 0, the `--ready` button reading *✓ {label}
read* at 120ms and still at 700ms, and the next label in `--brand` after 1.3s;
under emulated `prefers-reduced-motion` the same four states appear at the same
times with every `animation-duration` and `transition-duration` at `0s`; a
mark whose write fails never shows the confirm state for longer than the
revert. Each `.actionbar .btn`'s computed `border-radius` is 12px.

### ☑ 1.10 Comics Up next queue · M
Requirement change, Sept 2026. data model 2.16, product § Requirement changes. One
ordered list of runs per user, open-ended: add, reorder, remove. No years,
quarters or capacity — do not add them. Mockups: the feel pass's comics
dashboard (Feel Review §2) for the shelf, and "Status — in flight, up next, done"
for the list. Depends on 0.8.

- `run_queue(user_id, run_id, ordinal, added_at)`, with primary key
  `(user_id, run_id)` and `UNIQUE (user_id, ordinal) DEFERRABLE INITIALLY
  DEFERRED`. Ordinals are contiguous from 1. Reorder and remove rewrite them in
  one transaction.
- `run_queue_state` view: the queue joined to `run_progress` and
  `run_readiness`, carrying state (`unstarted` / `reading` / `read`),
  readiness and the blocked-by count. The dashboard and the status screen both
  read it.
- **Add** from the run detail (*+ Up next*, which appends, and *Read next*,
  which goes to the top), run-list rows, the dashboard's *Ready when you are*
  rows (§15; it was *Unlocked and waiting*), and the status screen's *Ready, not queued*. A run that's already
  queued shows *In Up next · #3* rather than the button. Placeholder and
  soft-deleted runs can't be queued.
- **Reorder** by drag handle (long press on the phone) and *Move to top*.
  **Remove** from the row menu, with the 1.2 undo toast.
- **Dashboard: a cover shelf** (slot 2; D-40, FP-D2; STYLE_GUIDE §7 `shelf`,
  §14.1; Feel Review §2). The unstarted queued runs face out as covers
  (`--cover-shelf` 112, 2:3, `--sh-cover`, `--r-cover`) in queue order, each
  with its position number in a chip on `--overlay`, a two-line title, mono
  meta and its readiness badge, unchanged. **Start** is on the first card. The
  shelf scrolls horizontally (`scroll-snap-type: x mandatory`) and bleeds to
  the frame edge; a tablet shows five covers with a 16px gap. At 1024px and
  up it stops at main's edge instead, because a bleed would run under the side
  rail (FP-D18): four full covers and 80px of a fifth at 1024, five and a 16px
  sliver at 1280. There, under `(hover:hover) and (pointer:fine)` and only
  while the row overflows, ‹ › buttons page it by the number of visible
  covers; ‹ is disabled at the start. Touch scrolls it. The slot head
  carries the count and **Reorder**, which opens the existing reorderable
  queue list — **the same queue row** as the status tab (M-08): the named
  `button.drag` handle and the `⋯` row menu — so drag and the keyboard
  sequence live there and never on a cover. Until 4.3 a card shows the
  neutral cover placeholder. When the queue is empty: "Nothing queued —
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
with contiguous ordinals, and Esc mid-lift leaves the order unchanged. The
dashboard shelf renders the queue's unstarted runs in ordinal order with
**Start** on the first card only and no drag handle on any card, and
**Reorder** reaches a list where that keyboard sequence works. At 1280px the
shelf ends at main's edge, not the viewport's; with a fine pointer and twelve
queued runs ‹ › render and › moves it by five covers, and with three queued
runs they do not render.

### ☑ 1.9 Status screens: In flight · Up next · Done · M
Requirement change, Sept 2026. design §11. `/comics/status` and
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
`book_status`. The dashboard's *Also reading* row (in the hero, D-40), the
*Up next* shelf's head and *Ready when you are → All N* link to the matching
tab, N computed.

*From TASK-017 (1.9, PR #117):* `book_status` holds no reading
position, so *with words left* has nothing to subtract from: until one is
stored, books In flight shows the book's word count. Where a position would
live is an open question in the Owner checklist (Decisions waiting on you).
The *Also reading* row is 2.4's; until then 1.9 links the dashboard's
*Mid-run* head to `?tab=inflight`.

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
primary action (design §14). Books *Up next* is empty until a book is put
On deck (1.7) or planned (2.3): the plan starts empty (D-13), and 1.4c alone adds
only to Someday. So its action in this task is **Add a book** (the 1.4c sheet),
never a link to a picker that does not exist yet; 2.3 changes it to *Plan a
book* (S-L5).

**The tab strip** (STYLE_GUIDE §9, UX-N22): 44px tabs, counts in mono 11, the
selected tab `--ink` 600 with a 2px `--m-*` underline, the rest `--muted` 500.
The underline is one element per tablist that slides between tabs (`--dur-2`);
under reduced motion it moves without easing. **Every tab's empty slate is
drawn** (UX-X07): nine in all, three per medium, each with the design §14
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

### ☑ 1.11 Slow down failed sign-ins · S
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

### ☑ 1.12 Load the volume map into `volume_rules` · S
Coverage check, 2026-10-08; the load half of 3.9. **Built in Phase 1's last
sitting, before cutover.** 0.3 created `volume_rules` ("`volume_map.csv`,
editable in the app"), but nothing fills it: `etl/extract.py` applies the
approved rules in `etl/data/volume_map.csv` to labels and never writes them
to `seed/`, so `load` has nothing to copy and the table is empty. After Step
14's final load, `load` never runs again, so a rule not in the table by then
could only come back by hand through 3.9's editor.

- `etl/extract.py` writes `seed/volume_rules.csv` from the same approved rows
  `load_volume_map` reads: series text verbatim, `run_id` (NULL for an any-run
  rule), `issue_from` / `issue_to` (NULL for any issue), `year`. A row the map
  flags (`approved with no year`) is not written.
- `etl/load.ps1` and `etl/load.sh` copy it, after `runs` (its `run_id` is a
  foreign key), and `npm run rebuild`'s row counts list it.
- No schema change. Labels are already normalized by extract.
- **The bulk-entry review's *Always use 2004 for Captain America* switch**
  (mockup `bulk`; owner, 2026-10-09: built here, not in 1.3c). On a row
  flagged *ambiguous volume* (1.3), the switch stages an any-run, any-issue
  rule (`run_id` and `issue_from` / `issue_to` NULL) that 1.3c's confirm
  writes in the same transaction as the insert. 1.3c's caller passes the
  table's rules to the parser, so a series with a rule is no longer flagged.
  3.9's editor is still the only way to change or remove a rule.

**Check:** `npm run test:etl` covers a fixture map holding a run-scoped rule,
an any-run rule and an approved row with no year, and asserts that
`seed/volume_rules.csv` holds exactly the first two, with `run_id` NULL on the
second. `npm run rebuild` (development) reports a `volume_rules` count equal to
the approved rows in `volume_map.csv`.

### ☑ 1.13 Book extract — one book per title and author, a merge review, no workbook reads · M
Book extract: one book per title and author, the merge review in `book_review.csv`, and no read state from the workbook (D-41). Task file: [TASK-021-book-extract-merge-review.md](tasks/archive/TASK-021-book-extract-merge-review.md).

**Check:** `npm run test:etl` covers a fixture workbook in which:
- two books share a title under different authors and load as two rows, with
  one `same title` review row;
- an authorless To-Read sighting joins its one authored match;
- a one-letter typo by the same author is proposed and not merged, and after
  `decision = merge` it loads as one book under the `keep` spelling with its
  status;
- `Vol 1` / `Vol 2` is not proposed;
- a decision survives a second extract;
- a Read tab with a count row and a summary block, a Top Books tab and a
  `Completed` tick create no book and no `read` row, and `workbook_reads.csv`
  lists the title block and nothing below the count row;
- the King tab's word count loads;
- a `Read 2031` tab is discovered.

### ☑ 1.14 Open Library details for the workbook's books · M
The Open Library half of 4.2, moved before cutover (D-44), the
way 0.6 and 0.7 moved Metron. **Built in sitting 8, after 1.13.** The
workbook's books load with only what was typed: no cover, page count or Open
Library id on any of them, and a published year on 202. The pre-cutover shape
is a sidecar that extract folds in, so the data survives every re-extract.

- **`etl/enrich_books.py`**, modelled on `enrich_comics.py`:
  - `--dry-run` first;
  - a SQLite cache, `etl/.openlibrary-cache.sqlite` (gitignored; added to
    git.md's never-commit list), that is resumable;
  - Open Library's courtesy rate, with a real `User-Agent` naming the app
    (architecture § Metadata sources);
  - `npm run enrich:books`.
- **Matching.** It searches by title and author. A book is matched only when
  exactly one work has that title and author after `clean()` / `key()`. When
  the top result is a near spelling by the same author (similarity ≥ 0.4), it
  is proposed, not matched: the script appends a `book` row with
  `reason = open library` to 1.13's `book_review.csv`. Accepting it renames
  the book in extract, and the next enrich run rekeys `book_details.csv`.
  Anything else stays unmatched and is listed in the run's report with its
  candidates.
- **`etl/data/book_details.csv`**, keyed by title and author, holds
  `open_library_id` (the work key), `page_count` (`number_of_pages_median`),
  `cover_url` and `published_year`, plus `source` (`openlibrary` or `hand`).
  A `hand` row is never overwritten. Extract folds it into `books`.
  `published_year` fills only where the workbook has none.
- **No word count is stored from pages.** 2.1 estimates a missing count as
  `page_count × 275` and marks it `estimated` itself. ISBNs stay out, because
  `books` has no column for one.
- Covers are stored as URLs only. Whether to hotlink or cache them is 4.3's
  question.

**Check:** a dry run over 100 books reports the match rate and writes nothing.
`npm run test:etl`, with recorded responses and no network, covers:
- an exact match fills `page_count`, `cover_url` and `open_library_id`;
- a `hand` row survives a rerun;
- a near spelling writes a review row and no details;
- two candidate works match nothing;
- an accepted rename rekeys the details row;
- a workbook `published_year` is not replaced.

Then a real run over the catalog with the cache warm. The PR reports how many
were matched, proposed and unmatched, and `npm run rebuild` (development)
loads the details.

### ☑ 1.15 Track series, authors and universes · M
Book-ingest review, 2026-10-08 (product B6). **Schema; build attended in
sitting 8, after 1.13.** The workbook's Series tab is a list of what the owner
follows, and it mixes three kinds:
- series (*A Song of Ice and Fire*, *Red Rising*);
- universes that span series (*Cosmere*, *Grishaverse*; the Riordanverse is
  its own tab);
- authors (*Michael Crichton*, *Blake Crouch*).

Only series have a home (`book_series`, `series_progress`). A universe is a
fact about the work, like a film franchise, not a shelf (D-42).
Shelves stay the owner's free-form lists.

- **Schema.**
  - `book_universes(id, name)` and a nullable `books.universe_id`.
  - Three narrow follow tables, `series_follows`, `author_follows` and
    `universe_follows`. Each is keyed `(user_id, <entity>_id)` with
    `state IN ('tracking', 'reading')`.
  - The state is authored and stored (D-43): it stays `reading`
    between books until the owner changes it. A follow row is per-user, so it
    is never a column on the catalog table.
  - All four tables go in `src/db/export-tables.ts` (the follows in
    `USER_TABLES`), and both loaders truncate and copy them. No column is
    dropped or retyped, so no down file.
- **Views (`etl/views.sql`).**
  - `author_progress` takes the shape of `series_progress`: books listed and
    read per author, live books only, and a book with no status counts as
    unread.
  - `universe_progress` is the same per universe.
  - Each of the three progress views gains a `follow_state` column, NULL when
    not followed. Whether it is done is derived (read = listed), never stored.
- **Seed (extract).**
  - The Cosmere and Riordanverse tabs become universes, every row a member.
  - A Series-tab group that names neither a series nor an author (after
    1.13's review) becomes a universe only when it is on extract's hand list,
    `UNIVERSE_GROUPS` (Grishaverse; owner at 1.15's plan gate, 2026-10-26:
    the tab's other unmatched groups are misspelled or unlisted series), and
    the books listed under it in the Series tab are its members.
  - Every Series-tab group and the four author tabs become a follow at
    `tracking`. The tab's `Completed` column is not read.
  - A group that matches nothing goes to `unresolved.csv`, and its name is
    offered in `book_review.csv` so a near spelling can be merged.
  - A book listed under a group fills a missing `word_count` from the tab's
    count, source `stated`, never replacing one (owner, 2026-10-26).
- **Not here:** the control that changes a follow's state, and pages for
  authors and universes. 5.9 draws series; the rest is 5.11.

**Check:**
- `etl/test_views.sql`:
  - `author_progress` and `universe_progress` count read and listed books
    and exclude a soft-deleted book;
  - a book with no status counts as unread;
  - the `state` CHECK rejects any other value;
  - `follow_state` is NULL for an entity nobody follows.
- `npm run test:etl`: a fixture Series tab with one series, one author, one
  universe group and one unmatched name seeds exactly three follows at
  `tracking` and one `unresolved` row, and the Cosmere tab's books carry
  `universe_id = 'cosmere'`.
- `test/export-tables.test.ts` passes with the four tables.
- `npm run test:db:reset` migrates from zero.

### ☑ 1.16 Dates in `America/New_York` · M
Dates stored and shown in `America/New_York` (migration `0012`, D-67). Task file: [TASK-025-dates-in-new-york.md](tasks/archive/TASK-025-dates-in-new-york.md).

**Check:** a vitest at `2026-10-31T21:30-04:00` marks *Today* and the row
reads October 31 in the spine and the toast. A row stored before the change
reads the same calendar day after it. A `none`-precision row is still `none`
with a NULL date. The up → down → up test asserts row values, if a migration
is used.

### ☐ 1.18 Calibre: word counts, series, tags and reads for the books · M
Backlog intake, 2026-10-20; D-73. **Built in sitting 8, after 1.14** (and
after 1.15, which does not need it): it checks Calibre against 1.14's Open
Library answers and reuses that task's cache. The owner's Calibre library has
what no API does, real word counts from the Count Pages plugin, plus series,
tags, summaries, ISBNs and read dates.

*Amended 2026-10-26 (owner, D-83):* the command can be re-run until cutover, and
a Calibre book the Ledger doesn't have is created at **Owned** (1.21) instead
of being left out. After cutover the sync moves into the app (4.4).

- **`etl/calibre.py`** (`npm run calibre`):
  - It is given the library folder (`--library "C:/Users/…/Calibre Library"`,
    or `CALIBRE_LIBRARY` in `.env`).
  - It copies `metadata.db` to a temp file and opens the copy read-only
    (`mode=ro`), so a running Calibre is never locked or written.
  - It finds custom columns by lookup name (`#words`, `#read` and `#date_read`
    by default, each overridable by a flag), never by `custom_column_N`.
  - `--dry-run` reports the match rate and writes nothing.
- **Matching is 1.13's.** A Calibre book is a workbook book when title and
  author match after `clean()` / `key()`. A near spelling (≥ 0.4) appends a
  `book_review.csv` row with `reason = calibre`, as 1.14 does. Anything else is
  reported as unmatched, with its candidates.
- **A Calibre book that matches nothing is created** (D-83, amending D-73,
  which left it to 1.4c). Extract writes a `books.csv` row from Calibre's
  title, author, series and word count, with a `book_status` row at `owned`
  (1.21), or at `read` once an accepted `calibre_reads.csv` row says so. For
  the plan gate: whether 1.20's hold applies to it when Open Library doesn't
  know it (proposed: no, since owning it is the owner's say-so).
- **`etl/data/calibre_books.csv`** is keyed by title and author, with `source`
  `calibre` or `hand`. A `hand` row is never overwritten. Extract folds it in:
  - `word_count`, as `stated`, only where the workbook has none. A workbook
    count that differs by more than 10% is reported, never replaced.
  - `series`, `series_index` and `isbn` fill **only where Open Library or
    Hardcover agree** (owner). A disagreement, or no API answer, goes to
    `etl/data/calibre_review.csv` (`field`, Calibre's value, the API's,
    `decision` calibre|api|neither) and fills nothing until it is decided.
  - `tags` and `comments` are for `books.subjects` and `books.summary`
    (design §13), and the ISBN needs a `books.isbn`. **Stop and ask**
    before adding any of the three columns (CLAUDE.md). Until then the values
    stay in the CSV and do not load.
- **Reads go through a review** (D-73). `etl/data/calibre_reads.csv` lists
  each Calibre read: title, author, the read flag, and the date read, which
  becomes `finished_on` (`exact`, or `approximate` for a year-only value). Its
  `decision` is accept|reject, blank until the owner decides. Only `accept`
  rows load, as `read_events` plus the `book_status` projection 1.5 defines. A
  book already read in the app keeps its read, and the Calibre row is reported,
  not merged.
- Nothing ever writes to Calibre. The CSVs are committed like the other
  sidecars; `metadata.db` and its temp copy never are.
- **Re-runnable until cutover** (owner, 2026-10-26). Run it after any change
  to the library: new Calibre books and reads append rows, a `hand` row and a
  decided review row are never rewritten, and a run over an unchanged library
  changes no sidecar byte. After cutover extract stops, and nothing local may
  write the live database (D-18), so the sync moves into the app: 4.4.

**Check:** `npm run test:etl`, with a fixture `metadata.db` built by the test
(two books, `#words` and `#date_read` custom columns) and recorded API answers,
shows:
- an exact match fills a `stated` word count where the workbook had none, and
  leaves a workbook count alone;
- a series Open Library agrees with fills; one it contradicts writes a
  `calibre_review.csv` row and fills nothing;
- a near spelling writes a `book_review.csv` row;
- a Calibre book matching nothing becomes one `books.csv` row with an `owned`
  status, and a second run over the same fixture leaves every sidecar
  byte-identical;
- an undecided `calibre_reads.csv` row loads nothing, an `accept` row loads one
  `read_events` row with its date and precision, and a `reject` row loads
  nothing;
- the fixture file's bytes and modified time are unchanged after the run.

Then a dry run over the real library, with the matched, proposed and unmatched
counts reported in the PR.

### ☐ 1.4e Paste a list: title and author in their own cells · S
Backlog intake, 2026-10-20 (owner: *adding books isn't "title - author", it's
two fields*). *By hand* already has two fields. *Paste a list* still wants
`Title - Author` on one line, and its review shows the line as typed.

- The paste also takes two columns copied from a spreadsheet: a line with a
  tab splits at its first tab, title then author (`src/lib/book-parse.ts`). The
  dash grammar still works.
- The review table (1.4's `ReviewTable`) shows **Title** and **Author** as
  separate cells, each editable in place. Editing either re-runs that line's
  match (your library, then the near-duplicate check, D-25) before *Add*. A line
  with no author shows an empty Author cell with its reason under it, instead
  of *Add one after a dash*.
- The label and empty-state copy become *One book per line: Title - Author, or
  paste two columns (title, author)*, and the mockup's `add` frame follows
  (standing rule 6).

**Check:** a vitest parses `Piranesi\tSusanna Clarke` and `Piranesi - Susanna
Clarke` to the same title and author, and a tab-split line whose title has a
dash in it keeps the dash in the title. In the browser (0.11), editing the
Author cell of a line with no author clears its reason, and the line adds with
that author. Each cell has an accessible name (*Title, line 3*). Screenshots at
360px and 1280px.

### ☐ 1.17 Started and finished: a start date for books, a derived span for runs · M
Backlog intake, 2026-10-20 (owner: *books: date started and ended; comics: a
run's date started and ended*). **Before cutover, in sitting 9**, for 1.5's
reason: a start date that isn't captured from the first day can't be
recovered later. Finish dates exist already (1.5). What's missing is when a
read began.

- **Books: a stored start, with its precision.** Proposed:
  `book_status.started_on` with `started_on_precision`, and the same pair on
  `read_events`, under data model 2.17's rule (NULL exactly when `none`).
  The start of a read in progress lives on `book_status`. Finishing copies it
  onto the new `read_events` row, so a reread keeps its own start (data model 2.18). **Stop and ask at plan time** (new columns, CLAUDE.md). No column is
  dropped or retyped, so there is no down file.
- **Writes go through `saveBookStatus`.** Entering *Reading* stamps today's
  Eastern day (1.16) as `exact`, unless a start already exists. The status
  control's date line gains *Started …* beside *Finished …*, both editable with
  1.5's picker (*Today · Pick a day · Year only · No date*). A start after the
  finish is refused, with the reason under the control.
- **Runs: derived, never stored.** `run_state` gains `started_at`, beside
  `finished_at`: the earliest dated read of the run's own placements. Undated
  reads (`none`) don't count, so a run with only undated reads has no start.
- **Where it shows:** the book row's meta, the run hero's span line (*Started
  Mar 2026*, or *Mar–Sep 2026* once finished) and 1.9's Done rows. Days taken
  (*16 days*) is computed in the query, never stored. 3.5's book sheet shows
  both dates (noted there).
- Extract loads no start dates (D-41). Calibre's come only through 1.18's
  review.

**Check:**
- Setting a book to Reading writes `started_on` as today in Eastern, `exact`.
- Finishing it appends a `read_events` row carrying the same start.
- Rereading it sets a fresh `started_on` and leaves the first read's row as it
  was.
- A start after the finish is refused and writes nothing; a `none` start has a
  NULL date.
- `etl/test_views.sql`: `run_state.started_at` is the earliest dated read of the
  run's own placements, ignores a read of the same issue in another run and a
  `none` read, and is NULL for a run with no dated read.
- `npm run test:db:reset` migrates from zero.

### ☐ 1.19 Comics Add remembers the last run · S
*From 1.8b (TASK-015, PR #114):* design §14 *Bulk add*,
**Remember the last run** you added to, so consecutive adds don't re-navigate.
1.8 ships the comics *Add* nav item `enabled: false` (`src/components/nav/items.ts`),
because no comics route adds without a run (TASK-014's open question; TASK-005's
note). This item remembers the run that last got an issue (per user, through
the existing add flow; where it is kept is the plan's to propose, and a new
column means stop and ask), and turns the item on so it lands on that run's
`/comics/{runId}/add`. With no run added to yet, it lands on `/comics/runs`.
Depends on 1.8 and 1.3c. **The Check below is proposed** (1.8b's plan, 2026-10-22).

**Check:** after adding an issue to run A from `/comics/A/add`, the comics *Add*
nav item is enabled in all three navs and links to `/comics/A/add`; after a
later add to run B it links to `/comics/B/add`; for a user who has added
nothing it links to `/comics/runs`. A soft-deleted run is never the target.

### ☐ 1.20 Hold books with no Open Library match for review · M
*From fix/skip-placeholder-books (owner, 2026-10-26):* the owner doesn't want
a book loaded that Open Library has never heard of until they have looked at
it. On 2026-10-26, 804 of the 1,352 books extract loads had no
`book_details.csv` row (678 of them on the to-read lists, 126 only on the
author tabs or Coming Out).
Extract holds such a book out of `books.csv` and lists it in a review file
(title, author, tabs, the Open Library search it tried) with a blank
`decision`; `keep` loads it on the next extract, and a held book's status,
plan, release and universe rows wait with it. A book with an Open Library row
loads as today. Placeholder titles are already skipped
(`workbook_placeholders.csv`). For the plan gate: what a held to-read book is
in the meantime (out of Someday until kept), whether `hand` rows in
`book_details.csv` count as a match, and how 1.18's Calibre matches count.
Depends on 1.14. **The Check below is proposed** (owner, 2026-10-26).

**Check:** `npm run test:etl`: a fixture book with no `book_details.csv` row is
not in `books.csv` and is listed in the review file with an empty decision,
and none of its status, plan or release rows load; `decision = keep` loads it
on the next extract with its status; a book with a `book_details.csv` row
loads unchanged; extract prints how many books are held.

### ☐ 1.21 Owned: the books you have but haven't put on your list · S
Backlog intake, 2026-10-26 (owner: *give all [Calibre] books a default status
below Someday … available during search, but not in my face on any list*).
D-83. **Built in sitting 8, before 1.18**, which creates Calibre's other books
at this level. The ladder becomes Quarter · Year · On deck · Someday ·
**Owned**. Someday keeps its line, *on your to-read list, not planned*. Owned
is *in your library, not on your list*.

- Proposed: a fifth `book_status.status` value, `owned`, beside `to_read`,
  `reading`, `read` and `dnf` (no CHECK constrains the column today). **Stop and
  ask at plan time**: it changes what a stored status means (CLAUDE.md). No
  column is added, dropped or retyped.
- **Out of the way.** `to_read_level` reads only `to_read`, so an Owned book has
  no level and is on no plan rail, capacity sum, dashboard slot or status
  screen, and in no year total. The master list's *Everything* leaves it out,
  and a fifth chip, *Owned · N*, shows only them. The progress views
  (`series_progress`, `author_progress`, 5.12's) count it as unread, as they
  count a book with no status today.
- **Found by search.** The master list's search, the add sheets' library
  search and 6.1 find it, tagged *Owned* (1.22).
- **One verb to promote it.** An Owned row and its sheet offer *Add to Someday*
  (writes `to_read`, with Undo) beside 1.4c's other destinations. Adding an
  Owned book through 1.4c moves it to the chosen destination instead of
  reporting it as already there.

**Check:** with a fixture of one `owned`, one `to_read` and one `read` book,
*Everything* lists two and the *Owned* chip lists one with the count 1; a
master-list search for the Owned book's title finds it; `to_read_level`, the
status screens and the plan rail never return it; *Add to Someday* writes one
`to_read` row and Undo puts back `owned`; a series holding one read and one
Owned book reads `1 / 2`.

### ☐ 1.22 Search as you type, and where each result comes from · M
Backlog intake, 2026-10-26 (owner: *search on finish typing, not just Enter …
any time there is a search (add books, filtering, etc), after a few characters
and a delay in typing … make it clear in search results where the result came
from (Open Library or Calibre/my list)*). D-84. Depends on 1.21 for the
*Owned* tag.

- **When it searches.** Every search box in the app (today the master list,
  Add books and Add issues) searches once the text is at least 3 characters
  and typing has paused for 500 ms. Enter still searches at once. A newer
  query aborts the older one's request, and a late answer to an old query is
  dropped. Under 3 characters, the results clear instead of searching.
- **The external APIs.** This amends `.claude/rules/ui.md`'s *searched when the
  user submits a search in Add* to *when the user submits or pauses typing*
  (D-84); this task edits the rule. Answers stay cached (D-53, D-62), so
  retyping a query asks no API, and the rate-limited states of 1.3b and 1.4c
  are unchanged. Add issues is the expensive case, because one search is up
  to ten Metron calls (D-60). The plan proposes whether its Metron half waits
  until the label parses as complete (`thor 337-340`, not `thor 33`), and the
  PR says which.
- **The master list** searches by replacing `?q=` without a history entry per
  keystroke, so one Back leaves the list rather than taking letters off.
- The hint *Searches when you press Enter* becomes *Searches as you type*.
- **Where each result comes from.** Every result row carries a source tag,
  in text and not colour alone: a library book shows where it sits (*Someday*,
  *On deck*, *Q1 2027*, *Reading*, *Read*, *Owned*), an Open Library result
  *Open Library*, a Metron result *Metron*. The group heads *In your library*
  and *From Open Library* stay. A *Calibre* tag on a book that is also on your
  list needs the Ledger to remember which books Calibre matched (for example
  `books.calibre_id`), a new column: **stop and ask** at plan time. Until then
  a Calibre-only book shows as *Owned*.

**Check:** in the browser (0.11), with recorded Open Library answers: typing
`pir` and pausing lists results without Enter; typing `pi` and pausing makes no
request; typing `piranesi` quickly makes one request, not six; a library result
shows its level tag and an Open Library result its source tag, each part of the
row's accessible name; the master list narrows as you type, and one Back leaves
it. A vitest with fake timers shows the older request aborted when a newer
query starts.

### ☐ 1.23 Audiobooks: listening, and a listen that counts as a read · M
Backlog intake, 2026-10-26 (owner: *audiobook listening: a separate status
under books, a separate column on a book if I've listened to it, shown only if
I'm listening or have listened … it counts as completed, but I want separate
stats and an icon to make it clear it was listened to or is being listened to;
the book summary shows reads and listens as different things*). D-85. **Before
cutover, in sitting 9**, for 1.5's and 1.17's reason: a finish logged without
saying it was a listen can't be told apart later.

- Proposed: a `listening` value of `book_status.status` (in progress, by ear),
  and `read_events.format` (`text` | `audio`, NOT NULL, default `text`, with a
  CHECK), so every read already logged is `text`. **Stop and ask at plan time**
  (a new column, and a new status meaning, CLAUDE.md). No column is dropped or
  retyped, so there is no down file.
- **A listen is a read.** Finishing from *Listening* sets `read` and appends a
  `read_events` row with `format = audio` through `saveBookStatus`, so series,
  author and universe progress, the Read filter and year totals count it as
  they count any read. A second listen is a reread (data model 2.18).
- **Said with a glyph.** A drawn headphones glyph with an `aria-label`
  (*Listened*, *Listening*) sits beside the status wherever a book's status
  shows: the master list, the status screens, search results (1.22) and the
  sheet. A book only ever read on the page shows none.
- **Listening is its own group.** The status control offers *Listening* beside
  *Reading*, and the books In flight screen (1.9) lists *Listening* as its own
  group after *Reading*.
- **The book's summary counts them apart:** *Read 2× · Listened 1×* on its
  master-list row and its sheet (3.5, noted there). The *Listened* part appears
  only when the book has a listen or is being listened to.
- **Separate stats, derived.** `books_by_year` gains a listened count beside
  its total (from `read_events.format`, never stored); the total still
  includes listens. 2.2's *2026 so far* and 6.2's charts show the split (noted
  there).
- **For the plan gate:** whether a listen counts against the year's reading
  capacity (2.1's word budget) or runs alongside it; whether a book can be
  Reading and Listening at once when you switch format mid-book (proposed: no,
  one in-progress state); whether a listen records its length.

**Check:**
- Setting a book to *Listening* and then finishing it writes `read` and one
  `read_events` row with `format = audio`; every read logged before the
  migration is `text`.
- `series_progress` counts the listened book as read.
- `books_by_year` returns a total that includes the listen, and a listened
  count of 1.
- In the browser (0.11), the row shows the headphones glyph with the accessible
  name *Listened*; a book only read on the page shows none; a book with two
  reads and one listen says *Read 2× · Listened 1×*.
- In flight lists a Listening book under *Listening*, not *Reading*.
- `npm run test:db:reset` migrates from zero.

---

## Phase 2 — The pace engine

**Goal:** Answer "is 2027 overcommitted" and "what does this run really cost": the pace engine, the books and comics dashboards, the telescope and unlock cost. **Milestones:** M10–M12 (2.11a in M7).

### ☐ 2.0 Settings · S
R1-05. The screen that owns `reading_settings`, and the reason 2.1 onward have
inputs at all. Nothing in any phase built it, and it was missing from
the route table (architecture § Routes and data access); every capacity figure on the books dashboard, the
plan rail, the move sheet and the rebalance sheet reads from it, so without this
they are stuck on a seeded guess. Mockup: `settings`.

`/settings`: minutes a day and words a minute. There is no plan granularity:
the plan is quarters only (D-38), and 1.7 drops `plan_granularity`. The 0.3
migration creates the table; this task seeds one row per user (45 min/day, 185
wpm — the workbook's figures) and lets it be edited. Controls are real (design §14 → Settings): the minutes stepper is two
labelled buttons around an `<output>`, switches are `role="switch"`. The volume
map line reads *67 rules · 61 series*. They look as STYLE_GUIDE §9 draws them: a
36×20 switch (on: `--brand` track, `--on-brand` knob; off: `--sunk` with a
`--faint-deco` ring and a `--muted` knob) in a 44px row; a `role="group"` stepper
of 32px buttons on `--sunk` with a mono `<output>`.

Later tasks extend this screen and do not create it: 2.1b adds *Measured from
sessions* and **Use these**, 6.11 adds the density toggle. (2.7's stretch-year
acceptance is its own `plan_acceptance` table and banner, not a Settings field —
R3-14.)

*Export* moves here from the nav: 1.8's sidebar and rail carry it at their foot, and the phone has no *Export* until this screen does (owner, 2026-10-19; from TASK-014).

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

*From TASK-022 (1.14, PR #130):* `page_count` comes
from Open Library's `number_of_pages_median`, which can be far off: *Harry
Potter and the Sorcerer's Stone* has 16 (a picture-book edition), and a few more
sit under 100. At `× 275` that is a 4,400-word estimate, so the plan should say
how 2.1 treats an implausible page count (a floor, a flag, or a `hand` row in
`book_details.csv`, which enrich never overwrites).

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
`session` — build the right-hand entry path, not the timer. product #20.

*From 1.8b (TASK-015, PR #114):* the batch sheet
(`src/components/BatchSheet.tsx`) ships *Log a session · Log* as
`aria-disabled="true"`, with the reason *Sessions aren't here yet.* Enable it
here to open the session sheet, and drop the reason.

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
Five slots in this order, per the feel pass (D-40; STYLE_GUIDE §14.1–§14.2,
Feel Review §4), which replaces "Books — v4" in `design/mockups.html` on layout
and copy: **Now** (the book in hand, or *Between books*); **Up next in Qn**, a
cover shelf of the current quarter's books in `ordinal` order with **Reorder**
(1.9's quarter list); **This quarter**, the single-quarter strip (FP-D8);
**On deck**; and **2026 so far**. Depends on 1.7, 1.8, 2.1 and, for the
sittings line, 2.1b.

*From 1.8e (TASK-028, PR #111):* the 834px `bdash`
frame in `design/mockups.html` is drawn from this feel pass at tablet width
(STYLE_GUIDE §14.5): the horizontal hero around a 150 × 225 cover, *Up next in
Q4*, *This quarter*, and *On deck* | *2026 so far* stacked below as two columns,
1.5 : 1. Build the 768–1023px layout from it.

*From 1.23 (2026-10-26 intake):* **Now** shows a book being listened to as it
shows one being read, with the headphones glyph, and *2026 so far* gives
listens beside reads (*31 finished · 6 listened*), from `books_by_year`'s
listened count.

- **Now** is the only large thing (`--r-hero`, the art band on `--art` once
  4.2 stores it): the cover (`--cover-hero`), the title in Newsreader
  (`--fs-hero-name`), the author, `p. 212 of 468` in mono, a 6px `--ready`
  meter, and *Started 21 Sep · about 30 pages a sitting · 7 sittings* once 2.1b
  has sessions. Time left is still evenings at your own session length, never a
  date: *at your set pace* before sessions exist and *at your measured pace*
  after. It is never blank and never hidden.
- **Between books** (§14.2; §15) replaces the old empty state. A 72px cover of
  the last finished book with a `--ready` check, a `✓ finished · Sun` badge,
  *Between books.*, a line saying what you finished and how long it took
  (*You finished Piranesi on Sunday, 245 pages in nine days. Nothing's on the
  go, and that's fine.*, from 1.5's dated reads; an undated finish says what,
  not when), the top of the current quarter's plan (the lowest-ordinal
  `to_read` book, D-37), and *Pick something else*. The thumb bar's verb starts
  the top of the plan, named.
- **This quarter** (FP-D8) is one strip for the current quarter against the
  760k rule: *Q4 2026 · 3 of 7 read · 615k planned · 760k a quarter*. The full
  plan rail stays on `/books/plan` (2.10); 2.2b's rail component draws this
  strip as a one-quarter rail.
- **2026 so far** is three this-year counts on `--raise` (books, pages, new
  authors), one line, linking to Stats (6.2). Never the backlog.

**Desktop** (§14.6; Feel Review §11d; `design/screenshots/desktop/07…10`): Now,
*Up next in Qn* and *This quarter* in main; *On deck* (Situation) and *2026 so
far* in 1.8's side rail. The hero has 2.4's geometry with a 168×252 cover, the
title at 32/36 (`--fs-hero-name-desk`), the page count at 32/36 mono, and the
meter under the lens's 480px cap. The shelf gets ‹ › only when it overflows
(1.10). *This quarter*'s strip fills its card's inner width, each block k / 760
of it, with the 760k rule at the right edge. *On deck* rows hide **Plan** at
rest and reveal it on row hover or `:focus-within` with a fine pointer, as
2.4's *+ Up next* (FP-D15). *Between books* drops *Finished it* from the header
and names the top of the plan in full on the primary; below about 1100px it
truncates and keeps the full title in its accessible name. No capacity card and
no *Place them* at any width until the question below is answered.

*From 1.8b (TASK-015, PR #114):* 1.8b builds and
unit-tests `ThumbBar`'s books configuration (`src/components/ThumbBar.tsx`):
the bar *Log progress · ✓ finished · search*, and the header *Search · Finished
it · Log pages*. Since `/books` was still a redirect, nothing renders it yet.
Render it here, wrapped in `VerbsProvider`, as the comics dashboard is.

**Open, stop and ask before building** (the feel pass is silent): the old
dashboard had a capacity card with **Rebalance** and **Accept** (2.7) and an
amber unplaced-entries card with **Place them** (2.8). The feel pass draws
neither. Where those decisions surface now — an amber card in slot 4 when one
is open, the strip's own badge, or `/books/plan` only — is the owner's call.

**The capacity number is amber past 100%, never red**, and the word "behind"
does not appear anywhere on this screen.

**Check:** the feel-pass screenshots (the header's widths, themes and
reduced-motion and reduced-transparency passes) of reading and *Between books* —
no horizontal scroll, the capacity rule legible, the primary action inside the
bottom 96px. The five slots render in the order above. Nothing on the screen
resolves to `--danger`. With nothing reading, Now renders *Between books* naming
the last finished book, and its offer is the current quarter's lowest-ordinal
book that is still `to_read` (D-37), named on the button; with nothing ever
finished it omits the finished line. The strip's planned total equals 2.1's
figure for that quarter. *2026 so far* has three counts, all this year.
At 1280px *On deck* and *2026 so far* are in the side rail, and **Plan** follows
2.4's hover rule for *+ Up next*.

### ☐ 2.2b The plan rail · M
Depends on 2.2 (the slot) and 1.7. Split out of 2.2 (R3-12). Since D-40 the
dashboard shows one quarter of it (FP-D8, 2.2's *This quarter* strip); the
four-column rail is `/books/plan`'s (2.10). The component and its rules below
are the same for both.

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

1.8d's `PlanRailSkeleton` was measured against a fixture of the mockup's markup; re-measure it against this component, within 2px at 360px (from TASK-027).

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

*From 1.4c (TASK-008, PR #77):* the Add books sheet
draws *Year or quarter…* in its *Add to* row `aria-disabled`, with the reason
*Year or quarter… arrives with the plan editor.* (the copy since 1.7, which
enabled *On deck*; `src/components/AddBooks.tsx`), and leaves out the mockup's
secondary *Year or quarter…* button on a search result row. This task enables the chip and
adds that button; the add itself is `POST /api/books`, whose `destination`
gains the plan level.

*From 1.7 (TASK-011, PR #96):* a quarter's ordinals count
every `reading_plan` row, a soft-deleted book's included, while `plan_period`
hides that book, so a planned book removed from the library would leave a
visible gap (1, 3). Nothing soft-deletes a planned book yet; whatever first
does should take its plan rows out through `takeOutOfPlan` / `moveToSomeday`
(`src/db/writes.ts`), or this task's lists re-rank.

*From 1.7 (TASK-011, PR #96):* undoing an add from a
search result clears the toast but leaves that row reading *✓ Added to …*
(disabled), so it can't be re-added without searching again (1.4c's
behaviour, seen at every destination). This task reworks those result-row
buttons; reset the row when its add is undone.

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
Five slots in this order, per the feel pass (D-40; STYLE_GUIDE §14.1, §15, §16;
Feel Review §2, with `design/LedgerComics.dc.html` as the live component), which
replaces "Comics — v4" in `design/mockups.html` on layout and copy. Depends on
1.6, 1.8, 1.8b, 1.10, 2.5b and 2.6.

*From TASK-017 (1.9, PR #117):* the hero's *Also reading* row
links to `/comics/status?tab=inflight` (*Also reading → All*, design §11.2).
1.9 links the *Mid-run* head there in the meantime; the hero replaces it.

*From 1.8e (TASK-028, PR #111):* the 834px `home`
frame in `design/mockups.html` is drawn from Feel Review §10c (STYLE_GUIDE
§14.5): the horizontal hero, *Since Tuesday* | *Also reading* in one row, a
five-cover shelf, the telescope at W = column − 84 with a three-column ladder,
and *Ready when you are* | *2026 so far* below, 1.5 : 1. Build the 768–1023px
layout from it.

| Slot | Content |
|---|---|
| 1 Now | **The hero** (P1, P3; FP-D3, FP-D4). The only large thing on the page, radius `--r-hero` 20, on the `--art` band once 4.3 stores it (`--surface` until then). The cover at `--cover-hero` (112, 2:3, `--sh-cover`), the kicker *Up now*, the issue number in mono `--fs-hero-num` 44/48, the story title in Newsreader italic 19/23 (`issues.story_title`; omitted when null), and the run · credit line. Then the **This stretch** lens: 24 cells, one per issue around the resume pointer (fewer on a shorter run), run-relative and never catalogue-relative, read-here cells `--ready`, read-elsewhere cells dashed grey, the head cell ringed with `--halo`, ends labelled (`#130 … #153`) and the count *45 of 381 read*. Then the **Since Tuesday** stack: up to four covers of the issues marked since your last visit, with the count. Then **Also reading**: the other runs in flight as one row with a 32px secondary verb (*Astonishing X-Men 11 / 25 · Read #12*). |
| 2 Next | The Up next cover shelf (1.10), **Start** on the first card, **Reorder** on the slot head. |
| 3 Position | The telescope card (2.5b), unchanged: horizontal, 14px minimum cell, plus the ladder (FP-D1). |
| 4 Situation | **Ready when you are** (§15; it was *Unlocked and waiting*): at most three rows, each with **+ Up next**, then an *All N* text link. |
| 5 Rollup | **2026 so far**: three this-year counts on `--raise`, in one line of numbers. Never the catalogue. |

The lede is a sentence, not a tally (§15): *14 issues since Tuesday. Next up:
Days of Future Past.*, not *2 runs in flight · 12 up next · 41 ready to start*.
**Removed from the dashboard** (FP-D4): *Rest of this block* (the ladder carries
it), *The frontier* (it moves to the run list, 2.9) and the provenance line (it
moves to Stats, 6.2). So **no catalogue total appears on this screen at all**,
not even as provenance.

Candidate run rows carry **cost and leverage**, not tier: "4,173 to unlock ·
opens 2" (§15; it was *costs 4,173*), with *opens N* from 2.6's `run_opens`,
and an owned-edition tag where one exists. (None does until 5.6 fills
`edition_issues` and 5.10 records what is collected: until then the tag is
absent, never a zero, and this task's check does not depend on it.) Blocked
runs keep the amber badge stating what is missing.

**Tablet** (§14.5; Feel Review §10c): the hero turns horizontal around a 150px
cover (`--cover-hero` at 768px), with the number at 56/60, the story, the run
and the lens to its right; *Since Tuesday* and *Also reading* share one row,
split in two; the shelf shows five covers; the telescope keeps its phone sizing
with `W` = column − 2 × 20 − 44 (548 at 768) and the ladder in three columns;
*Ready when you are* and *2026 so far* stack below as two columns, 1.5 : 1.

**Desktop** (§14.6; Feel Review §11a–c; `design/screenshots/desktop/01…06`):
the five slots keep their DOM order, with Now, Next and Position in main and
Situation and Rollup in 1.8's sticky side rail. The hero is horizontal and
never wider than main: a 168×252 cover from 1280px (`--cover-hero`) and
150×225 from 1024px, padding and gap 24/28 at 1280 and 20/24 at 1024, the
number at 56/60 (`--fs-hero-num-desk`), and the lens in the text column,
capped at 480px (`--lens-max`, about 18px a cell). *Since Tuesday* and *Also
reading* split the footer 1 : 1, and Also reading stays in Now. The telescope
takes its desktop sizes with `W` = main − 2 × 20 − 72 (544 at 1280, 480 at
1024) and the ladder in three columns. *Ready when you are* rows hide
**+ Up next** at rest and reveal it on row hover or `:focus-within`, the row
turning `--raise` over `--dur-1` (FP-D15); with a coarse pointer it always
shows. The meta truncates while the verb shows, the row's accessible name
carries the full text, and *N more are one soft read away* sits under the
*All N* link. The mark (1.8b) plays on the header button. *All caught up*
keeps Situation in the side rail, and the shelf's first card has no **Start**,
because the header carries that verb.

**The mark lands here** (1.8b): the lens cell fills, the stamp lands on the
cover, the three counts tick, the next issue slides in, and the marked cover
joins the stack. Undo (1.2) reverses all of it.

**`<RunStateBadge state hardLeft softLeft>`** (`src/components/RunStateBadge.tsx`)
renders the five states of the `run_state` view (already in `etl/views.sql`)
everywhere a run appears — dashboard, run list, status, search, queue — with a glyph as well as colour and an `aria-label`
with the full sentence (design §11):

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

The telescope card's foot row, when the next block has no name, shows *Block 3
has no name yet* with a **Name it** button. The inbox chip stays beside the `h1`
below 1024px; from 1024px the sidebar's Inbox carries the count (FP-D16).

**All caught up** (FP-D13; §14.2, §15; Feel Review §10a) is the empty state with
no run in flight. The Now slot keeps its shape: a 72px cover of the last
finished run with a `--ready` check, the badge `✓ caught up · 1 Oct`, *All
caught up.*, a line saying what you finished (*You finished Uncanny X-Men on
Sunday… Nothing's on the go, and that's fine.*), the top of Up next with its
readiness badge, and *Pick something else*. Position is the telescope's empty
variant (track rail only, no head, no brackets) **without its own Start
button**, because the thumb bar's verb is *Start {top of Up next}*. The lede is
*All caught up.* With the queue empty too, the offer and the verb are *Pick from
N ready runs*, linking to *Ready, not queued* (M-11). **The *Coming out* list
waits for 5.8**: it lists the next release of each run you follow, with the date
in mono `--ink-2` and a grey *in N days* chip (a date has no colour meaning), and
it needs 5.8's follows and release cache. Until 5.8, the caught-up state has no
*Coming out* list and no release in its lede.

**Every readiness count is computed** (R1-02, D-7). *Ready when you are → All
N* and *Pick from N ready runs* take their numbers from
`run_state`; no literal appears in copy. The reviewed mockups say 41, but in the
current extract **most runs carry a hard prerequisite** (172 of 258 were
`blocked` on 2026-09-23 — a snapshot, not a number to test against), so
*Ready when you are* is a much shorter list than the mockup draws. That is a
data fact, not a layout change — the slot keeps its position and its design, and
the list should grow once the prerequisite audit (2.11a + OWNER-CHECKLIST, D-20)
reclassifies over-hard edges.

*From 1.10 (TASK-016, PR #115):* slot 2's shelf is built
(`src/components/QueueShelf.tsx`), and from 1024px the dashboard already has
main + side rail (`.dash-cols`, `--aside-w`) with *Ready when you are* in the
rail, so the shelf stops at main's edge. 2.4 builds the rest around it: its
`<RunStateBadge>` replaces `QueueBadge` on the shelf and the queue row, the rail
rows' **+ Up next** becomes the FP-D15 hover reveal, and
`src/app/comics/(dash)/loading.tsx` gains the shelf's geometry (it has none yet).

**Check:** the feel-pass screenshots (the header's widths, themes and
reduced-motion and reduced-transparency passes) of rest, the mark storyboard,
*All caught up*, offline and loading. The five slots render in the order above.
Test that a run whose readiness is
`ready_hard` renders the green-outline `○ ready · 1 soft unread` badge and still
appears in *Ready when you are*; that the slot never renders more than three rows;
that a blocked run appears only in the dimmed
state with its true cost; and that no element on the page renders `--danger`.
On a 381-issue fixture run with 45 read the lens renders 24 cells, every one an
issue of that run, the head cell at the resume pointer, and its count reads *45
of 381*; on a 10-issue run it renders 10. The *Since Tuesday* stack holds at most
four covers and its count equals the marks since the fixture's last visit.
Snapshot test of `<RunStateBadge>` for all five states, driven by a fixture
that puts one run in each state (never by naming a real run — the seed moves
under the audit, S-11): the `ready_hard` run renders outlined green, the
`blocked` one amber, an undated `read` run `✓ read` with no date, and no
`reading` row carries a prerequisite badge, and the telecard's `reading` badge is
`◐ n / N` like every other (M-04). The phone and desktop telecard badge
markup is identical. At no width does the page text contain the catalogue
total. With no run in flight the page renders *All caught up.*, the telescope's
empty variant with no button inside it, and the thumb bar's verb names the top
of Up next; with an empty queue as well, the offer links to *Ready, not queued*.
At 1280px Now, Next and Position are in main and Situation and Rollup in the
side rail, in that DOM order; the hero is no wider than main and the lens no
wider than 480px; with a fine pointer *+ Up next* is hidden at rest and shows on
row hover and on keyboard focus inside the row, and with touch emulated it shows
at rest.

### ☐ 2.5 The telescope · M

*From 1.8a (task/1.8a-tokens-control-states):* in `design/mockups.html` the telescope frame's stub label overlaps the run-rail end label (`+10 runs · 244` over `244`, `+11 runs · 238` over `641`), phone and desktop. It predates 1.8a's 11px floor; the real geometry (`layout.ts`) should fold or drop the label, never overlap it.

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

**Geometry** (design §5, DIAGRAMS 3b) lives in
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
  design §5 *Rail count and fallbacks*.
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
- **Where it sits** (D-40, FP-D1). On the comics dashboard the telescope is its
  own card in slot 3, *Where you are*, not part of the Now card, and the
  component is otherwise unchanged. It also leads the run detail, under the
  run's art band and above the spine (Feel Review §6). The ladder's BLOCK row
  carries what the dashboard's removed *Rest of this block* slot said (*run 2 of
  5 · 3 runs left in the block*). **On a dashboard the empty variant has no
  button** (FP-D13): the thumb bar carries *Start {top of Up next}*. Elsewhere
  it keeps its one primary action.
- **Fully read keeps a way on** (design §5 *Fully read*, A2.3; follow-up
  from PR #69, task 1.6). Its action is secondary: *Next in block · {run}*,
  the block's next unread run (the same run 2.12's *Start {next in block}*
  names). It navigates and never writes (R1-08). If no run in the block is
  unread, the action is left out. 1.6 drew the run page's fully-read badge
  without this action, because it needs the block logic built here.
- **The mockup follows** (standing rule 6): `design/mockups.html`'s telescope
  frames on `home`, `telescope`, `krakoa`, `watchlist`, `dashextras` and `states`
  are redrawn horizontal in this PR, from the same geometry, and the vertical
  drawings are removed.

1.8d's `TelecardSkeleton` was measured against a fixture of the mockup's markup; re-measure it against the telecard drawn here, within 2px at 360px (from TASK-027). The `/comics` loading screen also ends in `RunRowsSkeleton`, whose rows have no `.measure` meter: a Mid-run row is about 10px taller once loaded, so the page shifts as it arrives. Give the skeleton that row's geometry too (from TASK-027).

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
no run in flight the telescope renders the track rail only and no brackets,
with one primary button off a dashboard and none on one (FP-D13). Tabbing through the phone frame reaches track, block and run
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
  event on the path with its distance in issues. **Editions owned** needs
  `edition_issues` (5.6) and collected flags (5.10), both later phases: until
  those rows exist the tile is hidden, not drawn as zero, and 5.10's check
  covers it.

- `run_opens` — **what a run opens** (D-40; the checklist's step 8). For run
  R, the runs that name R as a direct prerequisite and whose readiness, from
  the existing readiness view and counting R as read, is `ready_hard` or
  `ready_all`. For a finished run that is simply their readiness now: *What this
  opened* (2.12). Ordered **same block as R first, then by queue position
  (1.10), then track order**. It answers the count and the rows, so a screen
  takes the count plus the first three. **The `opens N` figure on every run row
  comes from this view** (2.4, 2.9), not from `run_leverage`'s direct count,
  which can include dependents still blocked by something else. Derived, never
  stored, in `etl/views.sql` (a view, or a function taking the run if a view
  cannot express "counting R as read").

Two surfaces read them. **Why blocked?**: the amber `⊘ N runs first` badge is a
button that opens `/comics/[runId]/path` (an intercepted sheet) listing the
cheapest ordered chain — run, own cost, running total, hard/soft — with *+ Up
next all*, computed from `run_ancestors()`. **Unlock preview**: the `opens N`
tag is an `aria-expanded` button that expands `run_opens`' rows, marking which
become `ready_all` and which `ready_hard`. Copy is *N to unlock*, never *costs
N* (D-40, §15). Mockup: `path`.

*From 1.10 (TASK-016, PR #115):* the Up next shelf and the
queue list draw a blocked run's badge from `run_queue_state.blocked_by`, the
*direct* hard prerequisites still unread (`src/components/QueueBadge.tsx`). Once
`run_ancestors` gives the transitive count, the badge reads that, and on the
shelf it becomes the *Why held?* button the feel pass draws.

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
the unlock preview for `claremont-xmen` lists exactly its `run_opens` rows,
split by resulting state, and never more than its direct leverage. On a fixture
where R is the hard prerequisite of A (nothing else), B (also hard-blocked by
an unread S) and C (soft only), `run_opens(R)` is A and C and not B; reading S
adds B; with A in R's block and C queued, A comes before C.

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

Every row carries *N to unlock* and *opens N* (D-40, §15) from `run_unlock_cost` and
`run_opens` instead of a tier badge; tier moves to the sort control alongside
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

**The frontier lives here now** (D-40, FP-D4; it left the dashboard). Above
the first track, a compact *Frontier* group shows 2.6's `frontier` tiles —
runs fully ready, runs one soft prereq short (the `ready_hard` outline), tracks
never started, owned editions covering a ready run (hidden until 5.6 and 5.10;
see 2.6), the cheapest block to close and the next event on the path — each a
link into this list, filtered.

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
The frontier group's counts equal 2.6's `frontier` view, and a row's *opens N*
equals its `run_opens` count.

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

### ☑ 2.11a Prerequisite cycle check · S
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

### ☐ 2.12 Run and block completion · M
D-40 (P6; FP-D11, FP-D14; STYLE_GUIDE §14.4, §15; Feel Review §7 and §10b).
Finished things stay visible: the run page after its last mark says what you
finished and what it opened. Depends on 1.8b, 2.5b and 2.6 (`run_opens`); 4.3
brings the key art and the `--art` band, and until then both are the neutral
placeholder on `--surface`. Nothing here is stored: *finished* is `run_state =
'read'`, its date is `run_state.finished_at`, and *opened* is `run_opens`.

**Run complete** (FP-D11), on `/comics/[runId]` when every placement is read
here:

- A centred band: the key art at 120 × 180, a grey `✓ read · Oct 2026` badge
  (the five-state `read` badge, unchanged: grey, never green), *Finished.* in
  Newsreader 44/46, *Uncanny X-Men, all 381 issues.*, and the date span with its
  duration (*Mar 2025 – Oct 2026 · 19 months*, from the first and last dated
  reads; undated reads give no span, S-14).
- A card holding the run rail fully green and the block rail. **The run rail
  fills once, left to right, over `--dur-fill`** when you arrive from the last
  mark; any later visit draws it already full, and reduced motion draws it full
  at once.
- **What this opened**: `run_opens`' count and first three rows, each with its
  readiness badge, then *All N newly ready*.
- One closing `line` (Newsreader italic 18/26). It may name a record (*The
  longest run you've finished so far.*), computed, never a goal, and is omitted
  when no record applies.
- Verbs: *Start {next in block}* (the block's next unread run; navigates, never
  writes, R1-08) and *Not now*.

**Block complete** (FP-D14) steps the same screen up a level when the run you
just finished was the block's last unread run: the block's covers fanned out
(60 × 90, overlapping by 16), a grey badge, `X-Men · block 1 of 7`, *Foundations,
done.* (an unnamed block reads *Block 3, done.*), the run count, issue count and
span. The track rail is the record: its cell fills over `--dur-fill`, then the
head ring moves to the next block over `--dur-4`. Then *The block* (its runs,
each with a `--ready` check), *What this opened* across the block, a closing
line, and *Start block 2* · *Not now*.

**Desktop** (§14.6; Feel Review §11e–f; `design/screenshots/desktop/11…14`):
both states sit in the run detail's centred 720px column (1.8). The band is
inside the column with `--r-xl` corners, not full-bleed (FP-D17); phone and
tablet stay full-bleed. The key art is 160×240, and the block fan 80×120
overlapping by 20. Block complete puts *The block* and *What this opened* side
by side. The thumb bar stays (D-25): glass across the content area, its buttons
held to the 720 column, 48px, primary first (*Start {next}* · *Not now*), with
120px of bottom padding on main to clear it.

Copy is STYLE_GUIDE §15's: *Finished. Uncanny X-Men, all 381 issues. Mar 2025 –
Oct 2026.*; *Foundations, done. Five runs and 664 issues, ending with
Excalibur.* No confetti, no streak, no exclamation mark. 5.4's rating and note
sit at the foot of this screen when 5.4 lands.

**Open, stop and ask:** on a later visit to a run that closed its block, does
the page show the block state or the run state? The feel pass draws only the
moment after the mark.

**Check:** on a fixture block of three runs, marking the last placement of the
first renders *Finished.*, the grey `✓ read` badge with no green fill, the full
run rail, and *What this opened* whose count equals `run_opens` and whose rows
are its first three in order. Under emulated reduced motion the rail is full on
first paint. A run with undated reads renders no date span. Marking the last
placement of the block's last unread run renders *done.* with every run of the
block listed and checked. Nothing on either screen resolves to `--danger`, and
neither contains a catalogue total. At 1280px the band's box lies inside the
720px column with rounded corners, and the thumb bar renders with *Start* first.
The feel-pass screenshots of both states.

---

## Phase 3 — Editing

**Goal:** Maintain the catalog in the app: inline edits, runs, prerequisites, eras, detail sheets and adding at scale. **Milestones:** M13–M15.

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

**One `.editable` field, six states** (UX-N06; product § Editing principles, principle 1): *idle*;
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

*New Run* becomes a second **Resolve** choice for a comics inbox note, beside
Add issues, and `/inbox`'s footnote goes back to the mockup's "Resolving a
comics note opens New Run"; a run created from a note resolves it in the same
transaction, as the add flows do (D-64; from TASK-009, 1.4b, PR #80).

**Other publishers** (2026-10-20 intake: *add DC and other publishers' comics,
like Walking Dead and Invincible*). Nothing in the catalog is Marvel-specific:
labels, the parser, Metron and the volume map all take any publisher. The one
Marvel default is `tracks.publisher` (`DEFAULT 'Marvel'`). So the track
assignment here can also **create a track**, with a name and a publisher
(*Marvel · DC · Image · Other…*), and the run list's track filter shows a
non-Marvel track like any other.

**Check:** create a run, assign two tracks, assert it appears under both filters;
assert saving a why stores `hand`, and that nothing in this task calls Anthropic.
A track created here with publisher *Image* stores it, and a run assigned to it
appears under that track's filter.

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
not exist on Android, which is the primary device. design §13;
mockups "Book detail sheet".

Content: summary, genre, year, page and word count with the
`stated`/`estimated` flag, notes, shelf membership, plan placement, reread
history. The run page stays a full page — too dense for a sheet.

*From 1.23 (2026-10-26 intake):* the reread history counts reads and listens
apart (*Read 2× · Listened 1×*), each listen marked with the headphones glyph.
The *Listened* line appears only when there is a listen or the book is being
listened to.

From the 2026-10-20 intake: *Your record* shows the start date beside the
finish (1.17), and each read in *History* shows both, with the days taken
derived. The series name is a link to its series page (5.9). If 1.18 already
added `books.summary` and `books.subjects`, this task reads them and adds
neither.

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
(`.claude/rules/schema.md`: never add a per-user boolean to a catalog table). The options are
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
  read only in another run stays visible, with its grey hint (data model 2.14).
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
product § Editing principles, principle 3, *archive, don't delete*; Review N UX-N15. Depends on 0.4
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

### ☐ 3.8 Blocks: assign, order, name · M
Coverage check, 2026-10-08; product C4 and Part 3 (*edit everything*). The
workbook placed every run in a block, and extract loaded `blocks(track_id,
number, name?)`, `runs.block_id` and `runs.sequence` from it. 3.2 creates runs
and assigns tracks, but no task moves a run between blocks, orders it within
one, or names a block (`name` is nullable precisely so blocks "get named
later"). After cutover the workbook cannot do it either. Depends on 2.9 (the
block bands it edits), 3.1 (the inline-field pattern) and 1.2 (undo).

- **On `/comics/runs`**, each block band's `⋯` menu offers **Rename** (3.1's
  inline field; empty clears the name back to *Block N*) and **Add block
  after**. Each run row's `⋯` menu offers **Move to block…** (a sheet listing
  the track's blocks and *No block*) and **Move up · Move down** within its
  block, the same keyboard route as 1.10's queue. Drag is a `(pointer:fine)`
  extra, never the only route.
- **What is written:** `runs.block_id`, and `runs.sequence` contiguous from 1
  within the block; `blocks.number` contiguous from 1 within the track, so
  `(track_id, number)` stays unique. A moved run joins the end of its new
  block. Every write raises 1.2's undo toast.
- Removing a block is not in this task: `blocks` has no `deleted_at`, and
  adding one is a schema change (ask first).
- Phase 3, so standing rule 5's adversarial review applies.

**Check:** moving a run to another block sets its `block_id`, appends it at the
end of that block, leaves both blocks' sequences contiguous from 1, and changes
`block_position` for that run to match. *Move up* swaps two sequences and
nothing else. Renaming a block shows the name on the run-list band and on the
telescope's block rail; clearing it shows *Block N* again. *Add block after*
block 2 renumbers the later blocks with `(track_id, number)` still unique.
Undo restores the previous block and sequence. No derived count is written.

### ☐ 3.9 Volume map editor · S
Coverage check, 2026-10-08 (the owner chose an editor over cutting the
table). Depends on 1.12 (which fills `volume_rules`), 1.3 and 1.3c (the parser
and review table it feeds) and 2.0 (Settings). The volume map is the approved
answer to "which volume does a bare `Captain America #1` mean in this run",
and after cutover it can no longer be edited as a CSV.

- **`/settings/volumes`**, linked from Settings' volume-map line (2.0, whose
  counts are computed, D-7): the rules grouped by series, each showing its run
  (or *any run*), its issue range (or *any issue*) and its year. **Add**,
  **Edit** and **Remove**. Remove deletes the row and raises the undo toast:
  `volume_rules` is configuration with no reading history and no
  `deleted_at`; adding one is a schema change (ask first).
- **A rule that overlaps** another for the same series and scope is refused,
  `aria-disabled` with the reason shown (*Overlaps X-Men · any run · #1–200*).
  1.12 writes *Always use* rules by select-then-insert with no unique key
  (case-sensitive on `series`), so a stale tab could write a duplicate: the
  editor dedupes, or a unique expression index is added here.
- **The parser reads it.** 1.12 already applies the rules in the parser (the
  run's own rule before an any-run rule, only inside the rule's issue range,
  annual rules under `<Title> Annual`), so a covered label is not flagged. This
  entry is left with the review row pre-selecting that year and saying *from
  the volume map*, and the user changing it; nothing is written without 1.3c's
  accept. With no matching rule, the row is flagged for a pick as before.
- **Nothing is relabelled.** Rules apply to labels entered after the edit;
  existing `issues` rows change only through an accepted label review
  (`.claude/rules/schema.md`).
- The mockup gains the screen (standing rule 6).

**Check:** `Captain America #1` typed into a run with a run-scoped rule to 2018
pre-selects `Captain America (2018) #1` marked *from the volume map*; the same
label in another run, with only an any-run rule to 1998, pre-selects 1998; with
no rule it is flagged for a pick as before. A rule overlapping an existing one
for the same series and scope is refused with its reason shown. Editing a rule
changes no existing `issues` row. The Settings line's counts equal the table's.

### ☐ 3.10 Add from a series' issue list · M
Backlog intake, 2026-10-20 (owner: *when creating or changing a run, add many
issues from one series at once: show every issue, then check them*). Today
*Search* in Add issues asks Metron one number at a time, ten a search at most
(D-60), and a longer stretch is *Type it*'s range (`#1-60`). This adds a third
way in: browse a series. Depends on 1.3b, 1.3c and 3.2.

- **Pick a series, then a volume.** The search box takes a series name. The
  results are series (name, volume year, publisher, issue count): your own
  catalog's first (*in 3 runs*), then Metron's `series/?name=`. Every publisher
  Metron carries is offered (DC, Image, Skybound), not only Marvel.
- **See the whole volume and check what you want.** One list in issue-number
  order, from your catalog and Metron's `series/{id}/issue_list`. That is pages
  of 100, so a 300-issue volume is three requests, cached in `metron_cache`
  (D-53) and paced by its 20 a minute. Each row has the number, the cover date,
  the story title when known, and its state: *in this run* (checked and
  locked), *in 2 other runs*, or new. **Select a range:** tap the first, then
  *Through here* on the last, or shift-click with a fine pointer. *Select all*
  and *None* sit above the list.
- **This amends D-60's rejection** of walking an issue list. That was the wrong
  tool for a typed number range, and it is the right one for browsing one
  volume. Record the amendment in the decisions log at the plan gate.
- **Then the existing path.** *Review N issues* hands the checked issues to
  1.3c's review table and insert, at the add flow's insertion point. Labels
  are in the bulk-entry grammar and carry their Metron ids. The label rule is
  unchanged: nothing is written without the accept. 3.11 arranges them.
- Loading, rate-limited and error states are 1.3b's, and *Type it instead*
  stays the escape.

**Check:** with a recorded Metron fixture for a 120-issue volume:
- opening it makes two `issue_list` requests, and opening it again makes none;
- issues already in the run render checked and locked;
- selecting #10 through #24 checks fifteen rows, and *Review 15 issues* makes
  fifteen review rows and writes nothing until accepted;
- accepting inserts fifteen placements in order, with one undo;
- a non-Marvel volume (Image's *Invincible (2003)*, in the fixture) goes the
  same way and its labels parse;
- no page render calls Metron.

### ☐ 3.11 Arrange issues in the reading order · M
Backlog intake, 2026-10-20 (owner: *when adding issues, drag them into order,
not all landing in one place*). Today every staged issue lands at the add
flow's one insertion point, in staged order. Real reading orders interleave,
with tie-ins between main-series issues. No task reorders existing
placements either. Depends on 1.3c and 3.10.

- **The review shows the issues in place.** Before the insert, 1.3c's review
  gains an *Arrange* step: the run's spine around the insertion point, with the
  staged rows, marked *new*, among the existing ones.
- **Moving a row.** With a fine pointer, drag by a named handle (`button.drag`,
  as in 1.10's queue). On every device, the row's `⋯` menu offers *Move up ·
  Move down · Place after…* (a picker over the run's placements by label), and
  the keyboard takes Space, arrows, Space (1.10's pattern). A staged row can go
  anywhere in the run. An existing placement can move too, which makes this the
  run's reorder (product § Editing principles).
- **One write.** *Insert* writes every new placement at its own sequence, and
  every moved one at its new sequence, in one transaction. Sequences stay
  contiguous (the deferred unique, R0-15), and one undo puts every sequence
  back. Read state is untouched, because it keys on the placement, not the
  position (data model 2.14). Proposed, to confirm at plan time: a row moved
  across an era boundary takes the era it lands in, and the row says so before
  the write.
- Outside an add, the run's `⋯` menu offers *Reorder issues*, the same step
  with nothing staged.

**Check:**
- Staging three issues and placing them after #3, #7 and #12 inserts each
  there, in one transaction, with contiguous sequences.
- Undo restores the prior order and removes the three.
- Moving an existing read placement keeps its `issue_progress` row and its read
  state.
- The keyboard sequence moves a row one place; the drag handle and the menu
  reach the same result.
- Screenshots at 360px and 1280px.

### ☐ 3.12 Issue previews in Add issues · S
Backlog intake, 2026-10-20 (owner: *when searching for an issue to add, hover
shows its summary, writer and so on*). A search result shows a label and a
date. What the issue is about takes Metron's detail page. Depends on 1.3b.

- **Expand, not only hover.** Each result has a *Details* disclosure
  (`aria-expanded`). It opens on a tap. With a fine pointer it also opens on a
  300ms hover. Hover is never the only route (UX floor). Expanded, it shows the
  cover, story title, writer and artist (the roles 3.5 shows), Metron's summary
  and the series' publisher.
- **One request, on demand.** Expanding asks Metron's `issue/{id}` once,
  through 1.3b's client and `metron_cache`. Expanding the same issue again
  makes no request. A hover that ends before the answer arrives leaves the
  cache filled and shows nothing stale. The rate-limited and error states are
  1.3b's, inside the disclosure.
- Expanding writes nothing to the catalog. The issue's details arrive with it
  on add, as 1.3b's insert does today, and its summary through 4.1's
  `issues.summary` once that column exists.

**Check:** with a mocked client:
- expanding a result makes one detail request and shows the story title,
  credits and summary;
- expanding it again makes none;
- with touch emulated, the disclosure opens on a tap;
- a mocked 429 renders the rate-limited line inside the disclosure;
- expanding writes no row.

---

## Phase 4 — Enrichment

**Goal:** Metron, Open Library and Hardcover backfill, and real covers. A prerequisite for Phase 7. **Milestones:** M16.

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

**An issue's summary** (2026-10-20 intake: *more context for the important
issues in a run*). Metron's issue detail carries a `desc`, already in every
detail page `--details` cached, so it costs no requests. Store it as
`issues.summary` with `summary_source` (`metron | hand`, the same CHECK pair as
`cover_date`), shown on 3.5's issue sheet and in 3.12's preview, and never
replacing a `hand` one. This is a schema change: **stop and ask** before adding
it. It is the factual half of an issue's context. Why the issue sits in *this*
run is the placement's note, which 7.8 drafts.

**Check:** dry run against 50 issues reports match rate and writes nothing.
Then a real run of 200 with the cache warm.

### ☐ 4.2 Open Library and Hardcover backfill · M
Page counts, covers, ISBNs from Open Library; series position from Hardcover.

**The Open Library pass for the workbook's books moved to 1.14** (D-44)
and runs before cutover into `book_details.csv`. What remains is
the after-cutover shape, like 4.1's: once the database is the source of truth
there is no re-extract, so a book added in the app without Open Library data
(by hand, or before an outage cleared) is backfilled straight into `books`, with
the same rule that a `hand` value is never replaced. Hardcover's series position
and the art tone below stay here. ISBNs need a column `books` doesn't have:
stop and ask before adding one.

*From TASK-022 (1.14, PR #130):* 1.14's real run
matched 549 of 1,354 books and left 314 **ambiguous**: Open Library often holds
duplicate works with the identical title and author (*Peace Talks*, *Jade War*,
each Harry Potter), and the 1.14 Check matches nothing when two do. Whether to
pick one (the work with the most editions, say) is an owner decision this item
should ask before reusing the rule; the candidates are in the run's report
(`npm run enrich:books -- --offline`).

**Calibre after cutover** is 4.4 (D-83, amending this paragraph's D-73 path):
an in-app sync from an uploaded `metadata.db`, through a review. This task's
backfill never fills a book from Calibre.

**Book covers get an art tone too** (D-40, FP-D6), for the books Now hero
(2.2) and *Between books*: the same extraction and clamp as 4.3, run at ingest
on the Open Library cover. Storing it (for example `books.art_d` / `art_l`) is a
schema change, deferred by the owner on 2026-10-05: **stop and ask** before
adding the columns, with 4.3's answer in hand so books and comics match.

**Check:** dry run over 100 books; report match rate and conflicts against
existing `series_position`. Once the columns are approved: every book with a
cover has both tone strings or neither, and 4.3's clamp tests cover the
shared extractor.

### ☐ 4.3 Covers in the UI · S
Lazy-loaded, aspect-locked, graceful when null. Do not let a missing cover
shift layout.

Rows created freeform and not yet enriched render `data-enrich="pending"`: a
dashed cover outline and a *metadata pending* line, on the spine, the master
list and book detail.

*From 1.4c (TASK-008, PR #77):* that much is built.
`src/components/Cover.tsx` draws `data-enrich="pending"` and its line on the
spine (an issue with no `metron_id`), the master list (a book with no
`open_library_id` or `hardcover_id`, which is every workbook book until 1.14),
and the Add books and Add issues search results. A spine row only gets a
cover box when it is pending, and a master-list row with no cover draws none.
This task makes every row's box the same: real covers, the neutral
placeholder, and the 28×42 size.

1.8d's `/books/list` loading screen draws run rows (a title and a sub-line), not a book row's cover and status controls. When the master list's rows get their covers here, draw that geometry in the screen's skeleton so it holds the layout (from TASK-027).

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

**Covers lead the feel pass** (D-40, P1; STYLE_GUIDE §4.2, §7). Outside the
spine row (which stays 28×42, SG-D13), a cover is 2:3 at the `--cover-*` widths
— hero 112 (150 from 768px), shelf 112, dashboard row 36, stack 30 — with
`--r-cover` 4 and `--sh-cover`, whose 1px edge stops a dark cover merging into
a dark card. The same lazy, aspect-locked, neutral-placeholder rules apply. The
run detail leads with the run's key art on a full-bleed `--art` band, above the
telescope and the spine (Feel Review §6); the comics hero (2.4) and completion
(2.12) use the same art.

**Cover art tone, `--art`** (FP-D6; the checklist's step 4). Deferred by the
owner on 2026-10-05: it is a schema change, so **stop and ask before adding the
columns**, with the open questions below.

- **At ingest, never at render** (no page render calls out, `.claude/rules/ui.md`). In
  `enrich_comics.py`, after the cover URL is known: downsample the cover to
  about 32 × 48, average in OKLab while skipping near-black (L < .12) and
  near-white (L > .95) pixels, and convert to oklch. A cover with nothing left
  after the skip gives no tone.
- **Clamp to two strings**, exactly: dark `oklch(min(L,.30) min(C,.06) h)` and
  light `oklch(max(L,.92) min(C,.035) h)`. The bounds are why every text token
  keeps 4.5:1 on it; `test:tokens` already proves that at every 30° of hue.
- **Stored with the cover**, both or neither (for example `art_d`, `art_l`
  beside `issues.cover_url`, paired like `cover_date`/`cover_date_source`, and
  carried through `issue_details.csv` so a re-extract keeps them). Rendered
  inline as `--art-d` / `--art-l` on a `[data-art]` element; `globals.css`
  already resolves `--art` from them per theme and falls back to `--surface`
  when either is missing.
- **A one-off backfill** for covers already stored (an `enrich_comics.py` mode,
  `--dry-run` first, cached like every other Metron fetch).
- **It carries no state** and can be switched off: **Settings → Appearance →
  Ambient colour** sets `data-ambient="off"` on the root (`globals.css` already
  honours it), stored wherever *Show covers* is.

Open questions for that conversation: which cover is a run's **key art** (the
first placement's? the head's? a chosen one?), and so where a run's tone lives;
and whether the setting is per device (a cookie, like *Show covers* may be) or
per user.

**Done when** (once approved) every run with a cover has both strings, and unit
tests over the clamp pass: a saturated dark cover clamps to L .30 and C .06; a
pale one to L .92 and C .035; a greyscale cover keeps C 0 and some hue; an
all-black or all-white cover, and a missing cover, give no tone and render
`--surface`.

**Check:** Lighthouse CLS under 0.1 on the books page. No cover placeholder
renders a gradient or an identity hue, and no row renders both an `.edge` and a
`.tag .sq`. On the spine, a row whose issue has a `cover_url` renders one
`<img loading="lazy" alt="">` inside a 28×42 box, and a row without one renders
the issue number in the same box. Swapping one for the other changes no row's
height (CLS under 0.1 on a 381-row spine). With `prefers-reduced-data: reduce`
emulated, or *Show covers* off, the spine makes zero image requests. No cover
element carries a `box-shadow` that resolves to `--halo`.

### ☐ 4.4 Sync from Calibre after cutover: upload `metadata.db` · M
Backlog intake, 2026-10-26 (owner: *Calibre link/import, recurring*). D-83.
Depends on 1.18 and 1.21, and only on cutover otherwise, so it can be pulled
ahead of 4.1–4.3. Extract stops at cutover and nothing local may write the
live database (`LEDGER_LIVE`, D-18), so 1.18's re-runnable command ends there.
This puts the same sync in the app.

- **Choose the file.** A *Sync from Calibre* screen (where it lives, under
  2.0's Settings or the books menu, is the plan's) takes `metadata.db` from the
  Calibre library folder. A Vercel function accepts at most 4.5 MB in a
  request and a library's `metadata.db` can be larger, so the proposal is that
  the browser reads the file (sql.js, WebAssembly) and sends only the fields
  1.18 reads: title, author, word count, series and index, ISBN, tags,
  comments, the read flag and date. The plan checks the limit, and whether a
  server-side read (`node:sqlite`) through Blob storage is simpler.
- **Matching is 1.18's**, in a TypeScript twin of `etl/calibre.py`'s, tested
  against the same fixtures, as `src/lib/issue-slug.ts` twins extract's ids
  (D-59, D-61).
- **A review, then writes.** One screen lists what the sync would do, each
  row accept or reject, and nothing is written until *Apply*: new books (to
  be created at Owned), word counts to fill (only where none is stored, never
  over a hand value), series and ISBN disagreements with Open Library, and new
  reads (D-73). A decided row is remembered, so the next sync doesn't ask
  again. Where that memory lives is the plan's to propose; a new table means
  stop and ask, and joins `src/db/export-tables.ts` (hard rule 7).
- The file is read and discarded: nothing stores `metadata.db`, and nothing
  writes to Calibre. Fetching it from Google Drive instead of an upload is
  *Later* § L-4.

**Check:** with a fixture `metadata.db` of three books (one matching a Ledger
book with no word count, one the Ledger lacks, one with a read), the review
lists one word count, one new Owned book and one read, and nothing is written
before *Apply*; *Apply* with all three accepted writes one `stated` word count,
one `books` row with an `owned` status and one `read_events` row; a second sync
of the same file lists nothing; a book with a hand-entered word count is never
offered a fill.

---

## Phase 5 — Remaining surfaces

**Goal:** The remaining list and detail surfaces: shelves, tracks, editions, releases and series pages. **Milestones:** M17, M18.

Not every item in Phases 5–7 has a **Check:** yet (follow-up from PR #57).
`/new-task` copies an item's Check as its first acceptance criterion, so an
item without one gets a Check written and agreed with the owner, here, before
it is converted.

- ☐ 5.1 Shelves (books only): create, add items, reorder · M. **+ Add to
  shelf** opens the 1.4c sheet with the shelf preselected: search your library
  and Open Library, or add by hand. A book not yet in the catalog is created
  first, then shelved. Each shelf shows its **next three unread** in shelf
  order, not just the next one (design §14 → Shelves).
  - **Context on a shelf** (2026-10-20 intake: *a context field, why a book is
    on it, like the Dark Tower reading order*). Proposed: `shelves.description`
    and `shelf_books.note`, and `shelf_titles.note` in 8.6. **Stop and ask**
    before adding them. The shelf page shows its description under its name,
    and each book's note under its row (*After Wizard and Glass: sets up the
    Wolves*), edited in place with 3.1's pattern. A shelf's order makes it a
    reading order across series and authors, the Dark Tower with its tie-ins,
    and a part-read shelf counts as *in the middle of* (5.12).
  - **Check (the context part):** a note saves, survives a reload and renders
    under its row; a shelf with no description renders no empty line; a note
    on one shelf does not appear on another shelf holding the same book.
  - **A new shelf from the add sheet** (2026-10-26 intake: *create a new
    shelf; right now I can only add to an existing one*). 1.4c's *Shelf…*
    picker ends with *New shelf…*: a name field, then the book goes on the new
    shelf in the same write, and one Undo removes both. A name already in use
    is refused, with the reason under the field. This part is small enough to
    pull ahead of the rest of 5.1 if the owner asks.
  - **Check (the new-shelf part):** *New shelf…* with a new name writes one
    `shelves` row and one `shelf_books` row; Undo leaves neither; a name
    already in use writes nothing and says why.

- ☐ 5.2 Tracks page from `track_progress` · S. `/comics/tracks`: 37 tracks, each
  drawn as a row of its blocks (D-29: cells sized by each block's issue count,
  14px floor, each filled by its own share read, `read / total` as text, counting
  `DISTINCT issue_id`), a *never opened · 24* group,
  and a link to the run list pre-filtered by track. The sidebar's Tracks link
  targets it. **Read runs stay visible** (D-40, P6): each track ends with a
  cover shelf of its finished runs, latest first, so finishing a run adds to
  something rather than removing a row. Mockup: `tracks`.

- 5.3 — removed 2026-09-24 (review M-O3): it duplicated 3.6, which builds add,
  remove, rename, reorder and boundary drag for eras. The number is not reused.

- ☐ 5.4 Ratings and post-read notes on runs · S. **The finish moment**
  (UX-N13, product #8/#11): marking a run's last placement, or setting a book
  to *Read* (3.4 owns the book rating), offers a rating (five 44px targets), a
  one-line note and *Skip*. For a run it sits at the foot of 2.12's completion
  screen (D-40), and the mark's undo toast stays, because it carries Undo. The
  rating control never fills `--ready`; it is an opinion, not progress. No celebration.

- ☐ 5.5 DNF with a reason field · S. DNF opens the same closing card as 5.4
  with a reason field instead of a rating; DNF stays grey (UX-N13).

- ☐ 5.6 `edition_issues` parser: `"Avengers #500-503 and Avengers Finale"` into join rows · M

- ☐ 5.7 **Books coming out** · M. D-35; product B1, B5; Review N UX-N26.
  Depends on 1.4c and 1.8. `/books/releases`: the books you want when they
  come out, read from the `releases` table (`book_id`, `release_date`; the
  workbook's *Coming Out* tab, 44 rows on the 2026-09-23 extract) that only the
  v1 home page ever showed, and that page goes when 1.8c makes `/` a redirect.
  - **What counts as wanted, with no new column:** a `releases` row whose book
    has no `book_status` row for you. **Got it** writes `book_status = to_read`
    (the book moves to Someday and off this one) and raises the undo
    toast. If the owner wants a separate per-user *want* row instead, that is a
    schema change: ask before building (CLAUDE.md).
  - **The list:** *Out now* first (a release date on or before today, not yet
    got), then one group per month, then *No date yet*. Each row: cover, title,
    author, series position, the date in mono, and **Got it**. The month
    grouping is the calendar view product B5 asked for; a month grid is not
    built.
  - **Adding:** 1.4c's add sheet gains a *Coming out* destination with a
    release-date field (a date, or *no date yet*). The book row is created or
    reused as usual, then the `releases` row.
  - **Notify me is in the app, not a push:** the books dashboard's rollup slot
    gains a line, *2 out now · 3 coming this month →*, linking here, so the
    five slots keep their order. The digest email stays 7.6.
  - The sidebar and navigation rail gain *Coming out* under Books (flip its
    `NAV_ITEMS` flag, R1-06); add `/books/releases` to the architecture's route
    table. The mockup gains a `releases` screen, phone, tablet and desktop, with
    its empty state (*Nothing coming out · Add a book*).
  - **Check:** a released-yesterday book with no status renders under *Out now*;
    one due next month under that month; *Got it* writes one `to_read` row and
    removes the row from the list, and Undo restores it; a book already `read`
    never appears. The dashboard line's counts equal the list's. Screenshot at
    360px, 834px and 1280px.

- ☐ 5.8 **Comic issues coming out, for the runs you follow** · M. D-35 (this
  reverses the product doc's *Not building: upcoming-issue tracking*). Depends on 1.3b,
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
  - **Checking is a search you start, never a page render** (`.claude/rules/ui.md`: the one
    live path is an add flow). The screen renders from the cache with *Checked
    3 days ago · Check now*; *Check now* asks Metron for each followed series'
    issues with a store date from 30 days ago onward, through 1.3b's
    server-side client, rate limit, cache and rate-limited state. A daily cron
    is a later option, alongside 7.6, not this task.
  - **The list:** *Out now*, *This month*, *Later*. Each row: cover, the label in
    the bulk-entry grammar, the store date, the run it would join, and **Add to
    Claremont — Uncanny X-Men**, which opens 1.3b's staged review with the
    issue appended after the run's last placement (change the run or the
    position there). *Not for me* dismisses it for you. An issue already placed
    in that run never appears.
  - The comics dashboard's rollup slot gains *2 new issues out →*; the sidebar
    and rail gain *Coming out* under Comics; add `/comics/releases` to
    the route table (architecture § Routes and data access); the mockup gains the screen and its empty state
    (*Follow a series from a run's ⋯ menu*).
  - **Check:** with a recorded Metron fixture, *Check now* for one followed
    series stores its three upcoming issues and writes nothing to `issues`;
    accepting one through the review creates exactly one `issues` row (with
    `metron_id`) and one placement at the end of the followed run, and it leaves
    the list; *Not for me* hides an issue for that user only; no page render
    calls Metron (the mocked client counts calls). A mocked 429 renders the
    rate-limited line and makes no second request before `Retry-After`.

- ☐ 5.9 **Series page from `series_progress`** · M. Coverage check,
  2026-10-08; product B6 (the workbook's Series tab). The view has existed
  since the first load and nothing shows it. `/books/series`: every series
  with its author, `books_read / total_books` in mono and an `.emeter` filled
  with `--ready`, in progress first, then not started, then complete. Each row
  names the **next unread** book, the lowest `series_position` not read
  (derived in the query, never stored), and links to `/books/list?series=<id>`
  (this task adds that filter if the list lacks it). A series whose read count
  exceeds a stated `total_books` (the R2 `pct > 1` case) draws a full meter and
  the true counts. The sidebar and navigation rail gain *Series* under Books
  (flip its `NAV_ITEMS` flag, as 5.7); the mockup gains the screen with its
  empty state (*No series yet · Add a book*).
  - **Every series is a link, to a page of its own** (2026-10-20 intake:
    *series are clickable*; this makes 5.9 an M). Each row links to
    `/books/series/[id]`, not to the list filter. The page lists the series'
    books in `series_position` order, each with its status and dates, and
    marks the next unread. A position between 1 and `total_books` with no book
    in the catalog is a grey gap row (*#4 not in your library · Add*), which
    opens 1.4c with the series named. Wherever the app prints a series name (a
    list row, 3.5's sheet, the books dashboard) it links here. 5.11 adds the
    follow control to this page.
  - **Check:** a series with 3 of 5 books read renders `3 / 5` and a meter
    filled with `--ready`; one with NULL `total_books` counts its listed books;
    a soft-deleted book is not counted; the next-unread line names the
    lowest-position unread book, and a complete series has none. The row's link
    shows only that series' books. A series holding positions 1, 2 and 4 of 4
    renders a gap row for #3, and a series name in a list row links to its
    page. Screenshot at 360px, 834px and 1280px.

- ☐ 5.10 **Editions: collected and read** · M. Coverage check, 2026-10-08;
  product § The owner's list's *Master* row. Depends on 5.6. The workbook's Master tab (178
  trades and omnibuses) was loaded as `editions`, with per-user
  `edition_progress(collected, read)`, and has had no page since; after cutover,
  buying a trade could not be recorded. `/comics/editions`: each edition's
  title, type, year and issue text, with **Collected** and **Read** toggles
  (`aria-pressed`) writing `edition_progress`, and a *Collected* filter. An
  edition whose `issues_text` 5.6 could not parse is listed with a grey
  *issues not parsed* flag. **Add edition** is by hand (no API covers
  editions), matching your own editions first, with the issue text going
  through 5.6's parser. An edition's *Read* never marks an issue read: issue
  reads are per placement (`.claude/rules/schema.md`), and nothing propagates. 3.5's issue sheet
  links its collecting editions here. This is what turns on 2.6's *editions
  owned* frontier tile and 2.4's owned-edition tag.
  - **Collected in, on the run page** (2026-10-20 intake: *collected in:
    omnibus or TPB?*). The run page gains a *Collected in* group: each edition
    whose `edition_issues` cover any of the run's placements, with its type
    (`editions.book_type`: *Omnibus*, *Trade Paperback*, *Epic Collection*),
    how much of this run it covers (*#1–24 of 60*, derived in a view), and
    *Collected*. A stretch no edition covers reads *#25–60 not in an edition
    you've listed*. Editions you have never listed are not discovered here
    (Later § L-3).
  - **Check:** toggling *Collected* writes one `edition_progress` row for the
    user and survives a reload; toggling *Read* writes no `issue_progress` row.
    The frontier's owned-editions tile counts an edition only when it is
    collected and its `edition_issues` cover a ready run, and is hidden while
    no `edition_issues` rows exist. An unparsed edition is listed with the flag.
    Adding an edition by hand creates one `editions` row and its
    `edition_issues` through 5.6's parser. A run whose #1–24 one collected
    omnibus covers shows it under *Collected in* as *#1–24 of 60*, and the
    uncovered stretch as *#25–60*.

- ☐ 5.11 **Author and universe pages, and the follow control** · M. Follow-up
  from PR #58 (1.15's *Not here*); D-42, D-43; product B6. Depends on 1.15
  and 5.9. 1.15 adds `author_progress`, `universe_progress` and the three
  follow tables, and 5.9 draws series. This task draws an author page and a
  universe page in 5.9's shape: `read / total` in mono, an `.emeter` filled
  with `--ready`, and the next unread book (derived in the query, never
  stored). It also adds the control that sets a follow's state on all three
  kinds of page: *Tracking · Reading · Not following*, a `role="radiogroup"`
  writing `series_follows`, `author_follows` or `universe_follows` for the
  user. *Reading* stays set until it is changed (D-43). Done is never stored.
  *From TASK-023 (1.15, PR #134):* nothing
  sets a book's `universe_id` after the load, and Grishaverse loads with no
  member books (the books its Series-tab group lists are reads, which D-41
  never loads), so its page would show 0/0 until a book can be put in a
  universe; settle where that happens at this task's plan gate. The first
  vitest suite that writes `book_universes` adds it to `truncateAll` in
  `test/db.ts`, which today clears it only through `books`' CASCADE.
  - **Check:** an author page and a universe page list their books with the
    counts from their views. Setting *Reading* writes one follow row for the
    user, survives a reload, and shows in the view's `follow_state`. *Not
    following* deletes the row. No count or state column is added.

- ☐ 5.12 **In the middle of: series, authors, universes and reading-order
  shelves** · S. Backlog intake, 2026-10-20 (owner: *series, authors and
  tracks I'm in the middle of*, where "tracks" means both universes and
  ordered shelves). Depends on 1.9, 1.15, 5.1 and 5.11.
  - **What counts is derived, never stored.** A series, universe or books
    shelf with at least one read and at least one unread live book, or one the
    owner follows as `reading` (D-43). An author counts only when followed:
    376 authors would otherwise list everyone you have read once with a book
    left. Read from `series_progress`, `author_progress`, `universe_progress`
    and a new `shelf_progress` view (books listed and read per shelf, live
    books only).
  - **Where it shows.** 1.9's books *In flight* tab gains a second group under
    the books being read, *In the middle of*. Each group gets one row: its kind,
    name, `read / total` in mono, an `.emeter` filled with `--ready`, and the
    next unread named. Most recently read first. The books dashboard's rollup
    links to it.
  - **Check:** a series with 2 of 5 read appears and one with 5 of 5 does not;
    a series with none read appears only when followed `reading`; an author
    appears only when followed; a shelf with 1 of 3 read appears; nothing is
    written; each row's counts equal its view's.

- ☐ 5.13 **Comic series page: every issue of a volume, its runs and its gaps**
  · M. Backlog intake, 2026-10-20 (owner: *a series view: every issue in my
  collection and to-read lists, the runs it's in, other metadata, with gaps*).
  Depends on 3.5, and is better after 4.1. `/comics/series/[key]`, one volume
  (`X-Men (2019)`):
  - Every catalog issue of the volume, in number order, with cover, cover date
    and story title. Beside each, the runs that place it and its read state in
    each, as 3.5's *Your record* draws them.
  - **Gaps.** A number between the volume's first and last in the catalog that
    no issue has is a grey stub (*#13–15 not in any run*). Once 4.1 has
    Metron's issue count for the volume, the numbers after your last are too.
    Coverage is text (*48 of 61 issues in your runs*), never a bar: you measure
    against what you chose, not the catalog (ui.md).
  - The volume's facts: publisher, years (from cover dates), and the runs that
    draw on it.
  - **The series key is open: stop and ask at plan time.** Either parse series
    and volume from the label in a view (the bulk-entry grammar, `Title (Year)
    #N`, where the 302 freeform labels fall out), or store Metron's series id
    per issue from 4.1 (`issues.metron_series_id`, a fact, not derived). Prefer
    the Metron id if 4.1 has landed.
  - The issue sheet's series line and a spine row's label link here.
  - **Check:** a fixture volume with #1–12 and #16–20, placed across two runs,
    renders 17 rows and one gap stub, `#13–15`, each row with its runs and
    their read state. A soft-deleted placement is not listed, freeform labels do
    not appear, and no page render calls Metron.

---

## Phase 6 — Polish, in any order

**Goal:** Polish, in any order. **Milestones:** M19–M21 (6.2b in M12).

- ☐ 6.1 Global search, `Ctrl+K`, across runs, issues, books, series, events · M.
  The overlay also takes verbs: a `>` prefix lists *Actions on this screen*
  (`> mark through #160`, `> move Piranesi Q3`, `> queue Priest BP top`) above
  *Results*, and results are grouped Comics · Books · Watch. The shortcut shows
  in the sidebar; on the phone the trigger is the 44px search icon.
  *From 1.8b (TASK-015, PR #114):* the thumb bar's and the
  dashboard header's *Search (Ctrl K)* slot is drawn, `aria-disabled`, until this
  lands. Turn on the `search` item in `NAV_ITEMS` and the slot becomes a link
  to it (`SearchVerb` in `ThumbBar.tsx`).

- ☐ 6.2 Stats and year in review — depends on 1.5 and 2.1b · L
  Five charts per product § Metrics: books/year with plan overlaid, genre mix
  planned vs read, track completion (block rows, D-29), reading velocity, publication-decade
  coverage. No streaks. **The provenance line lives here** (D-40, FP-D4): *73 of
  10,834 issues logged…*, small and grey, is the one place the catalogue total
  appears; the dashboards no longer carry it. The dashboards' *2026 so far*
  rollups link here. *From 1.23:* books per year splits read from listened,
  and listens get their own count (books listened per year).

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
  highlighted row with *Another* and *Plan for…*), plus saved views (as 2.9) · S.
  Also product B3 and the route table's `/books/list` row (architecture § Routes and data access): **sort by word
  count**, and a **series-completion filter** (*complete · in progress · not
  started*, read from `series_progress`, never computed in the app).

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

- ☐ 6.15 **A favicon** · S. Follow-up from PRs #67 and #69: `/favicon.ico`
  returns 404 on every page load, which shows as a console error in every
  ui-verifier run. Add the icon through the App Router's `app/icon` file
  convention. It stays behind the passcode gate: `/api/health` is the only
  route outside it (CLAUDE.md), and nothing joins it. 6.4's manifest reuses
  the same art.
  **Check:** signed in, the icon route Next emits returns 200, and loading
  `/comics` logs no 404.

- ☐ 6.16 **A malformed request body is a 400, not a 500** · S. Follow-up from
  PR #63, task 1.2: `POST /api/progress/issue` returns 500 on a body that
  isn't JSON, because `req.json()` throws. Every route handler that reads a
  body answers non-JSON, or JSON of the wrong shape, with a 400 and writes
  nothing.
  **Check:** a vitest sends each body-reading route a non-JSON body and gets a
  400, and the row counts of the tables it writes are unchanged.

- ☐ 6.5 Keyboard shortcuts: `j`/`k`/`x`/`/` · S. The keyboard layer (UX-N23):
  a focused-row state on desktop (2px `--brand` ring at half strength on
  `--raise`), a `?` sheet listing `j/k`, `x`, `Shift-x` (range), `/`, `Ctrl K`
  and `g c` / `g b` / `g w`, and the `?` hint beside `Ctrl K` in the sidebar
  footer. **Desktop mark reach** (UX-X03, F6): the header verbs stay (D-25), and
  with a mouse or trackpad (`(hover:hover) and (pointer:fine)`) a spine or queue
  row also reveals a small *Mark read* button on hover or focus, with `x` as its
  shortcut. Phone and tablet are unchanged: their check is already one tap.

- ☐ 6.6 Goodreads and StoryGraph CSV import · M

- ☐ 6.17 **Activity: the reading log as a page** · M. Backlog intake,
  2026-10-20 (owner: *total books read each year, and a past list of read books
  and activity*). The yearly totals exist (`books_by_year`, `/books`' year
  chips) and 6.2 charts them. What has no page is the log itself. Depends on
  1.5 and 1.17.
  - `/activity`: every finished read, latest first, grouped by month under year
    headings, each year with its totals (*2026 · 31 books · 412 issues*).
  - Book rows come from `read_events`, with start, finish and days taken
    (1.17).
  - Comic reads come from `issue_progress`, grouped per run per day: *6 issues
    of Claremont — Uncanny X-Men, #141–146*.
  - Watch events join once Phase 8 exists, and music listens after Phase 9.
  - Filters by medium and year. Undated reads sit at the foot, under *No date*.
  - The sidebar gains *Activity*. Rows come from an `activity_log` view;
    nothing is stored.
  - **Check:** a book read in two different years appears in both (D-65); six
    marks in one run on one day render as one row with the range; undated reads
    come last; each year's book total equals `books_by_year`'s.

- 6.7 — removed 2026-10-08 (coverage check; R0 had flagged it): it duplicated
  7.6 word for word. 7.6 keeps the digest, because Phase 7's *after Phase 4*
  framing fits an email about verified releases (CLAUDE-CODE-PROMPTS). The
  number is not reused.

- ☐ 6.9 **Revisit the theme** — do this near the end, once every screen exists
  and you have lived with it on a phone for a few weeks · M

  **Partly done by Step 3 (D-31, 2026-09-30) and the feel pass (D-40,
  2026-10-05):** the style guide retuned the neutrals and rebuilt dark depth,
  and the owner chose palette 1c *After hours* from three measured candidates,
  keeping the four meanings and the identity hues. What this task still owes is
  the lived-with pass, the CVD check on the eight identity hues and `--brand`
  distance (M-O2). That last one is sharper with 1c: its teal `--brand` sits
  ΔE 6.8 from light `--t6` / `--m-books` and 8.2 dark (`test:tokens` prints it).
  Run the prompt below against `globals.css` as it then stands.

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

**Goal:** Claude proposes, Metron verifies, you approve. Only after Phase 4. **Milestones:** M22.

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

The diff is a table (design §11, *Review tables*), one row per proposed
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

### ☐ 7.7 Catch me up: a recap before a later book in a series · M
Backlog intake, 2026-10-20 (owner: *a summary of the earlier books when I come
back to a series after a while; AI, in real time?*). Depends on 7.1 (the
`proposals` table and the Anthropic client) and 1.17. It writes nothing to the
catalog, so unlike 7.3–7.5 it needs no Metron gate, and it can be pulled
forward once 7.1 lands.

- **When it is offered.** Starting book N of a series (status → Reading, 1.17)
  when the previous book's latest read finished more than six months ago
  (derived) makes the status control and the book sheet offer *Catch me up on
  books 1–3*. The series page (5.9) always offers *Recap so far*.
- **On demand, never on a render.** It is a call the user starts, like an add
  flow's search (ui.md). The answer streams into the sheet as it arrives. It is
  stored in `proposals` with its prompt and response, so reopening costs
  nothing and reads *Recap from 3 Oct · Regenerate*.
- **The spoiler boundary.** The prompt includes only the books before N. It
  asks for the threads that matter going into book N and for nothing from N or
  later.
- **Grounded, and labelled.** The prompt carries each earlier book's title,
  year, Open Library summary (if any) and the owner's own notes. The sheet
  labels the text as Claude's recap, which can be wrong about less-known books,
  and offers *This is wrong*, which marks the proposal rejected. Whether to add
  the API's web search tool for grounding is a plan-time question, cost against
  accuracy.

**Check:** with a mocked client, starting book 4 seven months after book 3
offers the recap, and starting it two weeks after does not. The prompt
includes books 1–3 and no summary or text from book 4 or later. A second open
makes no API call, no page render calls Anthropic, and *This is wrong* sets
the proposal's decision.

### ☐ 7.8 Issue context: draft notes for a run's important issues · M
Backlog intake, 2026-10-20 (owner: *more context for the important issues in a
run*, and *retrieve an issue's context on add or when it has none: if it is
special, or why it is in the run*). Depends on 7.1, 7.2 and 4.1
(`issues.summary`). The context is the placement's note
(`run_issues.notes`), because why an issue matters depends on the run: a
tie-in essential to one reading order is skippable in another. What the issue
*is* (Metron's summary) is 4.1's.

- **Drafting.** The run's `⋯` menu offers *Draft issue notes*, and an add can
  offer *Draft notes for the 12 new issues*. Claude proposes a one- or
  two-sentence note for each placement that warrants one (a first appearance;
  an event tie-in and what to know going in; why an optional issue is here)
  and none for the rest. The prompt is grounded in the run's why, its eras, each
  issue's story title, credits and Metron summary, and the run's prerequisites.
- **Provenance, like a why.** Proposed: `run_issues.notes_source`
  (`hand | claude`, the `why_source` rule). A `hand` note is never replaced or
  re-proposed. A `claude` note may be re-proposed for review, never silently.
  **Stop and ask** before adding the column.
- **Review, then write.** The drafts render as 7.3's diff, and each row is
  accepted, edited (which makes it `hand`) or rejected. Nothing is written until
  accepted. A note may name other issues: those labels pass 7.2's
  verification gate before they show as links (CLAUDE.md).
- **Where notes show:** a marker on the spine row with the note on expand
  (3.6b's row), the issue sheet's placement table (3.5), and the run hero's
  next-issue strip, which already reads the placement note (1.6).
- Whether an important issue also needs a visible *key* marker beyond having a
  note is a plan-time question.

**Check:** a golden test against a fixture run parses the response into
per-placement drafts. Accepting one writes its note with `notes_source =
'claude'`, and editing one writes `hand`. A placement with a `hand` note is
not sent for drafting. A draft naming a fabricated issue renders that label
unverified and unlinked.

---

## Phase 8 — Watchlist: film and television

**Goal:** Films, shows, seasons and franchises. Needs only Phase 0, so it can be pulled forward. **Milestones:** M23, M24.

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
(DIAGRAMS §8b, data model 2.5b). Update `etl/views.sql` in the same PR.

**From the 2026-10-20 intake** (owner: *streaming host, original network or
streaming original, director, studio, length, episodes and seasons, genre,
lead actors, filterable and obvious when browsing*; D-74). These amend
data model §4.2's draft before anything is built (data model 2.20):

- **Networks and studios.** `titles.networks text[]` (TMDB `networks`: the
  original network or streamer, *HBO*, or *Netflix* for a Netflix original)
  and `titles.studios text[]` (`production_companies`), handled like `genres`:
  short vocabularies filtered by containment, with a GIN index.
- **Credits are rows**, as comics' are (data model 2.12). `people(id,
  tmdb_id UNIQUE, name)` and `title_credits(title_id, person_id, role IN
  ('director', 'creator', 'cast'), ordinal)`, cast capped at the top ten
  billed. They replace the draft's `creators` and `cast_top` arrays, so a
  director page (8.10) and a cast filter are joins.
- **Lengths.** `titles.runtime` is a film's length, or a show's typical episode
  (`episode_run_time`, else the last episode's runtime). `seasons.episode_count`
  comes from the same `/tv/{id}` call. A show's season and episode totals are
  `show_progress` columns, never stored (hard rule 2), so the draft's
  `titles.season_count` is dropped.
- **Waiting for a new season.** `titles.tmdb_status` (*Returning Series ·
  Ended · Canceled · In Production*) is a fact from TMDB. `show_progress.state`
  gains `caught_up`: every known season watched, and the show returning.
- **A show's own rating and note.** For a show, `title_status.status` is NULL
  or `dropped`, and the row may carry `rating` and `notes`. For a film, status
  stays required. This replaces *accepts `kind = 'tv'` only with `status =
  'dropped'`*.

**Stop and ask** at plan time for these, as for every column in this task.
DIAGRAMS §8b's watch ERD still draws the arrays and `season_count`, so it is
redrawn in the same PR.

**Check:** test that a `/search/multi` response parses into `titles` rows for
both a film and a show; that `/tv/{id}` populates the full `seasons` array in
one call; and that no code path returns the API key to a client component. A
show with a `dropped` row reports `dropped` even with seasons watched, and a
`watching` `title_status` row for a show is rejected. A `/tv/{id}` fixture
fills `networks`, `studios` and `tmdb_status`, plus `title_credits` rows for
its creator and cast. `show_progress` counts the show's seasons and sums their
episodes. A returning show with every season watched is `caught_up`, and an
ended one is `watched`. A show's `title_status` row with a rating and a NULL
status is accepted.

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
The error line is a grey `×` (UX floor), as 1.3b built it; the TMDB error frame
in `design/mockups.html` still draws `⚠` and is redrawn with this task (from
TASK-006, 1.3b, PR #75).

A Watch note's **Resolve** already leads to `/watch/add?q=…&note=…` (1.4b).
This screen reads `?q=` as Search's starting text (searched only when
submitted) and `?note=`, and the add resolves that note in its own transaction
(D-64). `inbox` has no title column yet, so linking the note to the `titles`
row needs one (a schema question for this task's plan) (from TASK-009, 1.4b,
PR #80).

**Check:** test that adding a show with 2 seasons creates 1 `titles` row and 2
`seasons` rows from a single TMDB call, and that re-adding updates rather than
duplicating. With TMDB mocked to fail, *Save to inbox* writes one inbox row of
kind Watch whose text is the query, and no `titles` row.

### ☐ 8.3 Lists and season progress · M
To-watch, watching, watched, dropped. Show rows display derived progress from
`show_progress` — "2 of 3 seasons" and the next unwatched season — never a
stored status. Inline status, date, and rating at both title and season level.

Every *watched* mark, of a film or a season, also appends a `watch_events` row:
the log, as `read_events` is for books (product § Watch, *rewatch history*).
Marking something already watched as watched again appends a rewatch whose
`rewatch_of` points at the previous event, and leaves the status row as it is.
8.4's detail sheets show that history (coverage check, 2026-10-08).

**Browsing shows the facts, and filters by them** (2026-10-20 intake). Each
row carries, in grey, its year, its network or studio, and its length: a
film's runtime (*2h 49m*), or a show's seasons and episodes (*3 seasons · 28
episodes*, from `show_progress`). A director or creator name sits on the
second line. Filters: film or TV, genre, network, studio, person (a
director, creator or one of the top-billed cast, through `title_credits`),
and length band (*under 2h · 2–3h · over 3h* for films, *one season · 2–4 ·
5+* for shows). Where to watch joins them with 8.9. A show's rating is set at
show level (8.1), and each season keeps its own.

**Saved views, so a filter becomes a collection you name.** The watch list gets
2.9's saved views, the same component and storage, as a third list beside the
run list and the master list. *Save view* names the current filters: *Disney
Animated* is studio *Walt Disney Animation Studios* and film; *DCOM* is network
*Disney Channel* and film; *Nolan* is person *Christopher Nolan*, director.
Views sit in the toolbar row above the controls, and each can be renamed or
deleted. A view stores its filters, never the titles they match, so a title
added later that matches joins it on its own. The examples are the owner's; any
combination of 8.3's filters can be saved.

**When filters don't get it all** (owner, 2026-10-20). A view also holds titles
you add and remove by hand. Its members are the filter's matches, plus its
**additions**, minus its **removals**, so its contents are always *filter ∪
added − removed*:
- *Add to view…* on any title's row or sheet adds it to a view even if no
  filter would match it. That covers a Pixar short in *Disney Animated*, or a
  film Nolan only produced in *Nolan*.
- *Remove from this view* on a matching row hides it there only.
- A view with no filters is entirely hand-picked: *New view* starts empty and
  takes additions. Unlike a shelf, it has no order of its own and no notes; it
  sorts like the list.
- Rows that are there by hand carry a grey *added* tag. Removed titles are
  listed under a collapsed *Removed · 2*, each with *Put back*.

Storage is a plan-gate question (**stop and ask**), because 2.9's views are
stored URLs and a URL is the wrong place for a list of title ids. Proposed:
`watch_views(id, user_id, name, filters jsonb)` and
`watch_view_titles(view_id, title_id, kind IN ('added', 'removed'))`, both in
the export. Membership is computed in the query, never stored.

**Check:** test that marking every season watched flips the show's derived state
to `watched` with nothing written to `title_status`; that marking one of three
gives `watching` with `next_season = 2`; and that a film with no seasons still
reports correctly from `title_status`. Marking a watched film watched again
appends a second `watch_events` row with `rewatch_of` set to the first and
leaves one `title_status` row. The person filter for a director narrows the
list to titles crediting them as director, and the network filter *HBO* to
titles listing HBO. A show row shows its season and episode totals from
`show_progress`. A view saved as studio + film reopens with both filters set,
survives a reload, and includes a matching film added after it was saved;
deleting the view changes no title. A film added to that view by hand appears
in it with an *added* tag, though no filter matches it. A matching film
removed from the view is absent there, still appears on the unfiltered list,
and *Put back* restores it. A view with no filters shows exactly its
additions.

### ☐ 8.4 Detail sheets — film, show, season · M
`/watch/[id]` and `/watch/[id]/season/[n]` as intercepted routes: a sheet over
the list when arrived at from the list, a full page on direct load or refresh.
Show detail includes the season list with per-season status, and every sheet
shows its rewatch history from 8.3's `watch_events`. design §13; mockups "Show detail — seasons".

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
  geometry as comics' no-block fallback (2.5, design §5). No episode rail — episodes
  are deliberately not tracked.
- **Up next** — five rows from `show_progress` and unwatched films, with a
  film/TV toggle and genre chips. **No period control**: there is no watch plan
  to put anything into, and that absence is a design decision, not an omission
  (design §11).
- **What's reachable** — seasons ready, shows never started, films waiting,
  franchise in progress, title waiting longest.
- **2026 so far** — films, seasons, series finished, ranked.

**The feel pass** (D-40; STYLE_GUIDE §14.1; Feel Review §5) recasts the slots
as comics' are: Now is the only large thing (`--r-hero`), led by a 16:9 still;
Up next is a shelf of posters; Position is the 2-rail telescope card; **Paused**
(FP-D12) lists shows untouched for more than four weeks as grey rows with no
nudge (*Still here when you want them.*), grey because paused has no colour
meaning. A `caught_up` show (8.1) is never *Paused*, because it has nothing to
watch until 8.9 finds a new season. And **2026 so far** is three this-year counts (films, seasons, shows
finished). **Open, stop and ask before building**, because the drawing
conflicts with rules that stand: (1) its Now has a one-cell-per-episode strip,
*S4 E3* and *Mark S4 E3 watched*, but the watchlist tracks seasons and never
episodes (`.claude/rules/schema.md`, this phase's header); (2) its shelf has **Reorder**, but
watch has no stored order (no queue table, and no period control by design);
(3) its Position rails read show → season, where this task's are franchise →
series. Until the owner settles them, build the season-level reading: the
current season as the unit, the verb *Mark S4 watched*, and the rails below.

The telecard stripe is the franchise hue (8.1), the coarse rail is headed
**FRANCHISE · release order**, and the unit badge reads *seasons*. The up-next
button says **Start S1** (or `Start S{next_season}`), not a bare *Watch*; a
film's says **Start**. Like comics' *Start* (1.10, R1-08), both navigate — to the
show's next season or the film's detail — and never write; marking is the thumb
bar's job. A show
in Now and the same show's detail must agree on its state — the mockup's Andor
is mid-show (S1 watched, S2 up next) on both.

1.8d's `SeasonRowsSkeleton` was measured against a fixture of the mockup's markup; re-measure it against the season rows drawn here, within 2px at 360px (from TASK-027).

*From 1.8b (TASK-015, PR #114):* until this task, `/watch`
shows 1.8b's empty-state verbs, *Search · Save to inbox*, in the thumb bar and
the desktop header. Give `ThumbBar` (`src/components/ThumbBar.tsx`) its watch
configuration here: slot 1 *Mark S2 watched* (the season-level verb above),
slot 2 *+ Add*, slot 3 search.

**Check:** test that a show with season 1 watched and season 2 watching appears
once in Now and not in Up next; that a show with every season watched appears in
neither; that the genre filter narrows the queue without changing its order; and
that the franchise rail renders 7 of 14 for a seeded Star Wars franchise.
A show untouched for 29 days renders under *Paused* in grey, and one touched
yesterday does not. The feel-pass screenshots.

### ☐ 8.8 Watch status: In flight · Up next · Done · S
`/watch/status`, the 1.9 component with film and TV rows. Depends on 1.9 and
8.3.

- **In flight**: shows whose `show_progress.state` is `watching`, with next
  season, and films with `title_status = watching`. Below them, *Waiting for
  a new season*: `caught_up` shows (8.1), grey, each with its last season
  watched (*Severance · S2 watched · returning*). They are in flight but have
  nothing to start.
- **Up next**: `to_watch` films and shows, oldest added first, with the
  dashboard's film/TV toggle and genre chips.
- **Done**: `watched`, with show state derived, most recent first. `dropped`
  collapsed under *Stopped*.

*Stopped* holds `dropped` shows and films as `<details class="stopped">`, each
with a grey `dropped` badge. Each tab's empty slate is drawn, with the design §14 copy and one primary action; the mockup gains watch's three (UX-X07,
see 1.9).

**Check:** a show with 1 of 3 seasons watched is in In flight only; a show with
all seasons watched is in Done with nothing written to `title_status`; a
dropped film appears only under Stopped; the genre filter narrows Up next
without reordering it. A returning show with every season watched is under
*Waiting for a new season*, not in Done.

### ☐ 8.6 Title shelves · S
`shelves.kind = 'titles'` with `shelf_titles`. Same UI as book shelves.
Distinct from franchises: a franchise is a fact about the work, a shelf is your
opinion.

**Custom shelves** (2026-10-20 intake: *Christopher Nolan, Spielberg, Disney
Animated, DCOM, a loosely connected group of films and shows*). A shelf holds
films and shows together, in your order, with 5.1's description and per-title
note (`shelf_titles.note`). The owner's examples are illustrations; any
grouping can be made in the app, in one of two ways:

- **A shelf** (this task): you choose its members and its order, and it changes
  only when you change it. It suits a loose group (a set of films you think
  belong together) and any list in an order of your own.
- **A saved view** (8.3): a named filter that keeps itself current, for a
  group that is a fact (a director's films, a studio's, a network's), with
  titles added or removed by hand where the filter misses or overreaches.

**From a filter to a shelf.** When a saved view's membership is right but you
want your own order or notes, *Add these to a shelf…* on the filtered list (and
on a person page, once 8.10 lands) adds every shown title to a new or existing title
shelf, in the list's order. It is one write with one undo. After that, the
shelf is yours and doesn't follow the filter.

**Check:** test that a book cannot be added to a title shelf, and vice versa.
A shelf holding a film and a show renders both, in shelf order, each with its
note. *Add these to a shelf…* on a list filtered to three titles adds three
`shelf_titles` rows in list order, Undo removes all three, and a title added
to the catalog afterwards does not join the shelf.

### ☐ 8.9 Refresh shows: new seasons and where to watch · M
Backlog intake, 2026-10-20; D-74. Depends on 8.1 and 8.3. Two TMDB facts change
after a title is added: a returning show gains seasons, and where a title
streams moves. Both refresh only when you ask, because no page render calls
TMDB (ui.md). The pattern is 5.8's *Checked 3 days ago · Check now*.

- **New seasons.** *Check for new seasons*, on the watch dashboard and on a
  show's sheet, re-reads `/tv/{id}` for each show that hasn't ended or been
  cancelled. It adds the new `seasons` rows and updates `tmdb_status`. A new
  season turns a `caught_up` show back to `watching` (derived), and the toast
  names it (*Severance S3 is listed*). Existing season rows and every status
  row stay as they are.
- **Where to watch.** `title_providers(title_id, region, provider, kind IN
  ('flatrate', 'free', 'ads', 'rent', 'buy'), fetched_at)`, from
  `/{movie|tv}/{id}/watch/providers`, region US.
  - It is refreshed per title from its sheet (*Check where to watch*), or in
    bulk from the list (*Refresh where to watch · 40 titles*), within TMDB's
    rate. The table goes in `export-tables.ts` (standing rule 7).
  - It shows as provider names with their date (*Netflix · as of 3 Oct*),
    greyed when older than 30 days. The list's *Where to watch* filter uses the
    latest snapshot.
  - JustWatch's attribution sits beside TMDB's in the footer: the data comes
    from JustWatch, and attribution is its condition.
- A daily cron for either refresh is a later option, with 7.6.

**Check:** with recorded fixtures:
- a show TMDB now lists with 3 seasons, where 2 were stored, gains one
  `seasons` row, keeps its season statuses, and goes from `caught_up` to
  `watching`;
- a provider refresh replaces that title's rows and stamps `fetched_at`;
- the *Netflix* filter shows only titles whose latest snapshot lists Netflix;
- no page render calls TMDB, and the JustWatch attribution renders.

### ☐ 8.10 People: director and cast pages · S
Backlog intake, 2026-10-20 (the owner's shelf ideas *Christopher Nolan* and
*Spielberg*). Depends on 8.1 and 8.3. A director's films are a fact about the
work, so they get a page that keeps itself up to date, not a shelf you
maintain by hand (data model 2.5d).

- `/watch/person/[id]` lists the titles in your watchlist that credit the
  person, grouped by role, in release order, each with its status, and
  `watched / listed` in mono.
- Every director, creator and cast name on a row or a sheet links here.
- *Their other work* is a TMDB search you start
  (`/person/{id}/combined_credits`), each result with *Add*. Opening the page
  never calls TMDB.
- Nothing creates a person page: every credited person has one. To keep a
  person on hand, save 8.3's person filter as a view (*Nolan*), or copy the
  page into a shelf (8.6).
- Studios and networks get 8.3's filters and saved views, not pages.

**Check:** a person credited as director on two listed films and as cast on
one show renders three rows under two roles. A name on a film's sheet links to
the page. Opening the page makes no TMDB call, and *Their other work* makes
one.

---

## Phase 9 — Music

**Goal:** A fourth medium, last (D-75). **Milestones:** M25.

Backlog intake, 2026-10-20; D-75. **After Phase 8, last.** A fourth medium,
shaped like the watchlist: **artist → album → track**, as franchise → title →
season. The catalog comes from MusicBrainz (free, CC0 core data, one request a
second, a real User-Agent): its release groups are albums and its recordings
are songs. Covers come from the Cover Art Archive. It starts empty, like
watch. No playback, scrobbling or streaming-service sync.

The owner asked for three things: artists to listen to, those artists' albums
to listen to, and a ranking of each song for some artists, with which albums
are the favourites read off the ranking.

### ☐ 9.0 Music in the shell, designed · M
The feel pass and the mockups draw no music, and a fourth medium changes rules
that every dashboard shares, so the design comes first (standing rule 6). The
phone media bar is `Comics · Books · Watch` (a UX-floor rule). Settle with the
owner how four fit at 360px, as four tabs or with Music under *More*, along
with the tablet rail, the sidebar and `/`'s redirect.

The screens, phone, tablet and desktop, in the mockup:
- the `/music` dashboard in the five slots: Now (the album you are on), Up
  next (albums from artists you follow), position (the album in its artist's
  discography), situation (artists you want to listen to), and this year;
- `/music/artist/[id]`, the album sheet, and the song ranker (9.4);
- the empty first screen, a search, as watch's is.

**Check:** the mockup gains each screen at phone, tablet and desktop widths,
`design/mockups-index.md` lists them, and the media-bar decision is in the
decisions log.

### ☐ 9.1 Schema and MusicBrainz client · M
Depends on 9.0. **Stop and ask at plan time** (new tables).
- **Catalog:** `artists(id, mbid UNIQUE, name, sort_name, disambiguation)`,
  `albums(id, mbid UNIQUE, artist_id, title, primary_type, secondary_types
  text[], first_release_year, cover_url)` and `tracks(id, recording_mbid,
  album_id, position, title, length_ms)`. An album's tracks come from one
  canonical release of its release group, the earliest official one, chosen
  at add. So a song is a recording, and a recording on several albums is
  still one song for ranking (9.4).
- **Per user:** `artist_follows(user_id, artist_id, state IN ('want',
  'listening'))` (D-43's pattern); `album_status(user_id, album_id, status IN
  ('to_listen', 'listened', 'skipped'), rating, notes)`; and `listen_events`,
  the log, as `read_events` is.
- **Views:** `artist_progress` and `album_progress` (`etl/views.sql`).
- **Client:** server-side, paced at one request a second, with a real
  User-Agent and a cache table like `metron_cache` (D-53).
- Every table goes in `src/db/export-tables.ts`.

**Check:** a recorded release-group fixture parses into albums with their
types, and a release fixture into tracks in position order. The client never
sends two requests within a second, and the export test passes with the new
tables.

### ☐ 9.2 Search and add an artist, with the discography · M
Depends on 9.1.
- Search MusicBrainz artists, with the disambiguation shown (*Genesis (UK rock
  band)*).
- Adding an artist follows them at `want` and adds their release groups.
  Studio albums are on by default; *EPs · Singles · Live · Compilations* are
  toggles. The albums become a to-listen list you can trim, where *Not for me*
  hides one.
- Tracks load when an album is first opened or ranked, never for the whole
  discography at once, to stay inside the request budget.
- Loading, rate-limited and error states are 1.3b's. There is no freeform
  path, as with watch (D-28): when MusicBrainz fails or finds nothing, the
  screen offers *Save to inbox*. The inbox has no Music kind yet: that is a
  schema question for this task's plan.

**Check:** adding an artist with 12 release groups creates 12 albums and makes
no recording requests; adding them again updates without duplicating; a
mocked failure offers *Save to inbox*.

### ☐ 9.3 Albums: listened, rated, logged · S
Depends on 9.2. Each album is to listen, listened or skipped, with a date and
a rating. Every listen appends a `listen_events` row, and a relisten links to
the previous one, as 8.3's rewatch does. The artist page lists the
discography by year with each album's status, and `listened / listed` derived.

**Check:** marking an album listened twice appends two events and leaves one
status row, and `artist_progress` counts the album once.

### ☐ 9.4 Rank an artist's songs · M
Depends on 9.2 (owner: *for specific artists, rank each song*).
- **A ranking is authored, so it is stored:** `song_rankings(user_id,
  artist_id, track_id, ordinal)`, contiguous from 1, like 1.10's queue. It goes
  in the export. Songs can stay unranked.
- **Two ways to build it.**
  - A pairwise *This or that* sorter: pick one of two songs. Binary insertion
    places each new song in about log₂ n picks, so 150 songs is roughly 1,100
    picks over many sittings. Each placed song is written at once, so
    stopping loses only the song in progress.
  - Direct reorder: drag by a handle with a fine pointer, or *Move to…* on
    touch and keyboard.
- A recording on several albums is one song, ranked once (dedupe by recording
  MBID).

**Check:** ranking five songs through the sorter, with scripted answers, gives
the expected order in at most 8 picks. Stopping and reopening resumes with the
placed songs kept. Ordinals stay contiguous after a song is unranked.

### ☐ 9.5 Which albums you favour · S
Depends on 9.4. Derived from the ranking in an `album_rank` view, never
stored. Per album: its ranked songs' median rank, how many of them are in your
top 10 and top 25, and how many of its songs are ranked. The artist page can
sort its albums by it.

**Check:** a fixture ranking in which album A holds ranks 1–3 and album B
ranks 4–8 orders A first. An album with unranked songs counts only its ranked
ones, and says *4 of 11 ranked*.

### ☐ 9.6 Music dashboard and status · M
Depends on 9.0, 9.3 and 1.9. `/music`, in 9.0's design, and `/music/status`
with *In flight · Up next · Done* (ui.md's rule for every medium):
- **In flight:** albums you have started, and artists followed as
  `listening`.
- **Up next:** to-listen albums from followed artists, oldest added first.
- **Done:** listened albums, by year.

Nothing is stored beyond what 9.1 defines.

**Check:** an album with one listen is in Done, not Up next; an artist
followed as `listening` with two albums to listen shows in In flight and both
albums in Up next; tab counts equal row counts; the feel-pass screenshots.

---

## Later — noted, not scheduled

From the 2026-10-20 intake: ideas worth keeping, not worth a task yet. Each
becomes a task once its open question is answered. None has a **Check:**, and
`/new-task` does not convert them.

- **L-1 Open in Marvel Unlimited.** A link from an issue to read it in the
  Marvel Unlimited app or site. Marvel publishes no reading API, and Metron
  cross-references Comic Vine and the GCD, not Marvel's digital ids. The open
  question is whether an issue's Marvel id can be found, or only a search link
  built from the label. Where the link goes is settled: links to reading
  sources live on the issue sheet and nowhere else (3.5; STYLE_GUIDE §12).
- **L-2 League of Comic Geeks ratings.** The owner's issue ratings live there
  (owner: far future). It has no public API. The open questions are whether
  its export carries per-issue ratings that can be matched to labels through
  the bulk-entry parser, and where a per-user issue rating would live (a
  schema question).
- **L-3 Collected editions you haven't listed.** Metron lists collected
  editions (trades, omnibuses) as series of their own, with the issues they
  reprint. That could suggest editions for 5.10's *Collected in* that you
  don't own yet. Research how complete the reprint data is first.
- **L-4 Calibre from Google Drive** (2026-10-26 intake). The owner's Calibre
  library lives on Google Drive, so once 4.4 works by upload, the app could
  fetch `metadata.db` itself, behind a *Sync now* button or a cron that stages
  the same review. It needs the Drive API with the library folder shared
  read-only to a service account (or an OAuth refresh token) and two Vercel
  secrets. The open questions: service account or OAuth; whether Drive's copy
  is current while Calibre is open (Calibre warns against libraries in synced
  folders, so the review should show the file's modified time); and whether
  the file fits a function's memory and time limits.

---
