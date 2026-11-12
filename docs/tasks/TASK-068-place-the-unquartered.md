---
id: TASK-068
title: 2.8 Place the unquartered
status: In progress
depends_on: []
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: 4351eb9
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

- Candidate decision: *Place them* surfaces on Up next's bare-year lane and on `/books/plan`'s card, one component, never on the dashboard; the flow's books are `plan_book_words`' bare-year rows (approved at plan)
- `docs/04-design.md` § Books dashboard and § Over-commitment say *Place them* is on `/books/plan` only: add Up next's lane (approved at plan)
- The closing card's *Rebalance 2027* and *Accept as a stretch year* (mockup `plan`, last frame) arrive with 2.7: TASK-067 adds them to the card (approved at plan)

## Plan

Approved by the owner up front (2026-11-12: "accept the plan right away"; the questions the gate would have asked are in the final report and the PR).

**Where it surfaces (the Context's stop-and-ask, decided here).** In both places the sources draw it, never on the dashboard: (1) Up next's bare-year lane (the Check verbatim: "turns amber and gains *Place them* here"; the `status` mockup's lane, `design/mockups.html` ~3035); (2) `/books/plan`, as the mockup `plan` frame's amber card above the quarters, whose sheet frame moved there (TASK-049 Q2 forbids only the dashboard). One component, two mounts. The Check is not amended.

**Which books.** A year's bare-year rows as `plan_book_words` counts them (`period = '2027'`), so the flow, the fifth lane and `plan_capacity` agree; largest first, a book with no count last, then by title.

Steps:

1. `unplacedBooks(userId, year)` in `src/db/queries.ts`: id, title, author, words, estimated, largest first.
2. `GET /api/plan?unplaced=2027` answers `{ year, quarters, books }` (`planCapacity` + step 1); 400 for anything not a year. Placing reuses `POST /api/plan` (`planMove` → `movePlan`: the bare-year row becomes the quarter row at its next ordinal; no new write).
3. `src/components/PlaceThem.tsx` (client): a *Place them* button; the shared `Sheet` (heading *Place 2027's books · 1 of N*, focus on it), the book (title, author, words), four quarter buttons each with its current total and an amber *over* badge, *Skip*, *Stop*. A placement POSTs, then adds the book's words to that quarter before the next book shows. After the last book, the closing card: *N placed. 2027 is still over by 540k — placing them made the overage visible, not smaller.* (amber), or *N placed. 2027 fits, with 120k of room.* (settled, grey); *Done* closes. Close by any route refreshes the page when something was placed; focus returns to *Place them*, or to the page heading when the button is gone.
4. `src/app/books/status/page.tsx`: the year lane's head on `--blocked-soft`, a summary row *In 2027, not in the plan* with an *N unplaced* badge and *Place them*, the books listed below as before.
5. `src/app/books/plan/page.tsx`: when the year has bare-year books (`year.books − Σ quarter.books`, from `plan_capacity`, no new query), the amber `.decide` card: *N books sit in 2027 with no quarter — X words.* plus whether the year fits, and *Place them*.
6. `src/app/globals.css`: the lane's amber, the sheet's 2×2 quarter grid (44px), the card; tokens only.
7. `design/mockups.html` notes: `status` and `plan` say 2.8 is built (redraw rule); the card's *Place all · Leave for now* becomes *Place them*.

Files: `src/db/queries.ts`, `src/app/api/plan/route.ts`, `src/components/PlaceThem.tsx` (new), `src/app/books/status/page.tsx`, `src/app/books/plan/page.tsx` (not in "Files likely touched": the second mount), `src/app/globals.css`, `design/mockups.html` (redraw rule), `test/plan-period.test.ts`, `test/e2e/place-them.spec.ts` (new), `test/e2e/status.spec.ts`.

Test strategy:

- AC-1 writes, AC-3: `test/plan-period.test.ts` › "Place them (task 2.8)": POST from `2027` to `2027-Q3` writes `period = '2027-Q3'` at Q3's next ordinal, one plan row before and after; the year's bare-year count (`plan_book_words`) drops by one; a book left alone keeps its row.
- AC-2 order: same file, `GET ?unplaced=` gives 200k, 150k, 90k (and an unknown-words book last) with the year's quarters.
- AC-1 lane, closing card; AC-2 totals; AC-3 Skip/Stop; AC-4; AC-5; AC-6: `test/e2e/place-them.spec.ts` (Up next and `/books/plan`; screenshots 360/834/1280 light and dark; axe; 44px; focus; no scroll at 360).
- `test/e2e/status.spec.ts`: the 1.9 lane test flips from grey-no-button to amber with *Place them*.

Risks: query budgets (`test/query-budget.test.ts`) stay as they are: the sheet's figures are read on open, not on render. Size: 10 files with 3 tests and one mockup note, no schema: kept whole (`split` policy) because the owner asked for the task to complete in one go.

Follow-ups (approved at plan): see `## Follow-ups`.

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
