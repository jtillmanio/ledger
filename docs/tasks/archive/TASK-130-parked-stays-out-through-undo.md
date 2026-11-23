---
id: TASK-130
title: 5.18 A Parked book stays out of the plan and the listen queue, through every undo
status: Done
depends_on: []
size: S
model: opus
autonomy: attended
ui: false
plan_status: approved
planned_at_commit: 7530fd8
---

# TASK-130 — 5.18 A Parked book stays out of the plan and the listen queue, through every undo

## Goal

No Undo can leave a Parked book in a plan period or on the listen queue: each undo that would either takes the book off as well or refuses and changes nothing.

## Context

- Roadmap: `docs/05-roadmap.md` § 5.18 (from TASK-127 and TASK-111, 5.15, PR #304 and PR #311; their schema reviews). Its **Check:** is AC-1, verbatim; proposed, and agreed when merged. Listed in `docs/06-tasklist.md` M17; pulled ahead of 1.26 (D-172). Depends on 5.15 (done).
- **The invariant** (5.15, D-105; `.claude/rules/schema.md` § the Parked paragraph, around line 297): a Parked book is in no `reading_plan` row and not in `listen_queue`. The forward writes keep it: `saveBookStatus` (`src/db/writes.ts`, around line 187) under the status-row lock, and `queueListen` (around line 2076) refusing a Parked book.
- **The four undos the entry names:**
  - `undoInside` (an add's undo, around line 2645), and `undoBookStatus` (around line 357) with `prior.status = 'parked'`: they put a book back to Parked while a `listen_queue` row written since stays. Reachable from `/parked` (TASK-111): *Plan…* or *Unlisted*, then *Queue to listen*, then the first verb's Undo.
  - `restoreListen` (around line 2106; a queue *Remove* undone after the book was parked) queues a Parked book: `listenable` checks only that the book is live.
  - `undoMoveIn` (around line 1642) refuses a book gone `unlisted` but not one gone `parked`, so it can put a plan row back under a Parked book.
- **For each, decide:** take the book off the queue (under `lockListen`, around line 1993) or refuse with nothing changed (the route answers 409). Write the choice into `.claude/rules/schema.md` beside the Parked paragraph.
- **The lock.** The entry asks to check that `undoBookStatus` takes `lockBook` on the book row as `saveBookStatus` does. On `main` it does (`if (!(await lockBook(tx, bookId))) return false;` at the top of its transaction). The plan confirms it, and says whether the listen-queue changes add `lockListen` inside that order without a deadlock (the order the other writes take both locks in).
- Routes that surface the 409s: `src/app/api/progress/book/route.ts` (the status undo), `src/app/api/listen-queue/route.ts` (the queue's *Remove* undo), the plan-move and add undos' routes (the plan names them).
- Tests nearby: `test/parked.test.ts`, `test/parked-review.test.ts`, `test/listen-queue.test.ts`, `test/plan-acceptance.test.ts`.
- Decisions: D-105, D-38. Hard rule 3 (read and plan state lives in progress tables).

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim): `npm test`: plan a Parked book from the review to 2027 Q1, queue it to
listen, and undo the plan: the book is `parked` with no `reading_plan` row
and no `listen_queue` row, or the undo answers 409 and changes nothing.
The same for an *Unlisted* from the review and its undo. Undoing a queue
*Remove* after the book was parked leaves it off the queue. Undoing a plan
move after the book was parked answers 409 and writes no plan row.
- [x] AC-2: For each of the four undos, the test asserts the one outcome the plan chose (taken off, or 409 with every row as before), not either. A refused undo leaves `book_status`, `reading_plan` and `listen_queue` exactly as they were before it, compared row for row.
- [x] AC-3: An add's undo (`undoInside`) that puts a book back to Parked, after a `listen_queue` row was written for it since the add, leaves the book `parked` with no `listen_queue` row, or refuses as AC-2 says.
- [x] AC-4: The listen queue's positions stay contiguous from 1 after any undo that takes a book off it.
- [x] AC-5: `.claude/rules/schema.md` names each undo's choice in the Parked paragraph, in the same PR.

## Out of scope

- The forward writes (`saveBookStatus`, `queueListen`): they already hold the invariant.
- Any change to what the parked review offers or how it reads (5.15's screens).
- A new table or column, or a CHECK constraint that enforces the invariant in the database.
- Undo messages or toasts on screen: the existing 409 handling shows whatever it shows today.

## Files likely touched

- `src/db/writes.ts` — the four undos.
- `test/parked.test.ts` (or `test/listen-queue.test.ts`) — AC-1 to AC-4.
- `.claude/rules/schema.md` — AC-5.

## Verification

- Automated: the tests above on `TEST_DATABASE_URL`; `npm run test:no-e2e`.
- Manual: none (no visible change beyond an existing 409's handling).

## Follow-ups

- Schema review R1, note 2: `undoInside` holds an unparked book's status row and then waits for the listen lock, while `undoBookStatus` back to Parked takes the listen lock and then updates that row. A cycle needs two undos of the same book at once, one of them a stale change, and the outcome is a Postgres deadlock error (one side aborts), not bad data → not tracked: accepted as is (practically unreachable, no data harm)
- The choice that every undo refuses rather than taking the row off is a lasting rule → not tracked: recorded in `.claude/rules/schema.md` § the Parked paragraph (AC-5), no separate decision needed
- Spec review R2 nit: `undoBookStatus`'s doc comment doesn't list the park-from-Parked refusal; the inline comment beside it does → not tracked: covered by the inline comment

## Plan

Approved 2026-11-23. **Every one of the four undos refuses** (409, nothing changed); none takes the book off
the queue. This matches the undos' existing rule for a plan row gained since: taking the queue row off would
erase a later action the undo never recorded.

1. Tests first (`test/parked.test.ts`, a new describe), through the routes, each comparing `book_status`,
   `reading_plan` and `listen_queue` row for row (AC-2):
   - *Plan…* undo: Parked `d` added to 2027 Q1, queued, the add undone → 409, all as before (AC-1, AC-3).
   - *Unlisted* undo: Unlisted from Parked, queued, undone → 409, all as before (AC-1).
   - *Remove* undo: `d` queued, removed, parked, the remove undone → 409, `d` off the queue, the queue as
     before (AC-1, AC-4).
   - Plan move undo: `d` in Q1 and On deck, moved Q1 → On deck (`placed: false`), parked, undone → 409, no
     plan row (AC-1).
   - Two races: another transaction holds the listen lock and queues `d` while each status undo (add's,
     *Unlisted*'s) waits → it refuses.
2. `undoBookStatus`: with `prior.status = 'parked'`, take `lockListen` and refuse when the book has a
   `listen_queue` row. Order book → listen; no plan lock on that path (`unplanned` is empty when the prior
   is Parked).
3. `undoInside`: for the unparked books, take `lockListen` after the plan re-check, before the status goes
   back to Parked; a queue row throws `refused`. Order add lock → status rows → plan → listen, as a park.
4. `restoreListen`: read the status under the listen lock; a Parked book throws `RefusedStatus`.
5. `undoMoveIn`: refuse `parked` as it refuses `unlisted`.
6. `src/app/api/listen-queue/route.ts` (not in Files likely touched): `RefusedStatus` on the *Remove* undo
   answers 409.
7. `.claude/rules/schema.md` Parked paragraph names each choice (AC-5); the `writes.ts` doc comments too.

**Files:** `src/db/writes.ts`, `src/app/api/listen-queue/route.ts`, `test/parked.test.ts`,
`.claude/rules/schema.md`, this task file.

**Test strategy:** AC-1–AC-3 by the tests in step 1. AC-4: no undo takes a book off, so the row-for-row
queue comparison (positions 1…N unchanged) after each refusal proves it. AC-5: the schema.md diff.

**Risks:** the new lock-order edge is book → listen in `undoBookStatus`; nothing takes the listen lock and
then locks a book row (the queue helpers only read `books`), so it can't deadlock.

**Follow-ups:** none at plan.

## Review log

- Verify R1 env FAIL (Git Bash started vitest from `c:\`: "failed to find the runner", no test ran) → R1 PASS from `C:\` | CI R1 PASS (6d03acf, every project)
- Spec R1 APPROVE (nit: a lost space) | Schema R1 APPROVE (3 MINOR: a hand-built park-from-Parked change with `unplanned` could restore plan rows under a Parked book and take listen → plan; one unreachable deadlock, no action; loose lock wording) → fixed in 4e6f3c9 with a test that fails without it | Verify R2 PASS
- Spec R2 APPROVE | Schema R2 APPROVE | Audit R1 PASS (7 of 7 new tests fail on 7530fd8; tree restored) | UI not run (`ui: false`, no UI files)

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 2 (plus one environment re-run)
- Review rounds: 2
- First-pass AC FAILs: 0
- Plan revisions after approval: 0 (the schema review's guard is in `writes.ts`, a planned file, inside the goal)
