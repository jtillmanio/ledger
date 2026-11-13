---
id: TASK-066
title: 2.7 Rebalance (1 of 2) — a stretch year stored, and the rebalance writes
status: Done
depends_on: []
size: M
model: opus
autonomy: attended
ui: false
plan_status: approved
planned_at_commit: 8690eae
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
- *From TASK-064 (2.3, PR #224):* the plan picker's over-capacity preview already draws *Accept as a stretch year* `aria-disabled`, with its reason *Accepting a stretch year arrives with 2.7.* (`STRETCH_WHY` in `src/components/PlanPicker.tsx`). Enabling it to write the acceptance, and dropping that reason, belongs to this part or TASK-067's sheet; the picker's preview figure (`over`) is `previewPlanMove`'s.

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim; this part proves storing the acceptance with a date, Undo removing it, a later change re-raising the flag, and *even out the quarters* keeping the count and the order. TASK-067 proves `.decide.settled` and `--hatch-settled` in the browser): test that accepting 2027 at 118% stores the acceptance with a date and
that the dashboard renders `.decide.settled` rather than `.decide`, and the
over-rule part of each block uses `--hatch-settled`, not `--hatch`; that Undo
removes it; that a later change pushing 2027 past the accepted total re-raises
the flag; and that "even out the quarters" leaves the year's book count
unchanged and never puts a book ahead of one that was ahead of it before.
- [x] AC-2: Given 2027 planned at 118% of capacity, accepting stores one `plan_acceptance` row for 2027 with `accepted_at` set and `accepted_total` equal to the year's planned total; accepting again leaves one row; *Undo acceptance* deletes it.
- [x] AC-3: With 2027 accepted at total T, the year reads settled while its total is at most T and over once a placement takes it past T; the diff stores no flag (no column, no status).
- [x] AC-4: *Move the overage into the next year* and *Move it to On deck* move exactly the books past each quarter's rule (each quarter's last in order), each landing where the plan settles and, in a quarter, at its end; On deck rows carry no ordinal; neither deletes a book or a `book_status` row; one undo restores every row and ordinal they changed.
- [x] AC-5: After *Even out the quarters*, the year's book count and word total are unchanged, every book is still in the year, every quarter is contiguous from 1, and reading Q1 to Q4 in ordinal order gives the same sequence as before.
- [x] AC-6: `plan_acceptance` has no `user_id` column and is listed in `src/db/export-tables.ts`, and `GET /api/export` returns it.

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

- The data model records `plan_acceptance` as built: § 2.9 gets a paragraph, and § 3's views table gets a `plan_overage` row (planning-doc update) → docs/03-data-model.md § 2.9 (approved at plan)
- What this part leaves TASK-067: the route and reads it needs (`/api/plan/rebalance`, `planDecision`, `planOverage`), that an accepted year that drops back under capacity reads `fits`, that a year can stay slightly over after a move because started books stay put, and that `STRETCH_WHY` in `PlanPicker` is still there to drop → docs/tasks/TASK-067-rebalance-sheet-settled.md § Context (approved at plan)
- Candidate decision: `plan_acceptance` has no `user_id`; the overage is the rail's books past the rule, including the one the rule cuts through; *into the next year* lands in that year's bare-year lane; only `to_read` books move; even-out works by word midpoint (owner, plan gate 2026-11-13) → docs/review/decisions.md § D-148 (approved at plan)
- `etl/load.ps1` and `load.sh` truncate `reading_plan` but not `plan_acceptance`, so after a development load an old acceptance can sit on a reloaded plan (schema-reviewer and spec-reviewer, round 1) → not tracked: harmless. The year still compares against `accepted_total`, so an old row only settles a year that is over and still at or under that figure. `reading_settings` and `shelf_follows` behave the same way, and `LEDGER_LIVE` refuses a load on production.
- `/api/plan`'s own `parseMove` duplicates the new `parsePlanMove` in `src/db/writes.ts` (plan revision 1) → not tracked: both parsers are correct for their routes; folding them is a refactor for whoever next changes `/api/plan`, outside 2.7's scope.
- The EXPLAIN pushdown test matches the text of PostgreSQL's plan (test-auditor, minor) → not tracked: same form as `test/capacity.test.ts`'s check; both would move together on a PostgreSQL major upgrade.

## Plan

**Owner answers at the plan gate (2026-11-13):** (1) `plan_acceptance(year int PRIMARY KEY, accepted_at timestamptz NOT NULL DEFAULT now(), accepted_total bigint NOT NULL)`, no `user_id` (D-91); `accepted_total` is the year's `planned_words` at accept. (2) *Move the overage into the next year* lands each book in the next year's bare-year lane (`2028`). (3) Only `to_read` books move; a reading or read book past the rule stays.

