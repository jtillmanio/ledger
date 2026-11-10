---
id: TASK-068
title: 2.8 Place the unquartered
status: Ready
depends_on: []
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-068 — 2.8 Place the unquartered

## Goal

Books committed to a year with no quarter can be placed into quarters one at a time, largest first, with each quarter's words in view, and the closing card says plainly whether the year still doesn't fit.

## Context

- Roadmap: `docs/05-roadmap.md` § 2.8 Place the unquartered (M11, after 2.3 and 2.7 in its order; the tasklist gives it no dependency). The entry and its **Check:** are the contract. Feature F-23. Pulled ahead of 1.26 on 2026-11-10 (D-139): it is built before the books cutover.
- **What it places.** Plan rows with a year and no quarter: a bare `2027` (D-37's year level). The plan starts empty (R0-04, D-13), so this serves whatever the owner has added without choosing a quarter; the count is always derived from `plan_period`, never a literal.
- **The flow.** One book at a time, largest first (the year lane has no order, D-37), four quarter buttons each showing that quarter's current word total (amber *over* where it already is), plus **Skip** and **Stop**. A placed book joins the end of that quarter's order, through 1.7's helpers (`placeInPlan` / `movePlan` in `src/db/writes.ts`). The end state is honest, not congratulatory: placing every unplaced book of a year does not make that year fit, and the closing card says so when it doesn't.
- **Stop and ask at plan time (owner, at /new-task, 2026-11-09): where it surfaces.** Three sources disagree. The entry says *a bulk flow on the books dashboard … It never leaves the dashboard*, with mockup `bdash`'s third frame. The Check says *the bare-year lane turns amber and gains* Place them *here (1.9 rendered it grey)*, and the lane 1.9 drew is the Up next tab's (`src/app/books/status/page.tsx`); the `status` mockup's notes agree (`design/mockups.html` around line 3154: *the bare-year lane in amber with a* Place them *button (the 2.8 flow)*). And the owner's answer at 2.2's plan gate (TASK-049, Q2) puts *Place them* on `/books/plan` only, never on the dashboard: `docs/04-design.md` § 12 → Books dashboard; the sheet's frame moved from `bdash` to `plan` (`design/mockups-index.md`'s `plan` row; `design/mockups.html` around line 3323). `/books/plan` is 2.10's (TASK-069), after this in M11's order. The plan asks where the lane's button and the sheet go, and whether the Check is amended.
- **The fifth lane** in the Check is the rail's bare-year lane (2.2b, `src/components/PlanRail.tsx`, `.un` blocks): its count is the year's bare-year rows.
- Totals come from 2.1 (`planCapacity`, `plan_capacity`, `plan_book_words`), so the buttons, the rail and the dashboard agree.
- Amber means *held*; nothing here is red (`docs/04-design.md` § 10).
- Design: `docs/04-design.md` § 12 → Over-commitment is a decision, not an error; § 11.2 Status screens.
- Decisions: D-37, D-13, R0-04, D-7.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): the bare-year lane turns amber and gains *Place them* here (1.9 rendered it grey). Test that placing a book writes `period = '2027-Q3'` with Q3's next ordinal,
that the fifth lane's count drops by one; that Skip advances without writing; that
stopping mid-way leaves the remainder untouched; and that the closing card
states the year is still over capacity when it is.
- [ ] AC-2: Given 2027 with bare-year books of 200k, 150k and 90k, the flow offers the 200k book first, then the 150k, then the 90k; each quarter button shows its current total, and the chosen quarter's total grows by the placed book's words before the next book shows.
- [ ] AC-3: Placing a book replaces its bare-year row with one quarter row (the book has one plan row before and after), at that quarter's last ordinal; *Stop* closes the flow and every remaining book keeps its bare-year row.
- [ ] AC-4: When the year's total is still over capacity after the last book, the closing card names the year and the amount over, in amber; when it fits, the card says it fits. Neither card congratulates, and nothing resolves to `--danger`.
- [ ] AC-5: A year with no bare-year books shows the lane neither amber nor with *Place them*.
- [ ] AC-6: The flow meets the UX floor (`docs/04-design.md` § 10. The UX floor): the four quarter buttons, Skip and Stop real buttons with names and 44px on the phone, focus on the sheet's heading and back on *Place them* when it closes by any route, text 4.5:1 in both themes, axe with no new violations, no horizontal scroll at 360px, and screenshots at 360px, 834px and 1280px, light and dark.

## Out of scope

- Reordering a quarter (1.9's Up next tab).
- Rebalance and Accept (2.7, TASK-066 and TASK-067).
- `/books/plan` itself (2.10, TASK-069).
- An order for the bare-year lane (D-37: it has none).

## Files likely touched

- `src/components/PlaceThem.tsx` (new; the plan's name) — the flow and its closing card.
- `src/app/books/status/page.tsx` — the bare-year lane amber with *Place them* (or wherever the plan gate puts it).
- `src/db/queries.ts` — a year's bare-year books, largest first.
- `src/app/api/plan/route.ts` — a placement, if the existing move doesn't serve.
- `src/app/globals.css` — the flow, from tokens only.
- `test/e2e/place-them.spec.ts` (new), `test/plan-period.test.ts`, `test/e2e/status.spec.ts`.

## Verification

- Automated: `test/plan-period.test.ts` (AC-1's write clauses, AC-3); `test/e2e/place-them.spec.ts` (AC-1's lane and closing card, AC-2, AC-4, AC-5, AC-6).
- Manual: `npm run dev`. Plan three books to next year with no quarter → the lane is amber with *Place them*; open it → the largest first; place one in Q3 → it is last in Q3 on Up next; Skip one; Stop → the rest stay in the lane. Put everything back, as found.

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
