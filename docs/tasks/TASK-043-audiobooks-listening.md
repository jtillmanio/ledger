---
id: TASK-043
title: 1.23 Audiobooks: listening, and a listen that counts as a read
status: Review
depends_on: [TASK-010, TASK-039]
size: L
model: opus
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: 0451037
---

# TASK-043 — 1.23 Audiobooks: listening, and a listen that counts as a read

## Goal

You can mark a book as *Listening*, and finishing it counts as a read everywhere reads count, while the Ledger still knows it was a listen: a headphones glyph marks it, its summary says *Read 2× · Listened 1×*, and the year's totals give the listened count beside the total.

## Context

- Roadmap: `docs/05-roadmap.md` § 1.23 Audiobooks: listening, and a listen that counts as a read (M9, sitting 9, after 1.17, last of the five before the entries 1.25 pulls ahead). The roadmap entry and its **Check:** are the contract. "In the browser (0.11)" is the Playwright harness, `test/e2e/` (TASK-013). **Before cutover**, for 1.5's and 1.17's reason: a finish logged without saying it was a listen can't be told apart later.
- *From TASK-041 (1.22, PR #181):* a search result's one tag is `placeTag` in `src/lib/format.ts` (Add books' library rows; the status from `librarySearch`). It knows *Someday* … *Unlisted* but not `listening`, which would show as the raw value: add *Listening* there when the status lands (the 2026-10-31 settlement lists it), beside this task's glyph in search results, and extend `test/add-book-sheet.test.tsx`'s `PLACES`.
- *From TASK-044 (1.27, PR #187):* `src/lib/wishlist-review.ts` is gone, with the rest of 1.4d's wishlist screen (D-111): the old To-Read tab is settled by extract now. Of the status-word maps this task names, `src/components/AddBooks.tsx`, `src/components/BookSearch.tsx` and `src/lib/book-review.ts` are left.
- **Why this is one large task** (`workflow.splitPolicy: never-split`): a migration, a new status meaning, the write path and its undo, two views, and the glyph and summary on several screens land together; a `format` column nothing writes, or a glyph nothing feeds, is half a feature.
- **Schema: stop and ask at plan time** (the entry, CLAUDE.md: a new column and a new status meaning), though the entry, D-85 and `docs/03-data-model.md` § 4.1 (1.23's row) propose it: `read_events.format text NOT NULL DEFAULT 'text'` with a CHECK `IN ('text','audio')`, so every read already logged is `text`; and a `listening` value of `book_status.status`, which has no CHECK (D-86), so only `BOOK_STATUSES` and `SETTABLE_STATUSES` in `src/db/writes.ts` and the route's validation change. Nothing is dropped or retyped, so there is no `drizzle/down/` file; no new table, so `src/db/export-tables.ts` is unchanged (Hard rule 7). No `user_id` on the new column (D-91).
- **After 1.17** (TASK-039): both change `book_status` and `read_events` and `saveBookStatus`. 1.17 stamps `started_on` on *Reading* and copies it into the finish's `read_events` row; this task's migration and write path build on that, and the plan says whether *Listening* stamps a start as *Reading* does.
- Writes: `saveBookStatus` and `undoBookStatus` in `src/db/writes.ts`, through `POST /api/progress/book` (`src/app/api/progress/book/route.ts`). Entering `read` appends a `read_events` row; a second read is a reread (`reread_of`, data model 2.18, D-65). A listen is the same append with `format = 'audio'`. How the write knows a finish was a listen (finishing *from Listening*, or a format chosen at the finish) is the plan's, within the entry's *Finishing from Listening sets `read` and appends … `format = audio`*.
- Views: `etl/views.sql` `book_reads` (every `read_events` row, plus a `read` status with no log row) gains the format, the status-only row reading `text`; `books_by_year` (grouped by year and genre) gains a listened count beside `books`, which still includes listens. `series_progress`, `author_progress` and `universe_progress` count `status = 'read'`, so a finished listen counts with no change; the Check's `series_progress` case proves it. Derived, never stored (Hard rule 2). `etl/test_views.sql` (`npm run test:views`) is where the view cases go.
- Every reader of *Reading* decides about *Listening* (the entry names the screens, not each query): `booksInFlight` (`src/db/queries.ts`, `status = 'reading'`) and `src/app/books/status/page.tsx` (In flight lists *Listening* as its own group after *Reading*); `src/components/BookStatus.tsx` (`STATUSES`, the control offers *Listening* beside *Reading*); the master list's *Reading* chip (`src/app/books/list/page.tsx`); the status-word maps in `src/components/AddBooks.tsx`, `src/components/BookSearch.tsx`, `src/lib/book-review.ts` and `src/lib/wishlist-review.ts`.
- The glyph: a drawn headphones glyph with an `aria-label` (*Listened*, *Listening*). The app's glyphs are vendored Lucide paths in `src/components/nav/Icons.tsx` (`LUCIDE-LICENSE.txt` beside it): Lucide's `headphones` is the natural source. It sits beside the status on the master list, the status screens (`src/components/StatusBookRow.tsx`), search results (1.22's tags in `src/components/BookSearch.tsx`) and the status control. 3.5's book sheet shows the summary later (noted there); 2.2's *2026 so far* and 6.2's charts show the split later (noted there).
- **Settled with the owner, 2026-10-31** (the entry's plan-gate list, plus what the screens raised; the plan builds them, it doesn't reopen them. The schema itself is still the stop and ask above):
  - **Capacity:** a listen runs alongside the year's reading, never against 2.1's word budget. An audiobook budget may come later; nothing here prepares for it beyond the derived listened count.
  - **One in-progress state.** The owner allows that a book could be read and listened to at once, but it is unlikely, so a book is *Reading* or *Listening*, not both. Switching between them moves the book and keeps its 1.17 start; the finish's `format` is the state the book was in when you finished it. *Listening* stamps a start as *Reading* does (1.17).
  - **No length is recorded.** A listen saves its format and its dates, not how many hours the audiobook ran.
  - **The master list's *Reading* chip includes *Listening* books**; there is no separate chip.
  - **The glyph marks any book with at least one listen, or being listened to now**, whatever its other reads. Its accessible name is *Listening* while the book is *Listening*, and *Listened* otherwise.
  - **Reads and listens are counted apart, each shown only when above zero:** *Read N×* counts the `text` reads and *Listened N×* the `audio` ones, so a book read twice and listened to once reads *Read 2× · Listened 1×*, a book only listened to once reads *Listened 1×*, and a book only read once reads *Read 1×*. This goes on the master-list row now and 3.5's book sheet later.
  - **A backfilled read is `text`** (a workbook `read` status with no log row, written into the log when the status leaves `read`): nothing loaded before this task was a listen (D-41, D-87).
- Design: no frame draws the glyph or *Listening* yet. Mockups `blist` (the master list row and the status control), `status` (In flight, Done) and `add` (search results) in `design/mockups.html`; the feel pass's status words (`design/Ledger Feel Review.dc.html`). Standing rule 6: the frames that gain the glyph or the *Listening* group are redrawn in the same PR (`ui.redrawFiles`).
- Decisions: D-85 (a finished audiobook is a read, the log says it was a listen; not chosen: a separate track, or a status that leaves the book unread), D-65 (reads are a log; years count reads), D-21 (the finish year is derived), D-86 (no CHECK on `book_status.status`), D-37 (levels), D-91, R0-C1 (a status change never nulls `rating`). F-58 and B18 in `docs/01-product.md`.

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim):
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
- [x] AC-2: Against the TEST database: a `read_events` row with `format = 'mp3'` violates its CHECK, and an insert naming no format reads back `text`. A migration test seeds two `read_events` rows before the migration and reads both back as `text` after it, their dates and precisions unchanged.
- [x] AC-3: Through `POST /api/progress/book`: *Listening* is accepted; *Reading → Listening* leaves the status `listening` with the start 1.17 stamped unchanged, and finishing it then appends `audio`; finishing a *Listening* book whose `rating` is 4 leaves it 4 (R0-C1) and appends one `audio` row, a second finish from *Listening* appends a second `audio` row whose `reread_of` is the first; finishing from *Reading* still appends `text`. *Undo* of the finish removes the appended row and restores *Listening* (`undoBookStatus`).
- [x] AC-4: On the master list: given a book with two `text` reads and one `audio` read, its row reads *Read 2× · Listened 1×* and shows the glyph named *Listened*; given a book with one `audio` read only, *Listened 1×* with no *Read* part; given a book with one `text` read only, *Read 1×* with no glyph and no *Listened* part; given a book being listened to for the first time, the glyph named *Listening* and no count; given a book with no reads, no count and no glyph. The *Reading* chip lists *Reading* and *Listening* books both. The status control offers *Listening* beside *Reading*.
- [x] AC-5: `etl/test_views.sql`: for a year with one `text` read and one `audio` read of books in the same genre, `books_by_year` gives `books = 2` and a listened count of 1; a status-only `read` with no log row counts as `text`. The view's existing cases pass unchanged.
- [x] AC-6: The books status screen, the master list row and the status control meet the UX floor (`docs/04-design.md` § 10. The UX floor): the glyph is an SVG with `role="img"` and an accessible name (*Listened*, *Listening*), never colour alone, and inherits the text colour at 4.5:1 in both themes; *Listening* is a real option in the control with its name; the In flight screen's *Listening* group has a heading; screenshots at every `ui.viewports` width, light and dark.

## Out of scope

- 2.2's *2026 so far*, 6.2's charts and 2.1's word budget showing or using the split (noted in those entries); this task supplies the derived count only.
- 3.5's book sheet (it shows *Read 2× · Listened 1×* later, noted there).
- Loading listens from the workbook or Calibre: every existing and loaded read is `text` (D-41, D-87).
- Comics: `read_events` rows for placements stay as they are, and a comic has no format.
- An audiobook as a separate edition or catalog row, narrators, or a listen's length (owner, 2026-10-31: not recorded).
- An audiobook word or hours budget (owner, 2026-10-31: maybe later; no roadmap entry yet).
- Being *Reading* and *Listening* at once (owner, 2026-10-31: one in-progress state).
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

- Data model decision 2.22 makes "decisions 2.1–2.21" stale in `CLAUDE.md` and `docs/02-architecture.md` (approved at close-out, owner 2026-11-03) → CLAUDE.md § Ledger (fixed in this PR); docs/02-architecture.md § 3. Data model (fixed in this PR)
- The same range in `docs/05-roadmap.md` line 36 (roadmap prose; a task branch changes only ticks; approved at close-out) → docs/OWNER-CHECKLIST.md § Approvals from follow-ups
- Candidate decision: Reading and Listening are one in-progress state, and a finish's format is the state you finished in; no length recorded (approved at close-out) → docs/review/decisions.md § D-112
- Schema review: the `EXISTS … format = 'audio'` subquery is written out in four queries; a shared fragment would keep them from drifting → not tracked: a shared `sql` fragment counts as a query in `test/query-budget.test.ts` (it took /books/status from 4 to 7), so the copies are deliberate
- Schema review: Listening → To read → Read logs a `text` read → not tracked: the owner's rule (the state you finish in is the format, 2026-10-31), D-112
- UI check: Listening, then To read, keeps the start on `book_status` (shown nowhere) → not tracked: 1.17's rule (To read keeps the start in progress, data model 2.18), not this task's
- UI check: the status control's option buttons are 32–34px tall, under 44px → not tracked: the existing options' size since 1.5, above the 24px floor (UX floor); this task adds one more of the same
- UI check: the dev server on :3143 looped on `HMR hash mismatch` reloads → not tracked: local dev cache (`npm run clean:dev`), not the app

## Plan

Approved 2026-11-03 (owner: "approve"), the schema change with it: `read_events.format text NOT NULL DEFAULT 'text'` with a CHECK `IN ('text','audio')`, and a `listening` value of `book_status.status`.

**Steps**

1. Schema: `format` and its CHECK in `src/db/schema.ts`; `npm run db:generate` writes `drizzle/0021_*.sql` and meta. `load.ps1`/`load.sh` name their columns, so loaded reads take the `text` default.
2. `src/db/writes.ts`: `listening` in `BOOK_STATUSES` and `SETTABLE_STATUSES`. Reading and Listening are one in-progress state: entering either stamps a start (1.17), switching keeps it, a `start` is accepted with either. A finish whose prior status is `listening` appends `format = 'audio'`, any other `text`; a re-date keeps the row's format, a backfill is `text`. Undo is unchanged (it deletes the appended row, restores the prior status).
3. `src/app/api/progress/book/route.ts`: a start with `listening`; the answer carries `format` (the appended read's, or null) so the control's glyph moves at once.
4. `etl/views.sql`: `book_reads` gains `format` (last column; a status-only `read` is `text`); `books_by_year` gains `listened` (last column); `books` still counts every read.
5. `src/db/queries.ts`: `listBooks` gains `reads` (text) and `listens` (audio) from `book_reads`, and `status=reading` matches `listening` too; `booksInFlight` returns both statuses with `status`; `booksUpNext`, `booksDone`, `librarySearch` gain `listened`.
6. `src/lib/format.ts`: `readSummary` (*Read 2× · Listened 1×*, each part only above zero), `listenGlyph` (*Listening* / *Listened* / null), `PLACE` and `bookDates` learn `listening`.
7. Glyph: `Headphones` in `src/components/nav/Icons.tsx` (Lucide paths, inline `<svg role="img" aria-label>`, `currentColor`); `.listen` size in `src/app/globals.css`.
8. UI: `BookStatus.tsx` offers *Listening* after *Reading*, glyph beside the badge, the date line while listening; the master list row's summary line, the *Reading* chip lists both; In flight in headed *Reading* and *Listening* groups, each only when it has books; the glyph in `StatusBookRow`, `PlanQuarter`, `BookSearch`; `AddBooks` and `book-review` status words.
9. Docs: redraw `blist`, `status`, `add` in `design/mockups.html` and `design/mockups-index.md`; `docs/03-data-model.md` (§ 4.1 row, reads are a log) and `.claude/rules/schema.md` (one sentence on `format`; not in Files likely touched).

**Test strategy**

- AC-1 write bullet, AC-2 CHECK and default, AC-3 (route cases), AC-4 query values and the Reading chip: `test/audiobooks.test.ts`.
- AC-2 migration: `test/audiobooks-migration.test.ts` (rolled-back transaction: drop the column, seed two reads, run 0021, both `text`, dates and precisions unchanged).
- AC-1 view bullets, AC-5: `etl/test_views.sql`.
- AC-4 / AC-6 control and glyph: `test/reading-log.test.tsx`; the format helpers: `test/audiobooks.test.tsx`; `test/add-book-sheet.test.tsx` `PLACES`.
- AC-1 browser and In flight bullets, AC-6 (axe, 4.5:1 both themes, screenshots every width): `test/e2e/audiobooks.spec.ts`. `npm run test:db:reset` from zero.

**Risks**: every read row on the master list gains a *Read N×* line (settled by the owner); `listBooks` gains two counts per row over up to 500 rows (index on `read_events`; the query-budget test watches).

**Size**: ~25 files, schema and UI together; `never-split` keeps it whole (Context says why), autonomy attended.

**Revisions after approval**

- `test/e2e/start-dates.spec.ts`: its control check runs axe from the top of the page. The control grew a button (*Listening* wraps *DNF* at 390px), so the scrolled page put a filter chip under the sticky bar and axe's target-size called it obscured. No assertion added or removed.
- The format helpers' unit tests are in `test/audiobooks.test.ts`, not a separate `.tsx` file.
- The `listened` subquery is written out in each query rather than shared: a shared `sql` fragment counts as a query in `test/query-budget.test.ts`.
- Close-out (approved): `CLAUDE.md` and `docs/02-architecture.md` say 2.1–2.22; D-112 recorded.

## Review log

_Filled by /implement-task. One line per round._

- Verify R1 round FAIL(1: query budget, /books/status 7 > 4) → R2 full FAIL(4: start-dates axe target-size at 390px) → R3 e2e (start-dates, audiobooks) PASS | Audit R1 PASS | Spec R1 APPROVE | Schema R1 APPROVE | UI R1 PASS (6 widths, light and dark; dev DB migrated to 0021 with the owner's yes, data left as found)

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 3
- Review rounds: 1
- First-pass AC FAILs: 0
- Plan revisions after approval: 3 (start-dates spec scroll, helper tests' file, inlined subquery)
