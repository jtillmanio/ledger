---
id: TASK-125
title: 5.9 Series (3 of 3) — every series name in the app links to its page
status: Ready
depends_on: [TASK-102]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
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
