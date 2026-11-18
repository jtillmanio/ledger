---
id: TASK-102
title: 5.9 Series (2 of 2) — a page per series, its gap rows, and every series name links to it
status: In progress
depends_on: [TASK-101]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: 62e16d1
---

# TASK-102 — 5.9 Series (2 of 2) — a page per series, its gap rows, and every series name links to it

## Goal

Every series has a page of its own: its books in order with their status and dates, the next one to read marked, a grey row for each book you don't have yet, and every series name in the app opens it.

## Context

- Roadmap: `docs/05-roadmap.md` § 5.9 Series page from `series_progress` (M17), the *Every series is a link, to a page of its own* bullet (2026-10-20 intake: *series are clickable*). Feature F-38. Its **Check:** is the contract.
- **Split, 2 of 3** (owner, at plan, 2026-11-18: past 8 files, `workflow.splitPolicy: split`). TASK-101 built the list and the nav item. This part draws `/books/series/[id]` and links the list's rows to it. TASK-115 links every other series name (AC-4's first clause moved there) and **its merge ticks 5.9**.
- **The page** lists the series' live books in `series_position` order, each with its status and dates (1.17's start and finish, as the Library's row shows them; `src/lib/format.ts`), and marks the next unread (the lowest position not read, derived). A position between 1 and `total_books` with no book in the catalog is a grey gap row (*#4 not in your library · Add*), which opens Add books (1.4c) with the series named (`/books/add` with the series in the query; the plan names the parameter, as `?shelf=` and `?q=` are today in `src/app/books/add/page.tsx`). A fractional position (*2.5*) is a book, never a gap. A missing or unknown id is a 404 page (`notFound()`).
- **Links:** wherever the app prints a series name, it links here: a Library row (`src/app/books/list/page.tsx`, `bookSub`/`bookPlace` in `src/lib/format.ts`), the books dashboard's *where the book sits* and *the book's place* lines (2.2g, 2.2j: `src/components/WhereItSits.tsx`, `src/components/OnDeckRow.tsx`), and TASK-101's list rows; 3.5's sheet (TASK-079) when it lands.
- **The follow control is this task's** (owner, at conversion, 2026-11-15). The roadmap disagrees with itself: 5.9's bullet says *5.11 adds the follow control to this page*, while 5.11's *Amended by the second 2026-11-02 intake (D-108)* says 2.2c built the control and *5.9 [places it] on the series page*. The owner chose the later amendment. This page places 2.2c's control (`src/components/FollowSheet.tsx`, `POST /api/follows`, `setFollow`) and builds none of its own: a `role="radiogroup"` *Reading · Tracking · Not following*, whose middle choice reads *On hold* on a part-read series (D-118), and *Not following* stores `off` (D-117, D-127). 5.11 (TASK-103) places the same control on the author and universe pages.
- **Not drawn yet:** the `series` screen gains the series page (books in order, the next unread marked, a gap row) at phone, tablet and desktop, in this PR (`ui.redrawFiles`).
- Architecture: `/books/series/[id]` is in `docs/02-architecture.md` § 5 (as task 5.9).
- Design: `docs/04-design.md` § 10 The UX floor; `.claude/rules/ui.md` (gap rows are grey; a read-elsewhere hint is never green).
- Decisions: D-42, D-90, D-108, D-119.
- *From TASK-101 (5.9, PR #289), open question for the plan:* the Library's own Series section (`src/app/books/list/page.tsx`, the foot of `/books/list`, fed by `seriesProgress`) duplicates `/books/series` now that it exists. Keep it, cut it, or make it a link to the list? This task edits that file to link the series names, so the plan says which.
- *From TASK-101 (5.9, PR #289):* the list's rows ship unlinked (owner, 2026-11-18: R1-06, nothing leads to a screen not built), so this task links every row of `/books/series` (`src/components/SeriesList.tsx`, the `.rt` name in `SeriesRowItem`) to `/books/series/[id]`, with the series' name as the link's accessible name, and adds the row's chevron. That proves AC-6's *each row's link has the series' name*, which TASK-101 defers here. TASK-101's `test/series-list.test.tsx` and `test/e2e/series.spec.ts` assert the rows are *not* links; this task changes those assertions with the link.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves the row's link shows only that series' books, the gap row for #3, and a series name in a list row linking to its page, in the browser (0.11) on the test database. TASK-101 proves the list's counts, meter and next-unread line):
a series with 3 of 5 books read renders `3 / 5` and a meter
filled with `--ready`; one with NULL `total_books` counts its listed books;
a soft-deleted book is not counted; the next-unread line names the
lowest-position unread book, and a complete series has none. The row's link
shows only that series' books. A series holding positions 1, 2 and 4 of 4
renders a gap row for #3, and a series name in a list row links to its
page. Screenshot at 360px, 834px and 1280px.
- [ ] AC-2: Given a series with books at positions 1 (read), 2 (reading) and 4 (no status) of a stated 4, its page lists #1, #2, a grey gap row for #3 and #4 in that order, each book with its status, and marks #4 as next unread (#2 is in hand, not unread: the plan confirms which the marker names).
- [ ] AC-3: Pressing *Add* on the gap row opens Add books with the series named; a series with NULL `total_books` draws no gap rows; a soft-deleted book is absent and its position is a gap.
- [ ] AC-4: `/books/series/<unknown>` renders the not-found page. (*A Library row's series name and the books dashboard's series line are links to `/books/series/<id>`* moved to TASK-115, owner at plan, 2026-11-18.)
- [ ] AC-5: The `series` frame in `design/mockups.html` draws the series page with a gap row, the next unread marked and the follow control, and `design/mockups-index.md` names it (task 5.9). On a series page with no follow, choosing *Reading* writes one `series_follows` row `reading`, still checked after a reload; *Not following* stores `off`, and `series_progress.follow_state` reads NULL; each write's toast *Undo* puts back the prior state.
- [ ] AC-6: The page meets the UX floor (`docs/04-design.md` § 10): a series with no live books draws an empty state with *Add a book*, loading skeletons, an error state; gap rows are grey and their *Add* is a real link with a name, ≥ 24px; contrast in light and dark; screenshots at 360px, 834px and 1280px.

## Out of scope

- The list and nav item (TASK-101).
- The author and universe pages and their controls (5.11, TASK-103), and `/progress` (5.12).
- A new follow control or new follow writes (2.2c's are reused).
- Editing a book's series or position (3.1, 3.5).

## Files likely touched

- `src/app/books/series/[id]/page.tsx`, `src/app/books/series/[id]/loading.tsx` (new).
- `src/db/queries.ts` — one series' books, positions and gaps.
- `src/app/books/list/page.tsx`, `src/lib/format.ts`, `src/components/WhereItSits.tsx`, `src/components/OnDeckRow.tsx` — series names as links.
- `src/app/books/add/page.tsx` — the series named from a gap row.
- `design/mockups.html`, `design/mockups-index.md` — the `series` frame (redraw).
- `test/series-page.test.ts`, `test/e2e/series.spec.ts`.

## Verification

- Automated: `test/series-page.test.ts` (positions, gaps, fractional positions, soft delete on `TEST_DATABASE_URL`), `test/e2e/series.spec.ts` (AC-1's browser clauses, AC-2 to AC-4, axe; screenshots at 360, 834 and 1280).
- Manual: on the dev database, Library → a row's series name → the series page; a gap row's *Add* → Add books with the series named.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- The split's third part: every other series name links to its page (a Library row, *where the book sits*, the *On deck* rows, the book sheet's Series line), `series_id` on those rows, and TASK-101's open question on the Library's own Series section; its merge ticks 5.9 (approved at plan) → docs/tasks/TASK-115-series-name-links.md (created at plan), and `docs/06-tasklist.md`'s 5.9 row names it
- A gap row's *Add* opens Search with the series named (`?q=`); By hand could open with Series and # filled from the gap (approved at plan) → docs/tasks/TASK-115-series-name-links.md § Context

## Plan

Approved 2026-11-18 by the owner, with the split (TASK-102 is 2 of 3; TASK-115 is 3 of 3 and takes AC-4's first clause).

### Decisions at plan (owner, 2026-11-18)

1. **Next unread** is TASK-101's rule (`seriesList`, its decision 3): the lowest-`series_position` live book (NULLS LAST, then title, then id) whose status is NULL, `to_read` or `unlisted`; a book in hand (reading, listening) or a DNF is skipped; a complete series has none. In AC-2 the marker names **#4**. It is drawn as a *Next up* tag on that row.
2. **Gaps** are the whole numbers 1…`total_books` (the stated total) with no live book at exactly that position, derived in the query (`generate_series`), never stored. A fractional position (*2.5*) is a book row placed between #2 and #3, never a gap. A NULL stated total draws no gaps. A series with no live books draws the empty state (*Add a book*), no gap rows.
3. **A gap's *Add*** is a link to `/books/add?q=<series name>`: the existing `?q=` (Search's starting text), so Add books opens with the series named and `src/app/books/add/page.tsx` needs no change. By hand filled from the gap is a follow-up (TASK-115).
4. **Status** is the search result's tag words (`placeTag` in `src/lib/format.ts`: *Q1 2027*, *Someday*, *Reading*, *Read*, *DNF*, *Unlisted*, *Not on your list*), with ✓ on read and ◐ in hand, glyph plus text (as `ShelfBooks`' rows). Dates are `bookDates` (1.17), as the Library row. The title links to the book (`bookHref`, the sheet over the page).
5. **The follow control** is 2.2c's: `ShelfFollow`'s body moves to `FollowOptions.tsx` as `FollowControl` (any `Grouping`), and the shelf page uses it unchanged. No new writes: `POST /api/follows` through `useFollowChange`.

### Steps

1. **Query** `seriesPage(userId, id)` in `src/db/queries.ts`: one read. The series (`series_progress`: name, author, `read`, `total`, `follow_state`; `unread` = live books neither read nor DNF), its live books in `series_position` order (NULLS LAST, title, id) each with id, title, position, cover, status (raw, NULL with no row), `to_read_level`'s level and period, the latest read's start, finish, precisions and days taken (as `listBooks`); the gap positions (decision 2); the next unread's id (decision 1, none when complete). An unknown id answers null. Soft-deleted books are on no list and leave their position a gap (hard rule 4).
2. **Route** `src/app/books/series/[id]/page.tsx` (`force-dynamic`, metadata *Series · Ledger*, `requireUserId`, the id decoded as the shelf page does, `notFound()` on a bad or unknown id), `loading.tsx` (the head and rows in `--sunk` at the loaded geometry), `error.tsx` (neutral: *Couldn't load this series. Nothing was changed.*, *Try again*, ‹ Series).
3. **Body** `src/components/SeriesBooks.tsx` (new): the head (‹ Series, the name as h1, the author, `read / total` in mono, a `.meter` filled with `--ready` via `fillShare`, `FollowControl`); then one list (`aria-label` *Books in <name>*) with books and gaps merged by position: a book row (`RowCover`, `#n` in mono, the title as a link, status tag, dates, *Next up* on the next unread); a gap row in grey (*#3 not in your library*, *Add* a real link named *Add #3 of <name>*, ≥ 24px). No live books: `EmptySlate` *No books in this series yet*, one action *Add a book* (`/books/add?q=<name>`).
4. **Follow control** to `FollowOptions.tsx` (`FollowControl`); `ShelfBooks.tsx`'s `ShelfFollow` becomes it.
5. **List rows** in `src/components/SeriesList.tsx`: the name is a link to `/books/series/<id>` (accessible name the series' name) and the row gains its chevron.
6. **Styles** in `src/app/globals.css` (tokens only, hard rule 6; gap rows `--faint`, nothing red). **Budget**: `/books/series/[id]` 1 query, 1 wave in `test/query-budget.test.ts` and `docs/02-architecture.md` § Performance budget.
7. **Mockup**: the `series` screen in `design/mockups.html` gains the series page at 360, 834 and desktop (books in order, the next unread marked, a gap row, the follow control), its notes and the list rows as links; `design/mockups-index.md`'s row says so.

### Files

- `src/db/queries.ts` — `seriesPage` and its types.
- `src/app/books/series/[id]/page.tsx`, `loading.tsx`, `error.tsx` (new; `error.tsx` not in *Files likely touched*: the UX floor's error state).
- `src/components/SeriesBooks.tsx` (new; not in *Files likely touched*) — the page body.
- `src/components/FollowOptions.tsx`, `src/components/ShelfBooks.tsx` (not in *Files likely touched*) — the shared follow control.
- `src/components/SeriesList.tsx` (named in Context) — the row link and chevron.
- `src/app/globals.css` (not in *Files likely touched*) — the page's rules.
- `design/mockups.html`, `design/mockups-index.md` — the `series` frames (`ui.redrawFiles`).
- `docs/02-architecture.md` (not in *Files likely touched*) — the budget line.
- `test/series-page.test.ts`, `test/series-list.test.tsx`, `test/e2e/series.spec.ts`, `test/query-budget.test.ts`.
- Not touched (moved to TASK-115 or by decision 3): `src/app/books/list/page.tsx`, `src/lib/format.ts`, `src/components/WhereItSits.tsx`, `src/components/OnDeckRow.tsx`, `src/app/books/add/page.tsx`.

### Test strategy

- **AC-1** (this part's clauses): `test/e2e/series.spec.ts` — *a list row's name links to its page, which shows only that series' books*; *a series holding 1, 2 and 4 of 4 draws a gap row for #3*; screenshots at 360, 834 and 1280.
- **AC-2**: `test/series-page.test.ts` — *1 read, 2 reading, 4 no status of a stated 4: books 1, 2, 4 in order, gap 3, next unread 4*; *a book at 2.5 is a book, never a gap*; the e2e spec checks the rows' order, statuses and the *Next up* tag in the page.
- **AC-3**: `test/series-page.test.ts` — *a NULL total draws no gaps*; *a soft-deleted book is absent and its position a gap*; e2e — *Add on the gap row opens Add books with the series named* (the search box holds the name).
- **AC-4**: `test/series-page.test.ts` — *an unknown id answers null*; e2e — `/books/series/<unknown>` renders the not-found page.
- **AC-5**: manual (the frames; spec-reviewer reads them); e2e — *Reading writes one row, still checked after a reload*; *Not following stores off and series_progress.follow_state reads NULL*; *each toast's Undo puts back the prior state*.
- **AC-6**: e2e — the empty state (*Add a book*), the loading skeleton at the loaded row height, the error state, axe, contrast light and dark, the gap row grey and its *Add* a named link ≥ 24px, no sideways scroll, nothing red, screenshots; `test/series-list.test.tsx` — the row is a link named by the series, with a chevron.
- `test/query-budget.test.ts` — `/books/series/[id]` 1 query, 1 wave.

### Plan revisions after approval

### Risks

- The e2e data: series and books under E2E ids no other spec uses, removed after the last test, as TASK-101's spec does.
- The mockup redraw is the largest edit; frames copy the `shelves` page's structure.

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
