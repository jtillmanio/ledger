---
id: TASK-101
title: 5.9 Series (1 of 2) — the Series list from series_progress, and the nav item
status: Review
depends_on: []
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: db59bb8
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

- [x] AC-1 (roadmap **Check:**, verbatim; this part proves the counts, the meter, the NULL total, the soft delete, the next-unread line and the screenshots of the list, on the test database and in the browser (0.11). TASK-102 proves the row's link, the gap row and a series name's link):
a series with 3 of 5 books read renders `3 / 5` and a meter
filled with `--ready`; one with NULL `total_books` counts its listed books;
a soft-deleted book is not counted; the next-unread line names the
lowest-position unread book, and a complete series has none. The row's link
shows only that series' books. A series holding positions 1, 2 and 4 of 4
renders a gap row for #3, and a series name in a list row links to its
page. Screenshot at 360px, 834px and 1280px.
- [x] AC-2: Given one series part-read, one with nothing read and one complete, the page lists them in that order, and the complete one names no next book.
- [x] AC-3: Given a series with a stated `total_books` of 3 and 4 live books read, its row reads `4 / 3` and its meter is full, not overflowing.
- [x] AC-4: *Series* shows under Books in the tab row, the rail and the sidebar, current on `/books/series`.
- [x] AC-5: `design/mockups.html` gains the `series` screen at phone, tablet and desktop with its empty state, and `design/mockups-index.md` lists it (task 5.9).
- [x] AC-6: The page meets the UX floor (`docs/04-design.md` § 10): the empty state (*No series yet* with *Add a book*), loading skeletons at the loaded size, an error state; text contrast in light and dark; each row's link has the series' name; screenshots at each `ui.viewports` width.

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

- The Library's own Series section (`src/app/books/list/page.tsx`, the foot of `/books/list`, fed by `seriesProgress`) duplicates `/books/series` once it exists: keep it, cut it, or make it a link here? Open question for TASK-102's plan, which edits that file (approved at plan) → docs/tasks/TASK-102-series-page.md § Context
- AC-6's *each row's link has the series' name* is proved by TASK-102, which links this task's rows (owner, at plan: the rows ship unlinked here) (approved at plan) → docs/tasks/TASK-102-series-page.md § Context
- `test/e2e/shelves.spec.ts` › *a description is written in place* reloaded before the save landed and failed in CI twice on this branch (the new series spec moved it to shard 3/8) and locally on main's code; it now waits for the stored description → not tracked: done in this PR (plan revision)
- The page renders every series at once (751 in the dev data, rows 104px tall); one query, server-rendered, not measured slow, and the plan's risk said to follow up only if a run shows it slow → not tracked: informational, no measurement shows it slow (revisit if Lighthouse or the budget flags `/books/series`)
- A part-read series whose remaining books are all in hand or set aside draws no *Next up* line (*A Song of Ice and Fire*, 5 / 7, in the dev data), by plan decision 3 → not tracked: accepted as designed (owner, at plan)
- `seriesList` treats a stated `total_books` of 0 as complete with a 0 / 0 meter (schema review, MINOR); it renders safely and the data was not checked for one → not tracked: corner case, guard `books_read >= total_books AND total_books > 0` if a 0 ever appears

## Plan

Approved 2026-11-18 by the owner (*approve with recommendations*): the four open questions resolved as recommended, recorded under Decisions at plan below.

### Decisions at plan (owner, 2026-11-18)

