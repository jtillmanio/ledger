---
id: TASK-007
title: 1.4 Books bulk entry
status: In progress
depends_on: [TASK-006]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: b407a1e
---

# TASK-007 — 1.4 Books bulk entry

## Goal

A pasted list of books (`Title — Author`, or `Title (Series #N)`) is matched against the library: books you already have are recognised, near-duplicates are flagged with their closest match, and only the genuinely new ones are created, after you accept them.

## Context

- Roadmap: `docs/TASKS.md` § 1.4 Books bulk entry (sitting 5, first). This is the *Paste a list* path of 1.4c's add sheet. The roadmap entry and its **Check:** are the contract.
- `depends_on` TASK-006 records the build order (sitting 4 before sitting 5), not a data dependency.
- Architecture: `docs/ARCHITECTURE.md` § 2. Decisions — 2.15 (adding ends in a real row: reuse a matching `books` row, else create it, plus `authors` / `book_series` when new). § 4. Interface *Review tables* (the same five-column shape as issues).
- Data model: `src/db/schema.ts` `books`, `authors`, `bookSeries`. The trigram index is `books_title_gin_trgm` in `etl/views.sql`. Only an exact match on title **and** author is the same book.
- Design: mockup `add` (search on the left and paste on the right on desktop). Reuse TASK-005's `ReviewTable` component for the review.
- Decisions: D-25a (near-duplicate means `pg_trgm` `similarity(title, pasted title) >= 0.4`; flagged, never merged without an accept), D-37 (a new book lands in Someday: `to_read`, no plan row), D-41 (no read state comes from the workbook).

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): paste a fixture of 15 lines where 9 exist and 6 don't; assert 6 inserts and 9 matches, zero duplicates. A line one letter off an existing title (similarity ≥ 0.4) is flagged with that match and is not merged.
- [ ] AC-2: `Title — Author`, `Title - Author` and `Title (Series #N) — Author` all parse. The series form creates or reuses a `book_series` row and sets `books.series_position` to N. A line with no author is flagged as needing one and can't be accepted until it has one.
- [ ] AC-3: A flagged near-duplicate shows its closest match and its similarity, and defaults to *create new*. Choosing *use that* creates nothing and points the line at the existing book. Nothing is written until the user confirms, and the confirm runs in one transaction: a forced failure on one line leaves `books`, `authors` and `book_series` unchanged.
- [ ] AC-4: Every created book lands at Someday (`book_status = to_read`, no `reading_plan` row). A matched book that already has a status keeps it.
- [ ] AC-5: The *Paste a list* review meets the UX floor (`docs/TASKS.md` § *The UX floor, for every UI task*): empty, parsing and error states drawn; kind glyphs carry text, not colour alone; decisions are `role="radiogroup"` with names; confirm is `aria-disabled="true"` with its reason while a line needs a choice; screenshots at every `ui.viewports` width, light and dark.

## Out of scope

