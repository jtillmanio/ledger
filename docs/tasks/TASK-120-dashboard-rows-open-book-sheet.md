---
id: TASK-120
title: 3.5b The book sheet's own writes (3 of 3) — the dashboards' book rows open the sheet
status: Ready
depends_on: [TASK-079, TASK-116]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-120 — 3.5b The book sheet's own writes (3 of 3) — the dashboards' book rows open the sheet

## Goal

Tapping a book's title on the books dashboard (the book in hand, On deck, the *Up next* shelf) or on Top books opens that book's sheet over the page, as the Library's rows already do. Back closes it with the page where it was.

## Context

- Roadmap: `docs/05-roadmap.md` § 3.5b (its **Check** is AC-1, verbatim), the bullet *The dashboards' book rows (Now, On deck, the plan shelf, Top books) open the sheet, as the Library's and the status tabs' rows do since 3.5.* `docs/06-tasklist.md` M14. Part 3 of 3: TASK-118 does the note and owned toggles, TASK-119 *Move* and *Shelves*. Independent of both: it can be built before them.
- How the Library and status rows do it (task 3.5, TASK-079): a plain `<a href={bookHref(id)}>` on the title (`src/app/books/list/page.tsx`, `src/components/StatusBookRow.tsx`) that `SheetLinks` opens as the intercepted sheet `src/app/@modal/(.)book/[id]/` (D-157); a direct load draws `src/app/book/[id]/`.
- The rows to change:
  - Now: `src/components/BooksNow.tsx`, the hero's `h2.now-name` (its *Next in* line already links to the Library's search, and stays).
  - On deck: `src/components/OnDeckRow.tsx` (its *Plan* verb stays a button).
  - The plan shelf: `src/components/PlanShelf.tsx`, each `li.card` (its comment says "No card is a link: a book has no page of its own yet"; now it has). The card's title or cover becomes the link: one link per card, not both.
  - Top books: `src/components/TopBooks.tsx`, `Body`'s `.qtitle` (the row also has a drag handle, a menu and *Rank it*: the link must not take their taps, and dragging a row must not open the sheet).
- Depends on 2.2k (TASK-116) because both change `PlanShelf`'s card; build this after it to avoid a conflict.
- The query budget (`test/query-budget.test.ts`) and the JS budgets (`scripts/perf/budget.json`, `docs/02-architecture.md` § Performance budget) cover `/books` and `/books/top`: a link adds no query, and `SheetLinks` is already on the page if the Library's pattern is followed.
- UX floor: `docs/04-design.md` § 10. Design: `design/mockups.html` `bdash`, `top`; the feel pass, `design/STYLE_GUIDE.md` § 14.1.
- Decisions: D-34, D-157, D-40.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves the dashboards' rows: TASK-118 proves the note and the owned toggles, TASK-119 *Move* leaving one sheet): test that saving a note from the sheet writes `book_status.notes` once and its Undo puts the old note back; that each owned toggle writes or deletes exactly one `owned_copies` row and its Undo reverses it; that opening *Move* from the sheet leaves exactly one sheet in the DOM; and that a book row on each books dashboard opens `/book/{id}` as a sheet.
- [ ] AC-2: On the test database with a Reading book, an On deck book, two books planned this quarter and a ranked read this year: tapping the title on Now, on an On deck row, on an *Up next* card and on a Top books row each changes the URL to `/book/{that book's id}`, shows exactly one sheet over the page with that book's title as its heading, and Back closes it with the URL and the scroll position as they were.
- [ ] AC-3: A direct load of `/book/{id}` still draws the full page (not the sheet). Each row's other controls do what they did: On deck's *Plan* opens the plan picker, the shelf's *Reorder* goes to Status, Top books' handle drags, its menu opens and *Rank it* opens the ranking, none of them opening the book sheet.
- [ ] AC-4: Each row has one link to the book, named by its title (no duplicate link for the cover and the title), and no row is wrapped in a link that contains a button.
- [ ] AC-5: The books dashboard and Top books meet the UX floor (`docs/04-design.md` § 10): each link has a visible focus ring and a target of at least 24×24px, axe passes (no nested interactive), no horizontal scroll at 360px, screenshots at 360px and 1280px with a sheet open from the dashboard.

## Out of scope

- The sheet's own editors: TASK-118 and TASK-119.
- The comics dashboard and the issue sheet (3.5's TASK-080).
- Any row outside the books dashboards and Top books (the Library, status tabs and Coming out already open it).
- Changing what a row shows or its layout beyond the title becoming a link.

## Files likely touched

- `src/components/BooksNow.tsx`: the hero's title links to the book
- `src/components/OnDeckRow.tsx`: the row's title links
- `src/components/PlanShelf.tsx`: each card's title links; its comment updated
- `src/components/TopBooks.tsx`: `Body`'s title links, clear of the handle's drag
- `src/app/globals.css`: the links' colour and focus ring in each place, from tokens
- `test/e2e/books-dashboard.spec.ts`, `test/e2e/top-books.spec.ts`: AC-2 to AC-5

## Verification

- Automated: the two e2e specs open each row's sheet, check the URL, the one dialog and its heading, Back, and that the other controls don't open it; the query budget test unchanged and green.
- Manual: on `/books` at 390px tap an *Up next* card's title → expected: the book's sheet slides up over the dashboard; Back → the dashboard where you left it. On `/books/top` drag a row by its handle → expected: it moves and no sheet opens.

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
