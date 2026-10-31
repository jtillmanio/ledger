---
id: TASK-043
title: 1.23 Audiobooks: listening, and a listen that counts as a read
status: Draft
depends_on: [TASK-010, TASK-039]
size: L
model: opus
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-043 — 1.23 Audiobooks: listening, and a listen that counts as a read

## Goal

You can mark a book as *Listening*, and finishing it counts as a read everywhere reads count, while the Ledger still knows it was a listen: a headphones glyph marks it, its summary says *Read 2× · Listened 1×*, and the year's totals give the listened count beside the total.

## Context

- Roadmap: `docs/05-roadmap.md` § 1.23 Audiobooks: listening, and a listen that counts as a read (M9, sitting 9, after 1.17, last of the five before the entries 1.25 pulls ahead). The roadmap entry and its **Check:** are the contract. "In the browser (0.11)" is the Playwright harness, `test/e2e/` (TASK-013). **Before cutover**, for 1.5's and 1.17's reason: a finish logged without saying it was a listen can't be told apart later.
- **Why this is one large task** (`workflow.splitPolicy: never-split`): a migration, a new status meaning, the write path and its undo, two views, and the glyph and summary on several screens land together; a `format` column nothing writes, or a glyph nothing feeds, is half a feature.
- **Schema: stop and ask at plan time** (the entry, CLAUDE.md: a new column and a new status meaning), though the entry, D-85 and `docs/03-data-model.md` § 4.1 (1.23's row) propose it: `read_events.format text NOT NULL DEFAULT 'text'` with a CHECK `IN ('text','audio')`, so every read already logged is `text`; and a `listening` value of `book_status.status`, which has no CHECK (D-86), so only `BOOK_STATUSES` and `SETTABLE_STATUSES` in `src/db/writes.ts` and the route's validation change. Nothing is dropped or retyped, so there is no `drizzle/down/` file; no new table, so `src/db/export-tables.ts` is unchanged (Hard rule 7). No `user_id` on the new column (D-91).
- **After 1.17** (TASK-039): both change `book_status` and `read_events` and `saveBookStatus`. 1.17 stamps `started_on` on *Reading* and copies it into the finish's `read_events` row; this task's migration and write path build on that, and the plan says whether *Listening* stamps a start as *Reading* does.
- Writes: `saveBookStatus` and `undoBookStatus` in `src/db/writes.ts`, through `POST /api/progress/book` (`src/app/api/progress/book/route.ts`). Entering `read` appends a `read_events` row; a second read is a reread (`reread_of`, data model 2.18, D-65). A listen is the same append with `format = 'audio'`. How the write knows a finish was a listen (finishing *from Listening*, or a format chosen at the finish) is the plan's, within the entry's *Finishing from Listening sets `read` and appends … `format = audio`*.
- Views: `etl/views.sql` `book_reads` (every `read_events` row, plus a `read` status with no log row) gains the format, the status-only row reading `text`; `books_by_year` (grouped by year and genre) gains a listened count beside `books`, which still includes listens. `series_progress`, `author_progress` and `universe_progress` count `status = 'read'`, so a finished listen counts with no change; the Check's `series_progress` case proves it. Derived, never stored (Hard rule 2). `etl/test_views.sql` (`npm run test:views`) is where the view cases go.
- Every reader of *Reading* decides about *Listening* (the entry names the screens, not each query): `booksInFlight` (`src/db/queries.ts`, `status = 'reading'`) and `src/app/books/status/page.tsx` (In flight lists *Listening* as its own group after *Reading*); `src/components/BookStatus.tsx` (`STATUSES`, the control offers *Listening* beside *Reading*); the master list's *Reading* chip (`src/app/books/list/page.tsx`); the status-word maps in `src/components/AddBooks.tsx`, `src/components/BookSearch.tsx`, `src/lib/book-review.ts` and `src/lib/wishlist-review.ts`.
- The glyph: a drawn headphones glyph with an `aria-label` (*Listened*, *Listening*). The app's glyphs are vendored Lucide paths in `src/components/nav/Icons.tsx` (`LUCIDE-LICENSE.txt` beside it): Lucide's `headphones` is the natural source. It sits beside the status on the master list, the status screens (`src/components/StatusBookRow.tsx`), search results (1.22's tags in `src/components/BookSearch.tsx`) and the status control. 3.5's book sheet shows the summary later (noted there); 2.2's *2026 so far* and 6.2's charts show the split later (noted there).
- **To settle at the plan gate** (the entry's own list, plus what the screens raise; each a question for the owner):
  - Whether a listen counts against the year's reading capacity (2.1's word budget) or runs alongside it.
  - Whether a book can be *Reading* and *Listening* at once when you switch format mid-book (proposed: no, one in-progress state).
  - Whether a listen records its length.
  - Whether the master list's *Reading* chip includes *Listening* books, or *Listening* gets its own chip.
  - Which read the glyph follows on a book read once on the page and later listened to (the latest read, or any listen).
  - Whether a backfilled read (a workbook `read` status with no log row, written into the log when the status leaves `read`) is `text`.
- Design: no frame draws the glyph or *Listening* yet. Mockups `blist` (the master list row and the status control), `status` (In flight, Done) and `add` (search results) in `design/mockups.html`; the feel pass's status words (`design/Ledger Feel Review.dc.html`). Standing rule 6: the frames that gain the glyph or the *Listening* group are redrawn in the same PR (`ui.redrawFiles`).
- Decisions: D-85 (a finished audiobook is a read, the log says it was a listen; not chosen: a separate track, or a status that leaves the book unread), D-65 (reads are a log; years count reads), D-21 (the finish year is derived), D-86 (no CHECK on `book_status.status`), D-37 (levels), D-91, R0-C1 (a status change never nulls `rating`). F-58 and B18 in `docs/01-product.md`.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim):
  - Setting a book to *Listening* and then finishing it writes `read` and one
    `read_events` row with `format = audio`; every read logged before the
    migration is `text`.
  - `series_progress` counts the listened book as read.
  - `books_by_year` returns a total that includes the listen, and a listened
    count of 1.
  - In the browser (0.11), the row shows the headphones glyph with the accessible
    name *Listened*; a book only read on the page shows none; a book with two
    reads and one listen says *Read 2× · Listened 1×*.
  - In flight lists a Listening book under *Listening*, not *Reading*.
  - `npm run test:db:reset` migrates from zero.
- [ ] AC-2: Against the TEST database: a `read_events` row with `format = 'mp3'` violates its CHECK, and an insert naming no format reads back `text`. A migration test seeds two `read_events` rows before the migration and reads both back as `text` after it, their dates and precisions unchanged.
- [ ] AC-3: Through `POST /api/progress/book`: *Listening* is accepted and *Reading → Listening* leaves one in-progress state (or the plan's settled rule); finishing a *Listening* book whose `rating` is 4 leaves it 4 (R0-C1) and appends one `audio` row, a second finish from *Listening* appends a second `audio` row whose `reread_of` is the first; finishing from *Reading* still appends `text`. *Undo* of the finish removes the appended row and restores *Listening* (`undoBookStatus`).
- [ ] AC-4: Given a book with two `text` reads and one `audio` read, its master-list row reads *Read 2× · Listened 1×* and shows the glyph named *Listened*; given a book being listened to, its row shows the glyph named *Listening* and no *Listened* count; given a book with only `text` reads, its row reads as today with no glyph and no *Listened* part. The status control offers *Listening* beside *Reading*.
- [ ] AC-5: `etl/test_views.sql`: for a year with one `text` read and one `audio` read of books in the same genre, `books_by_year` gives `books = 2` and a listened count of 1; a status-only `read` with no log row counts as `text`. The view's existing cases pass unchanged.
- [ ] AC-6: The books status screen, the master list row and the status control meet the UX floor (`docs/04-design.md` § 10. The UX floor): the glyph is an SVG with `role="img"` and an accessible name (*Listened*, *Listening*), never colour alone, and inherits the text colour at 4.5:1 in both themes; *Listening* is a real option in the control with its name; the In flight screen's *Listening* group has a heading; screenshots at every `ui.viewports` width, light and dark.

## Out of scope

- 2.2's *2026 so far*, 6.2's charts and 2.1's word budget showing or using the split (noted in those entries); this task supplies the derived count only.
- 3.5's book sheet (it shows *Read 2× · Listened 1×* later, noted there).
- Loading listens from the workbook or Calibre: every existing and loaded read is `text` (D-41, D-87).
- Comics: `read_events` rows for placements stay as they are, and a comic has no format.
- An audiobook as a separate edition or catalog row, narrators, or a listen's length (unless the plan gate decides to record it).
- Start dates themselves (1.17, TASK-039).

## Files likely touched

- `src/db/schema.ts`: `read_events.format` and its CHECK; `drizzle/<tag>.sql` and `drizzle/meta/*` from `npm run db:generate`.
- `src/db/writes.ts`: `BOOK_STATUSES`, `SETTABLE_STATUSES`, `saveBookStatus` (the `audio` append), `undoBookStatus`.
- `src/app/api/progress/book/route.ts`: *Listening* in the request, the format in the answer.
- `etl/views.sql` (`book_reads`, `books_by_year`), `etl/test_views.sql` (AC-1's view bullets, AC-5).
- `src/db/queries.ts`: `listBooks` (the read and listen counts, the glyph's state), `booksInFlight` (the two groups), `librarySearch` (the glyph in search results).
- `src/components/nav/Icons.tsx` (the headphones glyph), `src/components/BookStatus.tsx`, `src/components/StatusBookRow.tsx`, `src/components/BookSearch.tsx`, `src/app/books/list/page.tsx`, `src/app/books/status/page.tsx`, and the status-word maps in `src/components/AddBooks.tsx`, `src/lib/book-review.ts`, `src/lib/wishlist-review.ts`.
- `src/app/globals.css`: the glyph's size and spacing from existing tokens.
- `test/reading-log.test.ts` or a new `test/audiobooks.test.ts` (DB), a migration test beside `test/reading-log-migration.test.ts`, `test/reading-log.test.tsx` (the control), `test/e2e/status.spec.ts` or a new spec (with axe).
- `design/mockups.html`, `design/mockups-index.md`: the `blist`, `status` and `add` frames that gain the glyph or the *Listening* group.
- `docs/03-data-model.md` (1.23's row and the reads-are-a-log decision, with the plan's answers).

## Verification

- Automated: the DB tests cover AC-1's write bullet, AC-2 and AC-3; `etl/test_views.sql` covers AC-1's two view bullets and AC-5; `npm run test:db:reset` from zero; the component tests and the e2e spec cover AC-1's browser and In flight bullets, AC-4 and AC-6 (axe, screenshots).
- Manual: on `npm run dev`, set a to-read book to *Listening* → expected: the glyph named *Listening* on its row, and the book under *Listening* on the books status screen's In flight tab. Finish it → expected: *Read*, the glyph named *Listened*, and the summary with *Listened 1×*. Undo each step, leaving the development data as found.

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
