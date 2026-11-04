---
id: TASK-047
title: 2.2e Library: its own page, sorted as well as filtered
status: In progress
depends_on: []
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: edbae5b
---

# TASK-047 — 2.2e Library: its own page, sorted as well as filtered

## Goal

The books master list becomes the *Library*: a page of its own with its own nav item, which you can sort by series, title, author, length, published year, finish date or plan order as well as filter. The sort stays in the URL, so a reload or a shared link keeps it.

## Context

- Roadmap: `docs/05-roadmap.md` § 2.2e Library: its own page, sorted as well as filtered (M10, after 2.0 and 2.1; owner intake 2026-11-02, D-110). The roadmap entry and its **Check:** are the contract; its Check was proposed at the intake and agreed by the owner on 2026-11-04, when these task files were written. Features: F-70. "In the browser (0.11)" is the Playwright harness, `test/e2e/` (TASK-013).
- **Before 2.2, or with it**: 2.2 (TASK-049) makes `/books` the dashboard and points the *Books* switch at it, so the list needs its own nav item first. 2.2e is not one of the entries 1.25 pulls ahead of cutover, but 2.2 depends on it, so it lands before 2.2 does.
- **Size:** the task list says S; by the sizing rules it is M (the query and the screen are two layers, and it touches more than three files, the mockup redraw included).
- **Its name is Library.** The heading (`src/app/books/list/page.tsx`'s `<h1>Books</h1>`), the nav item, and every link and line that names the list say *Library*: `src/app/books/status/page.tsx` (*Opens the master list.*), `src/components/AddBooks.tsx` (after a shelf add), and the empty slates that link to `/books/list`. A new `books-library` item in the books section of `src/components/nav/items.ts`, enabled now. The *Books* media switch keeps `href: "/books/list"` until 2.2 changes it. The icon is the plan's: `library` is taken by *Shelves* (hue identifies data, never navigation; icons are neutral).
- **Ask at the plan gate:** the route's name. The entry proposes it stays at `/books/list` (ui.md's list screen one level down); a rename moves `scripts/perf/routes.mjs`, the filter links, `AFTER_ADD` in `src/components/PasteBooks.tsx` and the e2e specs with it. Also *Recently added*: it needs `books.added_at`, which doesn't exist; 2.10b proposes it, and whichever task is built first asks (a new column is a stop-and-ask, CLAUDE.md). Without it, that order is not offered.
- **Sort is SQL in `listBooks`** (`src/db/queries.ts`, today `ORDER BY s.name NULLS LAST, b.series_position NULLS LAST, b.title LIMIT 500`), never a sort in the app; the 500-row cap applies after the order, and the match count (`total`) is unchanged by it. The orders: *Series* (default, today's), *Title* A–Z, *Author* (name, then title), *Length* longest first (an estimated count sorts by its estimate and keeps 2.2b's `~` mark), *Published* newest first, *Finished* most recent first (a book with no finish comes last under any filter), *Plan order* on *To read* (quarters in order and by ordinal, then bare years, On deck, Someday; D-37, through `to_read_level` and `plan_period`, never by parsing `period`). Each reverses (↑ ↓). NULLs last in either direction (`.claude/rules/schema.md`: anything sorting by a finish date puts NULLs last).
- **In the URL** (`?sort=length&dir=asc`): it combines with every filter and the search, and survives a reload. Today each filter chip's `href` is a fixed `/books/list?status=…` that drops the other parameters, and `BookListSearch` replaces `?q=`; the plan says how the chips and the box carry `sort` and `dir` (a chip that drops the sort fails the Check). A query-string link stays `prefetch={false}` (`test/no-prefetched-filters.test.ts`).
- **The control:** *Sort* beside the filters: a `<select>` on the phone, in the filter rail from 1024px (1.8's desktop filter rail, `docs/04-design.md` § 11.8).
- **Not drawn yet.** The mockup's `blist` (`design/mockups.html`; `design/mockups-index.md`) gains the *Sort* control and the *Library* name at phone, tablet and desktop widths before it is built: the plan draws those frames first and the owner sees them at the plan gate (standing rule 6, `ui.redrawFiles`).
- This absorbs 6.10's *sort by word count*; 6.10 keeps the rest.
- Decisions: D-110 (the Library, its own page, sorted), D-37, D-84 (search as you type), D-83 and D-86 (*Everything* leaves Unlisted out; a sort changes no filter).

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): `npm test`: `listBooks` with `sort=length` returns the
longest book first and a book with no word count last, and `dir=asc` reverses
the order with the empty one still last; `sort=title` with `status=read` keeps
only read books; `sort=plan` on *To read* lists 2027 Q1's books by ordinal
before 2027 Q2's, and Someday's after On deck's. In the browser (0.11),
choosing *Length* updates the URL and the order and survives a reload; the
nav shows *Library* at 768px and 1280px, current on `/books/list`; at 360px the *Books* switch is current there and the page's heading reads *Library*.
Screenshots at 360px and 1280px.
- [ ] AC-2: For each of *Series*, *Title*, *Author*, *Published* and *Finished*, `listBooks` on a fixture with a NULL in that order's key returns the fixture's rows in the stated order with the NULL row last, and with `dir` reversed returns the non-NULL rows reversed and the NULL row still last; an unknown `sort` or `dir` falls back to *Series* in today's order, never a 500.
- [ ] AC-3: Given `?status=to_read&level=quarter&q=the&sort=length`, the page lists exactly the rows the same URL without `sort` lists, in length order, with the same match count; tapping a filter chip or typing in the search box keeps `sort` and `dir` in the URL.
- [ ] AC-4: The page's `<h1>` reads *Library*, the books status screen's *Someday* row and every other link to the list name it *Library*, and no rendered text on any books screen reads *master list*.
- [ ] AC-5: The Library meets the UX floor (`docs/04-design.md` § 10. The UX floor): the *Sort* control is a real `<select>` (phone) or a set of real controls (rail) with an accessible name *Sort*, and the reverse control says which way it sorts in its name; nothing interactive is under 24px; text 4.5:1 in both themes; its existing loading state still matches the loaded geometry; screenshots at every `ui.viewports` width, light and dark.

