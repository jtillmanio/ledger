---
id: TASK-108
title: 5.15 Parked (1 of 4) — the parked status, out of the plan and the listen queue, with an exact Undo
status: Ready
depends_on: [TASK-106]
size: M
model: opus
autonomy: attended
ui: false
plan_status: none
planned_at_commit:
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

- [ ] AC-1 (roadmap **Check (proposed):**, verbatim; this part proves, with `npm test`: the park of the 2nd of 3 in 2027 Q1 and its Undo, absence from `to_read_level`, `plan_period`, the status tabs' queries and 2.10b's suggestions, presence under `listBooks`'s *Parked* filter and in search, and `1 / 2`. TASK-109 proves the chip and tag in the browser, TASK-110 the cadence, TASK-111 the review and the dashboard line): (proposed; the owner agrees it by merging or edits it first)
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
- [ ] AC-2: Given a queued listen at position 2 of 3 that is also `listening`, parking it writes `parked`, leaves the listen queue at 1–2, and its Undo restores `listening`, its start date and queue position 2.
- [ ] AC-3: Parking writes `parked_on` as today's Eastern date (as approved), leaving `parked` clears it, and the undo of a park leaves no `parked_on`; a book parked from `reading` with a start and no finish since derives as *parked mid-read*.
- [ ] AC-4: Parking a `read`, `dnf`, `unlisted` or status-less book is refused with 400 and writes nothing; a missing or soft-deleted book answers 404.
- [ ] AC-5: `booksInFlight`, `booksUpNext` and `booksDone` return no parked book, `planCapacity` and `planSuggestions` leave it out, and `listBooks({ status: 'parked' })` returns exactly the parked books while *Everything* returns none of them.

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
