---
id: TASK-023
title: 1.15 Track series, authors and universes
status: Draft
depends_on: [TASK-022]
size: L
model: opus
autonomy: attended
ui: false
plan_status: none
planned_at_commit:
---

# TASK-023 — 1.15 Track series, authors and universes

## Goal

The series, authors and universes (Cosmere, the Riordanverse) the owner follows come across from the workbook as follows with their own progress: how many of each are listed and how many are read, without a hand-kept *Completed* column.

## Context

- Roadmap: `docs/TASKS.md` § 1.15 Track series, authors and universes (sitting 8, after 1.13 and 1.14; schema, built attended). FEATURES B6. The roadmap entry and its **Check:** are the contract.
- **Why this is one large task** (`workflow.splitPolicy: never-split`): four tables, two new views plus a column on a third, extract seeding, both loaders, and the export list. They are only testable together.
- **Schema change, stop and ask at plan time** (CLAUDE.md), though D-42 and D-43 specify it: `book_universes(id, name)`, a nullable `books.universe_id`, and `series_follows`, `author_follows`, `universe_follows`, each keyed `(user_id, <entity>_id)` with `state IN ('tracking', 'reading')`. No column is dropped or retyped, so there is no down file. All four go in `src/db/export-tables.ts` (the follows in `USER_TABLES`), and both loaders truncate and copy them.
- Architecture: `docs/ARCHITECTURE.md` § 2. Decisions — 2.5e (narrow tables, not a polymorphic one). `.claude/rules/schema.md` (per-user facts live in progress tables, never a column on a catalog table; derived data in views).
- Views (`etl/views.sql`): `author_progress` and `universe_progress` in the shape of `series_progress` (live books only; a book with no status counts as unread). All three gain `follow_state`, NULL when not followed. Done is derived (read = listed), never stored.
- Seed (`etl/extract.py`): the Cosmere and Riordanverse tabs become universes with every row a member. A Series-tab group naming neither a series nor an author (after TASK-021's review) becomes a universe with its listed books as members. Every Series-tab group and the four author tabs become a follow at `tracking`. The tab's `Completed` column is not read. A group matching nothing goes to `unresolved.csv`.
- Decisions: D-42 (a universe is a fact about the work, not a shelf; amends FEATURES §9), D-43 (following is a stored choice; `reading` stays set until changed), D-41, D-17. Standing rule 4 applies to extract.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): `etl/test_views.sql`: `author_progress` and `universe_progress` count read and listed books and exclude a soft-deleted book; a book with no status counts as unread; the `state` CHECK rejects any other value; `follow_state` is NULL for an entity nobody follows. `npm run test:etl`: a fixture Series tab with one series, one author, one universe group and one unmatched name seeds exactly three follows at `tracking` and one `unresolved` row, and the Cosmere tab's books carry `universe_id = 'cosmere'`. `test/export-tables.test.ts` passes with the four tables. `npm run test:db:reset` migrates from zero.
- [ ] AC-2: `series_progress` keeps every column and row it had before and gains only `follow_state`. A test compares its output on a fixture before and after the change.
- [ ] AC-3: `etl/load.ps1` and `etl/load.sh` truncate and copy the four tables, in foreign-key order (`book_universes` before `books`, the follows after their targets), and still refuse when `LEDGER_LIVE=true`. `rebuild`'s row counts list them.
- [ ] AC-4: No catalog table gains a per-user column: `books`, `authors`, `book_series` and `book_universes` have no `user_id`, `state` or completion column. A `follow_state` change requires no change to any catalog row.
- [ ] AC-5: Re-running extract against both workbooks changes only the new seed files, `books.csv`'s `universe_id` column and `unresolved.csv`'s new rows. The diff summary is in the PR (standing rule 4).

## Out of scope

- The control that changes a follow's state, and author and universe pages (a follow-up task). The series page is 5.9.
- Shelves (Phase 5). Universes are not shelves.
- Reading the workbook's `Completed` column, or any read state (D-41).
- Open Library series data (4.2).

## Files likely touched

- `src/db/schema.ts`: `book_universes`, `books.universe_id`, the three follow tables. `drizzle/<tag>.sql` and `drizzle/meta/*` are generated.
- `src/db/export-tables.ts`: the four tables.
- `etl/views.sql`: `author_progress`, `universe_progress`, `follow_state` on all three. `etl/test_views.sql`.
- `etl/extract.py`, `etl/test_extract.py`: seed universes, members and follows.
- `etl/load.ps1`, `etl/load.sh`, `etl/rebuild.ps1`, `etl/rebuild.sh`: copy and count.
- `test/export-tables.test.ts`: passes as is once the list is updated.

## Verification

- Automated: `npm run test:views` (`etl/test_views.sql`) covers the views, the CHECK and `follow_state` (AC-1, AC-2). `npm run test:etl` covers the seed (AC-1). `test/export-tables.test.ts` and `npm run test:db:reset` (AC-1). `npm run check:migrations` passes with no down file needed.
- Manual: `npm run extract`, then `npm run rebuild` on the development database → expected: the Cosmere books carry `universe_id = 'cosmere'`, the follows are at `tracking`, and `unresolved.csv` names any group that matched nothing.

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
