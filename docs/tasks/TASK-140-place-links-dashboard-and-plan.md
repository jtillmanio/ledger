---
id: TASK-140
title: 5.9b Every other place line links its names (1 of 3) — the dashboard and the plan screens
status: Draft
depends_on: []
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-140 — 5.9b Every other place line links its names (1 of 3) — the dashboard and the plan screens

## Goal

On the books dashboard's Up next cards and *Next in*, and on every plan screen, a book's series, author and universe names are links to their pages, as they already are in the Library.

## Context

- Roadmap: `docs/05-roadmap.md` § 5.9b Every other place line links its names (M17 in `docs/06-tasklist.md`). Feature F-38. Depends on 5.9 (TASK-125) and 5.11, both done. Its **Check:** is AC-1, verbatim; proposed, and agreed when merged.
- **Split, 1 of 3** (`workflow.splitPolicy: split`: thirteen surfaces, their queries and Add books' By hand are more than one sitting's eight files). This part: the Up next cards, Now's *Next in*, and the plan screens. TASK-141 does the status rows, Top books, Coming out, Parked, Listen next and the follow sheet; TASK-142 does Add books (its results, and the gap row's By hand), and its merge ticks 5.9b.
- *From TASK-125 (5.9, PR #330):* 5.9 linked the names in the Library rows, *where the book sits*, the *On deck* rows and the book sheet through `BookPlace` (`src/components/BookPlace.tsx`), and listed the rest in the entry (approved at its plan, 2026-11-23). Each surface here draws its place line through `BookPlace`: a plain `<a>` where a route's byte budget is tight, `<Link prefetch={false}>` elsewhere. The queries behind them gain `author_id`, `universe_id` and `series_id`, and the mockup draws `a.plink` on each.
- **Surfaces in this part:** the Up next cards (`src/components/PlanShelf.tsx`), Now's *Next in* (`src/components/BooksNow.tsx`, and `src/components/BetweenBooks.tsx` where it draws one), and the plan screens (`src/components/PlanQuarter.tsx`, `src/components/PlanQuarterRows.tsx`, `src/components/PlanSheet.tsx`, `src/components/PlanPicker.tsx`). Routes: `/books`, `/books/plan` (and `/books/status`'s Up next, which draws `PlanQuarter`).
- **Byte budgets.** `scripts/perf/budget.json` holds each route's ceiling (D-175); 5.9 chose the plain `<a>` on the tightest. The plan names each route this part changes and which link form it takes.
- Design: `design/mockups.html` §§ `bdash`, `plan`, `moveplan` (`design/mockups-index.md`): each place line draws `a.plink` (`ui.redrawFiles`).
- Rules: `.claude/rules/ui.md`, `.claude/rules/schema.md` (queries in `src/db/queries.ts`). Hard rule 4 (each id read with `deleted_at IS NULL`). UX floor: `docs/04-design.md` § 10. The UX floor. Decisions: D-119, D-134.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves the clauses for the Up next cards, the plan screens and Now's *Next in*, and the byte budgets of the routes it changes. TASK-141 and TASK-142 prove the rest):
on the Up next cards, the status rows, the plan screens, Top books, Coming
out, Parked, Listen next, Add books' results, Now's *Next in* and the
follow sheet's rows, a book's series name is a link named by the series
alone to `/books/series/<id>`, and its author and universe names link to
their pages; a book with no series draws no series link. A gap row's
*Add* for #3 opens By hand with the series named and `3` in *#*. Every
route it changes stays within its byte budget (`scripts/perf/budget.json`).
Screenshots at 360px and 1280px.
- [ ] AC-2: Given a book in a series, by an author, in a universe, on the seeded test database, each surface in this part draws three links: the series' accessible name is the series name alone (no `#n`) and its `href` is `/books/series/<series id>`; the author's is `/books/authors/<id>`; the universe's `/books/universes/<id>`.
- [ ] AC-3: Given a standalone book with no series and no universe, the same surfaces draw the author link and no series or universe link, and the line reads as before.
- [ ] AC-4: Tapping a place link inside a card or row that is itself a control (a plan row, an Up next card) opens the series, author or universe page, not the book, and the card's own tap still opens the book.
- [ ] AC-5: These surfaces meet the UX floor (`docs/04-design.md` § 10. The UX floor): every link a real `<a>` with a name, targets at least 24px, link text 4.5:1 in both themes, axe reports no new violations, and screenshots at each `ui.viewports` width, light and dark.

## Out of scope

- The status rows, Top books, Coming out, Parked, Listen next, the follow sheet (TASK-141) and Add books (TASK-142).
- The surfaces 5.9 already linked (the Library, *where the book sits*, *On deck*, the book sheet).
- Any change to the series, author or universe pages themselves.

## Files likely touched

- `src/components/PlanShelf.tsx`, `src/components/BooksNow.tsx`, `src/components/BetweenBooks.tsx` — the dashboard.
- `src/components/PlanQuarter.tsx`, `src/components/PlanQuarterRows.tsx`, `src/components/PlanSheet.tsx`, `src/components/PlanPicker.tsx` — the plan screens.
- `src/db/queries.ts` — `author_id`, `universe_id`, `series_id` on their rows.
- `design/mockups.html`, `design/mockups-index.md` — `a.plink` on each.
- `test/book-place.test.tsx`, `test/plan-page.test.tsx`, `test/books-dashboard.test.ts`, `test/e2e/books-dashboard.spec.ts`, `test/e2e/plan-sheet.spec.ts` — AC-1 to AC-5.

## Verification

- Automated: component tests for each surface's links and the no-series case (AC-2, AC-3); `test/e2e/books-dashboard.spec.ts` and `test/e2e/plan-sheet.spec.ts` for the links' targets and AC-4, with axe; `test/perf.test.ts` still passes.
- Manual: the ui-verifier taps a series, an author and a universe name on `/books` and `/books/plan` at 360px and 1280px → expected: each opens its page, and the card's own tap still opens the book.

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