## Out of scope

- *Recently added* unless `books.added_at` is approved at this plan gate (otherwise 2.10b asks).
- The rest of 6.10 (saved views, the other list refinements), *Pick one for me* and *Fits Q2* (`docs/04-design.md` § 14 → Master list).
- The books dashboard at `/books` and the *Books* switch's new target (2.2, TASK-049).
- A row menu, *Follow.* and the follow sheet (2.2c, TASK-048).
- Any change to which rows a filter returns.

## Files likely touched

- `src/db/queries.ts` — `listBooks` takes `sort` and `dir`; the ORDER BY per sort.
- `src/app/books/list/page.tsx` — *Library*, the sort parameters through every chip, the control.
- `src/components/BookSort.tsx` (new) — the select and the rail's control.
- `src/components/BookListSearch.tsx` — keeps `sort` and `dir` when it replaces `?q=`.
- `src/components/nav/items.ts` — `books-library`.
- `src/app/books/status/page.tsx`, `src/components/AddBooks.tsx` — *Library* in copy.
- `design/mockups.html`, `design/mockups-index.md` — `blist` gains *Sort* and *Library* (redrawn first).
- `test/queries.test.ts` (or a new `test/library-sort.test.ts`), `test/nav-items.test.tsx`, `test/e2e/library-sort.spec.ts` (new).

## Verification

