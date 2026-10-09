---
id: TASK-007
title: 1.4 Books bulk entry
status: Draft
depends_on: [TASK-006]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
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
