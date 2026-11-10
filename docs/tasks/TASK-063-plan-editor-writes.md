---
id: TASK-063
title: 2.3 Plan editor (1 of 3) — every plan level through one write
status: In progress
depends_on: [TASK-011, TASK-046]
size: M
model: opus
autonomy: attended
ui: false
plan_status: approved
planned_at_commit: c6f1ec4
---

# TASK-063 — 2.3 Plan editor (1 of 3) — every plan level through one write

## Goal

Moving a book to any plan level (a quarter, a bare year, On deck or Someday), and adding a new book straight into the plan, are single undoable writes that keep every quarter's order intact, with the target's budget known before you confirm.

## Context

- Roadmap: `docs/05-roadmap.md` § 2.3 Plan editor (M11, first in its order: *the picker first, then the actions that use it*). The entry and its **Check:** are the contract. Features F-23. Depends on 1.7 (TASK-011) and 2.1 (TASK-046). **Pulled ahead of 1.26 by 1.25** (`docs/cutover-parity.md`: the year and quarter word-count budget the To-Read tabs hold), so it is built before the books cutover (tasklist M9's *Order*).
- **Split, 1 of 3** (`workflow.splitPolicy: split`; the entry spans writes, two API routes, a new sheet and five components). This part is the writes, the API and the totals the sheet shows. TASK-064 is the picker sheet from the Library and Add books, with the Check's *Flip*; TASK-065 is the rail's blocks opening it. TASK-065's merge ticks the roadmap entry.
- **Order (D-37).** Every write goes through 1.7's helpers in `src/db/writes.ts` (`placeInPlan`, `movePlan`, `takeOutOfPlan`, `moveToSomeday`): a book placed in a quarter joins its **end**, a quarter it left closes up, bare-year and On deck entries take no position, and undoing a move restores the exact prior order. A quarter's order is changed on the Up next tab (1.9), never here. No month (D-38): one `period` value, `YYYY-Qn`, `YYYY` or `on_deck`.
- **Someday** deletes the plan row and keeps the book `to_read`; it never deletes the book, and pushes an undo onto the 1.2 stack (TASK-001).
- **The budget.** Each year and quarter chip shows its current word total, and a preview gives the target's total after the move and how far over capacity it would go. Totals come from what 2.1 built (`planCapacity` in `src/db/queries.ts`, the `plan_capacity` and `plan_book_words` views), so the sheet, the rail and the dashboard never disagree. The seed has no plan (D-13), so tests build their own.
- **Today:** `src/app/api/plan/route.ts` PATCHes a move inside a quarter (1.9) and POSTs a move between periods (2.2's On deck *Plan*); its comment says *2.3's sheet is the general mover*.
- *From 1.4c (TASK-008, PR #77):* the add itself is `POST /api/books`, whose `destination` gains the plan level (`src/lib/book-add.ts` `destinationOf`); adding a book to a year or quarter writes its `book_status` and `reading_plan` rows in one transaction (the Check's *Flip*, R3-08).
- *From 1.7 (TASK-011, PR #96):* a quarter's ordinals count every `reading_plan` row, a soft-deleted book's included, while `plan_period` hides that book, so a planned book removed from the library would leave a visible gap (1, 3). Nothing soft-deletes a planned book yet; whatever first does should take its plan rows out through `takeOutOfPlan` / `moveToSomeday`, or this task's lists re-rank.
- *From 1.21 (TASK-029, PR #143):* undoing a status change on a book that had no status row (`undoBookStatus`, `src/db/writes.ts`) deletes the row even when the book has been planned since, leaving a plan row with no `book_status`. This task makes planning a book an everyday action. 1.21 made the undo refuse when it would put an Unlisted book back under a plan row; make the no-prior case refuse the same way (or keep the row as a bare `to_read`, as the undo already does when the row has gained a rating or a note).
- Data model: `docs/03-data-model.md` § 2. Decisions, 2.9 (one period column; the year is a substring of it). `.claude/rules/schema.md` *A to-read book sits at one of four levels*.
- Decisions: D-37, D-38, D-13, R3-08, D-86.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves its write clauses: both periods' totals, the preview's figure as the API answers it, the last ordinal, contiguity and undo, On deck and Someday, *No quarter yet*, one `period` value, and the one-transaction add. TASK-064 proves the preview in the sheet and the *Flip*'s screens): test that moving a 150k-word book from 2027 Q1 to 2028 Q2 changes
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
- [ ] AC-2: Given 2027-Q1 holding A, B (150k) and C in that order and 2028-Q2 holding D, moving B leaves 2027-Q1 as A = 1, C = 2 and 2028-Q2 as D = 1, B = 2; each period's total changes by exactly 150k; undo restores A = 1, B = 2, C = 3 and D alone.
- [ ] AC-3: A preview request for a book and a target answers the target's total after the move and the amount over capacity (none when it fits), and writes nothing (`reading_plan` unchanged).
- [ ] AC-4: A request carrying a month, or a year and a quarter as separate values, answers 400 and writes nothing. Moving to Someday deletes the book's `reading_plan` row and leaves its `book_status` (status, dates, rating, note) unchanged, and its undo restores the row at its old ordinal.
- [ ] AC-5: `POST /api/books` with a quarter or bare-year destination writes `book_status` (`to_read`) and the `reading_plan` row together; when the plan insert fails, no `book_status` row is left. Undoing a status change on a book that had no status row, and has been planned since, never leaves a `reading_plan` row without a `book_status` row.

## Out of scope

- The picker sheet and its entry points (TASK-064); the rail's blocks (TASK-065).
- Reordering inside a quarter (1.9's Up next tab).
- Accepting a stretch year (2.7, TASK-066: its table).
- Soft-deleting a planned book (nothing does yet).

## Files likely touched

- `src/db/writes.ts` — the general move, the add into the plan in one transaction, `undoBookStatus`'s no-prior case.
- `src/db/queries.ts` — chip totals and the preview, from 2.1's views.
- `src/app/api/plan/route.ts` — the general move and the preview.
- `src/app/api/books/route.ts`, `src/lib/book-add.ts` — `destination` gains the plan level.
- `test/plan-period.test.ts`, `test/capacity.test.ts`, `test/add-book.test.ts`, `test/unlisted.test.ts`.

## Verification

- Automated: `test/plan-period.test.ts` (AC-1's move, ordinal, undo, Someday and *No quarter yet* clauses, AC-2, AC-4); `test/capacity.test.ts` (AC-3's preview against the same totals); `test/add-book.test.ts` (AC-5's one transaction); `test/unlisted.test.ts` (AC-5's undo).
- Manual: none in a browser (TASK-064, TASK-065).

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

## Plan

Approved by the owner 2026-11-10. Worktree `.claude/worktrees/task-2.3` runs its tests on `.env`'s `ledger_test` (owner: `ledger_test_2` is another job's, no `ledger_test_3`).

**Steps**

1. `src/db/writes.ts`: `restoreToPlan(userId, bookId, period, ordinal)` puts a book back at a place in a quarter (the books from that place shift down, so the quarter stays 1…N; a bare year or On deck takes none). `planMove(userId, bookId, from, to)` is the general mover, `from`/`to` a period or `someday`: someday → period is `placeInPlan` (refused unless the book is `to_read` with no plan row), period → period `movePlan`, period → someday `moveToSomeday`. It answers its undo, `{ placed, prior: [{ period, ordinal }] }`, read before the move in its transaction. `undoPlanMove` takes the book out of `to` (only when the move placed it there) and restores each prior row at its ordinal; refused, changing nothing, when the book is no longer in `to` or has gained a prior period.
2. The preview, `previewPlanMove`: the same move in a transaction, then `plan_capacity` for the target, then a rollback, so the figure is 2.1's view's. A book not in the library yet (the add sheet) sends `words`: the target's current total plus them. Answers `{ plannedWords, capacity, over }` (`over` null when it fits); On deck and Someday answer no budget.
3. `src/db/queries.ts`: `planYears(userId, from, 5)`, the chip totals: one read of `plan_capacity` for five years and their quarters, an empty year at your capacity (`planCapacity`'s empty filler, shared).
4. `src/app/api/plan/route.ts`: POST extended (`from`/`to` may be `someday`; answers the undo), so 2.2's On deck *Plan* keeps working; DELETE is its undo; GET `?from=YYYY` the chip totals, GET `?bookId|words&from&to` the preview. A body with `year`, `quarter` or `month` keys, or a period like `2027-03`, answers 400 and writes nothing.
5. `Destination` gains `{ kind: "period", period }`, a quarter or a bare year (`parseDestination`, `writeDestination`): promote or status `to_read`, then `placeInPlan`, in the add's transaction; `undoInside` handles it as On deck. `/api/books/bulk` gains it with the parser.
6. `undoBookStatus`'s no-prior case refuses when the book has a plan row, as the Unlisted case does (owner's choice).

**Files**: `src/db/writes.ts`, `src/db/queries.ts`, `src/app/api/plan/route.ts`, `src/lib/book-add.ts`, `src/app/api/books/route.ts` (the 400 message), `test/plan-period.test.ts`, `test/capacity.test.ts`, `test/add-book.test.ts`, `test/unlisted.test.ts`. All in *Files likely touched*.

**Test strategy**

- AC-1, AC-2: `test/plan-period.test.ts` § the general move (2.3): A, B (150k), C in 2027-Q1 and D in 2028-Q2; ordinals, each total ±150k exactly, undo to 1-2-3; *No quarter yet* writes `2027`; On deck and Someday need no quarter.
- AC-3: `test/capacity.test.ts`: the preview equals `planCapacity` after the real move; over and null; `reading_plan` unchanged after a preview.
- AC-4: `test/plan-period.test.ts`: month and split-value requests 400 and write nothing; Someday keeps `book_status` (status, dates, rating, note); its undo restores the old ordinal.
- AC-5: `test/add-book.test.ts`: quarter and year adds; one transaction (a period the CHECK refuses, `2027-Q5`, passed straight to `addBook`, leaves no `book_status`). `test/unlisted.test.ts`: the no-prior undo after planning refuses and changes nothing.

**Risks**: the preview's rollback must never commit (a thrown sentinel, as `undoAddBooks`); `restoreToPlan`'s shift passes through a duplicate ordinal, which the deferred UNIQUE allows. Size: 9 files, no schema or UI; already 1 of 3 parts, not split again.

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