- Open Library search and the *By hand* form, and destinations other than Someday (1.4c).
- Promoting the 497 `wishlist` lines (1.4d), which reuses this review.
- Merging existing duplicate books in the catalog (1.13's merge review).
- Word counts and covers (1.14, 4.2).

## Files likely touched

- `src/lib/book-parse.ts` (new): the line grammar.
- `src/app/books/add/page.tsx` (new): the *Paste a list* half of Add books.
- `src/app/api/books/bulk/route.ts` (new): the review (dry run) and the confirm.
- `src/db/queries.ts`: exact and trigram matches against `books`.
- `src/db/writes.ts`: the transactional create-or-reuse of `books`, `authors`, `book_series` and `book_status`.
- `src/components/ReviewTable.tsx`: book rows (shared with TASK-005).
- `test/books-bulk.test.ts` (new, DB), `test/book-parse.test.ts` (new).

## Verification

- Automated: `test/books-bulk.test.ts` against `TEST_DATABASE_URL` covers the 15-line fixture (6 inserts, 9 matches, zero duplicates), the one-letter-off flag, *use that*, all-or-nothing, and Someday placement (AC-1, AC-3, AC-4). `test/book-parse.test.ts` covers the three line forms and the missing author (AC-2).
- Manual: `npm run dev`, *Add books → Paste a list*, paste five lines including one typo of an existing title → expected: one near-duplicate flag naming the right book. Confirm → expected: the new books appear under *To read*.

## Plan

Approved by the owner 2026-10-12, with every recommendation below.

**Steps**

1. `src/lib/book-parse.ts` (pure): `Title — Author`, `Title – Author`, `Title - Author` (split on the last spaced separator), `Title (Series #N)` with or without an author. Strips bullets and list numbers; blank lines skipped. No author → flagged; no title → error.
2. `bookId()` in `src/lib/issue-slug.ts`, the twin of extract's `slug(title, author)[:100]` with `-x` while taken; `test/fixtures/book-ids.json` checked by vitest and `etl/test_extract.py` (as D-59).
3. `src/lib/book-review.ts` (pure): an exact title + author match (case-insensitive) is *Skip* when it has a status, *Add* to Someday when it has none; a near-duplicate shows its closest title and `similar 0.91`, *Create new · Use that · Drop*, default *Create new*; a new line *Add · Drop*; no author needs a choice (*Use that* when there is a near match, else *Drop*) or a fixed line; a repeat is skipped (*Also on line N*).
4. `src/db/queries.ts` `bookMatches()`: exact matches among live books, plus the closest title with `title % t AND similarity(...) >= 0.4` (uses `books_title_gin_trgm`). `src/db/writes.ts` `addBooks()`: one transaction under an advisory lock; re-checks the exact match at confirm, creates or reuses `authors` / `book_series` / `books`, `book_status = to_read` `ON CONFLICT DO NOTHING`; no plan row.
5. `src/app/api/books/bulk/route.ts`: POST `dryRun` (writes nothing) or the confirm; validated, at most 500 lines.
6. `src/components/PasteBooks.tsx`: textarea → **Check N lines** (mockup copy) → shared `ReviewTable` → **Add N books**, `aria-disabled` with its reason (*Check 2 new lines first*, *Resolve 1 line to add*); empty slate, checking, neutral error with *Try again*, done line linking *To read*. `/books/add` page and skeleton; *Add books* link on `/books`. `ReviewTable` takes only the row fields it draws.

**Resolved at the gate**

- No *Search · Paste a list · By hand* control or *Add to* chips yet: 1.4c's `AddBookSheet` wraps this component.
- An explicit **Check N lines** button (the mockup), not the comics screen's check-on-pause.
- A matched book with no status gets `to_read` and counts in *Add N books*.
- Exact match folds case only (curly vs straight apostrophes surface as near-duplicates ~0.9); a soft-deleted book is never revived (1.13's merge soft-deletes the loser).

**Files**: the above, plus `src/app/books/add/loading.tsx`, `src/app/books/page.tsx` (link), maybe `src/app/globals.css`, `test/book-parse.test.ts`, `test/book-review.test.ts`, `test/books-bulk.test.ts`, `test/paste-books.test.tsx`, `test/fixtures/book-ids.json`, `etl/test_extract.py`, `docs/TASKS.md` (tick). Outside *Files likely touched*: `book-review.ts`, `PasteBooks.tsx`, `issue-slug.ts`, `loading.tsx`, `books/page.tsx`, `globals.css`, the fixture. More than 8 files, DB and UI together; `splitPolicy` is `never-split`, so the task stays whole and attended.

**Test strategy**

- AC-1: `test/books-bulk.test.ts`: 15 lines → 9 matches, 6 inserts; a second confirm inserts 0; the one-letter-off title is flagged with the right book and similarity ≥ 0.4 and stays a separate book.
- AC-2: `test/book-parse.test.ts` (forms, missing author); DB: series created or reused, position N.
- AC-3: `test/book-review.test.ts` (default *Create new*, *Use that*); DB: *Use that* creates nothing, the dry run writes nothing, a forced failure (test-only trigger) leaves all three tables unchanged.
- AC-4: DB: new books `to_read` with no plan row; a matched `read` book stays `read`.
- AC-5: `test/paste-books.test.tsx` (states, radiogroup names, `aria-disabled` + reason) and ui-verifier screenshots at every `ui.viewports` width, light and dark.

## Follow-ups

- TASK-008's Context: *Paste a list* ships as `PasteBooks` on `/books/add` with no undo; open question for 1.4c's plan whether its AC-5 undo covers the paste. (approved at plan)
- TASK-021's Context: extract's book id rule now has an app twin (`bookId()`) and a shared fixture, `test/fixtures/book-ids.json`; a change to the rule changes both. (approved at plan)
- Candidate decision: the app mints a book id exactly as extract does, matches a book on title + author (case-insensitive) among live books, and never revives a soft-deleted one. (approved at plan)

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
