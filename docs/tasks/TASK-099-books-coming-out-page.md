---
id: TASK-099
title: 5.7 Books coming out (1 of 2) — the Coming out page, Got it, and the nav item
status: In progress
depends_on: []
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: 24620a2
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

- F1 (approved at plan): every book on the workbook's *Coming Out* tab is held by extract's 1.20 hold (46 rows in `etl/data/book_hold.csv`: no Hardcover or Calibre record knows an unreleased book), and a held book loads no `releases` row, so `seed/releases.csv` is its header alone and *Coming out* lists nothing after a load (dev, 2026-11-17: 0 `releases` rows). `docs/cutover-parity.md` § `Coming Out` says "Loaded as `releases`". Owner action: decide the Coming Out rows in `book_hold.csv` (`keep` loads the book and its release). Placement: Owner checklist § Actions.
- F2 (approved at plan): extract loads no undated Coming Out row (`etl/extract.py`, `if not bid or pd.isna(date): continue`), so *No date yet* fills only from TASK-100's add sheet (`release_date` NULL). Placement: `docs/tasks/TASK-100-coming-out-destination-and-dashboard-line.md` § Context.

## Plan

_Written by /plan-batch or /implement-task Phase 1. Approved by the user (plan_status: approved) before any code is written._

Approved 2026-11-17. **Plan-gate answer (owner): an Unlisted book with a release does not count as wanted** (as written: wanted = a `releases` row whose live book has no `book_status` row). AC-2's Unlisted fixture therefore asserts the book is *not* listed.

Dev database at plan time (read-only count, 2026-11-17): 0 `releases` rows, so 0 books with a release and no status, and 0 Unlisted books with a release (see Follow-ups F1).

**Steps**

1. **Query** (`src/db/queries.ts`): replace `upcomingReleases` (no callers) with `wantedReleases(userId, today)`: live books (`deleted_at IS NULL`) with a `releases` row and `NOT EXISTS` a `book_status` row for the user; columns `id, title, author, series, series_position, universe, cover_url, release_date` and `grp`, computed in SQL on the text, never cast: `'out'` when `release_date <= today`, `left(release_date, 7)` (`YYYY-MM`) for a later date, `'none'` for NULL. Ordered *Out now*, then months ascending, then *No date yet*; inside a group by date, then title, then id. `today` is the Eastern day (`today()` from `src/lib/finish-date.ts`), a parameter so tests pin it.
2. **Page** `src/app/books/releases/page.tsx` (server, `force-dynamic`): h1 *Coming out*; a `<section>` per group with an `h2.group-head` (*Out now*, the month as *December 2026* — a malformed `YYYY-MM` prints as stored —, *No date yet*) and a mono count; rows `article.row.book-row`: `RowCover` (initials fallback), the title a `Link` to `bookHref(id)` (`scroll={false}`, `prefetch={false}`), `bookSub` line, the date in mono (`dayWhen(…, "exact")` for a well-formed day, else the stored text), and **Got it**. Empty: `EmptySlate` *Nothing coming out* with one action, **Add a book** → `/books/add`. `loading.tsx`: h1 bar plus skeleton rows at the loaded size (`Skeleton.tsx` pieces). `error.tsx`: neutral `×` line and *Try again*, never red (as `books/top/error.tsx`).
3. **`src/components/GotIt.tsx`** (client): wraps a row; **Got it** calls `useBookWrite` with `status: "to_read"`, `name: title`, `detail: "Was coming out"`; on save (`onSaved`) the row hides (no reload; `router.refresh` follows); `onUndone` shows it again. A refused or failed save keeps the row and shows a neutral inline line. The button is a real `<button>` named `Got it: <title>` (label-in-name), 44px on a phone row, ≥ 24px from 768px.
4. **`src/components/useBookWrite.ts`** (not in "Files likely touched"): optional `detail?: string` in `BookWriteArgs` overriding the toast's *Was …* line, since `was` has no word for "no status".
5. **Nav**: `src/components/nav/items.ts` gains `{ id: "books-releases", label: "Coming out", href: "/books/releases", icon: "calendar-clock", enabled: true, group: "medium", medium: "books" }` after Top, before Add; `src/components/nav/Icons.tsx` (not in "Files likely touched") gains Lucide's `calendar-clock` (neutral, `IconName` extended).
6. **Docs and design**: `docs/02-architecture.md` § 5 route row drops "(task 5.7)"; `design/mockups.html` gains a `data-id="releases"` section, phone (a populated list and the empty state), 834 and desktop frames; `design/mockups-index.md` lists it. `src/app/globals.css` only if the row's verb needs a rule (tokens only).

**Files**: `src/db/queries.ts`, `src/app/books/releases/{page,loading,error}.tsx` (new), `src/components/GotIt.tsx` (new), `src/components/useBookWrite.ts` (flagged), `src/components/nav/items.ts`, `src/components/nav/Icons.tsx` (flagged), `src/app/globals.css` (maybe), `design/mockups.html`, `design/mockups-index.md`, `docs/02-architecture.md`, `test/releases.test.ts` (new), `test/nav-items.test.tsx`, `test/e2e/releases.spec.ts` (new); any test that pins the books tab row (grep `test/` for `books-top`, `Top books`, the books item list).

**Test strategy**

- AC-1 (this part's clauses): `test/e2e/releases.spec.ts` — released-yesterday under *Out now*; next month under that month's heading; *Got it* removes the row without a reload, one `to_read` row stored; Undo restores the row and leaves no `book_status` row; a `read` book never appears; screenshots at 360, 834, 1280 (light and dark). The dashboard line's counts: TASK-100.
- AC-2: `test/releases.test.ts` (TEST database) — `wantedReleases` with today, today + 3 months, NULL, soft-deleted, `to_read`, `read`, and Unlisted fixtures: groups `out`, the month, `none`; the last four absent.
- AC-3: `test/e2e/releases.spec.ts` (row gone without reload, toast *Undo*, row back in its group, no `book_status` row) and `test/releases.test.ts` (the route: POST `to_read` writes one row; DELETE with its `change` leaves none).
- AC-4: `test/nav-items.test.tsx` (item enabled, after Top, current on `/books/releases` in the tab row, rail and sidebar) and the e2e spec at 360, 834, 1280.
- AC-5: manual — the `releases` section exists with phone, 834 and desktop frames and the empty state (`scripts/screen.ps1 releases`); the index row is present.
- AC-6: e2e — axe, contrast in light and dark, *Got it* ≥ 44px at phone width and ≥ 24px wider, accessible name with the title, no horizontal scroll, screenshots at each `ui.viewports` width; vitest — the empty slate's copy and single action, `error.tsx` renders a `role="alert"` line and *Try again*, `loading.tsx` renders skeleton rows.

**Risks / open questions**: e2e specs that pin the books tab row or sidebar list must gain the item. The dev page is empty until F1 is acted on, so the manual walk needs a temporary dev `releases` row, removed afterwards (data left as found).

**Size check**: ~9 source files, over 8, but this is already part 1 of the owner's split, and the two flagged files are one-line changes; kept whole.

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
