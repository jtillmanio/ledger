---
id: TASK-024
title: 1.4d Promote the wishlist into Someday
status: In progress
depends_on: [TASK-007]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: 806b039
---

# TASK-024 — 1.4d Promote the wishlist into Someday

## Goal

The roughly 500 lines from the old To-Read tab, which never became books, can be gone through once. Each is matched, fixed or confirmed, then becomes an ordinary Someday book or is dismissed, so nothing is left in a list the app never shows.

## Context

- Roadmap: `docs/05-roadmap.md` § 1.4d Promote the wishlist into Someday. It is not in a sitting: it depends on 1.4 alone, and the **promotion itself is run on production after Step 14's final load** (OWNER-CHECKLIST), because a load truncates `books`. The screen can be built and tested any time after TASK-007. It is placed last here. The roadmap entry and its **Check:** are the contract.
- Data model: `src/db/schema.ts` `wishlist` (lines like `First Law - Joe Abercrombie` with a genre; `book_id` NULL on every line). Accepting creates or reuses the `books` row, writes `book_status = to_read` if the book has no status yet, and sets `wishlist.book_id`, in one transaction per line. Dismissing deletes the line (a hard delete of a staging row the nightly backup still holds; D-39 says so explicitly).
- Design: TASK-007's *Paste a list* review (`src/components/ReviewTable.tsx`), pre-filled, at `/books/add?from=wishlist`: unresolved lines (`book_id IS NULL`) in workbook order, grouped by genre. Each line can be edited before it is accepted.
- Parser: `Title - Author` (plain hyphen) and `Title — Author` both parse, extending TASK-007's `src/lib/book-parse.ts`. A line naming a series rather than a book (*First Law*, *The Warlord Chronicles*) is flagged *series?*.
- Decisions: D-39 (promote, then drop; the table and `wishlist.csv` go in a later `chore/` PR once nothing is left), D-37 (Someday is `to_read` with no plan row), D-25a (≥ 0.4 is a near-duplicate).
- After the promotion: once the screen shows nothing left, a follow-up `chore/` PR drops `wishlist` (with its down file) and extract's `wishlist.csv`. That's not part of this task.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): a fixture of five wishlist lines — one matching an existing book, one a letter off an existing title, one series name, two new — shows one match, one near-duplicate flag, one *series?* flag and two proposed creations, and writes nothing until accepted. Accepting all but the series line creates two books at Someday (`to_read`, no plan row), links all four `wishlist.book_id` values, and leaves an existing book's status untouched. `Title - Author` and `Title — Author` parse the same. A dismissed line is gone from the screen and from the table.
- [ ] AC-2: Lines appear in workbook order, grouped by genre, and only lines with `book_id IS NULL` are listed. An accepted line disappears from the screen and doesn't come back on reload. Editing a line's text re-runs its match before it can be accepted.
- [ ] AC-3: Each accept is its own transaction: a forced failure on one line leaves that line unresolved and every other accepted line committed. With every line resolved or dismissed, the screen shows an empty slate saying nothing is left, with one action back to Add books.
- [ ] AC-4: The wishlist review meets the UX floor (`docs/04-design.md` § 10. The UX floor): empty, loading and error states drawn; flags carry glyph and text; decisions are named `role="radiogroup"`s; *Dismiss* is not red (it removes a staging line, not a book); screenshots at every `ui.viewports` width, light and dark.

## Out of scope

