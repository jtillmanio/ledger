---
id: TASK-011
title: 1.7 One period column on reading_plan
status: In progress
depends_on: [TASK-010]
size: L
model: opus
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: 2ccb788
---

# TASK-011 — 1.7 One period column on reading_plan

## Goal

A to-read book sits at exactly one plan level: a quarter (in order), a year, On deck, or Someday. Its year can never disagree with its quarter. Books can now be added *On deck*.

## Context

- Roadmap: `docs/TASKS.md` § 1.7 One period column on `reading_plan` (sitting 6, first; it must land before real planning data accumulates). The roadmap entry, its four-level table and its **Check:** are the contract.
- **Why this is one large task** (`workflow.splitPolicy: never-split`): a migration that replaces two columns and drops a third, its refusing down file, two views, the write helpers every later plan task uses, `extract.py --with-plan`, and the add sheet's *On deck* flip.
- **Schema change, stop and ask at plan time** (CLAUDE.md), though the roadmap specifies it: `reading_plan.period text NOT NULL` checked against `^[0-9]{4}(-Q[1-4])?$` or `on_deck`; `ordinal integer` with `CHECK ((ordinal IS NULL) = (period !~ '-Q'))` and `UNIQUE (user_id, period, ordinal) DEFERRABLE INITIALLY DEFERRED`; key `(user_id, book_id, period)`; drop `planned_year`, `planned_quarter` and `reading_settings.plan_granularity`. The down file `drizzle/down/<tag>.sql` restores the legacy columns from every quarter and year row, re-adds `plan_granularity` at `quarter`, and **raises** while any `on_deck` row exists.
- Architecture: `docs/ARCHITECTURE.md` § 2. Decisions — 2.9 (the to-read levels). `.claude/rules/schema.md` *A plan entry's year is derived from its period* and *A to-read book sits at one of four levels*.
- Data model: `src/db/schema.ts` `readingPlan`, `readingSettings`. New views in `etl/views.sql`: `plan_period` (`year`, `quarter`, `level`, `ordinal`) and `to_read_level` (one row per `to_read` book; with several plan rows it takes the earliest: quarters and years by date, then `on_deck`). `src/db/queries.ts` `listBooks` reads the period through `plan_period`. Every reader of `planned_year` / `planned_quarter` moves.
- Design: mockup `add` (*On deck* becomes enabled on the Add books sheet from TASK-008). Mockup `planmonth`'s month frame was retired by D-38. Nothing in this task draws it.
- Decisions: D-13 (the plan starts empty; `--with-plan` restores the To-Read tabs), D-37 (four levels; only quarters are ordered), D-38 (no months), R0-04.
- *From TASK-021 (1.13, PR #93):* if 1.13 lands before 1.7, 1.7's `--with-plan` change starts from the year tabs found by name (`^To-Read \d{4}$`) and BookIndex's authorless-sighting fold (plan rows follow its id remap), not `GENRE_TABS["plan"]`. Both approved plans name this; it is not a stale-plan note.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): test that `2027-Q1` reads back as year 2027, quarter 1, level `quarter`; `2027` with a null quarter and level `year`; `on_deck` with a null year and level `on_deck`; that `2027-Q5`, `2027-03` and `someday` are rejected by the constraint, and so are a quarter row with a null ordinal and a year row with one. `to_read_level` puts a `to_read` book with no plan row at `someday`, and a book planned both `2027` and `on_deck` at `year`. The migration composes the legacy columns without losing a row (a fixture with a two-year book keeps both rows), and up → down → up restores them, asserting row values; the down raises while an `on_deck` row exists. Ordinals: adding three books to `2027-Q1` gives 1–3; adding one to `2027-Q2` gives it 1 there; moving Q1's #2 to Q2 leaves Q1 at 1–2 and makes it Q2's 2; moving a quarter book to `2027` or `on_deck` gives it a null ordinal and closes the gap; *move to top* on Q1's #2 gives a contiguous 1–2 with it first. Two concurrent reorders of one quarter never leave duplicate ordinals, and after up → down → up every quarter is 1…N again. `plan_granularity` no longer exists. Adding a book *On deck* from the add sheet writes the book and its plan row in one transaction.
- [ ] AC-2: The migration numbers existing quarter rows by `books.title`, then `book_id`. `etl/extract.py --with-plan` writes `period` and `ordinal` (quarter rows in workbook row order), and without the flag writes no plan rows. `etl/test_extract.py` asserts both, and standing rule 4's diff of the CSVs against both workbooks is in the PR.
- [ ] AC-3: Every plan write goes through the helpers in `src/db/writes.ts` (append, take out and close the gap, reorder, move to top, move to Someday). A test asserts that moving a book to Someday deletes its plan row and leaves its `book_status` row unchanged. No file outside `src/db/writes.ts` and the migration writes `reading_plan.period` or `ordinal` (`git grep`).
- [ ] AC-4: On the Add books sheet, *On deck* is enabled and no longer `aria-disabled`. Choosing it and adding a book shows *Add to On deck* on the primary button, and `to_read_level` reports the book at `on_deck`. *Year or quarter…* stays `aria-disabled="true"` with its reason until 2.3.
- [ ] AC-5: No app code parses a period string: `git grep -nE "period.*(split|slice|substring|match)\\(" src/` returns nothing, and every reader of year, quarter or level goes through `plan_period` or `to_read_level`.

## Out of scope

- The plan editor, the rail and the quarter picker (2.2b, 2.3, 2.10). *Year or quarter…* on the add sheet stays disabled.
- Capacity per year or quarter (2.1), and rebalance (2.7).
- Reordering a quarter in the UI (1.9's books *Up next* tab uses this task's helpers).
- Promoting the wishlist (1.4d).

## Files likely touched

- `src/db/schema.ts`: `readingPlan` (period, ordinal, key, CHECKs), `readingSettings` (drop `plan_granularity`). `drizzle/<tag>.sql` and `drizzle/meta/*` are generated, then hand-edited for the composition and `DEFERRABLE`.
- `drizzle/down/<tag>.sql` (new, by hand, raises on `on_deck`).
- `etl/views.sql`: `plan_period`, `to_read_level`. `etl/test_views.sql`: their cases.
- `src/db/writes.ts`: the plan helpers. `src/db/queries.ts`: `listBooks` and friends on `plan_period`.
- `src/app/books/page.tsx`: the year cell reads from `plan_period`.
- `src/components/AddBookSheet.tsx`: enable *On deck*.
- `etl/extract.py`, `etl/test_extract.py`: `--with-plan` writes `period` and `ordinal`.
- `test/plan-period.test.ts` (new, DB), `test/plan-period-migration.test.ts` (new, up → down → up).

## Verification

- Automated: `test/plan-period.test.ts` covers the read-backs, the rejected values, `to_read_level`, every ordinal move, concurrent reorders and the *On deck* add (AC-1, AC-3, AC-4). `test/plan-period-migration.test.ts` covers composing a two-year book, up → down → up with row values, and the down raising on `on_deck` (AC-1). `etl/test_views.sql` and `etl/test_extract.py` cover AC-2. `npm run check:migrations` passes with the down file.
- Manual: `npm run rebuild` on the development database, then add a book *On deck* from Add books → expected: it appears with level `on_deck`. Run `npm run extract -- --with-plan` → expected: `reading_plan.csv` has `period` and `ordinal` and no `planned_year`.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- 1.13 rewrites the same `--with-plan` block in `extract_books` (year tabs found by name): whichever of 1.7 and 1.13 lands second keeps the other's change, so 1.13's year tabs write `period`, not `planned_year` → docs/tasks/TASK-021-book-extract-merge-review.md § Context (approved at plan)
- Files likely touched names `src/components/AddBookSheet.tsx`; the add sheet is `src/components/AddBooks.tsx`, with `src/lib/book-add.ts` and both books routes → not tracked: the plan names the real files
- `Books.xlsx`'s To-Read tabs carry a year and no quarter, so `--with-plan` never writes a quarter row, and AC-2's "quarter rows in workbook row order" has nothing to number today → not tracked: informational, the plan numbers them in row order if one ever appears

## Plan

**Schema change, owner decision at the gate** (CLAUDE.md), exactly as the roadmap specifies it. The migration is expected to be `0013_plan_period` (after TASK-025's 0012); the tag is whatever drizzle-kit assigns.

Steps:
1. `src/db/schema.ts` `readingPlan`: `period text NOT NULL`, `ordinal integer`; PK `(user_id, book_id, period)`; CHECKs `reading_plan_period_check` (`period ~ '^[0-9]{4}(-Q[1-4])?$' OR period = 'on_deck'`) and `reading_plan_ordinal_check` (`(ordinal IS NULL) = (period !~ '-Q')`); `unique("reading_plan_quarter_order").on(userId, period, ordinal)`. `readingSettings`: drop `planGranularity` and its check.
2. `npm run db:generate` (answer "create column" to any rename prompt), then hand-edit the SQL: add `period`/`ordinal` nullable; `UPDATE … SET period = planned_year::text || COALESCE('-Q' || planned_quarter, '')`; number quarter rows `row_number() OVER (PARTITION BY user_id, period ORDER BY books.title, book_id)`; `SET NOT NULL`; swap the PK; drop `planned_year`, `planned_quarter`; add the CHECKs; the UNIQUE gets `DEFERRABLE INITIALLY DEFERRED` (drizzle can't express it; the snapshot still matches `schema.ts`, so `check:migrations` passes); drop `plan_granularity` with its check.
3. `drizzle/down/<tag>.sql` (by hand, 0011's header shape): `RAISE` while an `on_deck` row exists, and also while a book holds a year and a quarter of that year (`2027` and `2027-Q1`), since the legacy PK `(user_id, book_id, planned_year)` can't hold both; drop `to_read_level` and `plan_period`; restore `planned_year = left(period, 4)::int` and `planned_quarter` from the `-Qn`; swap the PK back; drop `period` and `ordinal`; re-add `plan_granularity text NOT NULL DEFAULT 'quarter'` with its check.
4. `etl/views.sql`: `plan_period` (`user_id, book_id, period, year, quarter, level, ordinal`; year and quarter NULL for `on_deck`) and `to_read_level` (one row per live `to_read` book: `level` `quarter | year | on_deck | someday`, with `period, year, quarter, ordinal`; earliest by `level = 'on_deck'`, `year`, `quarter NULLS LAST`, so a book in `2027` and `2027-Q1` sits at the quarter). `etl/test_views.sql`: their cases.
5. `src/db/writes.ts` plan helpers. Each runs in a transaction behind `pg_advisory_xact_lock(hashtext('ledger:plan:' || userId))` and accepts an outer `tx`. Quarter-ness is decided in SQL (`period ~ '-Q'`), never by parsing in TS. The helpers: `placeInPlan(userId, bookId, period)` (a quarter appends at max + 1), `movePlan(userId, bookId, from, to)` (closes `from`'s gap, appends in `to`), `reorderQuarter(userId, period, bookIds)` (must be exactly that quarter's books; rewrites 1…N), `moveToTop(userId, bookId, period)`, `moveToSomeday(userId, bookId)` (deletes every plan row of the book, closes each gap, leaves `book_status` alone). The private `closeGap(tx, userId, period)` backs them.
6. On deck in the add flow: `Destination` gains `{ kind: "on_deck" }`. `writeDestination` writes a `to_read` status where the book has none (listed as `statused` on `AddedEntry`), then `placeInPlan(…, "on_deck")` for books that are `to_read`. `undoAddBooks` deletes exactly those `on_deck` rows and bare statuses, and refuses as today when anything has moved. `src/lib/book-add.ts`: `parseDestination` and `addTo` (*Add to On deck*). `src/app/api/books/route.ts` (DELETE accepts `statused`) and `src/app/api/books/bulk/route.ts`.
7. `src/components/AddBooks.tsx`: *On deck* is a real `aria-pressed` chip. The reason line now covers *Year or quarter…* alone: "Year or quarter… arrives with the plan editor." (new copy; confirm at the gate). `src/components/PasteBooks.tsx`'s `where`.
8. `src/db/queries.ts` `listBooks`: `plan_year` is `MIN(pp.year)` from `plan_period`, and the year filter uses `pp.year`. `BookRow.planned_year` becomes `plan_year`; `src/app/books/page.tsx` follows.
9. `etl/extract.py` `--with-plan`: columns `user_id, book_id, period, ordinal`, `period = str(year)`, a blank ordinal, deduped on `(book_id, period)`. `etl/load.ps1` and `etl/load.sh`: `\copy reading_plan(user_id,book_id,period,ordinal)`.
10. `.claude/rules/schema.md`: drop the two "(from task 1.7 …)" caveats. Tick 1.7 in `docs/TASKS.md`.

Files: the paths named in steps 1–10, plus `drizzle/meta/*`, `test/plan-period.test.ts` (new), `test/plan-period-migration.test.ts` (new), `test/add-book-sheet.test.tsx`, `test/schema-additions.test.ts`, `test/books-bulk.test.ts`, `test/add-book.test.ts`, `test/queries.test.ts`, `etl/test_extract.py`.

Test strategy:
- AC-1 → `test/plan-period.test.ts`, one `it` per Check clause: the read-backs through `plan_period`; `23514` on `2027-Q5`, `2027-03`, `someday`, a quarter with a NULL ordinal and a year with one; `to_read_level`'s `someday` and its `2027` + `on_deck` → `year`; every ordinal move in the Check; `Promise.all` of two `reorderQuarter`s leaves 1…N distinct; `plan_granularity` is absent from `information_schema.columns`; *On deck* `addBooks` writes the book, its status and its plan row, and a batch that refuses (`gone`) writes none of them. `test/plan-period-migration.test.ts` (rolled back): down; legacy rows (a two-year book, three Q1 books whose titles sort against their ids, a year row); up → periods, and ordinals by title then `book_id`; down → the legacy values; up → every quarter 1…N; an `on_deck` row makes the down raise.
- AC-2 → `etl/test_extract.py` `ReadingPlanPeriod`: with `--with-plan` the header is `user_id,book_id,period,ordinal` and the rows are `2027`, blank; without it, the header alone. The PR carries standing rule 4's diff.
- AC-3 → `plan-period.test.ts`: `moveToSomeday` deletes the plan rows and `book_status` is byte-identical. The PR shows `git grep -nE "insert\(readingPlan\)|update\(readingPlan\)|reading_plan" src/` matching only `src/db/writes.ts` and `src/db/schema.ts`. Test fixtures insert rows with SQL; the AC reads as app code.
- AC-4 → `test/add-book-sheet.test.tsx`: *On deck* has no `aria-disabled`; choosing it gives *Add to On deck*, and after the add `to_read_level` is `on_deck`; *Year or quarter…* stays `aria-disabled="true"` with its reason.
- AC-5 → the PR shows `git grep -nE "period.*(split|slice|substring|match)\(" src/` empty.
- Updated: `schema-additions.test.ts` (no `plan_granularity`), `books-bulk.test.ts`, `add-book.test.ts` and `queries.test.ts` move to `period`.

Risks / open questions:
- On deck for a book that is already `read`, `reading` or `dnf`: the plan keeps its status and writes no plan row (`to_read_level` covers only `to_read` books), and the toast reports it as already yours. Confirm, or say it should become `to_read`.
- A book in `2027` and `2027-Q1` at once is allowed by the new key; `to_read_level` puts it at the quarter. The down refuses it rather than lose a row.
- `DEFERRABLE` can't be an `ON CONFLICT` arbiter; the helpers never use one.
- TASK-021 edits the same `--with-plan` block (follow-up 1).

Size check: L by `never-split` (task Context says why). About 30 files, one migration with a refusing down file, attended.

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
