---
id: TASK-069
title: 2.10 Plan page as the full-size rail (1 of 2) — the page, its quarters and the fifth lane
status: In progress
depends_on: [TASK-011, TASK-046, TASK-049, TASK-051, TASK-064]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: ae56fe1
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

- The book detail's Words field takes the estimated-count treatment (`~65k`, the dotted edge): no detail sheet exists yet (`docs/04-design.md` § 13), so it is 3.5's to draw. A *From 2.10* line on the roadmap entry. (approved at plan)
- *+ Add books* in the plan page's header (mockup `plan`, desktop beside *Suggest books*): not in 2.10's Check; a note in TASK-072's Context, which adds *Suggest books* to that header. (approved at plan)
- Candidate decision: a lone block under 24px takes its hit area's missing px from the side that has room (the column's foot or top, or a neighbour's px beyond its own 24px), not evenly from both; when neither side has room (a 30k book between two 110k ones at 230px), it falls back to the even split. Decisions mode `propose`: asked at close-out. (approved at plan)

## Plan

Approved 2026-11-11 (attended, Opus session; implementation on the task's model). Worktree `.claude/worktrees/task-2.10-plan-rail`, test database `ledger_test_2`.

**Owner's answers at the gate:**

- **Kept whole**, though it is past the 8-file size line: it is already 1 of 2, and no schema changes.
- **The room line** sums the room (capacity less planned words) in the quarters still ahead that are not over: this quarter and later for this year, all four for a later year. It names them as a range when they are contiguous (*893k of room across Q2–Q4*), otherwise as a list (*Q2 and Q4*). It is the page's one empty state: no quarter, expanded or summary, ever draws an empty state of its own. Until 2.10b (TASK-072), its sub-line is *Plan books from the Library: ⋯ → Plan for…* and its action a secondary **Library** link to `/books/list`; TASK-072 swaps that link for *Suggest*. With no quarter ahead that has room, the line is not drawn.
- **A year switch**: links to `?year=YYYY` for this year and the next four (the picker's five years), the current year by default. An out-of-range or malformed `year` reads as the current year.
- **The book detail's Words field** is a follow-up on roadmap 3.5; nothing is built here.

**Settled from the docs (no question):**

- Column height stays `docs/04-design.md` § 6's 230px phone / 300px desktop, which 2.2b's checks assert, not the mockup's 252/356. The styling blueprint (D-31) beats the mockup on plan-rail geometry, and "taller" in the roadmap is taller than the dashboard strip.
- The Library's `.rm` values already carry the `~` (`src/app/books/list/page.tsx:143`, tested at `test/library-page.test.tsx:105`): no change there. AC-5's Library part is cited to that test.
- The heading is **Plan** (the nav item, the route, the mockup's third frame), with the year's running total under it (§ 14 → Plan: *31 books · 3.58M of 3.04M*, figures computed, D-7).
- A rail block keeps its GET form to its Library row, and a stack stays `aria-disabled`: swapping them for the picker is TASK-065's. Drag and hover are TASK-070's. The capacity card, Rebalance and Accept (2.7) and *Place them* (2.8) are not drawn; the layout leaves the desktop side column for them.
- The focus starts on this quarter in the current year, and on Q1 in a later year.

Steps:

1. **Tests first, each failing for the expected reason:**
   - `test/plan-rail.test.ts`: the hit-area share (a 30k block at the foot below a 110k one, and above one at the top, leaves the 110k's centred 24px uncovered; the squeeze case falls back to even); which blocks fit a title at the phone's and the desktop's heights; the room-line rule (contiguous range, a list, over quarters left out, past quarters left out, a later year's four).
   - `test/nav-items.test.tsx`: `books-plan` is enabled (moved out of the `off` list).
   - New `test/plan-page.test.tsx` (test database, `renderToStaticMarkup` of the page's parts as the books dashboard tests do): one expanded quarter whose rows are in `ordinal` order, each with a **Move** button named for its book; three summary buttons with `aria-expanded="false"` carrying total, book count and room (or the amber over); a plan with Q2–Q4 empty draws one room line whose figure is their capacity summed less what they hold, and no per-quarter empty state; every over badge is `.bdg.bl` (`--blocked`) and nothing uses a danger class; the dashboard's `QuarterStrip` and this page's footer for the same quarter render the same total from one `planCapacity` read; the year switch's five links and the fallback.
   - `test/loading-states.test.tsx`: `PlanRailSkeleton` draws the legend.
   - `test/e2e/plan-rail.spec.ts`: moved from the staged render to the real `/books/plan`, with the fixture's books seeded under `e2e-plan-%` ids in a later year (`?year=`) and removed after each test. It keeps every 2.2b item and adds: the block heights in a quarter sum to its words to the pixel rounding; the straddling book hatched and the one below not; expanding Q2 collapses Q1; **Move** opens the picker for that book (and Esc returns focus); titles inside tall blocks; `~` on the rail and the plan rows; a 30k beside a 110k each taking taps across its own whole area; the skeleton's legend height equal to the loaded legend's; axe, 4.5:1 text and 3:1 outlines in both themes; no sideways scroll at 360px; screenshots at 360, 834 and 1280px, light and dark.
   - `test/e2e/routes.spec.ts`: the Plan item leads to `/books/plan`.
2. **`src/db/queries.ts`:** `planRows(userId, year)`, one read: each book planned in one of the year's quarters, in `ordinal` order, with author, series and position, words (null when unknown), the estimated flag and genre, from `plan_book_words` like `planRail`, so a quarter's words add up to `planCapacity`. No schema or view change.
3. **`src/lib/plan-rail.ts`:** a lone sub-24px block's `--lift` (the share of its missing px taken below) from the room on each side; title fit at both heights; `roomAhead(quarters, today)` for the room line.
4. **`src/components/PlanRail.tsx`:** in the column axis, a block tall enough shows its title (ellipsised) and words; from 1024px the words show on blocks the phone can't fit (the 16px floor dropped, D-135, D-138). The legend becomes an exported `RailLegend`. The strip (row axis) is unchanged.
5. **`src/components/Skeleton.tsx`:** `PlanRailSkeleton` draws `RailLegend`, so the rail's arrival shifts nothing.
6. **`src/components/PlanQuarterRows.tsx` (new, client):** the expanded quarter's heading (*Q1 2027 · 892k of 760k*) and rows (hue edge, title, `.rm` words with `~` when estimated or *no count*, author · series #n, **Move** opening `PlanPickerSheet` from 2.3, loaded on first use like `BookRowMenu`'s); the other three as `<button aria-expanded>` summary rows; the room line with its Library link.
7. **`src/app/books/plan/page.tsx`, `loading.tsx`, `error.tsx` (new):** the page (heading, year switch, running total, rail, rows) from `planCapacity`, `planRail` and `planRows` in one wave; its skeleton at the loaded geometry; a neutral error line with a grey × and *Try again*. `src/components/nav/items.ts`: `books-plan` on. `src/app/globals.css`: the page's rules, tokens only (Hard rule 6).
8. **Performance:** a `plan` entry in `scripts/perf/routes.mjs` (the tap from `/books`) and `scripts/perf/budget.json`, mirrored in `docs/02-architecture.md`'s budget table.

**Files:** `src/app/books/plan/{page,loading,error}.tsx` (new), `src/components/PlanQuarterRows.tsx` (new), `src/components/PlanRail.tsx`, `src/lib/plan-rail.ts`, `src/components/Skeleton.tsx`, `src/components/nav/items.ts`, `src/db/queries.ts` (not in *Files likely touched*: the rows' author and series), `src/app/globals.css`, `scripts/perf/budget.json`, `scripts/perf/routes.mjs` and `docs/02-architecture.md` (not listed: the perf rule that a new route adds both), tests as above. `src/app/books/list/page.tsx` is listed but unchanged (see above).

**Test strategy:** AC-1 → `test/e2e/plan-rail.spec.ts` (sums, hatch, Q2 collapses Q1, screenshots) and `test/plan-page.test.tsx` (identical totals). AC-2 → `test/nav-items.test.tsx`, `test/e2e/routes.spec.ts`, `test/e2e/plan-rail.spec.ts` (2.2b's items at 360 and 1280). AC-3 → `test/plan-page.test.tsx`, `test/e2e/plan-rail.spec.ts` (Move opens the picker). AC-4 → `test/plan-page.test.tsx`, `test/plan-rail.test.ts` (room rule). AC-5 → `test/plan-rail.test.ts`, `test/e2e/plan-rail.spec.ts`, `test/library-page.test.tsx:105` (existing), `test/loading-states.test.tsx`. AC-6 → `test/e2e/plan-rail.spec.ts` (axe, contrast, scroll, screenshots), `test/plan-page.test.tsx` (error state).

**Risks:** the squeeze case (two tight neighbours) can't give three 24px targets in 57px at 230px; it keeps today's even split, and the test pins that this is the only case that does. The 1.30 branch (PR #236) also edits `Skeleton.tsx` and `budget.json`, in other places; whichever merges second rebases.

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
