---
id: TASK-058
title: 1.17b Dates when you start and finish (1 of 2) — re-date any read, the write and its API
status: Ready
depends_on: [TASK-039, TASK-043]
size: M
model: opus
autonomy: attended
ui: false
plan_status: none
planned_at_commit:
---

# TASK-058 — 1.17b Dates when you start and finish (1 of 2) — re-date any read, the write and its API

## Goal

Any read of a book, not only the latest, can have its start and finish changed, and changing the latest keeps the book's status in step. A start picked just after a status change is undone with that change.

## Context

- Roadmap: `docs/05-roadmap.md` § 1.17b Dates when you start and finish, and on every read (M9; owner, 2026-11-08, D-131; extends 1.17). The entry and its **Check:** are the contract; the Check is marked *proposed; the owner agrees it by merging or edits it first*. **Before 1.26** (in its **Depends on**). Feature F-17. Depends on 1.17 (TASK-039) and 1.23 (TASK-043).
- **Split** (`workflow.splitPolicy: split`; the whole entry is a write layer and five UI files). This part is the data and the API: re-dating any read, keeping `book_status` in step, and the reads a book has. TASK-059 is the status control that asks the dates and lists every read, on the Library row, Now and the status screens. TASK-059's merge ticks the roadmap entry; the tasklist row names both.
- **Today:** `POST /api/progress/book` (`src/app/api/progress/book/route.ts`) takes `{ bookId, status, finish?, start?, rating? }`; entering Reading or Listening without a `start` stamps today (1.17); on a book already read, `read` with a `start` and no `finish` edits the **latest** read's start alone. `saveBookStatus` and `undoBookStatus` are in `src/db/writes.ts`; `resolveStart` / `resolveFinish` in `src/lib/finish-date.ts`; 1.17's start-after-finish reason comes from `finishReason` in `src/components/FinishDate.tsx`.
- **What changes.** Re-dating an earlier read changes its `read_events` row only; re-dating the latest keeps `book_status` in step, through `saveBookStatus` or a sibling helper in `src/db/writes.ts` (the plan's). A start picked right after Reading or Listening was set re-dates the start just written, and the control's **one** Undo restores what was there before the status change (the plan says how the API lets one undo cover both).
- **Stop and ask at plan time** if the plan changes how a stored date is written or interpreted (CLAUDE.md). No new column is proposed. Dates are stored with their precision (`docs/03-data-model.md` § 2. Decisions, 2.17) and a read's start is stored for books (2.18); a listen is a read with format `audio` (2.22).
- 4.4 sends the latest finish to Calibre (D-133): another reason the latest read and `book_status` never disagree.
- Architecture: `docs/02-architecture.md` § 5. Routes and data access.
- Decisions: D-131, D-85, D-87, D-133. Hard rules 3 and 4.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves its write clauses at the API and database: an earlier start written `exact` and Undo restoring status and start, one `read_events` row carrying both dates, the refused start after the finish, and re-dating the first and second of two reads. TASK-059 proves the browser clauses): in the
browser (0.11): setting a book to *Reading* opens *Started* on *Today*; picking
an earlier day writes that `started_on`, `exact`, and Undo restores the status
and start before. Setting it to *Read* opens both; confirming writes one
`read_events` row carrying both dates; a start after the finish is refused and
writes nothing. A book with two reads lists both under *All reads (2)*;
re-dating the first changes only its `read_events` row, and re-dating the
second changes it and `book_status`. The same control works from *Now* on
`/books` and from `/books/status`; a search result has none. axe passes at
every width.
- [ ] AC-2: Given a book with two reads, re-dating the first read's start and finish through the API changes only that `read_events` row: the second read and `book_status` (its `started_on`, `finished_on` and their precisions) are byte-for-byte as before. Re-dating the second read changes its row and sets `book_status`'s dates to the same values and precisions.
- [ ] AC-3: A re-date whose start falls after its finish, or whose date is after today (Eastern), answers 400 with 1.17's reason, and no `read_events` or `book_status` row changes.
- [ ] AC-4: Given a book at `to_read` with no start, setting `reading` (today stamped) and then re-dating that start to an earlier day writes `started_on` = that day with precision `exact`; the one undo of the status change then restores `to_read` and no start, with no `read_events` row left behind.
- [ ] AC-5: Setting `read` with a start and a finish writes exactly one new `read_events` row carrying both dates, and `book_status` in step. A book's reads are readable oldest first with their format (`text` or `audio`), start, finish and precisions, for the control to list (the plan names the query). The diff adds no column.

## Out of scope

- The control, the pickers and the *All reads* list (TASK-059).
- Deleting a read, or adding one by hand that never happened through a status change.
- Sending dates to Calibre (4.4).
- Search results (D-131: none there).

## Files likely touched

- `src/db/writes.ts` — re-date a read; keep `book_status` in step for the latest.
- `src/app/api/progress/book/route.ts` (or a sibling route, the plan's) — the re-date request and the joint undo.
- `src/db/queries.ts` — a book's reads, oldest first.
- `src/lib/finish-date.ts` — the shared validation, if it moves.
- `test/start-dates.test.ts`, `test/reading-log.test.ts`, `test/audiobooks.test.ts`.

## Verification

- Automated: `test/start-dates.test.ts` (AC-2, AC-3, AC-4 against `TEST_DATABASE_URL`); `test/reading-log.test.ts` (AC-5's one row, and the reads query's order); `test/audiobooks.test.ts` (a listen's format survives a re-date).
- Manual: none in a browser (TASK-059). With `npm run dev`, `POST` a re-date for an earlier read of a reread book → expected: only that read's dates change; put it back, as found.

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
