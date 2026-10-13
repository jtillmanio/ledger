---
id: TASK-008
title: 1.4c Add a book by search or by hand, to a destination
status: Done
depends_on: [TASK-007]
size: L
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: 1f3160f
---

# TASK-008 — 1.4c Add a book by search or by hand, to a destination

## Goal

A book can be added from an Open Library search or typed by hand, straight into where it belongs (Someday or a shelf). It's reused if the library already has it, and the button says where it's going (*Add to Someday*).

## Context

- Roadmap: `docs/TASKS.md` § 1.4c Add a book by search or by hand, to a destination (sitting 5, after 1.4). The roadmap entry and its **Check:** are the contract.
- **Why this is one large task** (`workflow.splitPolicy: never-split`): one add sheet with three entry tabs (Search, Paste a list from 1.4, By hand), an Open Library client and a transactional write. It is reached from four places.
- **Destinations arrive in steps.** This task ships **Someday** (the default) and **Shelf…**. 1.7 enables **On deck** and 2.3 enables **Year or quarter…** (R3-08). Here those two are drawn `aria-disabled="true"` with their reason.
- Architecture: `docs/ARCHITECTURE.md` § 2. Decisions — 2.15 (your library first, then Open Library live on submit; create or reuse `books`, plus `authors` / `book_series`, then the destination row, in one transaction) and 2.9 (to-read levels). § 6. Metadata sources (Open Library; `word_count_source = 'estimated'` from pages × `reading_settings.words_per_page`).
- Data model: `src/db/schema.ts` `books` (`open_library_id`, `word_count` / `word_count_source`, `cover_url`), `shelfBooks`, `bookStatus`.
- Design: mockups `add` (search on the left and paste on the right on desktop; *Add to* names the destination; the primary button is *Add to <destination>*) and `shelves` (*+ Add to shelf* opens this sheet with the shelf chosen). Mockup `apistates` (loading, rate-limited and error for Open Library). *Metadata pending*: a dashed `--muted` cover outline and an italic line (`data-enrich="pending"`), per the UX floor. `docs/TASKS.md` § *Focus returns where it came from* (it opens as a sheet).
- Decisions: D-37 (four to-read levels; Someday is `to_read` with no plan row), D-25a (near-duplicate threshold, shared with 1.4), R3-08, D-51 (Open Library for books).
- The sheet opens from Add books, a shelf's *+ Add to shelf*, the plan (when it exists, 2.3) and the master list's *To read* filter, with that destination preselected.
- *From TASK-007 (1.4, PR #76):* *Paste a list* ships as `src/components/PasteBooks.tsx`, alone on `/books/add` (its own `/api/books/bulk`), with an *Add books* link on `/books`. Wrapping it in this sheet's *Search · Paste a list · By hand* control puts the mockup's copy back: the heading *Or paste a list* and the lede's *then Open Library* (`design/mockups-index.md` § Not shown, 15). Its confirm takes Someday only; *Add to* would pass the destination through. `addBooks()` in `src/db/writes.ts` is the create-or-reuse (D-61) to build on.
- *From TASK-007 (1.4, PR #76), open question for the plan:* the paste's confirm pushes nothing onto TASK-001's undo stack. Does AC-5's undo cover *Paste a list* too (remove the `to_read` rows it created and soft-delete the books it created), or only Search and By hand?

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim): adding an Open Library result to the Cosmere shelf creates one `books` row with `open_library_id` and one `shelf_books` row; adding the same book again, from search or by hand with the same title and author, reuses it and says so; a by-hand book with no pages saves with null word count and still lands in Someday (`to_read`, no plan row); an Open Library failure leaves By hand working and writes nothing. (*On deck* is asserted in 1.7 and *Year or quarter…* in 2.3, not here.)
- [x] AC-2: Search runs on submit, not per keystroke, and lists your library's matches before Open Library's. An Open Library result with a page count saves `word_count = pages × words_per_page` and `word_count_source = 'estimated'`. A by-hand word count is saved as `stated`. By hand requires title and author, and submitting without them shows *Title is required* / *Author is required* under the field, writing nothing.
- [x] AC-3: Opened from a shelf's *+ Add to shelf*, the sheet's *Add to* shows that shelf, and every result's primary button reads *Add to <shelf name>*. Opened from Add books, it defaults to *Someday*. *On deck* and *Year or quarter…* are `aria-disabled="true"` with a visible reason.
- [x] AC-4: A by-hand book with no Open Library record renders with the dashed cover outline and *metadata pending* (`data-enrich="pending"`) wherever its row appears. The same treatment applies to an issue created by TASK-005 without Metron data.
- [x] AC-5: An add pushes one entry onto TASK-001's undo stack (R1-09). **Undo** removes the destination row it wrote (the `shelf_books` row, or the `to_read` status it created) and soft-deletes a book this add created. A reused book, and any status it already had, stay exactly as they were.
- [x] AC-6: The Add books sheet meets the UX floor (`docs/TASKS.md` § *The UX floor, for every UI task* and § *Focus returns where it came from*): empty, loading, rate-limited and error states for search; labelled inputs; focus on the heading at open and back on the opener at close, by every route; `inert` behind it; targets at least 24px; screenshots at every `ui.viewports` width, light and dark.

## Out of scope

- *On deck* (1.7) and *Year or quarter…* (2.3) as working destinations, and *Coming out* (5.7).
- The shelves screen itself and creating shelves (Phase 5). The test fixture creates the Cosmere shelf.
- Hardcover, ISBNs and the after-cutover Open Library backfill (4.2). Fetching details for the workbook's books is 1.14.
- The quick-capture inbox (1.4b).

## Files likely touched

- `src/lib/openlibrary.ts` (new): server-only search client.
- `src/app/api/books/search/route.ts` (new) and `src/app/api/books/route.ts` (new, the create-or-reuse plus destination write).
- `src/components/AddBookSheet.tsx` (new): Search, Paste a list (from TASK-007) and By hand, with *Add to*.
- `src/app/books/add/page.tsx`: host the sheet; `src/app/books/page.tsx`: the *To read* entry point.
- `src/db/writes.ts`, `src/db/queries.ts`: create-or-reuse a book with its destination; library search.
- `src/components/Sheet.tsx` (from TASK-002): reused.
- `src/app/globals.css`: result rows, *metadata pending*.
- `test/add-book.test.ts` (new, DB, mocked Open Library), `test/add-book-sheet.test.tsx` (new, happy-dom).

## Verification

- Automated: `test/add-book.test.ts` with a mocked Open Library client: the Cosmere shelf add, reuse from both paths, the by-hand book with no pages, the failure path writing nothing, estimated vs stated word counts, undo of a created and of a reused book (AC-1, AC-2, AC-5). `test/add-book-sheet.test.tsx`: destination preselection, button labels, the disabled destinations with reasons, required-field errors, *metadata pending*, focus return (AC-2, AC-3, AC-4, AC-6).
- Manual: `npm run dev`, *Add books*, search for a known title → expected: results with covers and page counts. Add it to Someday → expected: it shows under *To read*. Add the same title by hand → expected: *already in your library*, nothing new created.

## Follow-ups

- `design/mockups-index.md` § Not shown 15 still described `add` before 1.4c. It is rewritten for the layout as built, noting:
  - the paste lede drops *then Open Library* (owner, plan gate);
  - on the full page the header spans both columns (spec review R2).

  → design/mockups-index.md § Not shown, and why (approved at plan)
- The mockup's secondary *Year or quarter…* button on a result row is left for 2.3, with the chip → docs/TASKS.md § 2.3 (approved at plan)
- 4.3 should know that 1.4c already renders `data-enrich="pending"` on spine rows, the master list and the add sheets' results → docs/TASKS.md § 4.3 (approved at plan)
- Decision: Open Library responses are cached in Postgres like Metron's (D-53), in `open_library_cache`, which is not exported. It amends D-61 (a work id also matches) → docs/review/decisions.md § D-62 (approved at plan)
- Decision: a sheet leaves the undo toast live above it (D-63). This changes the standing *Focus returns* rule → docs/review/decisions.md § D-63, plus the docs/TASKS.md § *Focus returns where it came from* edit (approved at close-out)
- The toast's Undo leaves focus on `<body>` when it unmounts. 1.8b places the toast, and must keep it live over sheets (ui-verifier R2) → docs/tasks/TASK-015-thumb-bar-contrast.md § Context
- `open_library_cache` keeps old search rows forever (schema review) → not tracked: the same as `metron_cache`, the rows are small, and one person searches
- `DELETE /api/books` trusted the ids the client sent (spec review, schema review) → not tracked: done in this PR (plan revision 1: `created` ⊆ `added`, bare `to_read` only, plan rows refuse)
- A React hydration warning on `/books/add` in the first browser walk → not tracked: none in 20 loads in the second walk
- The segmented control (34px) and the *Add to* chips (32px) are under 44px on a phone → not tracked: they meet the UX floor's 24px; the 44px rule is for thumb-bar and icon buttons

## Plan

Approved 2026-10-12 at `1f3160f`. Owner answers at the gate: cache in a new `open_library_cache` table (D-62); Paste a list gets undo and honours *Add to*; *metadata pending* = no external record (books: `open_library_id` and `hardcover_id` null; issues: `metron_id` null); the paste lede stays truthful (*Matched against your library first. You confirm anything ambiguous.*).

**Steps**

0. Schema: `open_library_cache(key text PK, body jsonb NOT NULL, fetched_at timestamptz NOT NULL DEFAULT now())` in `src/db/schema.ts`, generated migration (create only, no down file), `NOT_EXPORTED` in `src/db/export-tables.ts`.
1. `src/lib/openlibrary.ts` (server-only): `search.json` with title, author, first year, `number_of_pages_median`, `cover_i`; answers `ok | rate_limited(retryIn) | error`. Each search cached 7 days; a 429's Retry-After written as the `hold` row and nothing calls while it lasts; a failure writes nothing; User-Agent, 10 s timeout.
2. `src/db/writes.ts`: factor `createBooks(tx, …)` out of `addBooks()` (D-61 ids, authors and series by slug, optional OL facts). `addBook(userId, item, destination)`: one transaction under the add-books lock; reuse a live book with the same `open_library_id` or the same title and author (D-61), else create it (OL: id, cover, year, pages, `word_count = pages × words_per_page` `estimated`; by hand: typed words `stated`, pages-only `estimated`, neither null). Then the destination row: Someday = `book_status to_read` ON CONFLICT DO NOTHING (existing status kept); Shelf = `shelf_books` at max ordinal + 1 (shelf must be the user's, `kind = books`). `addBooks()` takes the destination too. `undoAddBooks(userId, entry)`: delete the destination rows the add wrote (a status only while still `to_read`), soft-delete the books it created; refuses and changes nothing if any of them changed.
3. `src/db/queries.ts`: `librarySearch(userId, q)` (title or author, with status and shelf count), `bookShelves(userId)`, `listBooks` + `open_library_id`/`hardcover_id`/`cover_url`, `runSpine` and `catalogSearch` + `metron_id` for the pending flag.
4. Routes: `POST /api/books/search {q}` (library first, then OL; an OL hit you already have is listed once, as yours); `POST /api/books` (the add) and `DELETE /api/books` (its undo); `/api/books/bulk` passes a destination through and returns what undo needs; `GET /api/shelves` (fetched on tapping *Shelf…*, never on load).
5. UI: `AddBooks.tsx` (*Add to* chips, then *Search · Paste a list · By hand*, real buttons; *On deck* and *Year or quarter…* `aria-disabled` with one visible reason); `BookSearch.tsx` (submit only; loading, rate-limited amber countdown + *Add it by hand*, error grey ×, empty; each result's button *Add to <dest>*); `ByHand.tsx` (title, author required with *Title is required* / *Author is required*; series, position, pages, words optional); `PasteBooks.tsx` loses its h1, heading *Or paste a list*, takes destination and `onDone`, pushes undo. Desktop ≥1024: Search/By hand left, Paste right.
6. Hosts: `/books` *Add books* becomes a button opening `AddBooks` in `Sheet` (focus, inert, Esc, Back); router refresh after an add. `/books/add` is the full page on direct load; `?shelf=<id>` preselects that shelf (the *+ Add to shelf* route until Phase 5).
7. Undo: each add pushes one entry; a reuse that wrote nothing notifies instead (*Already in your library*).
8. *Metadata pending*: `Cover` component, `data-enrich="pending"`, dashed `--muted` outline + italic line, on `/books` rows, sheet results, spine rows and Add issues catalog rows.
9. `src/app/globals.css`: result rows, chip row, cover and pending state (tokens only).

**Files**: `src/db/schema.ts`, `drizzle/00xx_*.sql` + meta *(not in Files likely touched: the cache table)*, `src/db/export-tables.ts` *(new table)*, `src/lib/openlibrary.ts`, `src/db/writes.ts`, `src/db/queries.ts`, `src/app/api/books/search/route.ts`, `src/app/api/books/route.ts`, `src/app/api/books/bulk/route.ts` *(destination + undo)*, `src/app/api/shelves/route.ts` *(new: shelf picker)*, `src/components/AddBooks.tsx` (the task's `AddBookSheet.tsx`), `src/components/BookSearch.tsx`, `src/components/ByHand.tsx`, `src/components/Cover.tsx` *(new)*, `src/components/AddBooksButton.tsx` *(new: the sheet opener)*, `src/components/PasteBooks.tsx`, `src/components/IssueRow.tsx` + `src/components/IssueSearch.tsx` + `src/lib/issue-search.ts` *(AC-4 issues)*, `src/app/books/page.tsx`, `src/app/books/add/page.tsx`, `src/app/globals.css`, `design/mockups-index.md` (follow-up), tests below.

**Test strategy**

- AC-1, AC-2 (word counts), AC-5, cache: `test/add-book.test.ts` (TEST database, `fetch` mocked) — Cosmere shelf add from an OL result; reuse from search and by hand; by hand with no pages lands in Someday with null words; an OL failure writes nothing (no book, no cache row) and by hand still adds; estimated vs stated; undo of a created and of a reused book; Paste a list undo and shelf destination; cache row on success, a 429 hold stops the next call.
- AC-2 (UI), AC-3, AC-4, AC-6: `test/add-book-sheet.test.tsx` (happy-dom) — submit-only search, library before OL, required-field errors writing nothing, destination preselection and button labels, disabled destinations with reason, pending cover on book and issue rows, empty/loading/rate-limited/error states, focus on heading at open and back on the opener by Cancel, Esc, Back and confirm, `inert` behind.
- AC-6 screenshots: ui-verifier at every `ui.viewports` width, light and dark.

**Revision 1** (2026-10-13, after review round 1):

- (a) The layout follows mockup `add` (spec review, D-1): the segmented control first, then *Add to*. Search shows *Or paste a list* under its results (beside them on the full page from 1024px). The search pane's *Done* bar is dropped, since the paste bar's *Cancel* serves. Each column's bar stays in its column on desktop.
- (b) Owner-approved: `src/components/Sheet.tsx` leaves the undo toast out of `inert`. `src/components/Undo.tsx` marks it `data-over-sheet`, and the toast's z-index goes above the sheet's, so an add made in the sheet is undone without closing it (ui-verifier R1). `test/range-sheet.test.tsx`'s inert assertions now exclude the toast.
- (c) The undo is tightened (schema review):
  - it deletes only a bare `to_read` row, with the check repeated in the delete;
  - `created` must be part of `added`;
  - a plan row on a reused book refuses the undo.
- (d) `test/metron-search.test.ts` asserts the Add issues `pending` flag.

**Risks**: `/books` query budget (4) — the sheet asks for nothing on load, shelves only on tap. Twelve-plus files with schema and UI together: kept whole by `never-split`, attended.

## Review log

- Verify R1 PASS | Audit R1 PASS (AC-1 to AC-5 proven; AC-6's screenshots and targets left to the UI walk)
- Review R1: Spec CHANGES (the control must precede *Add to*, per mockup `add`; the Add issues `pending` flag UNTESTED) | Schema APPROVE (5 minor: undo hardening ×3, record D-62, cache pruning) | UI CHANGES (the toast's Undo was inert over the sheet; desktop bars floated; a flaky hydration warning)
- Plan revision 1, then Verify R2 PASS
- Review R2: Spec APPROVE (stale `Sheet` docstring fixed) | UI PASS at 6 viewports, light and dark (the focus after Undo goes to TASK-015)

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 2 (both green: R1 after the build, R2 after review round 1's fixes)
- Review rounds: 2
- First-pass AC FAILs: 2 (AC-5: the toast's Undo couldn't be pressed with the sheet open; AC-4: the Add issues `pending` flag was UNTESTED)
- Plan revisions after approval: 1
