---
id: TASK-011
title: 1.7 One period column on reading_plan
status: Ready
depends_on: [TASK-010]
size: L
model: opus
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
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

## Plan

_Written by /plan-batch or /implement-task Phase 1. Approved by the user (plan_status: approved) before any code is written._

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
