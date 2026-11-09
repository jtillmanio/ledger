---
id: TASK-069
title: 2.10 Plan page as the full-size rail (1 of 2) — the page, its quarters and the fifth lane
status: Ready
depends_on: [TASK-011, TASK-046, TASK-049, TASK-051, TASK-064]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-069 — 2.10 Plan page as the full-size rail (1 of 2) — the page, its quarters and the fifth lane

## Goal

`/books/plan` shows the year as the full-size rail: every book a legible block in its quarter, the quarter in focus listed with **Move** on each row, and one honest line about the room left.

## Context

- Roadmap: `docs/05-roadmap.md` § 2.10 Plan page as the full-size rail (M11). The entry and its **Check:** are the contract. Feature F-23. Depends on 1.7 (TASK-011), 2.1 (TASK-046) and 2.2 (TASK-049), and on 2.2b's rail (TASK-051). It also needs 2.3's picker (TASK-064), because **Move** on a row opens it (2.3's third entry point; M11's order builds 2.3 first).
- **Split, 1 of 2** (`workflow.splitPolicy: split`). This part is the page and everything the Check tests; TASK-070 adds desktop drag and the hover popover, and **its merge ticks the roadmap entry**.
- **Same geometry as the dashboard, taller**, with each block's title and word count legible inside it. The rail exists: `src/components/PlanRail.tsx`, `src/lib/plan-rail.ts` (the four columns, the fifth lane, D-135, D-136, D-138), fed by `planRail` and `planCapacity` in `src/db/queries.ts`. The nav item is there but off (`src/components/nav/items.ts`: `books-plan`, `enabled: false`).
- **Only the quarter in focus expands** to rows with **Move** on each, in that quarter's `ordinal` order (D-37), the same order its blocks stack from the foot of the column; the other three are summary rows carrying their total, book count and room. Reordering inside a quarter stays on the Up next tab (1.9).
- **One consolidated empty state** (*893k of room across Q2–Q4*, sample figures, D-7) instead of one per empty quarter. Over-budget badges are amber. *Suggest* opens 2.10b's planning sheet (D-104), **so it arrives with 2.10b** (TASK-072): the plan says how the empty state reads until then.
- **The estimated-count treatment from 2.2** (a dotted top edge and a `~` prefix, `docs/04-design.md` § 14 → Plan) applies here too, including on plan rows, the master list's `.rm` values and the book detail's Words field. **Stop and ask at plan time** about the book detail: no book detail sheet exists yet (`docs/04-design.md` § 13. Detail sheets).
- *From 2.2b (TASK-051, PR #214):* this page draws the rail with the four columns and the fifth lane. 2.2b proved its four-column items (the Check's columns, fifth lane and footers at 360px and 1280px) on a staged render in a real browser, since this page didn't exist: re-run them here on the real page (`test/e2e/plan-rail.spec.ts`). Three things 2.2b saw and left: a lone block just under 24px beside a block just over it leaves the neighbour only part of its own hit area (a 30k book beside a 110k one), so check that case; `PlanRailSkeleton` has no legend, so the page shifts by the legend's height when the rail loads; and the full-size rail has room for a title in each block, so it can drop the labels' 16px floor (D-135, D-138).
- **The capacity card.** The owner's answer at 2.2's plan gate (TASK-049, Q2) puts the capacity card with Rebalance and Accept (2.7) and *Place them* (2.8) on `/books/plan` only. Where those land here is settled at TASK-067's and TASK-068's plan gates; this task draws the page they join.
- `/books/plan` is a new route: it needs a loading state and an entry in `scripts/perf/budget.json` like the other pages (TASK-049).
- Design: mockups `plan` (*Plan by quarter*, `design/mockups.html` around lines 3117–3278) and `planmonth` (*Plan rail — estimates, stacks, drag*, around 5053–5106; the month frame retired, D-38); `design/Plan Rail Spec.dc.html`; `docs/04-design.md` § 6. The plan rail and § 14 → Plan.
- Decisions: D-37, D-38, D-104, D-135, D-136, D-138, M-07, D-7.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves all of it, and TASK-070 re-runs it with drag in place): test that the sum of the rendered block heights in a quarter equals
that quarter's word total to the pixel rounding; that a book crossing the
capacity line renders hatched and the one below it does not; that expanding Q2
collapses Q1; and that the rail and the dashboard render identical totals from
the same query. Screenshot at 360px and 1280px.
- [ ] AC-2: The *Plan* nav item is enabled and leads to `/books/plan`, which draws the current year's four quarter columns, the fifth lane and their footers, and 2.2b's four-column checks (`test/e2e/plan-rail.spec.ts`) pass on this page at 360px and 1280px.
- [ ] AC-3: Exactly one quarter is expanded at a time: its rows are in ordinal order and each has a **Move** button that opens 2.3's picker for that book; each of the other three is one summary row with its total, book count and room.
- [ ] AC-4: Given a plan with Q2, Q3 and Q4 empty, the page shows one empty-state line naming the combined room across them (each quarter's capacity summed, minus what they hold) and no per-quarter empty state; an over-budget badge resolves to `--blocked`, never `--danger`.
- [ ] AC-5: A block tall enough shows its title and word count inside it; an estimated count reads `~65k` with the dotted edge on the rail, on the plan rows and in the Library's `.rm` values; a 30k block beside a 110k block leaves each its own whole hit area; and the loading skeleton draws the legend, so the rail's arrival shifts nothing.
- [ ] AC-6: The page meets the UX floor (`docs/04-design.md` § 10. The UX floor): empty, loading and error states drawn; every block, row and **Move** a real button with a name and at least a 24px target; text 4.5:1 and block outlines 3:1 in both themes; axe with no new violations; no horizontal scroll at 360px; screenshots at 360px, 834px and 1280px, light and dark.

## Out of scope

- Desktop drag and the hover popover (TASK-070).
- *Suggest* and the planning sheet (2.10b, TASK-071 and TASK-072).
- Rebalance, Accept and *Place them* (2.7, 2.8), beyond leaving room for them.
- Reordering inside a quarter (1.9's Up next tab).

## Files likely touched

- `src/app/books/plan/page.tsx`, `src/app/books/plan/loading.tsx` (new) — the page and its skeleton.
- `src/components/nav/items.ts` — the *Plan* item on.
- `src/components/PlanRail.tsx`, `src/lib/plan-rail.ts` — titles inside blocks, the hit-area case, the skeleton's legend.
- `src/components/PlanQuarterRows.tsx` (new; the plan's name) — the expanded quarter and the summary rows.
- `src/app/books/list/page.tsx` — the estimated `.rm` values.
- `src/app/globals.css` — the page, from tokens only.
- `scripts/perf/budget.json` — the new route's budget.
- `test/e2e/plan-rail.spec.ts`, `test/plan-rail.test.ts`, `test/nav-items.test.tsx`, `test/e2e/routes.spec.ts`.

## Verification

- Automated: `test/e2e/plan-rail.spec.ts` (AC-1, AC-2, AC-3, AC-5's rail and hit areas, AC-6); `test/plan-rail.test.ts` (block geometry sums, the hatch); `test/nav-items.test.tsx` (the item on); `test/e2e/library-sort.spec.ts` or `test/library-page.test.tsx` (the `.rm` treatment).
- Manual: `npm run dev`. Open *Plan* → this year's rail with titles in the blocks; expand Q2 → Q1 collapses; **Move** a book → the picker. Compare the dashboard strip's total with this quarter's → equal. Put everything back, as found.

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
