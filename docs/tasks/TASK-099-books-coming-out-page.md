---
id: TASK-099
title: 5.7 Books coming out (1 of 2) — the Coming out page, Got it, and the nav item
status: Ready
depends_on: []
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-099 — 5.7 Books coming out (1 of 2) — the Coming out page, Got it, and the nav item

## Goal

A *Coming out* page lists the books you want when they come out, *Out now* first, then by month, then *No date yet*, and *Got it* moves a book onto your list with an Undo.

## Context

- Roadmap: `docs/05-roadmap.md` § 5.7 Books coming out (M17; D-35; product B1, B5; Review N UX-N26). Pulled ahead of 1.26 by 1.25 (`docs/cutover-parity.md`: the workbook's *Coming Out* tab is a books use the cutover must carry). Feature F-37. Its **Check:** is the contract.
- **Split, 1 of 2** (`workflow.splitPolicy: split`: a page, a write, the nav, the add sheet's destination and the dashboard line run past 8 files). This part is the page, *Got it* and the nav item. TASK-100 adds the add sheet's *Coming out* destination and the dashboard line, and its merge ticks the entry.
- **What counts as wanted, with no new column:** a `releases` row (`book_id`, `release_date` text, NULL = announced but undated; `src/db/schema.ts`) whose live book has no `book_status` row for you. **Got it** writes `book_status = to_read` (the book moves to Someday and off this list) and raises the undo toast. A separate per-user *want* row would be a schema change: ask before building (CLAUDE.md).
- **Ask at plan time: does an Unlisted book with a release count as wanted?** (Owner, at conversion, 2026-11-15: decide at the plan gate, and explain what it means there.) The plan sets out these facts and asks:
  - *Unlisted* (1.21, D-83, D-86) is `book_status = 'unlisted'`: a book in your library that you haven't put on your list. Every book Calibre creates starts there (1.18), and so does a book a paste to *Physical copy* creates (5.17, TASK-094). Under the entry's rule (*no `book_status` row*), it has a row, so it never shows on *Coming out*.
  - **No, as written:** *Coming out* lists only books the Ledger knows nothing else about. If a book you're waiting for is already Unlisted (Calibre picked it up from a pre-order, say), it drops off *Coming out* without a *Got it*, and only *Unlisted · N* and search still show it.
  - **Yes, Unlisted counts:** the query adds `OR status = 'unlisted'`. *Got it* moves the book to `to_read` (Someday), as *Add to Someday* does today, and Undo puts back `unlisted`, not *no row*. The risk: a Calibre book that also has a `releases` row (from the workbook's *Coming Out* tab) would show as wanted after you already have it.
  - The plan counts both cases on the dev database (books with a release and no status, books with a release that are Unlisted), so the owner decides from real numbers.
- **The list:** *Out now* first (a release date on or before today, Eastern, task 1.16), then one group per month, then *No date yet*. Each row: cover (4.1's `Cover` where it exists), title, author, series position, the date in mono, and **Got it**. The month grouping is product B5's calendar view; no month grid is built. `upcomingReleases` (`src/db/queries.ts`, the v1 home page's query, now unused) is the starting point; it filters nothing on status and drops undated rows.
- **The write.** *Got it* goes through `saveBookStatus` (`src/db/writes.ts`) via `POST /api/progress/book`, as the Library's status control does (`src/components/useBookWrite.ts`), so its undo (`undoBookStatus`) deletes the row it made.
- **Navigation:** add a *Coming out* item under Books in `NAV_ITEMS` (`src/components/nav/items.ts`; the entry says "flip its flag", but no item exists yet, so this task adds it, enabled), drawn in the tab row, the rail and the sidebar (R1-06). Add `/books/releases` to `docs/02-architecture.md` § 5 (the route table already lists it as task 5.7: drop the "(task 5.7)" once built).
- **Not drawn yet:** the mockup gains a `releases` screen at phone, tablet and desktop, with its empty state (*Nothing coming out · Add a book*), and `design/mockups-index.md` lists it (`ui.redrawFiles`).
- Design: `docs/04-design.md` § 10 The UX floor; `design/STYLE_GUIDE.md` § 14 (rows, mono dates); `.claude/rules/ui.md`.
- Decisions: D-35, D-67 (Eastern days), D-83, D-86; R1-06.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves, on the test database and in the browser (0.11): the *Out now* and month groups, *Got it*'s one row, its removal and Undo, a `read` book never listed, and the screenshots. TASK-100 proves the dashboard line's counts):
a released-yesterday book with no status renders under *Out now*;
one due next month under that month; *Got it* writes one `to_read` row and
removes the row from the list, and Undo restores it; a book already `read`
never appears. The dashboard line's counts equal the list's. Screenshot at
360px, 834px and 1280px.
- [ ] AC-2: Given releases for a book due today (Eastern), one due in three months, one with NULL date, one soft-deleted and one whose book is `to_read`, the page groups the first under *Out now*, the second under its month's heading, the third under *No date yet*, and shows neither of the last two (an Unlisted book with a release follows the owner's plan-gate answer, with its own fixture).
- [ ] AC-3: Given a wanted book, pressing *Got it* removes its row without a reload and the toast offers *Undo*; after *Undo* the row is back in its group and `book_status` holds no row for the book.
- [ ] AC-4: *Coming out* shows under Books in the tab row, the rail and the sidebar, current on `/books/releases`.
- [ ] AC-5: `design/mockups.html` gains the `releases` screen at phone, tablet and desktop with its empty state, and `design/mockups-index.md` lists it (task 5.7).
- [ ] AC-6: The page meets the UX floor (`docs/04-design.md` § 10): empty state (*Nothing coming out* with one action, *Add a book*), loading skeletons at the loaded size, an error state; *Got it* a real button with the book in its name, ≥ 24px (44px on a phone row); text contrast in light and dark; screenshots at each `ui.viewports` width.

## Out of scope

- The add sheet's *Coming out* destination and the dashboard line (TASK-100).
- Comic issues coming out (5.8) and the digest email (7.6).
- A month grid, notifications or a per-user *want* row.

## Files likely touched

- `src/app/books/releases/page.tsx`, `src/app/books/releases/loading.tsx` (new).
- `src/db/queries.ts` — `upcomingReleases` becomes the wanted list (grouping inputs, status filter, undated rows).
- `src/components/GotIt.tsx` (new; the name is the plan's) — the write and its undo through `useBookWrite`.
- `src/components/nav/items.ts` — the *Coming out* item.
- `design/mockups.html`, `design/mockups-index.md` — the `releases` screen.
- `docs/02-architecture.md` — the route.
- `test/releases.test.ts` (new), `test/nav-items.test.tsx`, `test/e2e/releases.spec.ts` (new).

## Verification

- Automated: `test/releases.test.ts` (AC-2's membership and grouping on `TEST_DATABASE_URL`), `test/e2e/releases.spec.ts` (AC-1's browser clauses, AC-3, AC-4, axe; screenshots at 360, 834 and 1280), `test/nav-items.test.tsx`.
- Manual: on the dev database, Books → Coming out → *Got it* on a row → it leaves, the toast's *Undo* brings it back. Leave the data as found.

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