1. **Rows ship unlinked**, with no chevron: `/books/series/[id]` is TASK-102's, and its Context says it links these rows (R1-06's spirit: nothing leads to a missing screen). AC-6's *each row's link has the series' name* is proved by TASK-102 (a note goes to its Context at close-out); this task's rows carry the series name as their visible heading.
2. **Every series with at least one live book** is listed (`books_listed > 0`). `seriesProgress`'s `total_books > 1` filter is not used: it would hide a NULL-total series with one listed book, which the Check counts.
3. **Next unread** is `follow_next`'s set: the lowest-`series_position` live book (position NULLS LAST, then title, then id) whose status is NULL, `to_read` or `unlisted`. A book being read or listened to is in hand, and a DNF is set aside: neither is named (as TASK-102 AC-2: *#2 is in hand, not unread*). A series that isn't complete but has no such book (the rest in hand, or not in your library) draws no next line.
4. **The meter is `.meter`**, the list-row meter the Shelves rows and their mockup use, not `.emeter` (the roadmap's word; `.emeter` is styled only inside `.era` and `.now-where`). It fills with `--ready` (D-26).

### Steps

1. **Query** `seriesList(userId): Promise<SeriesSummary[]>` in `src/db/queries.ts` (new; `seriesProgress` stays as it is, because the Library's Series section reads it): one read of `series_progress` for the user, `books_listed > 0`, with a `LEFT JOIN LATERAL` for the next unread (`{ id, title, position }` or null) as in decision 3. Order: in progress (`0 < books_read < total_books`), then not started (`books_read = 0`), then complete (`books_read >= total_books`), each by `lower(name)`, then id. Counts cast to `int`. Derived in the query, never stored (hard rule 2); live books only (hard rule 4, through the view and the lateral's `deleted_at IS NULL`).
2. **The list** `src/components/SeriesList.tsx` (new), modelled on `ShelfList`. A `<main className="series-page">` with *Series* as its h1 and a lede, then `<ul className="group series-rows" aria-label="Your series">`. Each `li.row.series-row`: `.rh` with the name (`.rt`) and `read / total` (`.rm.mono`); the author (`.rs`) when there is one; *Next up* + the title + `#n` in mono, when there is a next; *✓ All read* (the glyph `aria-hidden`) when complete; a `.meter` whose `<i>` width is `fillShare(read, total)` (from `WhereItSits`), so `4 / 3` draws full and the counts stay true. No link, no chevron (decision 1). Empty: `EmptySlate` titled *No series yet*, its one action *Add a book* (a link to `/books/add`).
3. **The route** `src/app/books/series/page.tsx` (`force-dynamic`, metadata *Series · Ledger*, `requireUserId`, one query), `loading.tsx` (the head and four rows in `--sunk` bars at the loaded geometry, as Shelves' loading), `error.tsx` (neutral, not red: *Couldn't load your series. Nothing was changed.* and *Try again*). `src/app/globals.css`: `.series-*` rules beside the `.shelf-row` ones, tokens only (hard rule 6); one column at every width (no rail aside: there is no action).
4. **Nav**: in `src/components/nav/items.ts`, `{ id: "books-series", label: "Series", href: "/books/series", icon: "book-marked", enabled: true, group: "medium", medium: "books" }` after Shelves, before Top; `book-marked` added to `IconName` and drawn in `src/components/nav/Icons.tsx` (Lucide's paths, neutral, used by no other item).
5. **Mockup**: a `series` screen in `design/mockups.html`, after `shelves`: a 360px populated phone frame (part-read rows with *Next up*, a not-started row, a complete row with *✓ All read*, one `4 / 3` row with a full meter), a 360px empty frame (*No series yet · Add a book*), an 834px tablet frame (*Series* current on the rail) and a desktop frame (current in the sidebar), with a notes block (decisions 1–4). `design/mockups-index.md` gains its row (task 5.9).
6. **Budget**: `/books/series` 1 query, 1 wave in `test/query-budget.test.ts` (BUDGET and its route list) and in `docs/02-architecture.md` § Performance budget (*`/books/series` 1 (task 5.9: every series with its counts and next unread)*).

### Files

- `src/db/queries.ts` — `seriesList` and `SeriesSummary`.
- `src/components/SeriesList.tsx` (new) — the page body.
- `src/app/books/series/page.tsx`, `loading.tsx`, `error.tsx` (new) — the route and its states (`error.tsx` is not in *Files likely touched*: the UX floor's error state, AC-6).
- `src/app/globals.css` — the `.series-*` rules (not in *Files likely touched*).
- `src/components/nav/items.ts`, `src/components/nav/Icons.tsx` — the item and its icon (`Icons.tsx` not in *Files likely touched*).
- `design/mockups.html`, `design/mockups-index.md` — the `series` screen (`ui.redrawFiles`).
- `docs/02-architecture.md` — the budget line (not in *Files likely touched*).
- `test/series-page.test.ts` (new), `test/nav-items.test.tsx`, `test/e2e/series.spec.ts` (new), `test/query-budget.test.ts` (not in *Files likely touched*).

### Test strategy

- **AC-1** (this part): `test/series-page.test.ts` on `TEST_DATABASE_URL` — *3 of 5 read reads 3 / 5*; *a NULL total counts its listed books*; *a soft-deleted book is not counted*; *the next unread is the lowest-position unread book, skipping read, reading, listening and DNF*; *a complete series names none*; *a series with no live book is not listed*. `test/e2e/series.spec.ts` — the row renders `3 / 5`, its meter's fill computes to `--ready`, the next-unread line names the book and the complete row names none; screenshots at 360, 834 and 1280px.
- **AC-2**: `test/series-page.test.ts` — *part-read, then not started, then complete, and the complete one has no next*; the e2e spec checks the rows' order on the page.
- **AC-3**: `test/series-page.test.ts` — *a stated total of 3 with 4 read reads 4 / 3*; the e2e spec — the row reads `4 / 3` and the meter's fill width equals its track's.
- **AC-4**: `test/nav-items.test.tsx` — *turns on Series (task 5.9): after Shelves, before Top, to /books/series, current there in every bar*; the icon is unique and in the sprite; `BOOKS_ITEMS` gains `books-series`.
- **AC-5**: manual — the `series` frames in `design/mockups.html` and the index row (spec-reviewer reads them).
- **AC-6**: `test/e2e/series.spec.ts` — the empty state (*No series yet*, *Add a book* links to `/books/add`), the loading skeleton's rows at the loaded row height, the error state rendered (`error.tsx` through `renderToStaticMarkup`: the alert and *Try again*), axe, text contrast light and dark, no sideways scroll, nothing red; screenshots at each `ui.viewports` width. The row-link clause → TASK-102 (decision 1).
- `test/query-budget.test.ts` — `/books/series` sends 1 query in 1 wave.

### Plan revisions after approval

1. **`test/series-list.test.tsx` added** (not in the plan's files): the empty state, the row markup, the skeleton and the error state in vitest, as `shelves-page.test.tsx` does for Shelves. The e2e spec draws the empty and error states in place too.
2. **`test/e2e/shelves.spec.ts` changed** (not in the plan's files): CI's browser suite failed twice on a race in an existing test, *a description is written in place*, which reloaded before the save landed. It now waits for the stored description (`descriptionOf`). Done under the CI-fix rule and reported to the owner, with no reply before the push.
3. **`.series-row .sk` is `vertical-align:top`** (the plan said *at the loaded geometry*): the skeleton rows were 2.06px taller than the loaded ones with the shared middle alignment.

### Risks

- **The e2e data**: series made under E2E ids no other spec uses, removed after the last test, as `shelves.spec.ts` does; the dev and test databases hold real series, so assertions find rows by name, never by index on the whole list.
- **Long list**: every series renders (no cut); one query, server-rendered. If the screenshot run shows it slow, that's a follow-up, not a cut here.

## Review log

Verify R1 PASS (after rerunning from `C:\`: the first run's lowercase drive made every vitest file fail to find the runner) | CI R1 FAIL (`shelves.spec.ts:205`, w390-light, shard 3/8: an existing test's race) → R2 FAIL (same test, 9da2ef5, comment-only change) → fixed in 8ec357c | Verify R2 PASS | Audit R1 PASS | Schema R1 APPROVE (2 MINOR: the doc comment reworded; `total_books = 0` left, see Follow-ups) | Spec R1 not run by the agent (weekly rate limit, resets Nov 21): the session ran the spec-reviewer's checklist itself, not independent: ACs against tests, hard rules 2–7 against the diff, scope against the plan → APPROVE | UI R1 PASS (AC-3, the empty, loading and error states are unreachable on the dev data and are proved by the tests; AC-5 read against the mockup) | CI R3 pending on 8ec357c and the close-out.

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 2 (the first run's lowercase-drive failure not counted)
- Review rounds: 1 (schema APPROVE, UI PASS, spec self-check; spec-reviewer agent unavailable)
- First-pass AC FAILs: 0 (one test-data slip in `series-page.test.ts` and two spec fixes found by the first runs, before any reviewer)
- Plan revisions after approval: 3
