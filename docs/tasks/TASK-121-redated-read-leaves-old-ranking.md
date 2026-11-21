---
id: TASK-121
title: 3.4c A re-dated read leaves its old year's ranking
status: In progress
depends_on: [TASK-077]
size: M
model: opus
autonomy: attended
ui: false
plan_status: approved
planned_at_commit: d9efddf
---

# TASK-121 — 3.4c A re-dated read leaves its old year's ranking

## Goal

When you move a ranked read to another year, or take its date away, the year it left closes up around the gap at once and the read waits unranked in its new year. One Undo puts both the date and the old ranking back.

## Context

- Roadmap: `docs/05-roadmap.md` § 3.4c (its **Check** is AC-1, verbatim). `docs/06-tasklist.md` M14. From TASK-077 (3.4b, PR #260), approved at its plan gate (owner, 2026-11-14).
- **Sized M, not the entry's S:** the write is one layer (`src/db/writes.ts`), but each re-date's undo payload goes through the client and back, so the two routes that check it change too (four files, two adjacent layers).
- The rule (`.claude/rules/schema.md`, *A rank belongs to a read*; D-101, D-122): a year's ranks are contiguous from 1 over its ranked reads of live books, written only through `rankRead`. Today a re-date carries `year_rank` with it: a gap in the year it left, a tie in the year it joined, until the next rank write to each renumbers it (`yearRanking` orders by rank, then the read's id; TASK-075).
- The three ways a finish is re-dated, all in `src/db/writes.ts`:
  - `redateBookRead` / `undoBookRedate` (task 1.17b, D-131): *All reads* and a read's dates, through `POST`/`DELETE /api/progress/book/read` (the route's `validRedate` checks the undo body).
  - `saveBookStatus` / `undoBookStatus`: *Read* on a book already read re-dates its latest read (a *Finished* correction), through `/api/progress/book` (its `validChange` checks the undo body).
  - The finish date written to `book_status` follows the latest read (D-133); only `read_events.year_rank` carries a rank.
