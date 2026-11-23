---
id: TASK-130
title: 5.18 A Parked book stays out of the plan and the listen queue, through every undo
status: Draft
depends_on: []
size: S
model: opus
autonomy: attended
ui: false
plan_status: none
planned_at_commit:
---

# TASK-130 — 5.18 A Parked book stays out of the plan and the listen queue, through every undo

## Goal

No Undo can leave a Parked book in a plan period or on the listen queue: each undo that would either takes the book off as well or refuses and changes nothing.

## Context

- Roadmap: `docs/05-roadmap.md` § 5.18 (from TASK-127 and TASK-111, 5.15, PR #304 and PR #311; their schema reviews). Its **Check:** is AC-1, verbatim; proposed, and agreed when merged. Listed in `docs/06-tasklist.md` M17. Depends on 5.15 (done).
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

- [ ] AC-1 (roadmap **Check:**, verbatim): `npm test`: plan a Parked book from the review to 2027 Q1, queue it to
listen, and undo the plan: the book is `parked` with no `reading_plan` row
and no `listen_queue` row, or the undo answers 409 and changes nothing.
The same for an *Unlisted* from the review and its undo. Undoing a queue
*Remove* after the book was parked leaves it off the queue. Undoing a plan
move after the book was parked answers 409 and writes no plan row.
- [ ] AC-2: For each of the four undos, the test asserts the one outcome the plan chose (taken off, or 409 with every row as before), not either. A refused undo leaves `book_status`, `reading_plan` and `listen_queue` exactly as they were before it, compared row for row.
- [ ] AC-3: An add's undo (`undoInside`) that puts a book back to Parked, after a `listen_queue` row was written for it since the add, leaves the book `parked` with no `listen_queue` row, or refuses as AC-2 says.
- [ ] AC-4: The listen queue's positions stay contiguous from 1 after any undo that takes a book off it.
- [ ] AC-5: `.claude/rules/schema.md` names each undo's choice in the Parked paragraph, in the same PR.

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

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

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
