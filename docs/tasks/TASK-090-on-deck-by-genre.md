---
id: TASK-090
title: 4.5b On deck by genre
status: Review
depends_on: [TASK-088, TASK-089, TASK-017]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: 73c21d9
---

# TASK-090 — 4.5b On deck by genre

## Goal

On deck can be narrowed to one genre and is grouped by genre, so picking the next fantasy (or the next thriller) is a glance, and nothing about On deck's order is stored.

## Context

- Roadmap: `docs/05-roadmap.md` § 4.5b On deck by genre (M16; depends on 4.5 and 1.9). The entry and its **Check:** are the contract; the owner agreed the Check on 2026-11-13 (it was *proposed*), without its clause *a book with no Calibre genre sorts by `books.genre`*, because 4.5 (TASK-089) drops that column before this is built. Feature F-74. Pulled ahead of 1.26 (D-139).
- **Chips and sections** (D-124). Status → *Up next* (`src/app/books/status/page.tsx`, `booksUpNext` in `src/db/queries.ts`; task 1.9, TASK-017) draws the plan by level, On deck last as one group. Its On deck group gains a chip per top-level genre that has an On deck book, and sections by top-level genre (`book_genre_tree` at depth 1). The chip is in the URL. A book in two top-level genres is in both sections and counts once on the tab (`src/components/StatusTabs.tsx`: *one count per tab, the rows that tab draws*).
- **After 4.5's drop** a book with no Calibre genre has no top-level genre (the entry's *`books.genre` for a book with none* no longer exists). **Stop and ask at plan time** where it goes: its own section, or after the sections unheaded; it still counts once.
- **Nothing is stored.** On deck stays unordered (D-37); inside a section, books run by series, then title. The chip writes nothing.
- **The Library's genre chips keep the filter** (D-124): today `libraryHref({ genre: g, ...order })` in `src/app/books/list/page.tsx` drops `status` and `level`, so *To read · On deck* then *Fantasy* loses On deck. A genre chip keeps both (`src/lib/library-sort.ts`).
- Size: the tasklist says S; the status screen, its query, the Library's chips and their tests are four to six files over two layers, so M.
- Design: no mockup frame draws the chips on *Up next*; the `status` frames (`powershell -NoProfile -File scripts/screen.ps1 status`) and `docs/04-design.md` § 11.2 Status screens set the look; `ui.redrawFiles` get the frame in the same PR.
- Decisions: D-37, D-98, D-124, D-139. Hard rules 2 and 6.
- *From TASK-088 (4.5, PR #252):* the top-level genres On deck groups by are `book_genre_levels` at `depth = 1` (`etl/views.sql`), one spelling per genre whatever its case; `listCounts(userId).genres` (`src/db/queries.ts`) already lists them for the Library's chips, most books first, and a book's hue family is `genreHue(genres)` (`src/lib/plan-rail.ts`, D-149).

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim): with On deck books in `Fantasy.Epic Fantasy` and `Sci-Fi`, and one in
both, Status → *Up next* renders a *Fantasy* and a *Sci-Fi* section, the book in
both is in each, and the tab counts it once; the *Fantasy* chip leaves only
*Fantasy*, survives a reload and writes nothing. In the Library, *To read · On
deck* then a genre chip lists only that genre's On deck books. Screenshots at 360px and 1280px.
- [x] AC-2: Given On deck books in `Fantasy.Epic Fantasy` and `Sci-Fi` and one in both, *Up next*'s On deck group draws a *Fantasy* and a *Sci-Fi* section, each listing its books by series then title, the two-genre book in both; the *Up next* tab's count is the number of distinct books it draws.
- [x] AC-3: Choosing the *Fantasy* chip leaves only the *Fantasy* section, puts the genre in the URL, survives a reload, and makes no write request (no `POST`, `PATCH` or `DELETE` in the browser's log) and changes no row.
- [x] AC-4: In the Library, *To read* · *On deck* then a genre chip lists only that genre's On deck books, and the URL keeps `status`, `level` and `genre`.
- [x] AC-5: *Up next*'s genre chips and sections meet the UX floor (`docs/04-design.md` § 10. The UX floor): the chips are real links with names and `aria-current` on the chosen one, 44px on the phone, the row scrolls without a horizontal page scroll at 360px; section headings are headings; genre hues identity only; text 4.5:1 in both themes; axe reports no new violations; screenshots at 360px, 834px and 1280px, light and dark (the Check names 360 and 1280).

## Out of scope

- An order per genre or for On deck (D-124, not chosen).
- Genre chips on quarters, the bare-year lane or Someday.
- How genres are shown and mapped to hues (TASK-088's plan gate).

## Files likely touched

- `src/app/books/status/page.tsx` — the chips and sections in the On deck group.
- `src/db/queries.ts` — On deck books with their top-level genres.
- `src/app/books/list/page.tsx`, `src/lib/library-sort.ts` — the genre chip keeps status and level.
- `design/mockups.html`, `design/mockups-index.md` — the *Up next* frame (`ui.redrawFiles`).
- `test/status.test.ts`, `test/library-sort.test.ts`, `test/e2e/status.spec.ts`.

## Verification

- Automated: `test/status.test.ts` (AC-2's grouping and count), `test/library-sort.test.ts` (AC-4's URL), `test/e2e/status.spec.ts` (AC-1, AC-3, AC-4, axe, screenshots at 360px and 1280px).
- Manual: on the dev database, Status → *Up next* → *Fantasy* chip → only fantasy On deck books; reload → still filtered.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- Roadmap 4.5b's first bullet still says *`books.genre` for a book with none*, a column TASK-089 dropped; roadmap item text isn't edited on a task branch, so it goes to the owner (approved at plan) → docs/OWNER-CHECKLIST.md § Actions from follow-ups.

## Plan

Approved 2026-11-14. Owner's answers at the gate (the recommended ones):
an On deck book with no Calibre genre goes in its own *No genre* section,
last, with no chip, and a chosen genre hides it; sections run most books
first, the chips' order; the task stays whole.

**Steps**

1. **Query** (`src/db/queries.ts` `booksUpNext`): each row gains `genres:
   string[]`, its top-level genres (`TOP_GENRES`, `book_genre_levels` at depth
   1). On deck rows sort by series, position, then title (the Library's series
   order); quarters and year lanes keep their order.
2. **Grouping** (new `src/lib/on-deck.ts`, pure): `deckSections(books, genre?)`
   returns the chips (each top-level genre with an On deck book, most books
   first, ties by name), the sections (a two-genre book in each; *No genre*
   last, with no chip), and the distinct books drawn. A chosen genre is matched
   case-blind; an unknown one draws everything.
3. **Status page** (`src/app/books/status/page.tsx`): reads `?genre=`. The On
   deck group gets a chip row (`.filters genre-row`: 44px on the phone,
   scrolls inside itself): *All*, then one link chip per genre to
   `?tab=next&genre=…`, `aria-current` on the chosen one; an `h3` per section.
   The On deck heading and the *Up next* tab count are the distinct books
   drawn (a two-genre book once; a filtered view counts what it shows). No
   genre hue on chips or headings: grey with text, as the Library's.
4. **Library** (`src/lib/library-sort.ts`, `src/app/books/list/page.tsx`):
   `genreChipHref(current, g)` keeps `status`, `level` and the sort; the genre
   chips use it.
5. **Redraw** the `status` frame in `design/mockups.html` (the books *Up next*
   frame gains the chips and sections) and note it in `design/mockups-index.md`.

**Files**

- `src/db/queries.ts`: On deck rows with their top-level genres, by series.
- `src/lib/on-deck.ts` (new, not in "Files likely touched"): the pure grouping.
- `src/app/books/status/page.tsx`: the chips and sections.
- `src/lib/library-sort.ts`, `src/app/books/list/page.tsx`: the chip keeps the filter.
- `design/mockups.html`, `design/mockups-index.md`: the redraw (`ui.redrawFiles`).
- `src/app/globals.css` only if the section `h3` needs a style (said if so).
- `test/status.test.ts`, `test/library-sort.test.ts`, `test/e2e/status.spec.ts`.

**Test strategy**

- AC-2: `test/status.test.ts`: Fantasy.Epic Fantasy, Sci-Fi and one in both give
  two sections by series then title, the two-genre book in each, a count of 3;
  the *No genre* section last; a filter leaves only Fantasy.
- AC-4: `test/library-sort.test.ts`: `genreChipHref` keeps `status`, `level`, `genre`.
- AC-1, AC-3, AC-4, AC-5: `test/e2e/status.spec.ts`: seeds `book_genres`;
  sections, tab count, chip, reload, no POST/PATCH/DELETE and row counts
  unchanged; the Library's *To read · On deck* then *Fantasy*; axe, 44px chips,
  no sideways page scroll at 360px, contrast; screenshots at 360, 834 and
  1280px, light and dark.

**Risks**

- `TOP_GENRES` reaches the query through `sql.unsafe`; it is a constant.
- The tab count with a filter on counts what is drawn (StatusTabs: *the rows
  that tab draws*).

**Size check**: about 11 files, 3 of them tests and 2 the mandated redraw, no
schema. Kept whole, as the task's own file list does (owner, at the gate).

## Review log

Verify R1 FAIL(1: `genre-drop-migration.test.ts` matched `b.genre` in a sort comparator) → R2 PASS | Audit R1 PASS | Spec R1 APPROVE (note: mockup frame's row order, fixed) | Schema R1 APPROVE | UI R1 NOT RUN (ui-verifier could not sign in to the dev server; the passcode was not handed over) — covered by the new e2e tests with screenshots at 360, 834 and 1280px, light and dark, and the owner's preview walk | CI R1 see PR #259

AC-4's URL test is in `test/library-page.test.tsx` (where `libraryHref` is tested), not `test/library-sort.test.ts` as planned; `test/no-prefetched-filters.test.ts` gained the two new href helpers.

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 2
- Review rounds: 1
- First-pass AC FAILs: 0
- Plan revisions after approval: 0
