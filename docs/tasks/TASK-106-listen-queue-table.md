---
id: TASK-106
title: 5.14 A queue to listen next (1 of 2) — the listen_queue table, its writes and undo
status: Ready
depends_on: []
size: M
model: opus
autonomy: attended
ui: false
plan_status: none
planned_at_commit:
---

# TASK-106 — 5.14 A queue to listen next (1 of 2) — the listen_queue table, its writes and undo

## Goal

The Ledger keeps the order you mean to listen to audiobooks in: queue a book, move it, take it off, and starting to listen takes it off the queue and closes the gap, all with an exact Undo.

## Context

- Roadmap: `docs/05-roadmap.md` § 5.14 Audiobooks: a queue to listen next (M17; owner intake 2026-11-01). Depends on 1.23 and 1.9 (done). Pulled ahead of 1.26 by the owner (D-139). Feature F-59. Its **Check (proposed):** is the contract; the owner agrees it by merging or edits it first.
- **Split, 1 of 2** (`workflow.splitPolicy: split`: a new table with writes and a route, then verbs on three surfaces and two status tabs). This part is the data side. TASK-107 draws the verbs and the status screens, and its merge ticks the entry.
- **The queue is an order, so it is stored:** proposed `listen_queue(book_id PRIMARY KEY → books.id, position)`, contiguous from 1, like 1.10's `run_queue` (data model 2.16; its order UNIQUE is `DEFERRABLE INITIALLY DEFERRED` in the migration, which drizzle can't express), no `user_id` (D-91), in `src/db/export-tables.ts` (hard rule 7). **Stop and ask at plan time** (a new table). Not chosen: a format on `reading_plan` rows, because the plan is periods and a word budget, and a listen queue is only an order.
- **The writes** copy `run_queue`'s (`queueRun`, `moveQueued`, `removeQueued`, `restoreQueued` in `src/db/writes.ts`; `POST /api/queue`): queue at the end, *Move to…* a position, remove, and each undo restoring the exact order. **Setting a queued book to *Listening*** (`saveBookStatus`, 1.23) takes it off the queue and closes the gap in the same transaction; its Undo (`undoBookStatus`) puts it back where it was. The plan says what the other statuses do to a queued book (a finish from Listening has already removed it; *Read* or *DNF* from To read: proposed, off the queue too).
- **For the plan gate** (the entry): whether a book can be on the reading plan and the listen queue at once (proposed: yes, they answer different questions); whether the books dashboard's *Up next* slot shows the first queued listen (TASK-107 draws it if so). A soft-deleted book is on no queue read (hard rule 4).
- **Loads.** `listen_queue` references `books`, so `etl/load.ps1` / `load.sh` truncate it through `CASCADE` (CLAUDE.md § Non-obvious rules); extract writes nothing to it. 5.15 (TASK-108) takes a parked book off it.
- Data model: `docs/03-data-model.md` § 2. Decisions (2.16, 2.22), § 4. Proposed additions (the plan adds the row). Architecture: `docs/02-architecture.md` § 5. Routes and data access.
- Decisions: D-85, D-91, D-139. Hard rules 2, 3, 4, 5 and 7.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check (proposed):**, verbatim; this part proves the `npm test` sentence and the export test on the test database. TASK-107 proves the browser sentence): (proposed; the owner agrees it by merging or edits it first)
`npm test`: queueing three books gives positions
1–3; setting #2 to *Listening* leaves the other two at 1–2, and its undo
restores all three in order. In the browser (0.11), Up next lists *Listen
next* in queue order; Done's *Listened* chip lists only books with an
audio read; each tab's count equals its rows. The export test passes with
`listen_queue`.
- [ ] AC-2: Given three queued books, moving #3 to position 1 gives the order 3, 1, 2 at positions 1–3, and its undo restores 1, 2, 3; removing #2 leaves 1–2 contiguous, and its undo puts it back at 2.
- [ ] AC-3: Queueing a book already queued leaves one row at its position; queueing a missing or soft-deleted book writes nothing and answers 404; a malformed body answers 400; a request without the passcode cookie gets the gate's answer.
- [ ] AC-4: `listen_queue` has no `user_id` column, is listed in `src/db/export-tables.ts`, and `GET /api/export` returns its rows (`test/export-tables.test.ts`).

## Out of scope

- *Queue to listen* and *Move to…* on any screen, *Listen next* on Up next and the *Listened* chip (TASK-107).
- Parking (5.15, TASK-108), which removes a book from this queue.
- A format on the reading plan.

## Files likely touched

- `src/db/schema.ts`, `drizzle/<new migration>.sql`, `drizzle/meta/*` — `listen_queue` (as approved).
- `src/db/export-tables.ts` — the table.
- `src/db/writes.ts` — queue, move, remove, restore, and the Listening hook in `saveBookStatus`/`undoBookStatus`.
- `src/app/api/listen-queue/route.ts` (new; the path is the plan's).
- `docs/03-data-model.md` — § 4's row, marked built.
- `test/listen-queue.test.ts` (new), `test/export-tables.test.ts`.

## Verification

- Automated: `test/listen-queue.test.ts` (AC-1's `npm test` sentence, AC-2, AC-3 on `TEST_DATABASE_URL`), `test/export-tables.test.ts` (AC-4), `npm run check:migrations`.
- Manual: none (TASK-107 shows it).

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
