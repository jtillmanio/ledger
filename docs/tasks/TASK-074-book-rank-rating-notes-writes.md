---
id: TASK-074
title: 3.4 Book ratings and top-books reorder
status: In progress
depends_on: [TASK-010]
size: S
model: opus
autonomy: attended
ui: false
plan_status: approved
planned_at_commit: 11d4126
---

# TASK-074 — 3.4 Book ratings and top-books reorder

## Goal

A finished book can be given a place in its year's ranking, and a note, and putting a book at a rank moves the books below it down one, so a year's ranking never has two books at the same rank.

## Context

- Roadmap: `docs/05-roadmap.md` § 3.4 Book ratings and top-books reorder (M14; order 3.4 → 3.4b → 3.5; no dependency in the tasklist). The entry and its **Check:** are the contract. Feature F-31. Pulled ahead of 1.26 by the parity audit (`docs/cutover-parity.md` § `Top Books`: *Rank my top books of a year → 3.4*; D-95).
- **Writes only, no screen** (owner, 2026-11-13, at this task's creation). There is no Top books screen yet: 3.4b builds it (TASK-076) over every year, and moves the rank from `book_status.year_rank` onto the read (TASK-075). This task gives the writes and their tests through the existing book API, so 3.4b moves working code instead of starting from nothing. Status and finish date moved to 1.5 (R1-03), so they are not here.
- **What exists.** `book_status.year_rank integer` (*your top-10 position for that year*), `book_status.rating double precision` and `book_status.notes text` are in `src/db/schema.ts` and loaded by `etl/load.ps1` / `load.sh` (`year_rank`, `rating`; extract writes both empty). Nothing in the app writes any of the three. `src/db/writes.ts` reads them only in the undo and Unlisted paths (lines ~296 and ~1950: a row with no rating, notes or rank may be deleted), so a rank or note written here must keep those rows.
- **A year's ranks are contiguous from 1** (D-101, amending D-3's cap of ten): placing a book at rank *n* moves the books at *n* and below down one, and taking a book out closes the gap, the way the comics queue keeps its ordinals (`moveQueued` in `src/db/writes.ts`, data model 2.16). The year is the finish year, `extract(year FROM finished_on)` (D-21), never stored. A book with no finish date (`finished_on_precision = 'none'`) has no year, so it can't be ranked.
- **Stop and ask at plan time:**
  - *Rating.* D-3 accepted *ranking-only rating*, and D-101 keeps it (*no star scale*). Does this task write `book_status.rating` at all, and if so with what meaning, or is the rank the only rating, leaving `rating` unwritten? (The column's fate, kept or dropped, is a schema question for later, not this task.)
  - *Notes.* Writing `notes` through the API is in scope, but no screen shows them until 3.5's book sheet (TASK-079). Confirm the API-only write is wanted now.
- Every write goes through `src/db/writes.ts` and pushes one 1.2 undo that restores every rank it changed (`src/components/Undo.tsx`, `/api/progress/book`).
- Data model: `docs/03-data-model.md` § 2. Decisions, 2.16 and 2.17; § 3. Views (`book_reads`).
- Decisions: D-3, D-21, D-65, D-101, D-122. Hard rules 2 and 3.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): test that setting `year_rank = 3` demotes whatever held rank 3.
- [ ] AC-2: Given 2025 with five read books ranked 1–5, ranking a sixth 2025 book at 3 leaves ranks 1–6 contiguous, the books that held 3, 4 and 5 now at 4, 5 and 6, and the order of the rest unchanged; one undo restores all five ranks and clears the sixth's.
- [ ] AC-3: Taking the book at rank 2 out of 2025's ranking clears its `year_rank` and moves ranks 3–5 up to 2–4; a book finished in 2024 keeps its rank throughout (ranks are per year).
- [ ] AC-4: Ranking a book with no finish date (`finished_on_precision = 'none'`) is refused with 400 and writes nothing.
- [ ] AC-5: Writing a note stores it in `book_status.notes`, an empty note stores NULL, and a book with a rank or a note survives the paths that delete an empty `book_status` row (the Unlisted undo).

