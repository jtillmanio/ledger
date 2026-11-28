---
id: TASK-151
title: 1.17c Log a past read of a book already read (1 of 2) — the write and its undo
status: In progress
depends_on: []
size: M
model: opus
autonomy: attended
ui: false
plan_status: approved
planned_at_commit: 956839f
---

# TASK-151 — 1.17c Log a past read of a book already read (1 of 2) — the write and its undo

## Goal

A book already Read can be given another read with past dates, without touching its other reads, and the add can be undone.

## Context

- Roadmap: `docs/05-roadmap.md` § 1.17c Log a past read of a book already read (M17 in `docs/06-tasklist.md`; Phase 1's, not a cutover gate). Feature F-17. Its **Check:** is AC-1, verbatim; proposed in PR #342 and agreed when it merged (2026-11-25).
- **Split, 1 of 2.** This part is the write, its undo and the route; TASK-152 draws *Add a past read*. AC-1's browser clauses are TASK-152's.
- **What exists.** `saveBookStatus` (`src/db/writes.ts`) appends a read on entering Read and re-dates the latest one on *Read* again (1.5); `redateBookRead` / `undoBookRedate` re-date one read (1.17b, D-131) behind `POST`/`DELETE /api/progress/book/read` (`src/app/api/progress/book/read/route.ts`), whose `GET` lists a book's reads (`bookReads`). `src/lib/finish-date.ts` resolves a finish and a start and refuses a start after the finish.
- **The rules that hold** (`.claude/rules/schema.md`): reads are a log (`read_events`), `book_status` is its projection, written through the helpers in `src/db/writes.ts`; a date is stored with its precision; years count reads (`book_reads`); a rank moves only through the rank helpers (D-101, D-169), so a logged read gets no rank.
- **Stop and ask at plan time:** how `reread_of` chains a read logged before others (if it means rewriting an existing row's `reread_of`), and anything that changes how a stored date is written or interpreted (CLAUDE.md). No new column is proposed.
- Decisions: D-21, D-65, D-85, D-101, D-131.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves its database clauses, TASK-152 its browser clauses):
with
the test database, a book read 2024-03-10 gets a past read finished
2019-06-01: it has two `read_events` rows, `book_status` still finishes
2024-03-10, and `book_reads` counts the book in 2019 and in 2024; Undo leaves
one row. A past read finished 2025-01-05 moves `book_status`'s finish to
2025-01-05. In the browser (0.11) at 360px, *Add a past read* opens both
pickers, a start after the finish is refused and writes nothing, and axe
passes.
- [ ] AC-2: Given a Read book, when a past read is logged with format `audio`, then its `read_events` row has `format = 'audio'` and `book_reads` counts it as a listen in its year; with no *Started*, its start is NULL with precision `none`.
- [ ] AC-3: Given a past read whose start is after its finish, the route answers 400 with 1.17's reason and writes nothing; given a book that isn't Read (no status, To read, Reading), it answers 409 and writes nothing.
- [ ] AC-4: Given a past read logged on a book with a ranked read, no `year_rank` changes in any year.
- [ ] AC-5: Undo of a logged read deletes exactly that row and restores `book_status`'s finish and precision to what they were; undo after another write to that book's reads is refused (409) and changes nothing.

## Out of scope

- The UI (TASK-152).
- Logging a read on a book that isn't Read: marking it Read already takes a past finish (1.17b).
- Ranking the logged read (3.4b's rank sheet does that).

## Files likely touched

- `src/db/writes.ts` — `logPastRead` and its undo, under the book's lock.
- `src/app/api/progress/book/read/route.ts` — the add and its undo (a new action on the existing route, or `PUT`; the plan's).
- `src/lib/finish-date.ts` — reused; changed only if the plan needs a helper.
- `test/reading-log.test.ts` — AC-1's database clauses, AC-2 to AC-5.

## Verification

- Automated: `test/reading-log.test.ts` on the test database (AC-1's rows and `book_reads` years, AC-2 to AC-5).
- Manual: none; TASK-152 walks it in the browser.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- A decision row: a book's latest read is its latest finish (undated last, ties by id), not its highest id; re-dates keep `book_status` on whichever read is latest after the write; a new read's `reread_of` (logged past, or appended by a status write: revision 2) is the read finished just before it, no existing row rewritten; a new read finished before the latest leaves `book_status` on the latest (approved at plan) → planned: `docs/review/decisions.md` (a new D-n row)
- A note to TASK-152: the route's shape (`PUT` / `DELETE { logged }`) and *All reads* now listed by finish, so a re-date can re-sort it (approved at plan) → planned: `docs/tasks/TASK-152-past-read-ui.md` § Context

## Plan

Approved 2026-11-28. Owner at the plan gate: "latest" becomes the latest finish (undated reads last, ties by id) everywhere, and a logged past read's `reread_of` points at its predecessor by finish (NULL when earliest), no existing row rewritten.

**Why "latest" changes.** Every reader of a book's latest read took the highest id (`latestRead`, six lateral joins in `queries.ts`, `bookReads`, the Calibre sync). A 2019 read logged today would get the highest id and become the latest: *Read* would re-date it, an undo would copy 2019 onto `book_status`, the sync would send 2019.

**Steps**

1. Tests first in `test/reading-log.test.ts` (below); confirm they fail.
2. One ordering for the latest read, `finished_on DESC NULLS LAST, id DESC`: `latestRead` (`src/db/writes.ts`), the six lateral joins in `src/db/queries.ts`, `bookReads` (oldest first, the same order reversed, so the last is still the latest), `bookDetail`'s *Reading history* (newest first; found in Phase 2, same file and rule) and the sync's latest read (`src/db/calibre-sync.ts`).
3. `redateBookRead` / `undoBookRedate` set `book_status`'s finish from the latest read after the write (as `undoBookStatus` does), so moving the latest read before another leaves `book_status` on the new latest.
4. `logPastRead(userId, { bookId, start?, finish, format })` under `lockBook`: a book not Read is refused (`NotRead`, 409); a Read book whose read the status holds alone has it logged first (as `saveBookStatus` does); one row inserted, no rank, `reread_of` the read finished just before it; `book_status`'s finish set from the latest read. Answers the prior finish and a snapshot of the book's reads and status after the add.
5. `undoPastRead`: refuses (409, nothing changed) unless the book's reads and status are exactly the snapshot; else deletes the row (and the backfilled one) and puts the prior finish and precision back.
5a. (Plan revision 1, owner 2026-11-28.) `undoBookStatus`'s "the log hasn't moved on" guard no longer asks for the touched read to be the latest: a read the write appended or backfilled must still be the newest row, and a read it corrected must exist and be the latest again with its old dates back. Otherwise a correction that moves the read before another could not be undone.
5b. (Plan revision 2, owner 2026-11-28.) A read appended by a status write (Reading or Listening, then Read) takes the same `reread_of` rule as a past read: the read finished just before it (`readBefore`). A reread finished today still points at the latest read.
5c. (Review fix, schema-reviewer and spec-reviewer R1.) `undoRank`'s backfill guard judges by the newest row (`newestRead`), as revision 1 does for `undoBookStatus`: by the latest read, an earlier past read logged after the backfill let the undo delete the 2024 read.
6. Route `src/app/api/progress/book/read/route.ts`: `PUT { bookId, start?, finish, format? }` adds (400 bad dates or `START_AFTER_FINISH`, 404 missing book, 409 not Read); `DELETE { logged }` undoes it, `DELETE { redate }` as before.

**Files**

- `src/db/writes.ts`: the ordering, re-date sync, `logPastRead` / `undoPastRead`.
- `src/app/api/progress/book/read/route.ts`: `PUT`, and `DELETE { logged }`.
- `src/db/queries.ts` (not in Files likely touched): the six latest-read joins and `bookReads`' order.
- `src/db/calibre-sync.ts` (not in Files likely touched): the sync's latest read.
- `test/reading-log.test.ts`: every AC, and the ordering.
- `test/start-dates.test.ts` (found in Verify R1): 1.17b's test expected an undated latest read to make `book_status` undated; under the approved order the dated read before it is the latest.

**Test strategy** (all `test/reading-log.test.ts`, a `describe("a past read (roadmap 1.17c)")`)

- AC-1: a 2024-03-10 read plus a 2019-06-01 past read: two rows, `book_status` 2024-03-10, `book_reads` years 2019 and 2024; Undo leaves one. A 2025-01-05 past read moves `book_status` to 2025-01-05.
- AC-2: `format: "audio"` stores `audio` and `book_reads` counts a listen in its year; no start is NULL / `none`.
- AC-3: start after finish 400 with `START_AFTER_FINISH`; no status, To read, Reading 409; nothing written in each.
- AC-4: two ranked reads; a past read logged in 2024 and in 2019; every `year_rank` unchanged.
- AC-5: Undo restores finish and precision; Undo after a re-date of another read, and after a status write, 409 and nothing changed.
- The ordering: after a 2019 past read, *Read* corrects the 2024 read; `listBooks`' start and the sync's latest read are 2024's; `bookReads` lists 2019 first; re-dating the latest before another moves `book_status` to the other.

**Risks**

- `bookReads` is no longer "log order, never reordered" (1.17b): *All reads* can re-sort after a re-date.
- A book whose highest-id read isn't its latest finish (possible only after a 1.17b re-date) keeps a stale `book_status` finish until its next write; no database was queried for one.

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
