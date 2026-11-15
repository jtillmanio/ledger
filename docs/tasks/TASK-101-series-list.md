---
id: TASK-101
title: 5.9 Series (1 of 2) — the Series list from series_progress, and the nav item
status: Ready
depends_on: []
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-101 — 5.9 Series (1 of 2) — the Series list from series_progress, and the nav item

## Goal

A *Series* page lists every series you have books in, with how far through it you are and the next book to read, in progress first, then not started, then complete.

## Context

- Roadmap: `docs/05-roadmap.md` § 5.9 Series page from `series_progress` (M17; coverage check 2026-10-08; product B6, the workbook's Series tab). After 1.26 in the tasklist's order. Feature F-38. Its **Check:** is the contract.
- **Split, 1 of 2** (`workflow.splitPolicy: split`: two pages, the nav, and a link on every series name run past 8 files). This part is the list. TASK-102 draws a series' own page and links every series name to it, and its merge ticks the entry.
- **The list** (`/books/series`): every series with its author, `books_read / total_books` in mono and an `.emeter` filled with `--ready` (D-26), in progress first, then not started, then complete. `series_progress` (`etl/views.sql`): `total_books` is the stated total, else the live books listed; a soft-deleted book is not counted; `follow_state` treats `off` as none. `seriesProgress` (`src/db/queries.ts`, unused today) is the starting point; it keeps only series with more than one book (the plan says whether that holds: the Check's NULL-total case counts its listed books).
- **The next unread** is the lowest `series_position` not read, derived in the query (hard rule 2), never stored; a complete series has none. A series whose read count exceeds its stated `total_books` (the R2 `pct > 1` case) draws a full meter and the true counts.
- **Each row links to `/books/series/[id]`** (the 2026-10-20 intake replaced the old `/books/list?series=<id>` link): until TASK-102 lands, the plan says whether the row is a link to a page not yet built or this task ships the row unlinked (the nav must never lead to a missing screen, R1-06).
- **Navigation:** add *Series* under Books in `NAV_ITEMS` (`src/components/nav/items.ts`; no item exists yet, so this task adds it, enabled), in the tab row, the rail and the sidebar. `/books/series` is already in `docs/02-architecture.md` § 5 (as task 5.9).
- **Not drawn yet:** the mockup gains the `series` screen at phone, tablet and desktop with its empty state (*No series yet · Add a book*), and `design/mockups-index.md` lists it (`ui.redrawFiles`).
- Design: `docs/04-design.md` § 10 The UX floor; `design/STYLE_GUIDE.md` § 14; `.claude/rules/ui.md` (every meter fills `--ready`).
- Decisions: D-26, D-42, D-90 (Calibre owns series); R1-06.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves the counts, the meter, the NULL total, the soft delete, the next-unread line and the screenshots of the list, on the test database and in the browser (0.11). TASK-102 proves the row's link, the gap row and a series name's link):
a series with 3 of 5 books read renders `3 / 5` and a meter
filled with `--ready`; one with NULL `total_books` counts its listed books;
a soft-deleted book is not counted; the next-unread line names the
lowest-position unread book, and a complete series has none. The row's link
shows only that series' books. A series holding positions 1, 2 and 4 of 4
renders a gap row for #3, and a series name in a list row links to its
page. Screenshot at 360px, 834px and 1280px.
- [ ] AC-2: Given one series part-read, one with nothing read and one complete, the page lists them in that order, and the complete one names no next book.
- [ ] AC-3: Given a series with a stated `total_books` of 3 and 4 live books read, its row reads `4 / 3` and its meter is full, not overflowing.
- [ ] AC-4: *Series* shows under Books in the tab row, the rail and the sidebar, current on `/books/series`.
- [ ] AC-5: `design/mockups.html` gains the `series` screen at phone, tablet and desktop with its empty state, and `design/mockups-index.md` lists it (task 5.9).
- [ ] AC-6: The page meets the UX floor (`docs/04-design.md` § 10): the empty state (*No series yet* with *Add a book*), loading skeletons at the loaded size, an error state; text contrast in light and dark; each row's link has the series' name; screenshots at each `ui.viewports` width.

## Out of scope

- A series' own page, gap rows and the links from every series name (TASK-102).
- The follow control on the series page (TASK-102; owner, 2026-11-15).
- Author and universe pages (5.11), `/progress` (5.12).
- A `/books/list?series=` filter.

## Files likely touched

- `src/app/books/series/page.tsx`, `src/app/books/series/loading.tsx` (new).
- `src/db/queries.ts` — `seriesProgress` with the next unread and the order.
- `src/components/nav/items.ts` — the *Series* item.
- `design/mockups.html`, `design/mockups-index.md` — the `series` screen.
- `test/series-page.test.ts` (new), `test/nav-items.test.tsx`, `test/e2e/series.spec.ts` (new).

## Verification

- Automated: `test/series-page.test.ts` (the counts, NULL total, soft delete, next unread, order, `pct > 1` on `TEST_DATABASE_URL`), `test/e2e/series.spec.ts` (the list's rendering, meter colour, axe; screenshots at 360, 834 and 1280), `test/nav-items.test.tsx`.
- Manual: on the dev database, Books → Series → a part-read series names its next book; a finished one names none.

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
