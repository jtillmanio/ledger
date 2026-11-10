---
id: TASK-066
title: 2.7 Rebalance (1 of 2) — a stretch year stored, and the rebalance writes
status: Ready
depends_on: []
size: M
model: opus
autonomy: attended
ui: false
plan_status: none
planned_at_commit:
---

# TASK-066 — 2.7 Rebalance (1 of 2) — a stretch year stored, and the rebalance writes

## Goal

Accepting an over-full year as a stretch year is remembered with its date and figure until the year grows past it, and the three ways to rebalance move books without losing one or breaking a quarter's order.

## Context

- Roadmap: `docs/05-roadmap.md` § 2.7 Rebalance, and accepting an overage (M11; its order is 2.3 → 2.7 → 2.8 → 2.10 → 2.10b; the tasklist gives it no dependency). The entry and its **Check:** are the contract. Feature F-23. Pulled ahead of 1.26 on 2026-11-10 (D-139): it is built before the books cutover, with M11's other books entries.
- **Split, 1 of 2** (`workflow.splitPolicy: split`: a new table and UI together). This part is the table, the writes and what reads them; TASK-067 is the sheet, the settled state and the hatch. TASK-067's merge ticks the roadmap entry.
- **The table, and a stop-and-ask.** The entry specifies `plan_acceptance(user_id → users, year int, accepted_at timestamptz NOT NULL, accepted_total bigint NOT NULL)`, primary key `(user_id, year)` (R3-14). D-91 (2026-10-27) came after it and Hard rule 3 says *a new table or column carries no `user_id`*, so the reading here is `plan_acceptance(year int PRIMARY KEY, accepted_at timestamptz NOT NULL, accepted_total bigint NOT NULL)`. A new table is a schema change: **stop and ask at plan time** (CLAUDE.md), confirming this reading. It goes in `src/db/export-tables.ts` in the same PR (Hard rule 7). Creating a table drops and retypes nothing, so no `drizzle/down/` file is required; the plan says if it ships one anyway.
- **A row, not a column on `reading_settings`,** because acceptance is per year and keeps its own date and figure. A later change that pushes the year past `accepted_total` re-raises the flag by comparing to it: the comparison is read, never stored (Hard rule 2). *Undo acceptance* deletes the row.
- **The four peers** (`docs/04-design.md` § 12 → Over-commitment is a decision, not an error): (1) move the overage into the next year, and show what it then holds; (2) move it to On deck, out of the year and its capacity (D-37), longest titles suggested first; (3) even out the quarters: same books, redistributed; (4) accept as a stretch year. Nothing is deleted.
- **Order (D-37).** The overage is the books past each quarter's rule, which are the end of that quarter's order (2.2b, `src/lib/plan-rail.ts`), so options 1 and 2 offer the books you ranked last. A book moved into a quarter joins its end. *Even out the quarters* keeps the year's order: it reads Q1's books in ordinal order, then Q2's, and so on, and refills the quarters in that sequence.
- **Stop and ask at plan time:** where option 1 puts a book in the next year. The entry says the overage *moves into the next year* and that *a book moved into a quarter joins the end of it*, but not whether the book lands in the next year's bare-year lane or in the same quarter of the next year.
- Every move goes through 1.7's helpers (`src/db/writes.ts`) and pushes one undo onto the 1.2 stack that restores every ordinal it changed. Capacity comes from 2.1 (`planCapacity`, `plan_capacity`).
- Data model: `docs/03-data-model.md` § 2. Decisions, 2.9; § 4. Proposed additions.
- Decisions: D-37, D-91, R3-14. Hard rules 2, 3 and 7.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves storing the acceptance with a date, Undo removing it, a later change re-raising the flag, and *even out the quarters* keeping the count and the order. TASK-067 proves `.decide.settled` and `--hatch-settled` in the browser): test that accepting 2027 at 118% stores the acceptance with a date and
that the dashboard renders `.decide.settled` rather than `.decide`, and the
over-rule part of each block uses `--hatch-settled`, not `--hatch`; that Undo
removes it; that a later change pushing 2027 past the accepted total re-raises
the flag; and that "even out the quarters" leaves the year's book count
unchanged and never puts a book ahead of one that was ahead of it before.
- [ ] AC-2: Given 2027 planned at 118% of capacity, accepting stores one `plan_acceptance` row for 2027 with `accepted_at` set and `accepted_total` equal to the year's planned total; accepting again leaves one row; *Undo acceptance* deletes it.
- [ ] AC-3: With 2027 accepted at total T, the year reads settled while its total is at most T and over once a placement takes it past T; the diff stores no flag (no column, no status).
- [ ] AC-4: *Move the overage into the next year* and *Move it to On deck* move exactly the books past each quarter's rule (each quarter's last in order), each landing where the plan settles and, in a quarter, at its end; On deck rows carry no ordinal; neither deletes a book or a `book_status` row; one undo restores every row and ordinal they changed.
- [ ] AC-5: After *Even out the quarters*, the year's book count and word total are unchanged, every book is still in the year, every quarter is contiguous from 1, and reading Q1 to Q4 in ordinal order gives the same sequence as before.
- [ ] AC-6: `plan_acceptance` has no `user_id` column and is listed in `src/db/export-tables.ts`, and `GET /api/export` returns it.

## Out of scope

- The sheet, the banner, the settled hatch and the legend (TASK-067).
- Where the sheet and banner surface, the dashboard or `/books/plan` (asked at TASK-067's plan gate).
- Removing the existing `user_id` columns (6.18).
- Accepting from 2.3's preview (asked at TASK-064's plan gate).

## Files likely touched

- `src/db/schema.ts`, `drizzle/<new migration>.sql` and `drizzle/meta/*` — `plan_acceptance`.
- `src/db/export-tables.ts` — the new table.
- `src/db/writes.ts` — accept, undo, the overage moves, even out.
- `src/db/queries.ts` (or `etl/views.sql`) — a year's settled or over state, read against `accepted_total`.
- `src/app/api/plan/route.ts`, or a sibling route (the plan's) — accept, undo and the three moves.
- `test/plan-acceptance.test.ts` (new), `test/export-tables.test.ts`, `test/schema-additions.test.ts`, `test/capacity.test.ts`.

## Verification

- Automated: `test/plan-acceptance.test.ts` (AC-1's stored clauses, AC-2 to AC-5, on `TEST_DATABASE_URL`); `test/export-tables.test.ts` (AC-6); `npm run check:migrations`.
- Manual: none in a browser (TASK-067).

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
