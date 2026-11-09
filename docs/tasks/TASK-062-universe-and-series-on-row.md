---
id: TASK-062
title: 2.2j The universe and series on a book's row
status: Draft
depends_on: [TASK-049]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-062 — 2.2j The universe and series on a book's row

## Goal

Every book row's second line names the author and where the book belongs, its universe and then its series and number, and reads the same on every books screen.

## Context

- Roadmap: `docs/05-roadmap.md` § 2.2j The universe and series on a book's row (M10; owner intake 2026-11-09, D-134). The entry and its **Check:** are the contract. Feature F-75. Depends on 2.2 (TASK-049: On deck and *Up next in Qn*). It doesn't gate 1.26; under D-129 it comes after the books cutover, with the rest of M10's open rows.
- **Sized M, not the entry's S:** seven code files over two adjacent layers (queries and UI), plus the mockup redraw.
- **One line, one rule (D-134).** The author, then its place: the universe (D-90: Calibre's superseries), then the series and `#position` (*Brandon Sanderson · Cosmere · Mistborn #4*). No universe: the series alone (*Robot #2*). No series: the universe alone, unnumbered (*First Law World*). Neither: the author alone. A series with no position drops the `#`. When the series name already contains the universe's, case-insensitively, the universe is dropped (*Magic Tree House #3*). The subseries isn't on this line (2.2g draws it in Now).
- **One helper, read everywhere.** A pure function in `src/lib/format.ts` (proposed: `bookPlace`) builds the line and replaces `bookSub`'s series part (`format.ts` around line 109, read by `PlanQuarter.tsx` and `StatusBookRow.tsx`) and the Library's inline join (`src/app/books/list/page.tsx` around line 147). Its queries in `src/db/queries.ts` add the universe's name (`books.universe_id` → `book_universes`): `onDeck`, `quarterShelf`, `listBooks`, `booksInFlight`, `booksUpNext`, `booksDone`. Nothing is stored (Hard rule 2).
- **Where.** On deck (`OnDeckRow.tsx`) and *Up next in Qn* (`PlanShelf.tsx`) on the dashboard, neither of which shows a series today; the status tabs (`StatusBookRow.tsx`, `PlanQuarter.tsx`) and the Library, today *Series #n*, which now gain the universe. 2.10b's suggestion rows (TASK-072) use it when built. The plan rail's blocks have no second line, so 2.2b is unchanged.
- **The line wraps rather than truncates:** *The Chronicles of Thomas Covenant the Unbeliever* stays readable at 360px.
- **Not drawn yet.** The mockup's `bdash` frames show the line on On deck and Up next at phone, tablet and desktop widths before it is built, at the plan gate (`ui.redrawFiles`: `design/mockups.html`, `design/mockups-index.md`). The figures in the frames are sample data (D-7).
- `/books` has a query budget (`scripts/perf/budget.json`, TASK-049); the universe is a join on queries that already run, not a new query.
- The dashboard is a feel-pass surface (`docs/04-design.md` § 10), so its changed rows are screenshotted at every feel-pass width, light and dark.
- Design: `docs/04-design.md` § 12. The dashboards → Books dashboard; § 11.2 Status screens.
- Decisions: D-134, D-90, D-40, D-7. Hard rule 2.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): `npm test`: `bookPlace` returns *Cosmere · Mistborn #4* for a book
with both, *Robot #2* for a series alone, *First Law World* for a universe
alone, an empty place for neither, *Mistborn* for a series with no position,
and *Magic Tree House #3* when the series name contains the universe's;
`onDeck` and `quarterShelf` return the universe's name. In the browser (0.11),
an On deck row and an *Up next* row for *The Alloy of Law* read *Brandon
Sanderson · Cosmere · Mistborn #4*, and the same book reads the same on its
status tab and in the Library. There is no horizontal scroll at 360px, axe
passes, and nothing resolves to `--danger`. Screenshots at 360px and 1280px.
- [ ] AC-2: The universe is dropped whatever the case: a universe *MAGIC TREE HOUSE* with a series *Magic Tree House: Merlin Missions* at position 2 gives *Magic Tree House: Merlin Missions #2*. A whole-number position prints without a decimal (`#4`, not `#4.0`).
- [ ] AC-3: `listBooks`, `booksInFlight`, `booksUpNext` and `booksDone` also return the universe's name, null for a book with none; no other builder of the line is left (`bookSub`'s series part and the Library's inline join are gone).
- [ ] AC-4: A row for a book in *The Chronicles of Thomas Covenant the Unbeliever* shows the series name in full at 360px, wrapped and with no ellipsis, and the page has no horizontal scroll.
- [ ] AC-5: The changed rows meet the UX floor (`docs/04-design.md` § 10. The UX floor), on a feel-pass surface: the line's text is 4.5:1 in both themes, the loading states (`src/app/books/loading.tsx`, `src/app/books/status/loading.tsx`, `src/app/books/list/loading.tsx`) keep the rows' height or the plan says why no layout shift goes over budget, axe reports no new violations, and screenshots at 360, 390, 412, 768, 1024 and 1280px, light and dark, with reduced motion and reduced transparency.

## Out of scope

- The subseries on the row (2.2g draws it in Now).
- The plan rail's blocks (2.2b), which have no second line.
- Links from the line to series or universe pages (5.9, 5.11).
- 2.10b's suggestion rows (TASK-072), which reuse the helper later.

## Files likely touched

- `src/lib/format.ts` — `bookPlace`; `bookSub` keeps the author only, or goes.
- `src/db/queries.ts` — the universe's name on six queries.
- `src/components/OnDeckRow.tsx`, `src/components/PlanShelf.tsx` — the line on the dashboard.
- `src/components/StatusBookRow.tsx`, `src/components/PlanQuarter.tsx` — the status tabs.
- `src/app/books/list/page.tsx` — the Library's row.
- `design/mockups.html`, `design/mockups-index.md` — `bdash` gains the line (drawn first).
- `test/format.test.ts` (new) or `test/books-dashboard.test.ts`, `test/queries.test.ts`, `test/e2e/books-dashboard.spec.ts`, `test/e2e/status.spec.ts`, `test/e2e/library-sort.spec.ts`.

## Verification

- Automated: a vitest file for `bookPlace` (AC-1's cases, AC-2); `test/books-dashboard.test.ts` / `test/queries.test.ts` (the six queries' universe name, AC-3); `test/e2e/books-dashboard.spec.ts` (AC-1's browser rows, AC-4, axe, `--danger` absent, the feel-pass screenshots); `test/e2e/status.spec.ts` and `test/e2e/library-sort.spec.ts` (the same line on the status tab and the Library).
- Manual: `npm run dev`. On `/books`, a book in a universe and a series on On deck → *Author · Universe · Series #n*. Find it on its status tab and in the Library → the same line. Resize to 360px → long series names wrap, no sideways scroll.

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
