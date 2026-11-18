---
id: TASK-108
title: 5.15 Parked (1 of 4) — the parked status, out of the plan and the listen queue, with an exact Undo
status: Review
depends_on: [TASK-106]
size: M
model: opus
autonomy: attended
ui: false
plan_status: approved
planned_at_commit: 5c47fd7
---

# TASK-108 — 5.15 Parked (1 of 4) — the parked status, out of the plan and the listen queue, with an exact Undo

## Goal

The Ledger can park a book: put it away on purpose, out of its plan and off the listen queue, out of every plan, dashboard and status list, still counted unread, with an Undo that puts everything back exactly.

## Context

- Roadmap: `docs/05-roadmap.md` § 5.15 Parked: put a book away on purpose, and review it on a schedule (M17; owner intake 2026-11-02). D-105. Depends on 1.9, 1.17, 1.21, 2.2 and 2.3 (done) and 5.14 (TASK-106: parking takes a book off the listen queue). Pulled ahead of 1.26 (D-139). Feature F-66. Its **Check (proposed):** is the contract; the owner agrees it by merging or edits it first.
- **Split, 1 of 4** (`workflow.splitPolicy: split`: a status and a column, plan and queue removal, verbs and a chip, two settings columns and a cadence, a review page, a dashboard line and an Inbox row). This part is the status's data side. TASK-109 draws *Park* and the *Parked* chip; TASK-110 stores the review's cadence and decides when it is due; TASK-111 draws `/parked` and the reminders, and its merge ticks the entry.
- **What it means:** *not now, but not gone.* Not Someday (on your list, not planned), not Unlisted (in your library, not on your list), not DNF (stopped), and not watch's derived *Paused*.
- **Stored as a status.** Proposed: a `parked` value of `book_status.status`, beside 1.21's `unlisted` (no CHECK, so no migration for the value), added to `SETTABLE_STATUSES` (`src/db/writes.ts`) for a book that is `to_read`, `reading` or `listening`. **Stop and ask at plan time** (a new status meaning and a column): the date it was parked, proposed `book_status.parked_on date`, written by `saveBookStatus` on entering `parked` and cleared on leaving it. Whether it was parked mid-read is derived: a `started_on` (1.17) with no finish since.
- **Out of the way.** Parking takes the book out of its plan through 1.7's helpers (`takeOutOfPlan`; its quarter closes up) and off 5.14's listen queue (TASK-106), in one transaction with the status; Undo (`undoBookStatus`) restores the status, the period and the exact position. `to_read_level` reads only `to_read` (`etl/views.sql`), so a parked book is on no plan rail, capacity sum, dashboard slot or status-screen tab, and in none of 2.10b's suggestions (`planSuggestions`); the progress views count it unread, as they count Unlisted; `follow_queue` already skips it (its comment names 5.15).
- **The Library and search.** `listBooks` (`src/db/queries.ts`) gains a `parked` filter for TASK-109's *Parked · N* chip and its count (`listCounts`); *Everything* leaves parked books out, as it leaves Unlisted out (the plan confirms against D-83); the Library search (1.22, `librarySearch`) returns a parked book with its status, so TASK-109 can tag it *Parked*.
- Data model: `docs/03-data-model.md` § 2. Decisions (2.17, 2.18, 2.22), § 4. Proposed additions (the plan adds the row). `.claude/rules/schema.md` (the four levels and Unlisted).
- Decisions: D-37, D-83, D-86, D-105, D-139. Hard rules 2, 3 and 4.

## Acceptance criteria

