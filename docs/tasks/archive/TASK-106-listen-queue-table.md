---
id: TASK-106
title: 5.14 A queue to listen next (1 of 2) — the listen_queue table, its writes and undo
status: Done
depends_on: []
size: M
model: opus
autonomy: attended
ui: false
plan_status: approved
planned_at_commit: 0d1f967
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

- [x] AC-1 (roadmap **Check (proposed):**, verbatim; this part proves the `npm test` sentence and the export test on the test database. TASK-107 proves the browser sentence): (proposed; the owner agrees it by merging or edits it first)
`npm test`: queueing three books gives positions
1–3; setting #2 to *Listening* leaves the other two at 1–2, and its undo
restores all three in order. In the browser (0.11), Up next lists *Listen
next* in queue order; Done's *Listened* chip lists only books with an
audio read; each tab's count equals its rows. The export test passes with
`listen_queue`.
- [x] AC-2: Given three queued books, moving #3 to position 1 gives the order 3, 1, 2 at positions 1–3, and its undo restores 1, 2, 3; removing #2 leaves 1–2 contiguous, and its undo puts it back at 2.
- [x] AC-3: Queueing a book already queued leaves one row at its position; queueing a missing or soft-deleted book writes nothing and answers 404; a malformed body answers 400; a request without the passcode cookie gets the gate's answer.
- [x] AC-4: `listen_queue` has no `user_id` column, is listed in `src/db/export-tables.ts`, and `GET /api/export` returns its rows (`test/export-tables.test.ts`).

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

- The roadmap's two plan-gate questions, answered by the owner at this plan gate (2026-11-18): a book may be on the reading plan and the listen queue at once; the books dashboard's *Up next* slot does **not** show the first queued listen (*Listen next* lives on the Up next tab only). TASK-107 draws to this. (approved at plan) → docs/tasks/TASK-107-listen-next-on-the-status-screens.md § Context
- Schema review (MINOR): a soft-deleted book keeps its queue row and position, so part 2's reads must number the rows they show and turn a shown place into a stored one; the add undos soft-delete a created book without looking at the queue; queueListen takes no book row lock; no test races two queue writes. All matter only once TASK-107 reads the queue and adds *Queue to listen* to the add sheet → docs/tasks/TASK-107-listen-next-on-the-status-screens.md § Context
- The two plan-gate answers as a decisions-log row → not tracked: recorded in docs/03-data-model.md § 4 (the 5.14 row) and TASK-107 § Context; no D-n proposed

## Plan

Approved by the owner 2026-11-18 (the new table, `position`; Listening, Read and DNF take a book off the queue; the dashboard slot shows no listen).

**Steps**

1. **Table** `listen_queue(book_id text PRIMARY KEY → books.id ON DELETE CASCADE, position integer NOT NULL)`, `UNIQUE (position) DEFERRABLE INITIALLY DEFERRED` hand-added to `drizzle/0032_listen_queue.sql` (as `0014_run_queue.sql`); no `user_id` (D-91), no `added_at`. Creates only: no down file.
2. **Export**: `listen_queue` in `CATALOG_TABLES` (hard rule 7).
3. **Writes** (`src/db/writes.ts`), copying `run_queue`'s, each one transaction behind one advisory lock (`ledger:listen-queue`): `queueListen` (at the end; a book already queued stays and answers its position; null for a missing or soft-deleted book), `moveListen` (to a position, clamped 1…N), `removeListen` (hard delete, the gap closes; answers the position it had), `restoreListen` (back at that position, clamped 1…N+1; a book queued again since is moved there). A soft-deleted book keeps its row, as `run_queue` does, so a restored book comes back to its place; TASK-107's reads filter `deleted_at` (hard rule 4).
4. **Status hook**: `saveBookStatus` setting a queued book to `listening`, `read` or `dnf` deletes its row and closes the gap in the same transaction (under the queue lock), and the change carries the position it had (`unqueued`); `reading` and `to_read` leave it queued. `undoBookStatus` puts it back at that position in its transaction (moved there if queued again since). `/api/progress/book`'s `validChange` accepts `unqueued` (a position or absent/null).
5. **Route** `src/app/api/listen-queue/route.ts`: POST `{ bookId }` (queue), POST `{ bookId, restore }` (remove's undo), PATCH `{ bookId, to }`, DELETE `{ bookId }`; answers `{ ok, position }` (+ `added` on a queue); 404 for a missing or soft-deleted book or one not queued; 400 for a malformed body; 401 without a session; inside the passcode gate.
6. **Docs**: `docs/03-data-model.md` § 4 row (built), `docs/02-architecture.md` § 5 the route, `.claude/rules/schema.md` a bullet for the table.

**Files**

- `src/db/schema.ts`, `drizzle/0032_listen_queue.sql`, `drizzle/meta/*` — the table.
- `src/db/export-tables.ts` — the table.
- `src/db/writes.ts` — the four writes and the status hook.
- `src/app/api/listen-queue/route.ts` (new) — the route.
- `src/app/api/progress/book/route.ts` — *not in Files likely touched*: the undo validator accepts `unqueued`.
- `test/listen-queue.test.ts` (new), `test/export-tables.test.ts`.
- `test/comics-load.test.ts` — *not listed*: it names every table and fails on an unknown one; `listen_queue` joins `BOOK_TABLES` (load:comics leaves it alone).
- `docs/03-data-model.md`; `docs/02-architecture.md` § 5 and `.claude/rules/schema.md` — *not listed*: the route and the table's rule, each in its one home.

**Test strategy**

- AC-1: `test/listen-queue.test.ts` › "three queued books are 1–3; Listening on #2 closes the gap and its undo restores the order".
- AC-2: › "move #3 to 1 gives 3, 1, 2 and its undo 1, 2, 3; remove #2 closes the gap and its undo puts it back at 2".
- AC-3: › "queueing a queued book leaves one row", "404 for a missing or soft-deleted book, writing nothing", "400 for a malformed body", "401 without a session", "inside the passcode gate" (the proxy, as `owned-copies.test.ts`).
- AC-4: `test/export-tables.test.ts` › "exports listen_queue whole".
- Also: Read and DNF from To read take it off, Reading leaves it; the order's UNIQUE is deferrable; `npm run check:migrations`.

**Risks**: lock order: `saveBookStatus` row-locks the book, then takes the queue's advisory lock; the queue writes take the advisory lock and only read `books` (no row lock), so the two never wait on each other in opposite orders.

**Size**: about 10 files, data side only, no UI; already the split half (TASK-107 is the UI), so not split again.

## Review log

_Filled by /implement-task. One line per round._

- Verify R1 PASS | Spec R1 CHANGES (follow-up bullet had no destination; placed at close-out) | Schema R1 APPROVE (3 MINOR → TASK-107 § Context) | Audit R1 PASS | UI not run (ui: false, no UI files)

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 1
- Review rounds: 1
- First-pass AC FAILs: 0
- Plan revisions after approval: 0 (one refinement inside the plan: only *entering* Listening, Read or DNF unqueues; PATCH also answers rom)