- Ranking writes: `rankRead` (taking a read out with `rank: null` closes the gap), `undoRank` (refuses unless the year's ranking is exactly as the write left it), `RankChange` (`before`, `after`, `left`). Every rank write runs under `inRanking`'s per-user advisory lock and then takes `lockBook`.
- **For the plan gate: lock order.** `rankRead` takes the ranking lock, then the book's row lock; `redateBookRead` and `saveBookStatus` take the book's lock first. Doing the ranking change inside the re-date's transaction must not take the two in the opposite order, or a rank write and a re-date of the same book can deadlock. The plan says which lock comes first in each path, and the test for two concurrent writes.
- **For the plan gate: the undo's refusal.** A re-date's undo today refuses when the read no longer holds the dates the re-date gave it. With ranks it must also refuse, changing nothing, when the old year's ranking has moved since (as `undoRank` checks `left`), so an undo never leaves a tie or a gap.
- Tests: `test/year-rank.test.ts` (3.4 and 3.4b's ranking tests, its fixtures of five ranked 2025 reads), `test/status.test.ts` and the 1.17b re-date tests.
- Decisions: D-21 (the year is derived from `finished_on`), D-65 (years count reads), D-101, D-122, D-131, D-133.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): `npm test`: re-dating the read ranked 3 of five in 2025 into 2024 leaves 2025 ranked 1–4 contiguous, the read unranked in 2024 and 2024's ranks unchanged; re-dating it to no date does the same with no year; one undo of either restores 2025's five ranks and the read's date; re-dating it to another day of 2025 keeps it at 3.
- [ ] AC-2: The same three outcomes hold when the re-date is a *Finished* correction through `saveBookStatus` (*Read* on the book already read, with a finish in 2024, with no date, and on another 2025 day), and its one undo through `undoBookStatus` restores the date and 2025's five ranks.
- [ ] AC-3: Given a re-date out of 2025 followed by a rank write to 2025 (another read moved), the re-date's undo is refused (409 from the route; `false` from the write), and the database is unchanged by the refused undo: 2025's ranks, the read's date and its `year_rank` are as the rank write left them.
- [ ] AC-4: An unranked read re-dated into another year changes no `year_rank` in either year. The read's rank change happens in the re-date's transaction: if the re-date is refused (a start after its finish), no rank changes.
- [ ] AC-5: `POST /api/progress/book/read` and `/api/progress/book` answer an undo payload that carries the rank change, and their `DELETE`/undo accepts it; a payload with a malformed rank change is 400 and writes nothing.
- [ ] AC-6: A re-date and a rank write to the same book's year, run concurrently (two connections), both complete or one waits: neither deadlocks, and the year's ranks are contiguous after both.

## Out of scope

- Ranking the read in its new year: it lands under *Not ranked yet*, and ranking it is 3.4b's *This or that* or Top books.
- Any change to how the ranking or Top books look.
- Healing gaps or ties already in the data from earlier re-dates (the next rank write to the year renumbers it, as today).
- A comic read's dates: `read_events` for comics isn't written yet.

## Files likely touched

- `src/db/writes.ts`: `redateBookRead`, `undoBookRedate`, `saveBookStatus`, `undoBookStatus`, `BookRedate` / `BookStatusChange` carry the rank change; a shared helper that takes a read out of its year's ranking inside a transaction
- `src/app/api/progress/book/read/route.ts`: `validRedate` accepts the rank change
- `src/app/api/progress/book/route.ts`: `validChange` accepts it
- `test/year-rank.test.ts`: AC-1 to AC-4 and AC-6; AC-5 through the routes

## Verification

- Automated: `test/year-rank.test.ts` (each re-date path, each undo, the refused undo, the concurrent pair); `npm run test:no-e2e` green.
- Manual: in the Library at 390px, open *All reads* on a book ranked 3 in 2025 and change its finish to a 2024 day → expected: Top books for 2025 shows 1–4 with no gap, 2024 shows the book under *Not ranked yet*; the toast's Undo puts it back at 3 in 2025.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

## Plan

Approved by the owner, 2026-11-21 (with step 4's cross-year refusal, and `ledger_test_3` for this worktree).

**Steps**

1. `src/db/writes.ts`: pull the reorder out of `rankRead` into a helper (`rerank(tx, userId, own, rank)` → `{ before, after, left }`); `rank: null` takes a read out of its year and renumbers the rest from 1. A type `RankExit = { year: number; before; after; left }`; `BookRedate.unranked?` and `BookStatusChange.unranked?` carry it, null when no rank moved (optional: an undo payload answered before 3.4c has none).
2. The re-date (`redateBookRead`, and `saveBookStatus`'s *Finished* correction): read the read's rank and year (`rankedRead`), write the dates, read the year again; ranked and its year changed (another year, or none) → the helper takes it out of the old year, in the same transaction. A re-date within the year keeps its rank. A start after its finish throws before any write.
3. Lock order, one everywhere: the per-user ranking lock (`inRanking`), then `lockBook`. `redateBookRead` / `undoBookRedate` take it for a finished read (`readId` set); `saveBookStatus` when the status is `read`; `undoBookStatus` when the change re-dated a read (`edited`). Same order as `rankRead`, so no deadlock.
4. The undos refuse, changing nothing, unless the read is still unranked and the old year's ranking is exactly `left` (the check `undoRank` makes, shared as a helper); then the date and every rank in `before` go back. Also refused: the read has been ranked since and the undo would move it to another year (it would carry its new rank across: a tie and a gap).
5. Routes: `validRedate` and `validChange` accept `unranked` through `isRankExit(u, readId)` exported from `writes.ts` (a route file can't export helpers): the read in `before` with a rank and in `after` with none, not in `left`, the same reads in both, ≤ 1000 rows; the status change's needs `edited`. A malformed one is 400, nothing written.

**Files**

- `src/db/writes.ts`: the helper, the four writes, the types, `isRankExit`
- `src/app/api/progress/book/read/route.ts`: `validRedate` accepts `unranked`
- `src/app/api/progress/book/route.ts`: `validChange` accepts `unranked`
- `test/year-rank.test.ts`: AC-1 to AC-6

**Test strategy** (`test/year-rank.test.ts`, five ranked 2025 reads)

- AC-1: `describe("re-dating a ranked read through All reads (roadmap 3.4c check, AC-1)")`: into 2024, to no date (each with one undo), another 2025 day.
- AC-2: the same three and the undo through `/api/progress/book` (*Read* on the book already read).
- AC-3: re-date out of 2025, a rank write to 2025, then the undo: 409 from the route, `false` from `undoBookRedate`; ranks, date and `year_rank` as the rank write left them.
- AC-4: an unranked read into 2024 changes no `year_rank`; a start after its finish is 400 and no rank changes.
- AC-5: the POSTs answer `unranked`, the DELETEs take it; a malformed one is 400 and writes nothing.
- AC-6: a re-date and a rank write run together (10 rounds), all complete, ranks contiguous; and the lock order: with the ranking lock held on another connection, a re-date waits on it with the book's row still free (`FOR UPDATE NOWAIT` succeeds from a third connection).

**Risks**: AC-4's "same transaction" is shown indirectly (no write can be made to fail after the rank change); the auditor may call it weak.

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