### Steps

1. Schema: `plan_acceptance` in `src/db/schema.ts`; `npm run db:generate` → `drizzle/0025_*.sql` + meta; `CATALOG_TABLES` in `src/db/export-tables.ts`. Creates only, so no down file.
2. View `plan_overage` (`etl/views.sql`): each counted quarter book (`plan_book_words`) in ordinal order with its words, its running end and the quarter's capacity; `past_rule` = end > capacity (the rail's `layoutColumn` rule: the straddler is over; unknown words count 0). Partitioned so a year filter pushes down.
3. Writes (`src/db/writes.ts`, behind the plan lock): `acceptStretch(year)` upserts with `accepted_total` = the year's `planned_words`, null when the year fits; `undoAcceptance(year)` deletes; `moveOverage(year, "next" | "on_deck")` sends each `to_read` book past the rule through `planMove` (last first), answering `PlanMove[]`; `undoPlanMoves(moves)` reverses them in one transaction, all or nothing (`undoPlanMove`'s body taking a tx); `evenOutQuarters(year)` reads every quarter row Q1→Q4 in ordinal order, gives each the quarter its words' midpoint falls in at total/4 per quarter (contiguous, order kept), writes through `movePlan` + `reorderQuarter`, answers the prior layout; its undo puts the layout back, refusing when the year's set of books changed. Refuses (null) when a book has two quarter rows in the year.
4. Reads (`src/db/queries.ts`): `planDecision(year)` → `{ capacity, plannedWords, acceptedAt, acceptedTotal, state: fits | over | settled }` (settled = over capacity and planned ≤ accepted_total; derived per read); `planOverage(year)` → the books past the rule, and the On deck order, longest first.
5. Route `src/app/api/plan/rebalance/route.ts` (new; the task file named "a sibling route"): POST `{ action: accept | next | on_deck | even, year }`, DELETE `{ undo }`, GET `?year=` the decision and the overage; 400/404/409 as `/api/plan`.

**Files:** `src/db/schema.ts`, `drizzle/0025_*.sql`, `drizzle/meta/*`, `src/db/export-tables.ts`, `etl/views.sql` (not in Files likely touched as the primary home; listed as the alternative), `src/db/writes.ts`, `src/db/queries.ts`, `src/app/api/plan/rebalance/route.ts`, `test/plan-acceptance.test.ts` (new), `test/export-tables.test.ts`, `etl/test_views.sql` (new; the view's test).

### Test strategy

- AC-1 (stored clauses), AC-2: `test/plan-acceptance.test.ts` "accepting 2027 at 118% stores one row with a date and the total; again keeps one; undo deletes it".
- AC-3: same file, "settled while at most the accepted total, over once a placement passes it; no flag stored".
- AC-4: same file, "into the next year" / "to On deck" / "one undo restores every row and ordinal".
- AC-5: same file, "even out keeps the count, the words and the order; quarters contiguous from 1".
- AC-6: `test/export-tables.test.ts` "plan_acceptance is exported and has no user_id"; `npm run check:migrations`.
- `plan_overage`: `etl/test_views.sql` block.

**Size:** 10+ files with generated meta; no UI, and already the split's first half, so kept whole.

**Risks:** the window view's pushdown; a book with two quarter rows in one year (refused).

**Revision 1 (during Phase 3, pinned lists the full suite found):** `test/comics-load.test.ts` lists `plan_acceptance` among `BOOK_TABLES` (the comics load leaves it alone); `drizzle/down/0011_dated_reading_log.sql` and `drizzle/down/0013_plan_period.sql` drop `plan_overage` before `plan_capacity`, as 2.2d added the follow views there. `parsePlanMove` lives in `src/db/writes.ts` beside `PlanMove`, for the new route (Next refuses extra exports from a route file); `/api/plan`'s own `parseMove` is left as it is.

## Review log

Verify R1 FAIL (comics-load BOOK_TABLES; down files 0011, 0013 dropping plan_capacity under plan_overage) → fixed (plan revision 1) | Verify R2 PASS | CI R1 PASS (a9c4d13, all eight e2e shards, Vercel, Lighthouse) | Spec R1 CHANGES (follow-ups without destinations: written at close-out; notes taken: book_status compared around On deck, layOut refuses) | Schema R1 APPROVE (4 MINOR: pushdown asserted, undoEvenOut documented, load scripts and docs as follow-ups) | Verify R3 PASS | Audit R1 PASS | Schema R2 APPROVE | Spec R2 APPROVE (with the close-out follow-ups check)

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 3
- Review rounds: 2
- First-pass AC FAILs: 0
- Plan revisions after approval: 1
