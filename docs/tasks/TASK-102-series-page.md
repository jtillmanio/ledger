---
id: TASK-102
title: 5.9 Series (2 of 2) — a page per series, its gap rows, and every series name links to it
status: Ready
depends_on: [TASK-101]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-102 — 5.9 Series (2 of 2) — a page per series, its gap rows, and every series name links to it

## Goal

Every series has a page of its own: its books in order with their status and dates, the next one to read marked, a grey row for each book you don't have yet, and every series name in the app opens it.

## Context

- Roadmap: `docs/05-roadmap.md` § 5.9 Series page from `series_progress` (M17), the *Every series is a link, to a page of its own* bullet (2026-10-20 intake: *series are clickable*). Feature F-38. Its **Check:** is the contract.
- **Split, 2 of 2.** TASK-101 built the list and the nav item. This part draws `/books/series/[id]` and links every series name to it, and **its merge ticks 5.9**.
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
- [ ] AC-4: A Library row's series name and the books dashboard's series line are links to `/books/series/<id>`; `/books/series/<unknown>` renders the not-found page.
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
