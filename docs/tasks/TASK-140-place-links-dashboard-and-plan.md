---
id: TASK-140
title: 5.9b Every other place line links its names (1 of 3) — the dashboard and the plan screens
status: In progress
depends_on: []
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: 99eb2e5
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

- `booksUpNext` now carries `author_id`, `series_id` and `universe_id` (step 1), so TASK-141's On deck and bare-year `StatusBookRow` rows on Up next need no query change for them (approved at plan) → `docs/tasks/TASK-141-place-links-lists-and-follow-sheet.md` § Context

## Plan

Approved by the owner 2026-11-24 ("go with recommendations"): *Next in* split into two links, *Or keep going*'s reason linked, the task kept whole (attended).

**Steps**

1. **Queries** (`src/db/queries.ts`): `author_id`, `series_id`, `universe_id` on `booksUpNext` (`PlannedBook`, which feeds `PlanQuarter`), `planRows` (`PlanRow`), `planSuggestions` (`PlanSuggestion`) and `planBook` (`PlanBook`); the follow's entity id on `booksInHand`'s `next_in` JSON (`NextIn`) and on `keepGoing` (`KeepGoing`). `quarterShelf` already has the three. Each book read keeps `b.deleted_at IS NULL` (directly or through `plan_period`, `plan_book_words`).
2. **Up next cards** (`src/components/PlanShelf.tsx`): `.card-sub` draws `<BookPlace parts={subParts(b)} />`; the title stays the card's one link to the book.
3. **Plan screens**: `PlanQuarter` `.qplace` (Up next on `/books/status`), `PlanQuarterRows` `.row-sub` (`/books/plan`), `PlanSheet`'s row `.ps-sub`, `PlanPicker`'s header `.pp-by` each draw `BookPlace`. The picker in Add books and Parked passes no ids, so its line stays text (`partHref` null).
4. **Now's *Next in*** (`src/components/BooksNow.tsx`): the one Library-search link becomes two links in the same 44px line: *Next in* [the follow's name → its series, universe or author page; a subseries, which has no page, stays text]: [the title → `/book/<id>`, the book's sheet, as 3.5b's other titles]. The `›` stays, decorative.
5. ***Or keep going*** (`src/components/BetweenBooks.tsx`): each reason's name, *Next in* [Red Rising] · 3 of 6 read, links to its page the same way (subseries and shelf text). The offer's author line stays text.
6. **Styles** (`src/app/globals.css`): `.card-sub a`, `.qplace a`, `.ps-sub a`, `.pp-by a`, the *Next in* and *Or keep going* names join the place-links rule (underlined, the line's ink, `--faint` underline, focus ring); the card's 11px line gets padding that makes a 24px box; nothing red, tokens only.
7. **Mockup** (`design/mockups.html`, `design/mockups-index.md`): `a.plink` on the `bdash` Up next cards, *Next in* (two links) and *Or keep going* reasons, the `plan` rows and planning-sheet rows, the `moveplan` header, the `status` Up next quarter rows; the index notes say so.

**Link form.** `<Link prefetch={false}>` (BookPlace's default) on every surface: none draws more than a quarter's rows, and each route already loads Link. Ceilings (document + RSC): `books` 12,000, `plan` 12,100, `books-status` 10,500; a PR may grow a route by 10% and 1,500 bytes (D-142, D-175). If Lighthouse shows a route over, that route takes `plain`.

**Files**

- `src/db/queries.ts` — the ids (step 1).
- `src/components/PlanShelf.tsx`, `BooksNow.tsx`, `BetweenBooks.tsx` — the dashboard (steps 2, 4, 5).
- `src/components/PlanQuarter.tsx`, `PlanQuarterRows.tsx`, `PlanSheet.tsx`, `PlanPicker.tsx` — the plan screens (step 3).
- `src/app/globals.css` — not in *Files likely touched*: the new containers' link styles and 24px targets (step 6).
- `design/mockups.html`, `design/mockups-index.md` — step 7.
- Tests: `test/books-dashboard.test.ts`, `test/plan-page.test.tsx`, `test/e2e/books-dashboard.spec.ts`, `test/e2e/plan-sheet.spec.ts`; any query test that pins these rows' columns (grep first).

**Test strategy**

- AC-2, AC-3 (component tests): `test/books-dashboard.test.ts` renders `PlanShelf`, `BooksNow` (*Next in*), `BetweenBooks` (*Or keep going*) and `PlanQuarter`; `test/plan-page.test.tsx` renders `PlanQuarterRows`, `PlanSheet`'s row and `PlanPicker`'s header. Each with a *Cosmere · Mistborn #4* book (three links: the series named *Mistborn* alone to `/books/series/<id>`, `/books/authors/<id>`, `/books/universes/<id>`) and a standalone book (the author link only, the line's text unchanged). Query tests: the ids on `booksUpNext`, `planRows`, `planSuggestions`, `planBook`, `booksInHand`'s `next_in` and `keepGoing`, against the seeded test database.
- AC-1, AC-4, AC-5 (browser): `test/e2e/books-dashboard.spec.ts`: the cards, *Next in* and the status Up next tab: the link names and targets; clicking a place link opens its page, not the book; the card's title (and *Next in*'s title) still opens the book's sheet; axe, 24px targets, 4.5:1 in both themes; screenshots at every width, light and dark (360 and 1280 among them). `test/e2e/plan-sheet.spec.ts`: the plan rows, the planning sheet's rows and the picker header, the same checks. `test/perf.test.ts` still passes; Lighthouse on the PR when `LIGHTHOUSE_MODE` is on.
- Manual: the ui-verifier taps a series, an author and a universe on `/books` and `/books/plan` at 360 and 1280.

**Risks.** The 24px box on an 11px line without moving the card's layout; Lighthouse measures only while its switch is on, else the byte budgets are checked after merge.

**Size.** 10 source files plus `globals.css`, over the split policy's 8; already part 1 of 3 and each edit small, so kept whole, attended (owner, at plan).

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
