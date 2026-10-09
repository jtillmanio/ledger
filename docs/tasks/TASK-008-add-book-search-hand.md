---
id: TASK-008
title: 1.4c Add a book by search or by hand, to a destination
status: Ready
depends_on: [TASK-007]
size: L
model: sonnet
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
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

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): adding an Open Library result to the Cosmere shelf creates one `books` row with `open_library_id` and one `shelf_books` row; adding the same book again, from search or by hand with the same title and author, reuses it and says so; a by-hand book with no pages saves with null word count and still lands in Someday (`to_read`, no plan row); an Open Library failure leaves By hand working and writes nothing. (*On deck* is asserted in 1.7 and *Year or quarter…* in 2.3, not here.)
- [ ] AC-2: Search runs on submit, not per keystroke, and lists your library's matches before Open Library's. An Open Library result with a page count saves `word_count = pages × words_per_page` and `word_count_source = 'estimated'`. A by-hand word count is saved as `stated`. By hand requires title and author, and submitting without them shows *Title is required* / *Author is required* under the field, writing nothing.
- [ ] AC-3: Opened from a shelf's *+ Add to shelf*, the sheet's *Add to* shows that shelf, and every result's primary button reads *Add to <shelf name>*. Opened from Add books, it defaults to *Someday*. *On deck* and *Year or quarter…* are `aria-disabled="true"` with a visible reason.
- [ ] AC-4: A by-hand book with no Open Library record renders with the dashed cover outline and *metadata pending* (`data-enrich="pending"`) wherever its row appears. The same treatment applies to an issue created by TASK-005 without Metron data.
- [ ] AC-5: An add pushes one entry onto TASK-001's undo stack (R1-09). **Undo** removes the destination row it wrote (the `shelf_books` row, or the `to_read` status it created) and soft-deletes a book this add created. A reused book, and any status it already had, stay exactly as they were.
- [ ] AC-6: The Add books sheet meets the UX floor (`docs/TASKS.md` § *The UX floor, for every UI task* and § *Focus returns where it came from*): empty, loading, rate-limited and error states for search; labelled inputs; focus on the heading at open and back on the opener at close, by every route; `inert` behind it; targets at least 24px; screenshots at every `ui.viewports` width, light and dark.

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
