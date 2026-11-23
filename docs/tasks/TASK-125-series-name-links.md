---
id: TASK-125
title: 5.9 Series (3 of 3) — every series name in the app links to its page
status: In progress
depends_on: [TASK-102]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: 078a19b
---

# TASK-125 — 5.9 Series (3 of 3) — every series name in the app links to its page

## Goal

Wherever the app prints a series name, it is a link to that series' own page (`/books/series/[id]`).

## Context

- Roadmap: `docs/05-roadmap.md` § 5.9 Series page from `series_progress` (M17), the *Every series is a link, to a page of its own* bullet: *Wherever the app prints a series name (a list row, 3.5's sheet, the books dashboard) it links here.* Feature F-38. Its **Check:** is the contract.
- **Split, 3 of 3** (owner, at TASK-102's plan, 2026-11-18: TASK-102 ran past 8 files). TASK-101 built the list and the nav item; TASK-102 drew `/books/series/[id]` and linked the list's rows. This part links every other series name, and **its merge ticks 5.9**.
- **Where a series name prints:** a Library row (`src/app/books/list/page.tsx`, its second line from `bookSub`/`bookPlace` in `src/lib/format.ts`), the books dashboard's *where the book sits* (2.2g, `src/components/WhereItSits.tsx`: `Level` already carries the id) and *the book's place* on the *On deck* rows (2.2j, `src/components/OnDeckRow.tsx`), and 3.5's book sheet (`src/components/BookDetail.tsx`: its Series fact and the hero's place line say *plain text until 5.9's series page*). The rows carry the series' name but not its id: `listBooks` (`BookRow`), `onDeck` (`ShelfBook`) and `bookDetail` (`BookDetail`) in `src/db/queries.ts` gain `series_id`. The plan says whether the Up next cards (`PlanShelf`), the status screen rows, the plan screens, Top books and Coming out link too, or are listed as follow-ups.
- **Payload:** the Library renders up to 500 rows into one page, and a `<Link>` per row went over its byte budget before (`src/components/SheetLinks.tsx`): a plain `<a>` is the lean choice (`scripts/perf/budget.json`, `library`).
- *From TASK-101 (5.9, PR #289), open question for the plan:* the Library's own Series section (`src/app/books/list/page.tsx`, the foot of `/books/list`, fed by `seriesProgress`, with `src/lib/series-list.ts` and its `?series=all`) duplicates `/books/series` now that it exists. Keep it (and link its names), cut it, or make it one link to the list? Cutting it also retires `seriesProgress`, `src/lib/series-list.ts`, `test/series-list.test.ts` and the *Show all* assertions in `test/library-page.test.tsx`.
- *From TASK-102 (5.9):* a gap row's *Add* opens Add books with Search holding the series' name (`/books/add?q=<name>`). By hand could also open with *Series* and *#* filled from the gap (`src/components/ByHand.tsx`, through `src/components/AddBooks.tsx` and a new parameter on `src/app/books/add/page.tsx`); the plan says whether that belongs here or in a later task.
- *From TASK-103 (5.11, PR #295):* the author and universe pages exist (`/books/authors/[id]`, `/books/universes/[id]`; `authorHref` and `universeHref` in `src/components/GroupingBooks.tsx`), and 5.11's *an author's name in a Library row links to its page* moved here (owner, at TASK-103's plan, 2026-11-18): it edits the same row code as the series links. Wherever this task links a series name, the author's and universe's names link too (a Library row, *where the book sits*, the *On deck* rows, the book sheet, the follow sheet's rows); the rows gain `author_id` and `universe_id` beside `series_id`, and the same plain `<a>` keeps the Library within its byte budget.
- Design: `docs/04-design.md` § 10 The UX floor; `.claude/rules/ui.md`. Decisions: D-90, D-119, D-134.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves *a series name in a list row links to its page* for the Library's rows, in the browser (0.11) on the test database. TASK-101 proved the list's counts, meter and next-unread line; TASK-102 the row's link, the series page and the gap row):
a series with 3 of 5 books read renders `3 / 5` and a meter
filled with `--ready`; one with NULL `total_books` counts its listed books;
a soft-deleted book is not counted; the next-unread line names the
lowest-position unread book, and a complete series has none. The row's link
shows only that series' books. A series holding positions 1, 2 and 4 of 4
renders a gap row for #3, and a series name in a list row links to its
page. Screenshot at 360px, 834px and 1280px.
- [ ] AC-2 (moved from TASK-102 at its plan, 2026-11-18): A Library row's series name and the books dashboard's series line are links to `/books/series/<id>`.
- [ ] AC-3: The book sheet's Series fact names the series as a link to `/books/series/<id>`; a book with no series draws no link.
- [ ] AC-4: Each link's accessible name is the series' name; a book in a universe but no series links nothing; the Library route stays within its byte budget (`scripts/perf/budget.json`, `library`).

## Out of scope

- The series page, its gap rows and follow control (TASK-102).
- The author and universe pages (5.11, TASK-103).
- Editing a book's series or position (3.1, 3.5).

## Files likely touched

- `src/db/queries.ts` — `series_id` on `BookRow`, `ShelfBook` and `BookDetail`.
- `src/lib/format.ts` or a new `src/components/BookPlace.tsx` — the place line with the series as a link.
- `src/app/books/list/page.tsx`, `src/components/WhereItSits.tsx`, `src/components/OnDeckRow.tsx`, `src/components/BookDetail.tsx`.
- `test/e2e/series.spec.ts`, `test/library-page.test.tsx`.

## Verification

- Automated: `test/e2e/series.spec.ts` (a Library row's and the dashboard's series names link to the series page), unit tests for the place line's link.
- Manual: on the dev database, Library → a row's series name → the series page; Books → *where the book sits* → the series page.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- Every other place a series name prints links nothing yet: the Up next cards (`PlanShelf`), the status rows (`StatusBookRow`), the plan screens (`PlanQuarter`, `PlanQuarterRows`, `PlanSheet`, `PlanPicker`), Top books, Coming out, Parked, Listen next, Add books' search results, Now's *Next in*, and the follow sheet's rows (TASK-103 named it). A new 5.x roadmap item links them through `BookPlace` (approved at plan)
- TASK-102's question: By hand could open with *Series* and *#* filled from a gap row (`src/components/ByHand.tsx` through `AddBooks.tsx` and a new parameter on `src/app/books/add/page.tsx`); it goes in the same new roadmap item, not here (approved at plan)
- TASK-101's question, the Library's own Series section at the foot of `/books/list`: decided by step 1's measurement. With room in the byte budget it stays and is a follow-up; short of room, it becomes one *All series →* link here, retiring `seriesProgress`, `src/lib/series-list.ts` and `test/series-list.test.ts` (approved at plan)

## Plan

Approved by the owner 2026-11-23 ("go with recommendations"): AC-4's *a book in a universe but no series links nothing* reads as *draws no series link*, so the universe's name links on its own (TASK-103's note); the task stays whole (8 source files and 4 tests, over the split line: it is already 3 of 3, has no schema change, and a split would halve AC-2); this session (Opus) implements it.

**Steps**

1. Measure first: a local `next build` + `next start` of main on the development database, the Library's document bytes (brotli) as the baseline; the same after step 9. Lighthouse is off (`LIGHTHOUSE_MODE` unset, D-158): the numbers go in the PR, and a hand run only if the owner asks. Short of room under 80,000, the foot Series section becomes one *All series →* link (Follow-ups).
2. `src/lib/format.ts`: `placeParts(b)`, the D-134 line as segments (author, universe, series and its `#n`, each with its id), and `bookPlace` / `bookSub` built from it, so the drop rules keep one home.
3. `src/components/BookPlace.tsx` (new): draws the segments, author, universe and series as links (`authorHref`, `universeHref`, `seriesHref`); the `#n` outside the link, so a series link's name is the series' name. A plain `<a>` for the Library (its byte budget), `<Link prefetch={false}>` elsewhere.
4. `src/db/queries.ts`: `author_id`, `universe_id`, `series_id` on `BookRow` (`listBooks`), `ShelfBook` (`quarterShelf`, `onDeck`) and `BookDetail` (`bookDetail`).
5. `src/app/books/list/page.tsx`: the row's sub-line through `BookPlace`.
6. `src/components/WhereItSits.tsx`: the universe, author and series names link to their pages; a subseries (no page) stays text.
7. `src/components/OnDeckRow.tsx`: the sub-line through `BookPlace`.
8. `src/components/BookDetail.tsx`: the hero's author and place line, and the Series fact, link; the *plain text until 5.9* note goes.
9. `src/app/globals.css`: the place links keep the ink, underlined (axe's link-in-text-block), with a 24px hit box from padding that doesn't move the line.

**Files**: the nine above (`format.ts` and `globals.css` beyond *Files likely touched*); tests `test/e2e/series.spec.ts`, `test/book-place.test.tsx` (new), `test/book-detail.test.tsx`, `test/books-dashboard.test.ts`. No schema; no mockup redraw (layout and copy unchanged).

**Revision 1** (owner, 2026-11-23, in Phase 2): `seriesHref`, `authorHref` and `universeHref` move into `BookPlace.tsx`, and `src/components/SeriesList.tsx` and `src/components/GroupingBooks.tsx` import and re-export them: the client *On deck* row draws `BookPlace`, and importing them from those two would bring the follow control and the series list into `/books`' JS. And `test/e2e/books-dashboard.spec.ts`: 2.2g's *the rows are read-only text: no link* test pinned what AC-2 changes; it now proves the dashboard half of AC-2 in the browser (the universe and series links, the subseries text, a tap to the series page).

**Revision 2** (spec-reviewer R1, standing rule 6 and `ui.redrawFiles`): the plan's *no mockup redraw* no longer held once the links were underlined, bdash's note said *Read-only, and not links*, and step 1 put new copy at the Library's foot. `design/mockups.html` draws the place links (`a.plink`, underlined in `--faint`) on bdash's *where the book sits* rows, blist's sub-lines and bookdetail's author, place line and Series fact, blist's first frame ends *All series →*, bdash's note is rewritten and blist and bookdetail gain a notes entry; `design/mockups-index.md`'s `bdash`, `blist`, `bookdetail` and `series` rows say so. Spec-reviewer R2 added bdash's *On deck* rows (nine frames; their place line a block, `.tb-place`, so the flex gap doesn't part the links).

**Test strategy**

- AC-1, AC-2 (Library): `series.spec.ts`, a Library row's series name is a link named by the series to `/books/series/e2e-sp-gap`, and a tap opens that page; screenshots at 360, 834 and 1280px.
- AC-2 (dashboard): a render test that *where the book sits* links its series row to `/books/series/<id>` and leaves a subseries as text.
- AC-3: `book-detail.test.tsx`, the Series fact links to `/books/series/<id>`; a book with no series draws no series link.
- AC-4: `book-place.test.tsx`, each series link's accessible name is the series' name; a book in a universe but no series draws no series link (its universe links); the budget by step 1's measurement.

**Step 1's outcome** (a local `next start` on the development database, 500 rows, the document gzip / brotli): main 79,023 / 66,034 bytes; with the row links 83,699 / 70,564 (+4,676 gzip). Against PR #275's preview measure (76,462) that is about 81,100, over 80,000, so the foot Series section became one *All series →* link as planned, retiring `seriesProgress`, `src/lib/series-list.ts` and `test/series-list.test.ts` (and their mocks in `test/library-page.test.tsx`, `test/list-totals.test.tsx`, `test/year-chips.test.tsx`, the helper's name in `test/no-prefetched-filters.test.ts`, and `test/unlisted.test.ts` reading `seriesList` instead). With the foot cut: 79,815 / 67,496 (+792 gzip, +1,462 brotli over main), about 77,300–77,900 on the preview's scale, inside 80,000.

**Risks**: about 1,500 more links on the Library's 500 rows against 80,000 bytes (76,462 at PR #275); over it, stop and ask.

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
