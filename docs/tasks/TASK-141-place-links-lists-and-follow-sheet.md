---
id: TASK-141
title: 5.9b Every other place line links its names (2 of 3) — the status rows, lists and follow sheet
status: Ready
depends_on: [TASK-140]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-141 — 5.9b Every other place line links its names (2 of 3) — the status rows, lists and follow sheet

## Goal

On the books status rows, Top books, Coming out, Parked, Listen next and the follow sheet, a book's series, author and universe names are links to their pages.

## Context

- Roadmap: `docs/05-roadmap.md` § 5.9b Every other place line links its names (M17). Feature F-38. Its **Check:** is AC-1, verbatim; proposed, and agreed when merged.
- **Split, 2 of 3.** TASK-140 linked the dashboard and the plan screens and set the pattern (which link form each route takes, the ids each query returns); this part follows it. TASK-142 does Add books and ticks 5.9b.
- *From TASK-125 (5.9, PR #330):* each surface draws its place line through `BookPlace` (`src/components/BookPlace.tsx`): a plain `<a>` where a route's byte budget is tight, `<Link prefetch={false}>` elsewhere; the queries gain `author_id`, `universe_id` and `series_id`; the mockup draws `a.plink` on each.
- **Surfaces in this part:** the status rows (`src/components/StatusBookRow.tsx`, `/books/status`), Top books (`src/components/TopBooks.tsx`, `/books/top`), Coming out (`src/app/books/releases/page.tsx`), Parked (`src/components/ParkedRow.tsx`, `/parked`), Listen next (`src/components/ListenNext.tsx`) and the follow sheet's rows (`src/components/FollowSheet.tsx`).
- **Rows that are controls.** Top books' rows carry a drag handle and `⋯` (task 3.4b), the status rows a status control; a place link inside them must not start a drag or open the row's menu.
- Design: `design/mockups.html` §§ `status`, `top`, `releases`, `parked`, `follow` (`design/mockups-index.md`): `a.plink` on each (`ui.redrawFiles`).
- Rules: `.claude/rules/ui.md`, `.claude/rules/schema.md`. Hard rule 4. UX floor: `docs/04-design.md` § 10. The UX floor. Decisions: D-119, D-122.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves the clauses for the status rows, Top books, Coming out, Parked, Listen next and the follow sheet's rows, and the byte budgets of the routes it changes. TASK-140 and TASK-142 prove the rest):
on the Up next cards, the status rows, the plan screens, Top books, Coming
out, Parked, Listen next, Add books' results, Now's *Next in* and the
follow sheet's rows, a book's series name is a link named by the series
alone to `/books/series/<id>`, and its author and universe names link to
their pages; a book with no series draws no series link. A gap row's
*Add* for #3 opens By hand with the series named and `3` in *#*. Every
route it changes stays within its byte budget (`scripts/perf/budget.json`).
Screenshots at 360px and 1280px.
- [ ] AC-2: Given a book in a series, by an author, in a universe, on the seeded test database, each surface in this part draws the series link (named by the series alone, `href` `/books/series/<id>`), the author link (`/books/authors/<id>`) and the universe link (`/books/universes/<id>`); given a standalone book, no series or universe link.
- [ ] AC-3: On Top books, a pointer press on a place link opens its page and starts no drag (the row's order is unchanged after); on the status rows and Parked, a place link's tap opens its page, not the row's control or menu.
- [ ] AC-4: These surfaces meet the UX floor (`docs/04-design.md` § 10. The UX floor): every link a real `<a>` with a name, targets at least 24px, link text 4.5:1 in both themes, axe reports no new violations, and screenshots at each `ui.viewports` width, light and dark.

## Out of scope

- The dashboard and plan screens (TASK-140) and Add books (TASK-142).
- Changing what any row shows besides the links (order, counts, menus).

## Files likely touched

- `src/components/StatusBookRow.tsx`, `src/components/TopBooks.tsx`, `src/app/books/releases/page.tsx`, `src/components/ParkedRow.tsx`, `src/components/ListenNext.tsx`, `src/components/FollowSheet.tsx` — the place lines.
- `src/db/queries.ts` — the ids on their rows.
- `design/mockups.html`, `design/mockups-index.md` — `a.plink` on each.
- `test/top-books.test.tsx`, `test/status.test.ts`, `test/parked.test.ts`, `test/e2e/status.spec.ts`, `test/e2e/top-books.spec.ts`, `test/e2e/follows.spec.ts` — AC-1 to AC-4.

## Verification

- Automated: component tests for each surface's links and the no-series case (AC-2); `test/e2e/top-books.spec.ts` for AC-3's drag clause; `test/e2e/status.spec.ts`, `test/e2e/follows.spec.ts` with axe; `test/perf.test.ts` still passes.
- Manual: the ui-verifier taps each surface's names at 360px and 1280px → expected: each opens its page, and no row's drag, menu or control fires.

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