- [x] AC-1 (roadmap **Check (proposed):**, verbatim; this part proves, with `npm test`: the park of the 2nd of 3 in 2027 Q1 and its Undo, absence from `to_read_level`, `plan_period`, the status tabs' queries and 2.10b's suggestions, presence under `listBooks`'s *Parked* filter and in search, and `1 / 2`. TASK-109 proves the chip and tag in the browser, TASK-110 the cadence, TASK-111 the review and the dashboard line): (proposed; the owner agrees it by merging or edits it first)
`npm test`: parking the 2nd of 3 books in 2027 Q1
writes `parked`, removes its plan row and leaves Q1 at ordinals 1–2, and
Undo restores `to_read` at position 2. A parked book is absent from
`to_read_level`, `plan_period`, the three status-screen tabs and 2.10b's
suggestions, and present under the master list's *Parked* chip and in
search tagged *Parked*; a series with one read and one parked book reads
`1 / 2`. With a monthly cadence, one parked book and a last review 40 days
ago, the review is due; with nothing parked it is not; *Done reviewing*
makes it not due. In the browser (0.11), the review's *Plan…* opens 2.3's
picker, *Unlisted* writes `unlisted` and Undo puts back `parked`, and the
dashboard line shows only when the review is due. Nothing on the
dashboard or the review resolves to `--danger`.
- [x] AC-2: Given a queued listen at position 2 of 3 that is also `listening`, parking it writes `parked`, leaves the listen queue at 1–2, and its Undo restores `listening`, its start date and queue position 2.
- [x] AC-3: Parking writes `parked_on` as today's Eastern date (as approved), leaving `parked` clears it, and the undo of a park leaves no `parked_on`; a book parked from `reading` with a start and no finish since derives as *parked mid-read*.
- [x] AC-4: Parking a `read`, `dnf`, `unlisted` or status-less book is refused with 400 and writes nothing; a missing or soft-deleted book answers 404.
- [x] AC-5: `booksInFlight`, `booksUpNext` and `booksDone` return no parked book, `planCapacity` and `planSuggestions` leave it out, and `listBooks({ status: 'parked' })` returns exactly the parked books while *Everything* returns none of them.

## Out of scope

- *Park* on any screen, the *Parked · N* chip and the search tag (TASK-109).
- The cadence settings, the due rule and *Done reviewing* (TASK-110); `/parked`, the dashboard line and the Inbox row (TASK-111).
- Parked runs (5.16) and other media (8.8, 9.3, 10.1).

## Files likely touched

- `src/db/schema.ts`, `drizzle/<new migration>.sql`, `drizzle/meta/*` — `book_status.parked_on` (as approved).
- `src/db/writes.ts` — `SETTABLE_STATUSES`, `saveBookStatus`/`undoBookStatus` (plan and queue out and back).
- `src/db/queries.ts` — `listBooks`'s parked filter, `listCounts`, `librarySearch`'s status.
- `src/app/api/progress/book/route.ts` — the allowed transitions.
- `docs/03-data-model.md` — § 4's row.
- `test/parked.test.ts` (new).

## Verification

- Automated: `test/parked.test.ts` (AC-1's `npm test` clauses for this part, AC-2 to AC-5 on `TEST_DATABASE_URL`), `npm run check:migrations`.
- Manual: none (TASK-109 shows it).

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- An add flow's *Use that* into On deck or a quarter (`writeDestination`) keeps a status the book has, so a parked book added there would be planned and still parked, on no rail; its `waiting` read also comes before the plan lock, so a park committing in between could leave the same state (approved at plan; the race from schema-reviewer R1) → docs/tasks/TASK-109-park-verb-and-parked-chip.md § Context
- `queueListen` checks only that a book is live, so a Parked book can be queued after it was parked; whether *Queue to listen* refuses a Parked book, or unparks it, is the verbs' call (schema-reviewer R1) → docs/tasks/TASK-109-park-verb-and-parked-chip.md § Context
- What this part built, for the verbs' plan (the change's `unplanned`, `PARKS_FROM`, `listCounts().parked`, `isParkedMidRead`) → docs/tasks/TASK-109-park-verb-and-parked-chip.md § Context
- Candidate decision: `book_status.parked_on` with its CHECK, set exactly while `parked`; parking only from To read, Reading or Listening; every plan row out and back with the undo; the Owned filters list Parked books as they list Unlisted (approved at plan) → docs/review/decisions.md § D-163

## Plan

Approved by the owner 2026-11-18, with: `book_status.parked_on` **with** the CHECK `(parked_on IS NOT NULL) = (status = 'parked')`; the Owned filters (*Physical · Audiobook · Ebook*) list Parked books, as they list Unlisted (D-152).

**Steps**

1. `src/db/schema.ts`: `book_status.parked_on date` (nullable) and the CHECK; `npm run db:generate` writes migration 0033 and its meta. No down file: it only adds a column and a constraint.
2. `src/db/writes.ts`: `parked` joins `BOOK_STATUSES`, `SETTABLE_STATUSES` and `LEAVES_LISTEN_QUEUE`.
3. `saveBookStatus`: `parked` only from `to_read`, `reading` or `listening` (anything else, no status row included, throws `RefusedStatus`: 400, nothing written; a missing or removed book stays null, 404). Entering it stamps `parked_on` (today, Eastern), deletes every plan row of the book behind the plan lock (each quarter closes up) and answers them as `unplanned: [{ period, ordinal }]`; the listen queue's `unqueued` as 5.14 does. Every other status clears `parked_on`; `prior` carries `parkedOn`. The start is left on `book_status`.
4. `undoBookStatus`: refuses up front when the book holds a plan row in an `unplanned` period; otherwise puts back status, start, `parked_on`, each plan row at its place (`restoreToPlan`) and the queue position.
5. `src/app/api/progress/book/route.ts`: POST accepts `parked`; `validChange` checks `unplanned` and `prior.parkedOn` (both optional, for a change sent before 5.15).
6. `src/db/queries.ts`: *Everything* and the genre chips leave Parked out as they leave Unlisted; a search and the Owned filters but *Not owned* list it; `status: 'parked'` lists exactly the parked books; `listCounts` gains `parked`. `librarySearch` already answers the status.
7. `src/lib/parked.ts` (new): `isParkedMidRead(row)`: Parked with a start held on `book_status` (1.17), derived, never stored (D-105).
8. Docs: `docs/03-data-model.md` § 4 a 5.15 row; `.claude/rules/schema.md` a Parked paragraph beside Unlisted (not in Files likely touched: it is the data-model rules' one home).

**Files**: `src/db/schema.ts`, `drizzle/0033_*.sql`, `drizzle/meta/*`, `src/db/writes.ts`, `src/db/queries.ts`, `src/app/api/progress/book/route.ts`, `src/lib/parked.ts` (new, flagged), `docs/03-data-model.md`, `.claude/rules/schema.md` (flagged), `test/parked.test.ts` (new).

**Test strategy** (`test/parked.test.ts`, one `describe` per AC): AC-1 the 2nd of 3 in 2027 Q1 parked and undone; absent from `to_read_level`, `plan_period`, `booksInFlight`, `booksUpNext`, `booksDone`, `planSuggestions`; under `listBooks({ status: 'parked' })` and in `librarySearch` with `status: 'parked'`; `series_progress` `1 / 2`. AC-2 a queued Listening book at 2 of 3. AC-3 `parked_on` written, cleared, gone after undo; `isParkedMidRead`. AC-4 the route's POST (400 per status, 404 missing and removed). AC-5 the three tabs, `planCapacity`, `planSuggestions`, `listBooks` and *Everything*, `listCounts`. Plus `npm run check:migrations`.

**Risks**: lock order (book row, then plan lock, then listen lock: no plan path may take the plan lock and then a book row); a `parked` status shown by a screen before TASK-109 draws it (only a search hit or an unreachable filter can).

## Review log

_Filled by /implement-task. One line per round._

- Verify R1 PASS (vitest 2,215 passed, ETL 411 OK, `check:migrations`) | CI R1 PASS (be1b78a, every project)
- Spec R1 CHANGES (two follow-ups without a destination) → placed at close-out | Schema R1 CHANGES (MAJOR: an unpark's undo under a plan row gained since; MINOR: the undo's period and day checks; two MINOR left as follow-ups) → fixed in 7bb92f6
- Verify R2 PASS (2,217 passed, ETL 411 OK) | Schema R2 APPROVE | Audit R1 PASS (AC-1 to AC-5 proven; four line mutations each failed their tests)
- Close-out follow-ups check APPROVE (4 bullets, 4 placed; no ticks due: 5.15 stays open until TASK-111)

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 2
- Review rounds: 2 (schema), 1 + close-out check (spec)
- First-pass AC FAILs: 0
- Plan revisions after approval: 0 (the review fix tightened the undo inside the approved step 4)
