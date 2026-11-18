---
id: TASK-122
title: 5.17b Own it from Search and By hand (1 of 2) — the writes, the paste check and the sync's refusal
status: Draft
depends_on: [TASK-094]
size: M
model: opus
autonomy: attended
ui: false
plan_status: none
planned_at_commit:
---

# TASK-122 — 5.17b Own it from Search and By hand (1 of 2) — the writes, the paste check and the sync's refusal

## Goal

One book added to *Physical copy* or *Audiobook* records that you own it, whether it was already in your library or not, and its Undo removes exactly what the add wrote. A paste says which books you already own before it counts them.

## Context

- Roadmap: `docs/05-roadmap.md` § 5.17b (its **Check** is AC-1, verbatim; still *proposed*: the owner agrees it by merging or edits it first). `docs/06-tasklist.md` M17. From TASK-094 (5.17, PR #268): the owner gave *Physical copy* and *Audiobook* to *Paste a list* only, and this entry brings them to *Search* and *By hand*.
- **Why two tasks.** The entry is S, but it spans the data, the API and the UI, over more than eight files. This part is the data and API (every write, the paste check, the undo's refusal); TASK-123 is the screens and the mockup.
- The writes, in `src/db/writes.ts`: `addBook` throws on the owned destination today ("an owned format is a paste's destination only"); `addBooks` and `writeDestination`'s owned branch are what the paste uses (a row once; a book that has the format keeps its row and it isn't the paste's). The undo is `undoOwned` (deletes only the rows the add wrote), reached through `undoAddBooks` from `DELETE /api/books`. `addBook` should go through the same owned branch.
- `POST /api/books` (`src/app/api/books/route.ts`) parses its destination with `parseDestination(..., { release: true, newShelf: true })`; it accepts `{ owned }` by passing `owned: true` (`src/lib/book-add.ts`), as the undo already does.
- The status rule (D-152, `.claude/rules/schema.md` *What you own*): a library book gets its `owned_copies` row whatever its status, which no add changes; a Hardcover result or a typed book the library lacks is created at `unlisted` with its row.
- The paste check: `bookMatches` (`src/db/queries.ts`, through `POST /api/books/bulk`'s dry run) answers each line's match; `src/lib/book-review.ts` builds the review (its `MARKS`, its `count`). Today a paste to *Physical copy* counts a book that already has the row, and the toast then counts fewer (spec review, PR #268). `bookMatches` answers the formats a matched book already owns; the review says *Already owned on paper* (or *Already own the audiobook*) and *Add N books* counts only the rows it will write.
- While there, `undoInside` (`src/db/writes.ts`; the undo of an add to Someday, On deck, a year or quarter, or a shelf) deletes a book the add created. If 4.4's sync has linked that book to Calibre since (`calibre_id` set), deleting it would make the sync skip it for good (schema review, PR #268). It refuses, as `undoOwned` does, and the route answers 409.
- Tests to extend: `test/add-book.test.ts`, `test/books-bulk.test.ts`, `test/owned-copies.test.ts`, `test/book-review.test.ts`.
- Decisions: D-121, D-132, D-152 (what you own), D-83, D-86 (Unlisted), D-133 (the sync), D-90 (the ebook is `calibre_id`).

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves, on the test database, the writes behind each clause: the library book's one row and no status change, the two `unlisted` creations, each undo, the paste's *already owned*, the 409. TASK-123 proves the same through the screens, with the screenshots): (proposed; the owner agrees it by merging or edits it first) with *Physical copy* chosen, Search's *Add to Physical copy* on a library book with a status writes one `physical` row and changes no status. On a Hardcover result, and on a typed book the library lacks, it creates one `unlisted` book with its row. Undo removes exactly what each add wrote, and leaves a row the book had before. A paste whose matched book already has the row counts it as already owned. Undoing an add to Someday whose created book has since gained a `calibre_id` answers 409 and changes nothing. Screenshots at 360px and 1280px.
- [ ] AC-2: `POST /api/books` with `destination: { owned: "physical" }` (and `"audio"`): for a library book with status `to_read`, writes one `owned_copies` row and leaves `book_status` and `reading_plan` as they were; for a Hardcover result and a typed book, creates one `books` row with `book_status.status = 'unlisted'` and one `owned_copies` row. Its answer's undo, sent to `DELETE /api/books`, deletes only those rows (and the created book); for a library book that already had the row, the add writes nothing and the undo deletes nothing.
- [ ] AC-3: `addBook` no longer throws on an owned destination; the error string *an owned format is a paste's destination only* is gone from the source.
- [ ] AC-4: `bookMatches` answers, for each matched book, the formats it owns (`physical`, `audio`; the ebook is not one). Given a paste of three lines to *Physical copy*, one matching a book that already has its `physical` row, one matching a book without it, one new: the review marks the first *Already owned on paper*, its count is 2, and the paste then writes two `owned_copies` rows (and one `unlisted` book), matching the count.
- [ ] AC-5: Given an add to Someday that created a book, then `calibre_id` set on that book, the add's undo through `DELETE /api/books` answers 409 with *Something changed since that add. Nothing was undone.* and the book, its status and its plan row are unchanged. The same for an add to On deck, a quarter and a shelf.

## Out of scope

- The *Add to* chips in Search and By hand, the result's button label, the review's wording on screen and the mockup: TASK-123.
- The ebook: `calibre_id`, never written here (D-90).
- Owning a book from the sheet: 3.5b (TASK-118).
- Writing the owned formats to Calibre: 4.4's sync already does (`#owned`).

## Files likely touched

- `src/db/writes.ts`: `addBook` through `writeDestination`'s owned branch; `undoInside` refuses a book with `calibre_id`
- `src/db/queries.ts`: `bookMatches` answers each match's owned formats
- `src/lib/book-review.ts`: *Already owned on paper* / *the audiobook*, and the count
- `src/app/api/books/route.ts`: `POST` accepts `{ owned }`
- `test/add-book.test.ts`, `test/books-bulk.test.ts`, `test/book-review.test.ts`: AC-2 to AC-5

## Verification

- Automated: the four vitest files above; `npm run test:no-e2e` green.
- Manual: none in this part (the screens are TASK-123).

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
