---
id: TASK-058
title: 1.17b Dates when you start and finish (1 of 2) — re-date any read, the write and its API
status: Done
depends_on: [TASK-039, TASK-043]
size: M
model: opus
autonomy: attended
ui: false
plan_status: approved
planned_at_commit: 3f240b2
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

- [x] AC-1 (roadmap **Check:**, verbatim; this part proves its write clauses at the API and database: an earlier start written `exact` and Undo restoring status and start, one `read_events` row carrying both dates, the refused start after the finish, and re-dating the first and second of two reads. TASK-059 proves the browser clauses): in the
browser (0.11): setting a book to *Reading* opens *Started* on *Today*; picking
an earlier day writes that `started_on`, `exact`, and Undo restores the status
and start before. Setting it to *Read* opens both; confirming writes one
`read_events` row carrying both dates; a start after the finish is refused and
writes nothing. A book with two reads lists both under *All reads (2)*;
re-dating the first changes only its `read_events` row, and re-dating the
second changes it and `book_status`. The same control works from *Now* on
`/books` and from `/books/status`; a search result has none. axe passes at
every width.
- [x] AC-2: Given a book with two reads, re-dating the first read's start and finish through the API changes only that `read_events` row: the second read and `book_status` (its `started_on`, `finished_on` and their precisions) are byte-for-byte as before. Re-dating the second read changes its row and sets `book_status`'s dates to the same values and precisions.
- [x] AC-3: A re-date whose start falls after its finish, or whose date is after today (Eastern), answers 400 with 1.17's reason, and no `read_events` or `book_status` row changes.
- [x] AC-4: Given a book at `to_read` with no start, setting `reading` (today stamped) and then re-dating that start to an earlier day writes `started_on` = that day with precision `exact`; the one undo of the status change then restores `to_read` and no start, with no `read_events` row left behind.
- [x] AC-5: Setting `read` with a start and a finish writes exactly one new `read_events` row carrying both dates, and `book_status` in step. A book's reads are readable oldest first with their format (`text` or `audio`), start, finish and precisions, for the control to list (the plan names the query). The diff adds no column.

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

- TASK-059 needs the API's shape: the re-date route, the `redate` undo payload, the one-Undo rule (keep the status change's `change`, drop the re-date's) and the reads from `GET` on open (approved at plan) → `docs/tasks/TASK-059-status-control-asks-dates.md` § Context
- AC-2's text says "sets `book_status`'s dates"; the owner's plan-gate decision (2026-11-09) is the finish only, recorded in `## Plan` and data model 2.18, and the tests assert that. The AC is left as written (only the owner edits an AC) → not tracked: decided by the owner at the plan gate; the decision is recorded in this task's Plan and `docs/03-data-model.md` 2.18
- Schema review suggested pinning `undoBookStatus`'s new finish sync for a prior-null row kept by a rating and a prior `unlisted` → not tracked: reviewed safe by reasoning (no read exists on those paths, so the sync is a no-op), and the existing undo tests for both paths pass unchanged

## Plan

Approved by the owner 2026-11-09. **Decision at the gate:** "book_status in step" is the
**finish only** (owner, 2026-11-09). A Read book's `book_status.started_on` stays NULL /
`none` (data model 2.18); a read's start lives on its `read_events` row alone. No column.

**Steps**

1. `src/db/queries.ts`: `bookReads(userId, bookId)`: `read_events` of a live book
   (`books.deleted_at IS NULL`), `book_id` set, ordered by `id` (the log's order, as
   `latestRead`): `id, format, started_on, started_on_precision, finished_on,
   finished_on_precision`.
2. `src/db/writes.ts`: `redateBookRead(userId, { bookId, readId, start?, finish? })`, in
   one transaction under `lockBook`. `readId` a read of this book: unsent dates kept as
   stored; `startAfterFinish` → `StartAfterFinish`; the row updated (format untouched); if
   it is the latest read (highest id), `book_status.finished_on` and precision set to its
   finish. `readId: null` is the read in progress: start only, status `reading` or
   `listening`, else `RefusedStatus`; `book_status.started_on` set. Answers a `BookRedate`
   (`bookId, readId, before, after`), or null for no such book or read.
