---
id: TASK-151
title: 1.17c Log a past read of a book already read (1 of 2) — the write and its undo
status: Ready
depends_on: []
size: M
model: opus
autonomy: attended
ui: false
plan_status: none
planned_at_commit:
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
