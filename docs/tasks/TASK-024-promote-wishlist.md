---
id: TASK-024
title: 1.4d Promote the wishlist into Someday
status: Ready
depends_on: [TASK-007]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
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