3. `undoBookRedate(userId, redate)`: refuses (false) unless the dates are still `after`;
   puts back `before`, and `before`'s finish on book_status while the read is the latest.
4. `undoBookStatus`: after restoring, if a read remains, `book_status`'s finish is the
   latest read's (Read → Reading, re-date the latest read, Undo: never disagree; D-133).
   Equal to the prior in every case today.
5. `src/app/api/progress/book/read/route.ts` (new): `GET ?bookId=` → `{ reads }`;
   `POST { bookId, readId, start?, finish? }` → choices through `resolveStart` /
   `resolveFinish` (a day after today in Eastern refused), 400 with the reason, 404 for no
   such book or read, `{ ok, redate }`; `DELETE { redate }` → 200, or 409 when moved on,
   400 for a malformed payload.
6. The one Undo: a re-date answers no status change; the status change's own `DELETE`
   restores the whole prior row and the read it appended or edited, so it covers any
   re-date after it. TASK-059 keeps the status change's `change` for the toast.
7. Docs: `docs/02-architecture.md` § 5 route handlers and § 6 F-17 row gain the route;
   `docs/03-data-model.md` 2.18 "editable while Read" → every read is editable, the latest
   keeps `book_status`'s finish in step.

**Files**: `src/db/writes.ts`, `src/db/queries.ts`, `src/app/api/progress/book/read/route.ts`
(new), `test/start-dates.test.ts`, `test/reading-log.test.ts`, `test/audiobooks.test.ts`,
`docs/02-architecture.md`, `docs/03-data-model.md` (the last two not in "Files likely
touched": the route and the 2.18 rule this task extends).

**Test strategy**

- AC-1 (write clauses): covered by AC-2 to AC-5 below; browser clauses are TASK-059's.
- AC-2: `test/start-dates.test.ts` "re-dating the first of two reads changes only its
  read_events row" (row_to_json snapshots of the second read and book_status); "re-dating
  the second read sets book_status's finish in step, its start stays none".
- AC-3: "a re-date with its start after its finish is refused…", "a re-date after today in
  Eastern is refused…" (fake clock at 03:30Z), each 400 with the reason and snapshots equal.
- AC-4: "Reading, then its start re-dated, is undone by the status change's one undo".
- AC-5: `test/reading-log.test.ts` "Read with a start and a finish writes one read_events
  row carrying both" and "a book's reads list oldest first with format and dates" (query and
  GET). No column: the diff has no migration and no `schema.ts` change (reviewer).
- `test/audiobooks.test.ts` "a listen's format survives a re-date".
- Also: 404 for another book's read, the re-date's own undo and its 409, step 4's case.

**Risks**: a book whose only read is held by its status (workbook, no log row) lists no
reads; it has one read, so *All reads* never shows, and the date line keeps editing it
through `POST /api/progress/book`. Comic reads are excluded by `book_id`.

## Review log

_Filled by /implement-task. One line per round._

- Verify R1 round PASS → full PASS (977 browser tests) | R2 round PASS (after review fixes)
- Audit R1 PASS (AC-5's one-row clause a regression pin: the behaviour predates the task; AC-2 wording note for the owner)
- Spec R1 APPROVE (AC-2 wording note; the dropped `BookRedate.status` field is a plan revision) → R2 APPROVE (fixes only)
- Schema R1 APPROVE, 2 MINOR (undoBookStatus comment overclaimed; the undo payload lacked a start-after-finish check) → fixed in 3d8c893 → R2 APPROVE
- UI: not run (`ui: false`, no UI files changed)

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 2 (R1 round + full, R2 round)
- Review rounds: 2
- First-pass AC FAILs: 0
- Plan revisions after approval: 1 (the re-date's answer dropped a planned `status` field: its undo puts `book_status`'s finish back while the read is still the latest, checked at undo time, which a newer read appended since can't defeat)