- Automated: the `listBooks` sort cases (AC-1, AC-2, AC-3's count) against the TEST database; `test/nav-items.test.tsx` (the item, enabled); `test/no-prefetched-filters.test.ts` still passing; `test/e2e/library-sort.spec.ts` (choose *Length*, URL and order, reload, a chip keeps the sort, nav current at 360/768/1280, axe, screenshots).
- Manual: `npm run dev`, open the Library, choose *Length* → the longest book is first and the URL reads `?sort=length`; tap *To read* → still sorted by length; reload → unchanged.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- 2.2: once `/books` is the dashboard, the phone reaches the Library only from it (the phone bar lists no medium items), so the dashboard needs a Library link → docs/tasks/TASK-049-books-dashboard.md § Context (approved at plan)
- The sticky desktop filter rail (search, chips and Sort in a right column from 1024px, the mockup's `blist` desktop frame) is not built; it goes with 6.10's saved views → docs/05-roadmap.md § 6.10 (approved at plan)
- Candidate decision: the Library's Sort sits inline beside the status filters at every width (the rail is 6.10's); plan order is year by year as Up next (a year's quarters by ordinal, then its bare-year books, then the next year, On deck, Someday); the phone reaches the Library through *Books* until 2.2 → docs/review/decisions.md (approved at plan; ID from next-id.ps1 at close-out)

## Plan

_Written by /plan-batch or /implement-task Phase 1. Approved by the user (plan_status: approved) before any code is written._

Approved 2026-11-04. Owner's answers at the gate: keep `/books/list`; Sort inline at every width (no desktop rail; 6.10); plan order year by year as Up next; amend the Check's 360px part (below). *Recently added* stays out (2.10b asks about `books.added_at`). The `blist` frames were redrawn first (commit edbae5b).

**Steps**

1. `src/lib/library-sort.ts` (new): `SORTS` — `series` (default, asc), `title` (asc), `author` (asc), `length` (desc), `published` (desc), `finished` (desc), `plan` (asc) — each with its option name and the label each direction shows (*A–Z* / *Z–A*, *Longest first* / *Shortest first*, *Newest first* / *Oldest first*, *Most recent first* / *Oldest first*, *First to last* / *Last to first*). `parseSort(sort, dir)`: an unknown `sort` or an unknown `dir` falls back to Series ascending, today's order (AC-2, read literally); a missing `dir` is the sort's default. `libraryHref(params)`: `/books/list?…` with `sort` and `dir` left out when they are the defaults.
2. `listBooks` (`src/db/queries.ts`) takes `sort` and `dir`; the ORDER BY is a whitelisted `sql` fragment per sort (no user text reaches SQL), each `(key IS NULL), key <dir>, tie-breakers <dir>, b.id <dir>`, so NULLs are last either way and a reversal is exact. Series asc is today's order (`s.name NULLS LAST, b.series_position NULLS LAST, b.title`). Author: `a.name`, then title. Length: `b.word_count` (an estimate sorts by its estimate). Published: `b.published_year`. Finished: `st.finished_on`. Plan: `LEFT JOIN to_read_level` only for this sort; key = not to-read last, then year (On deck and Someday after every year), quarter (bare year after its quarters), ordinal, then On deck before Someday, then title. `LIMIT 500` after the order; `total` unchanged. `BookRow` gains `word_count_source`.
3. `src/app/books/list/page.tsx`: `<h1>Library</h1>`; every chip (status, level, year, No year, genre, Everything) and *Show all N series* (`seriesAllHref` in `src/lib/series-list.ts`) built with the current `sort` and `dir`, all `prefetch={false}`; `<BookSort>` at the end of the status chip row; an estimated count prints `~387k`.
4. `src/components/BookSort.tsx` (new, client): `<label>` *Sort* + a native `<select>` (accessible name *Sort*), `router.push(libraryHref(…))` on change, keeping every other parameter (`dir` reset to the new sort's default); beside it the direction `<Link prefetch={false}>` showing the current order (*↓ Longest first*) and named *Longest first; reverse to shortest first*. Token-only CSS in `src/app/globals.css`, nothing under 24px. `BookListSearch` already keeps the other parameters (it reads `window.location.search`): no change, only a test.
5. `src/components/nav/items.ts`: `books-library` (*Library*, `/books/list`, after Status, enabled) with a new neutral `book-copy` icon in `src/components/nav/Icons.tsx`. The *Books* switch keeps `/books/list`.
6. `src/app/books/status/page.tsx`: the Someday row reads *Opens the Library.* (the one rendered *master list*; AddBooks has no copy naming the list).
7. The owner-approved amendment of the Check's 360px part, in `docs/05-roadmap.md` § 2.2e **Check:** and AC-1: "the nav shows *Library* at 768px and 1280px, current on `/books/list`; at 360px the *Books* switch is current there and the page's heading reads *Library*."

**Files:** `src/lib/library-sort.ts` (new), `src/db/queries.ts`, `src/app/books/list/page.tsx`, `src/components/BookSort.tsx` (new), `src/app/globals.css` (not in Files likely touched), `src/lib/series-list.ts` (not listed), `src/components/nav/items.ts`, `src/components/nav/Icons.tsx` (not listed), `src/app/books/status/page.tsx`, `docs/05-roadmap.md` + this task's AC-1 (the amended Check), `design/mockups.html` + `design/mockups-index.md` (done, edbae5b); tests below. `src/components/BookListSearch.tsx` and `src/components/AddBooks.tsx` need no change. More than 8 files: `splitPolicy` is `never-split` and the task is already attended.

**Test strategy**

- AC-1 (`npm test` part), AC-2, AC-3's count: `test/library-sort.test.ts` against TEST — length desc with the uncounted book last, `asc` reversed with it still last; `title` + `status=read` only read books; `plan` on To read: 2027 Q1 by ordinal, then Q2, …, On deck, then Someday; Series, Author, Published, Finished each with a NULL row, both directions; unknown `sort`/`dir` → Series; the same `status=to_read&level=quarter&q=the` with and without `sort` → the same ids and `total`. Title is `NOT NULL` (`books.title`), so AC-2's Title case proves order and reversal only.
- AC-3 (links), AC-4: `test/library-page.test.tsx` renders the page: every chip and *Show all* href keeps `sort`/`dir`; `<h1>` *Library*; the select named *Sort* and the direction link's name; the status page's Someday row says *Library*; no *master list* in either render. `test/series-list.test.ts` (the href carries the sort). `test/no-prefetched-filters.test.ts` learns `libraryHref(`.
- Nav: `test/nav-items.test.tsx` — `books-library` enabled, after Status in the rail and sidebar, current on `/books/list`.
- Browser (AC-1, AC-3, AC-5): `test/e2e/library-sort.spec.ts` — choose *Length*: URL `?sort=length`, the longest first, survives a reload; a chip and the search box keep the sort; nav at 360 (Books current, h1 Library), 768 and 1280 (Library current); the controls ≥24px; axe; screenshots at 360 and 1280 (every `ui.viewports` width, light and dark, through e2e:full and ui-verifier).
- AC-5's loading state: the Sort sits in the first chip row, so `ListSkeleton`'s geometry is unchanged; `test/loading-states.test.tsx` stays green.

**Risks:** postgres.js fragment nesting for the ORDER BY; e2e specs that pin the old `<h1>Books</h1>` text.

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