- Running the promotion on production. That is the owner's, after Step 14.
- Dropping `wishlist` and `wishlist.csv` (a later `chore/` PR, D-39).
- Planning promoted books into a quarter or year (2.3).
- Open Library lookups for the promoted books (4.2, or 1.4c's search one at a time).

## Files likely touched

- `src/app/books/add/page.tsx`: the `?from=wishlist` mode.
- `src/lib/book-parse.ts`: the plain-hyphen form and the *series?* flag.
- `src/app/api/books/wishlist/route.ts` (new): list, accept, dismiss.
- `src/db/queries.ts`, `src/db/writes.ts`: unresolved lines; accept (create or reuse, status if none, link) and dismiss.
- `src/components/ReviewTable.tsx`: edit-in-place for a line.
- `test/wishlist.test.ts` (new, DB), `test/book-parse.test.ts`.

## Verification

- Automated: `test/wishlist.test.ts` against `TEST_DATABASE_URL` covers the five-line fixture, nothing written before accept, the two Someday books, four links, the untouched status, dismissal, per-line transactions and the empty slate (AC-1 to AC-3). `test/book-parse.test.ts` covers both separators and *series?* (AC-1).
- Manual: on the development database after `npm run rebuild`, open `/books/add?from=wishlist` → expected: lines grouped by genre in workbook order. Accept one and dismiss one → expected: both gone after a reload, and the accepted book is under *To read*.

## Plan

_Approved by the user at the plan gate, 2026-10-26._

**Steps**

1. `src/lib/book-parse.ts`: add `seriesLike(title)`, a keyword test (Saga, Trilogy, Cycle, Chronicles, Quartet, Series and the like). `Title - Author` and `Title — Author` already parse the same through `normalizeLine`; a test shows it.
2. New `src/lib/wishlist-review.ts` (pure): one row per unresolved line, on 1.4's types. A line is *series?* when `seriesLike` matches or its title equals a `book_series` name: choices *Leave* (default) and *Dismiss*, never written. Match, near-duplicate (≥ 0.4) and new lines get *Link*, *Create new*, *Use that* or *Add*, plus *Dismiss* (not red). A matched book that already has a status is linked and its status left alone.
3. `src/db/queries.ts`: `unresolvedWishlist()` (`book_id IS NULL`, workbook order, i.e. by id) and `seriesNames()`.
4. `src/db/writes.ts`: `acceptWishlist(userId, items)`, one transaction per line (`addLock`, re-check the exact title and author, reuse or `createBooks`, `toRead` which never overwrites, set `wishlist.book_id`); a failing line returns `{ok:false}` and the others stay committed. `dismissWishlist(ids)` hard-deletes unresolved staging lines (D-39).
5. New `src/app/api/books/wishlist/route.ts`: POST `{accept:[…]}` and POST `{dismiss:[ids]}`. The library check is the existing `/api/books/bulk` dry run.
6. UI: `src/app/books/add/page.tsx` handles `?from=wishlist` and renders new `src/components/WishlistReview.tsx` (genre headings, per-row Edit that re-queues the line for Check, one action bar, empty slate with a link back to Add books, error state, the existing `loading.tsx`). `ReviewTable.tsx` gets an optional per-row `extra` slot. `globals.css` only if a style is missing, tokens only.
7. Redraw the wishlist frame in `design/mockups.html` and `design/mockups-index.md` (`ui.redrawFiles`). Tick roadmap 1.4d at close-out.

**Files:** the above, plus `test/wishlist.test.ts` (new, DB), `test/book-parse.test.ts`, `test/wishlist-review.test.ts` (new), a component test for `WishlistReview`. Not on "Files likely touched": `wishlist-review.ts`, `WishlistReview.tsx`, the mockup files.

**Test strategy**

- AC-1: `test/wishlist.test.ts` five-line fixture (one match, one near-duplicate, one series, two new): nothing written before accept; accepting all but the series line creates two `to_read` books with no plan row, links four `wishlist.book_id`, leaves the matched book's status; dismissal removes the line. `test/book-parse.test.ts`: both separators and `seriesLike`.
- AC-2: `test/wishlist.test.ts` workbook order, only `book_id IS NULL`, an accepted line doesn't return; `test/wishlist-review.test.ts` an edited line's match is re-run before it can be accepted.
- AC-3: `test/wishlist.test.ts` a forced failure on one line (a `use` for a missing book) leaves it unresolved and the others committed; the empty slate is in the component test.
- AC-4: the component test (radiogroups, glyph and text, *Dismiss* not red, empty, loading and error); screenshots at every `ui.viewports` width, light and dark, by ui-verifier.

**Risks / open questions**

- `wishlist` has no `user_id`; the screen works on the whole table. No schema change.
- Series detection is a heuristic and will miss some (*Osten Ard*, *Nevernight*): you decide those lines. Accepted at the plan gate.
- Rows with no author (`Classic`, `Non-Euro`) can only be dismissed. Extract is not changed.
- Edits to a line's text live in the browser and are written only on accept; `raw_entry` is never rewritten.

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
