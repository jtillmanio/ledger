---
id: TASK-104
title: 5.12 In the middle of, and completed (1 of 2) — the derived rows for books and comics
status: Ready
depends_on: []
size: M
model: opus
autonomy: attended
ui: false
plan_status: none
planned_at_commit:
---

# TASK-104 — 5.12 In the middle of, and completed (1 of 2) — the derived rows for books and comics

## Goal

The Ledger can answer, without storing anything, what you're in the middle of, what's on hold, and what you've completed, across books (series, universes, authors, shelves) and comics (runs, tracks), with each row's counts, next thing and when it was last touched or finished.

## Context

- Roadmap: `docs/05-roadmap.md` § 5.12 In the middle of, and completed: one page for every medium (M17; backlog intake 2026-10-20, rewritten by the second 2026-11-02 intake). D-109, D-108, D-118, D-119. Depends on 1.9, 1.15, 2.2c and 2.2d (all done). After 1.26 in the tasklist's order. Feature F-69. Its **Check:** is the contract.
- **Split, 1 of 2** (`workflow.splitPolicy: split`: six kinds of row across two media, nesting and ordering, then a page, chips, tabs, nav and two dashboards). This part is the queries, proven on the test database. TASK-105 draws `/progress`, and its merge ticks the entry.
- **What counts is derived, never stored** (hard rule 2), and for books it follows D-108: only a *Reading* follow puts something in the middle.
  - **Books, In the middle of:** each series, universe, author and shelf followed `reading` with an unread live book, from `series_progress`, `universe_progress`, `author_progress` and `shelf_progress` (`etl/views.sql`; `follow_state` already reads `off` as NULL). Having read one book of something you don't follow never lists it. (Subseries: `subseries_progress` exists since 2.2h; the plan says whether a subseries is a row, nested under its series.)
  - **Books, On hold** (D-118): everything followed `tracking` with at least one read and one unread. Nothing here reaches `follow_next`.
  - **Books, Completed:** each series, universe and shelf with two or more live books, every one read (a standalone isn't a series), and each *followed* author with every listed book read. A follow isn't needed otherwise: completing something is a fact.
  - **Comics, In the middle of:** runs partly read (1.9's In flight rows, `inFlightRuns`) and tracks partly read (`track_progress`). **Completed:** runs and tracks fully read (`doneRuns`).
- **Each row** carries: medium, kind (*series*, *universe*, *author*, *shelf*, *run*, *track*), id, name, `read / total`, the next thing (2.2d's `follow_next` for books, 1.6's resume pointer for a run, `nextUnread`), and the parent it nests under (a series under its universe, a subseries under its series, D-119), so TASK-105 can indent. *In the middle of* is most recently touched first (the latest dated read in it: `follow_queue`'s `last_read_on` for books, the latest `issue_progress.completed_at` for comics); *Completed* most recently finished first, with the finish's month.
- **Counts equal the views'** (the Check): the queries read the views, never recount. Watch, music and games add their rows at 8.8, 9.6 and 10.3.
- Queries go in `src/db/queries.ts`, raw SQL for anything joining views (`.claude/rules/schema.md`).
- Decisions: D-108, D-109, D-117, D-118, D-119. Hard rules 2 and 4.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves every data clause on the test database: membership of each tab and *On hold*, the one-book series, the author only when followed, the shelf, the run, nothing written, counts equal to the views, and the nesting parent. TASK-105 proves the *Books* chip, the drawn nesting and the screenshots):
a series followed `reading` with 2 of 5 read is under *In the
middle of* and the same series unfollowed is not; a series with 5 of 5
read is under *Completed* whether followed or not, and a one-book
series read is not; an author appears only when followed; a shelf
followed `reading` with 1 of 3 read appears; a run with 3 of 10 read is
under *In the middle of*, and with 10 of 10 under *Completed*; the
*Books* chip hides the run; nothing is written; each row's counts equal
its view's. A series followed `tracking` with 2 of 5 read is under *On
hold* and not above it, and at 0 of 5 it is on neither; a series under a
listed universe nests beneath it. Screenshots at 360px and 1280px.
- [ ] AC-2: Given the fixtures the Check names, the in-the-middle query returns exactly the reading-followed series, the followed shelf and the part-read run; the on-hold query exactly the tracking series at 2 of 5; the completed query exactly the 5-of-5 series, the 10-of-10 run and nothing for the one-book series.
- [ ] AC-3: Given a universe followed `reading` and one of its series followed `reading`, both are returned and the series' parent is the universe; a series whose universe isn't returned has no parent.
- [ ] AC-4: Given two in-the-middle rows whose latest reads are on different days, the more recent is first; a completed row carries the month of its last finish, and completed rows are ordered by it, newest first.
- [ ] AC-5: The queries run with the statement counter showing no write (`test/query-budget.test.ts`'s pattern, or a transaction that asserts no row changed), and each row's `read` and `total` equal its progress view's for that id.

## Out of scope

- The page, tabs, chips, nav item, empty states and dashboard links (TASK-105).
- Watch, music and games rows (8.8, 9.6, 10.3).
- Any new follow state or column (D-118: *On hold* is derived).

## Files likely touched

- `src/db/queries.ts` — the in-the-middle, on-hold and completed queries.
- `etl/views.sql` — only if the plan finds a view must expose a column it lacks (a parent id, a last finish); asked at the plan gate, never a stored value.
- `test/progress-page.test.ts` (new), `etl/test_views.sql` if a view changes.

## Verification

- Automated: `test/progress-page.test.ts` (AC-1's data clauses, AC-2 to AC-5 on `TEST_DATABASE_URL`).
- Manual: none (TASK-105 shows it).

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
