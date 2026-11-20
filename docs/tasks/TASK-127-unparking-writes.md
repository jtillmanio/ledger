---
id: TASK-127
title: 5.15 Parked (4 of 5) — the unparking writes, Unlisted from Parked and the listen queue's refusal
status: Review
depends_on: [TASK-109, TASK-110]
size: M
model: sonnet
autonomy: attended
ui: false
plan_status: approved
planned_at_commit: 3f7a31d
---

# TASK-127 — 5.15 Parked (4 of 5) — the unparking writes, Unlisted from Parked and the listen queue's refusal

## Goal

A Parked book can leave Parked the ways the review needs: an add to Someday or a plan level puts it back on your list (and plans it), the review's *Unlisted* lets it go, each with an exact Undo; and the listen queue refuses it.

## Context

- **Split from TASK-111** at its plan gate (owner, 2026-11-20: the review was past the size line, writes and UI together). This part is the write layer the review's verbs stand on; TASK-111 (5 of 5) draws `/parked`, the dashboard line and the Inbox row, and **its merge ticks 5.15**, not this one's.
- Roadmap: `docs/05-roadmap.md` § 5.15 Parked (M17), *The review* bullet (*Plan…*, *Unlisted*, each one write with Undo). D-105, D-86, D-37, D-164.
- *From TASK-109 (5.15, PR #299), owner's answer at its plan gate (moved here from TASK-111 at the split):* an add to a plan level (On deck, a year or a quarter: `writeDestination` in `src/db/writes.ts`, Add books' *Use that* and *Paste a list*) moves a Parked book to `to_read` and plans it, as it moves an Unlisted one (`promote`), clearing `parked_on` with the status. Re-read the status under the plan lock, so a park that commits between the `waiting` read and `placeInPlan` can't leave a planned Parked book. The review's *Plan…* needs the same unparking. Its undo puts back `parked` and the day.
- *From TASK-109 (5.15, PR #299), owner's answer at its plan gate (moved here from TASK-111 at the split):* `queueListen` (`/api/listen-queue`) refuses a Parked book with 400 and writes nothing. The UI already hides *Queue to listen* for one (`queueable` in `src/lib/status-tabs.ts`), so this only closes the API.
- **Unlisted from Parked.** The roadmap's review offers *Unlisted* as one write with Undo. Today no status write sets `unlisted` (`SETTABLE_STATUSES`, D-86: only an undo, the Calibre import and an owned paste write it). This task lets `saveBookStatus` set it from `parked` only; every other status stays refused. Its undo (`undoBookStatus`, unchanged) puts back `parked` and its `parked_on`.
- Rules: `.claude/rules/schema.md` (*Below Someday sits Unlisted*, *Beside it sits Parked*, the listen queue).

## Acceptance criteria

- [x] AC-1: Given a Parked book (`parked_on` set), an add of it by `{ use }` (`addBooks`, `POST /api/books/bulk`) to a quarter, a bare year or On deck leaves it `to_read` with `parked_on` NULL and that period's plan row (a quarter: at its end, ordinal N+1); to Someday it leaves it `to_read` with `parked_on` NULL and no plan row. The entry names it in `unparked` with its `parked_on`.
- [x] AC-2: That add's undo (`undoAddBooks`, `DELETE /api/books`) puts the book back to `parked` with the same `parked_on`, removes the plan row it wrote and closes the quarter up (the books after it at their old ordinals), and answers true, also for a Parked book with an earlier read (a `finished_on` on its status); when the book has moved on since (no longer `to_read`, or given another plan row), it answers false and changes nothing.
- [x] AC-3: With the plan lock held by another connection, an add of a `to_read` book to a quarter waits; a park written and committed meanwhile (status `parked`) leaves the add placing no plan row: the book ends Parked with no `reading_plan` row (the add re-reads the status after taking the plan lock).
- [x] AC-4: `POST /api/progress/book { status: 'unlisted' }` on a Parked book writes `unlisted` with `parked_on` NULL and its undo (`DELETE` with the change) puts back `parked` and the same `parked_on`; on a book To read, Reading, Listening, Read, DNF or with no status it answers 400 and writes nothing.
- [x] AC-5: `POST /api/listen-queue` (`queueListen`) on a Parked book answers 400 and writes no `listen_queue` row; a To read book still queues (200).
- [x] AC-6: `.claude/rules/schema.md` says a Parked book's add to Someday or a plan level moves it to `to_read` (its undo puts back `parked` and the day), and that the review's *Unlisted* is the one status write that sets `unlisted`, from Parked only.

## Out of scope

- `/parked`, the dashboard line, the Inbox row and every screen (TASK-111).
- Parked runs (5.16) and other media.

## Files likely touched

- `src/db/writes.ts` — `promote` (Parked too), `writeDestination` (the waiting read under the plan lock), `AddedEntry.unparked`, `undoInside`, `saveBookStatus` (`unlisted` from `parked`), `queueListen` / `listenable`.
- `src/app/api/progress/book/route.ts` — `unlisted` allowed in a POST, its change validated.
- `src/app/api/listen-queue/route.ts` — 400 for a Parked book.
- `src/app/api/books/route.ts` (the add's undo) — only if its change parser must accept `unparked`.
- `.claude/rules/schema.md`.
- `test/parked.test.ts`, `test/listen-queue.test.ts`.

## Verification

- Automated: `test/parked.test.ts` (AC-1 to AC-4), `test/listen-queue.test.ts` (AC-5); AC-6 by reading the rules file.
- Manual: none (no screen changes; TASK-111 walks the review).

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- Candidate decision: the review's *Unlisted* is the one status write that sets `unlisted`, from Parked only (amends D-86); and an add unparks a Parked book as it promotes an Unlisted one (applies D-105) (approved at plan; the owner approved the row at close-out, 2026-11-20; PR #304) → `docs/review/decisions.md` § D-166
- The 5.15 row of `docs/03-data-model.md` § 4 says `parked_on` is written by `saveBookStatus` and cleared on leaving it, and the status is set only on a book To read, Reading or Listening; an add now clears it and the undos restore it, and *Unlisted* is set from Parked (approval queued; the owner's yes was not for this item) → `docs/OWNER-CHECKLIST.md` § Approvals from follow-ups
- The listen queue's refusal leaks through `restoreListen`, an add's undo and `undoBookStatus` back to Parked (schema-reviewer; outside the approved plan, which kept `restoreListen` unchanged) → `docs/tasks/TASK-111-parked-review-and-reminders.md` § Context (arrived after the plan was approved)
- A plan move's undo (`undoMoveIn`) refuses only `unlisted`, so it can put a plan row back under a book parked since (schema-reviewer; predates this task) → `docs/tasks/TASK-111-parked-review-and-reminders.md` § Context (arrived after the plan was approved)
- The add's undo guard for an unparked book (`to_read`, no `parked_on`, no other plan row) can't tell a book started, read and set back to To read since from one untouched, so that undo parks it again (schema-reviewer) → not tracked: accepted; the window is the toast's, the book returns to Parked and nothing is lost
- The undo's older status-row selects (`bareStatus`, `promotedRows`) are read before the plan lock without `FOR UPDATE`, so a park racing an undo can deadlock and one request answers 500 (schema-reviewer; the new unparked select locks its rows) → not tracked: predates this task, nothing is corrupted
- The plan revision (four client undo bodies pass `unparked` through) → not tracked: done in this PR (plan revision 1)

## Plan

Approved by the owner 2026-11-20 at TASK-111's plan gate, as the first half of its split.

**Steps**
1. `promote` moves a `parked` book to `to_read` as well as an `unlisted` one, clearing `parked_on`; it answers which were Parked and their `parked_on`, so `writeDestination` returns `unparked: { bookId, parkedOn }[]` beside `promoted` (Unlisted only). `AddedEntry.unparked?` (absent on an entry sent before 5.15).
2. `writeDestination`'s plan-level branch: keep `promote` and `toRead` first, then inside one `inPlan(userId, tx, …)` re-read `waiting` (the `to_read` books) and `placeInPlan` each. Not the plan lock first: `saveBookStatus` holds the book and its status row before it takes the plan lock, so taking the plan lock before `promote`'s update would deadlock against a park.
3. `undoInside`: the unparked books get their own guard, not `promotedRows` (which requires `finished_on IS NULL` and so would refuse a Parked book read before): status `to_read`, `parked_on` NULL, and no plan row but the add's own period's (a book started, finished or given up since is no longer `to_read`). Then, after the plan rows are taken out, `UPDATE … SET status = 'parked', parked_on = <its day>` for each, all or nothing (`refused`).
4. `saveBookStatus`: `unlisted` is accepted only when `before.status === 'parked'` (`UNLISTS_FROM = ['parked']`, its own `RefusedStatus` otherwise); the existing `parkedOn: status === 'parked' ? … : null` clears the day. `SETTABLE_STATUSES` stays as is (it is the status control's list); the route's `ALLOWED` gains `unlisted`, and `validChange` accepts a change whose `status` is `unlisted`.
5. `queueListen`: `listenable` (or a check beside it) reads `book_status.status`; a Parked book answers a refusal the route turns into 400 `{ error }`, writing nothing. `restoreListen` (an undo) is unchanged.
6. `.claude/rules/schema.md`: the two sentences of AC-6, in *Below Someday sits Unlisted* and *Beside it sits Parked*.

**Files**: `src/db/writes.ts`, `src/app/api/progress/book/route.ts`, `src/app/api/listen-queue/route.ts`, `src/app/api/books/route.ts` (only if the undo's parser needs `unparked`), `.claude/rules/schema.md`, `test/parked.test.ts`, `test/listen-queue.test.ts`.

**Plan revision 1 (owner, 2026-11-20, in the session):** the add's undo body is built by hand in four client files that copy the entry's fields one by one, so none would send `unparked` and an Undo from Add books, Paste a list or the plan sheet would leave a Parked book To read. Step 7: pass `unparked` through in `src/lib/book-add.ts` (`undoAdd`), `src/components/AddBooks.tsx`, `src/components/PasteBooks.tsx` and `src/components/PlanSheet.tsx`; `test/parked.test.ts` › "the screen's own undoAdd sends the unparked list" pins `undoAdd`'s body.

**Test strategy**
- AC-1: `test/parked.test.ts` › "an add unparks a Parked book": a book parked from `to_read`, added by `{ use }` to `2027-Q1` (two books already there: ordinal 3), `2027`, `on_deck` and Someday; status, `parked_on`, plan rows, `unparked`.
- AC-2: same file › "the add's undo puts it back to Parked": status `parked`, the same `parked_on`, Q1 back to 1–2; a Parked book with a `finished_on` (read once, set back to To read, parked); refused after the book is started, or moved to another period, with nothing changed.
- AC-3: same file › "the add re-reads the status under the plan lock": connection X holds `pg_advisory_xact_lock(hashtext('ledger:plan:<user>'))`; the add starts and blocks; connection Y sets the status to `parked` (raw SQL) and commits; X releases; the book is Parked with no plan row. Fails on today's code, where `waiting` is read before the lock.
- AC-4: same file › "Unlisted from Parked": POST/DELETE through the route handlers (as the file's other route tests do); 400 and no write from each other status.
- AC-5: `test/listen-queue.test.ts` › "refuses a Parked book".
- AC-6: read by the spec-reviewer.

**Risks**: grep `test/` for `promoted` and `SETTABLE_STATUSES`: tests that pin the add entry's shape or the settable list. The AC-3 test needs two connections to `TEST_DATABASE_URL` (postgres.js `sql.reserve()` or a second client), never `DATABASE_URL`.

## Review log

Verify R1 PASS | CI R1 FAIL (e2e-budget only: 6.1 min a shard against the 6.0 ceiling; tests and every browser project green; this PR adds 0 test runs) | Spec R1 CHANGES (schema.md `parked_on` writers; follow-up bullet) → R2 APPROVE | Schema R1 CHANGES (saveBookStatus unlocked read, undo lock order and plan recheck, listen-queue leaks, undoMoveIn) → R2 APPROVE | Audit R1 PASS | Verify R2 PASS | CI R2 FAIL (e2e-budget only: 6.5 min a shard; main at e01e95d, the same 2084 test runs, is itself 6.5 min, so the gate fails every PR until main shrinks or the owner applies `e2e-growth`: owner action) | UI n/a (no screen changes)

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 2
- Review rounds: 2 (spec-reviewer and schema-reviewer; test-auditor 1)
- First-pass AC FAILs: 0
- Plan revisions after approval: 1 (the four client undo bodies pass `unparked` through)