## Out of scope

- The Top books screen, the year switcher and drag to reorder (3.4b, TASK-076).
- Moving the rank onto `read_events` and loading the workbook's past ranks (3.4b, TASK-075).
- Ranking at the finish, *This or that* (3.4b, TASK-077).
- Showing notes anywhere (3.5's book sheet, TASK-079).
- Dropping or retyping `book_status.rating`.

## Files likely touched

- `src/db/writes.ts` — rank at a position, take out of the ranking, write a note; each with its undo.
- `src/app/api/progress/book/route.ts` (or a sibling route, the plan's) — the rank and note writes.
- `test/year-rank.test.ts` (new) — AC-1 to AC-5 on `TEST_DATABASE_URL`.

## Verification

- Automated: `test/year-rank.test.ts` (AC-1 to AC-5).
- Manual: none in a browser (no screen until TASK-076).

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- A ranked book whose finish is re-dated across years (`redateBookRead`, a `read` re-date) or cleared by a status undo keeps its `year_rank` in the wrong year, or with no year; nothing here prevents it, a later rank write to that year heals the list. TASK-075 moves the rank onto the read and should keep it with the read's year (approved at plan).

## Plan

Approved by the owner 2026-11-13. Answers to the plan-gate questions: **rating** is not written by this task (the rank is the only rating, D-3, D-101; the status POST's existing `rating` pass-through, task 1.5's, is left alone); **notes** are written through the API now, with no screen until TASK-079; **a book with no `book_status` row** is refused a note with a 400 (no `unlisted` row is created to hold it).

1. Tests first: `test/year-rank.test.ts` (AC-1 to AC-5) through the routes on `TEST_DATABASE_URL`; confirm they fail.
2. `src/db/writes.ts`: `rankBook(userId, bookId, rank)` and `unrankBook(userId, bookId)`, one per-user advisory lock (as `inQueue`). The year is `extract(year FROM finished_on)` (D-21); a book with no finish (`finished_on_precision = 'none'`) or no status row throws `RefusedStatus`. The write reads the year's ranked books in order (`year_rank`, then `book_id`), takes the book out, puts it at `rank` (clamped to 1…N+1), and renumbers 1…k, so a gap or duplicate it finds is healed. Answers `{ bookId, year, before: [{bookId, rank}], after: [{bookId, rank}] }` for every row it changed; `undoRank` puts `before` back, refusing (false → 409) when any of those rows no longer holds its `after` rank. Null for a missing or removed book.
3. `saveBookNote(userId, bookId, text)`: trimmed, empty stores NULL; a book with no status row throws `RefusedStatus`. Answers `{ bookId, prior, note }`; `undoBookNote` refuses when the note is no longer `note`.
4. Routes: `src/app/api/progress/book/rank/route.ts` (POST `{ bookId, rank: n | null }`, null takes the book out; DELETE `{ change }`) and `src/app/api/progress/book/note/route.ts` (POST `{ bookId, note }`; DELETE `{ change }`). Bad input or a refused write is 400, a missing book 404, a stale undo 409.
5. AC-5: a ranked or noted book keeps its `book_status` row through `undoBookStatus`'s delete-if-empty path and `undoAddBooks`'s Unlisted promotion undo (both already check `notes` and `year_rank` IS NULL).

**Files:** `src/db/writes.ts`; `src/app/api/progress/book/rank/route.ts` (new); `src/app/api/progress/book/note/route.ts` (new); `test/year-rank.test.ts` (new). No schema change.

**Tests:** `test/year-rank.test.ts`, one `describe` per AC.

**Risks:** a ranked book whose finish is re-dated across years, or cleared by a status undo, keeps its rank in the wrong year or none; a later rank write to that year heals it. Follow-up to TASK-075, which moves the rank onto the read.

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
