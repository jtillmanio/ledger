---
id: TASK-042
title: 1.24 Wishlist accept promotes an Unlisted book to Someday
status: Review
depends_on: [TASK-029, TASK-024]
size: M
model: opus
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: b9af224
---

# TASK-042 — 1.24 Wishlist accept promotes an Unlisted book to Someday

## Goal

Accepting a wishlist line that names a book you have but haven't put on your list (*Unlisted*) puts it on Someday, as *Add books* does, and the review says so before you apply. A book already on your list keeps its status.

## Context

- Roadmap: `docs/05-roadmap.md` § 1.24 Wishlist accept promotes an Unlisted book to Someday (M9, sitting 9, after 1.22 and before 1.17). The roadmap entry and its **Check:** are the contract. **The Check is proposed** (the entry says so; written from TASK-030's follow-ups, 2026-10-27): AC-1 copies it verbatim as TASK-038 copied 1.19's, and the owner confirms or edits it before the plan. A change to its wording is the owner's.
- *From TASK-029 (1.21) and TASK-030 (1.18):* accepting a wishlist line leaves a book already in the Ledger at its status; since 1.18 creates about 3,200 Calibre books at *Unlisted*, a wishlist line will often name one.
- Today's write: `acceptWishlist` → `acceptLine` in `src/db/writes.ts` calls `toRead(tx, userId, [book])`, an insert with `onConflictDoNothing`, so an existing `unlisted` row stays `unlisted`. *Add books* moves an Unlisted book with `promote(tx, userId, ids)` (an update, `status = 'unlisted'` → `to_read`, task 1.21, D-86), records it in `AddedEntry.promoted`, and `undoAddBooks` puts it back to `unlisted` (an update, never a delete), refusing when the book has moved since. That pair is the pattern to copy.
- Today's copy: `src/lib/wishlist-review.ts` `buildWishlistReview` (pure) writes the in-library row's why: *Already in your library (Unlisted): links this line, and your status stays.* for any status, and *In your library, not on your list yet: links this line and adds it to Someday.* for a book with no status. The Unlisted row needs the second kind of wording.
- **Settled with the owner, 2026-10-31: this task adds an undo of a wishlist accept, and the Check stands as written.** A wishlist accept has no undo today: `POST /api/books/wishlist` (`src/app/api/books/wishlist/route.ts`) answers `{ accepted, dismissed }` and nothing reverses it, and `src/components/WishlistReview.tsx`'s only *Undo* is *Undo edit* on a line's text. Every other add in the app can be undone (`undoAddBooks`, `undoInsert`, `undoBookStatus`), so the wishlist's Apply gets the same, modelled on `undoAddBooks`:
  - Apply's answer carries an undo entry for the lines it accepted: the books it created, the statuses it wrote, the Unlisted books it promoted, and the lines it linked.
  - *Undo* puts each linked line back to unresolved (`wishlist.book_id = NULL`), removes the `to_read` statuses it wrote, puts each promoted book back to `unlisted` (an update, never a delete), and soft-deletes the books it created (Hard rule 4).
  - It refuses, changing nothing, when anything moved in between, as `undoAddBooks` refuses (a promoted book no longer `to_read`, or with a plan row or a read it didn't write; a created book that gained another status, shelf or plan row).
  - Dismissed lines are not brought back: a dismissal is a hard delete of a staging row the nightly backup still holds (D-39), and stays final.
  - The control is the app's existing undo toast (`src/components/Undo.tsx`), shown after Apply.
- No schema change: `book_status.status` has no CHECK (D-86), `unlisted` and `to_read` both exist. No plan row is written (Someday is `to_read` with none, D-37), and the accept's other paths (a new book, a book with a status) are unchanged.
- Design: the wishlist review (`/books/add?from=wishlist`, `wishlist` in `design/mockups-index.md`, not drawn in `design/mockups.html`); its rows are `src/components/ReviewTable.tsx` (`docs/04-design.md` § 11.6 Review tables). The undo toast is the app's existing one, so there is no frame to redraw.
- Decisions: D-39 (the wishlist is staging; accepted lines become books), D-37 (Someday is `to_read` with no plan row), D-83 and D-86 (Unlisted; only an undo or the Calibre import writes it), D-61 (a book is its title and author).

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim): `npm test`: accepting a wishlist line that names an Unlisted book
writes `book_status = to_read` and no plan row, and its undo restores
`unlisted`; a line naming a `read` or `to_read` book leaves the status as it
was; the review row for the Unlisted book says it moves to Someday.
- [x] AC-2: Against the TEST database (`test/wishlist.test.ts`): given an Unlisted book with a rating and a note, accepting a line linked to it (`{ id, use }`) and a line that matches it by title and author (`{ id, title, author }`) each leave `book_status.status = 'to_read'`, the rating and note unchanged, no `reading_plan` row, and `wishlist.book_id` pointing at the book; a book at `reading`, `read` or `dnf` keeps that status, its `finished_on` and its precision byte-for-byte.
- [x] AC-3: The undo (`test/wishlist.test.ts`): given an Apply that accepted three lines (one promoting an Unlisted book, one creating a new book, one linking a `read` book), *Undo* leaves the promoted book `unlisted` with its rating and note, the created book soft-deleted (`deleted_at` set) with no status, the `read` book's status, finish and precision unchanged, and all three lines with `book_id` NULL. Given the promoted book gained a plan row (or became `reading`) after the Apply, the undo answers that it can't, and every row is as it was before the undo.
- [x] AC-4: In the browser (0.11), at 390px: apply a review holding a line for an Unlisted book → the undo toast appears; press *Undo* → the line is back in the review as unresolved, and the book is on the master list's *Unlisted* chip again.
- [x] AC-5: `test/wishlist-review.test.ts`: the in-library row for an Unlisted match reads *In your library, Unlisted: links this line and moves it to Someday.* (or the plan's wording, which must say it moves to Someday), and the row for a `read` or `to_read` match still says your status stays.
- [x] AC-6: The wishlist review meets the UX floor (`docs/04-design.md` § 10. The UX floor) for what this task changes: the Unlisted row's why is text tied to its row (`aria-describedby`), at 4.5:1 in both themes, the undo toast's *Undo* is a real button whose name says what it undoes (*Undo: 3 wishlist lines*), and focus returns to the review after it; screenshots at every `ui.viewports` width, light and dark.

## Out of scope

- Promoting an Unlisted book from a shelf add (a shelf leaves it Unlisted, task 1.21) or from *Paste a list*'s plain add path, which already promotes.
- Placing an accepted line anywhere but Someday (a quarter or On deck from the wishlist).
- Changing how the wishlist is parsed, matched or dismissed (1.4d).
- Showing Calibre books' provenance in the review (1.22's tags).

## Files likely touched

- `src/db/writes.ts`: `acceptLine` promotes an Unlisted book and records it; `acceptWishlist` returns the undo entry; a new `undoAcceptWishlist`, on `undoAddBooks`'s pattern.
- `src/lib/wishlist-review.ts`: the Unlisted row's why.
- `src/app/api/books/wishlist/route.ts`: the answer's undo entry, and the undo request (a `DELETE`, as `/api/books` undoes an add).
- `src/components/WishlistReview.tsx`: the undo toast after Apply.
- `test/wishlist.test.ts`, `test/wishlist-review.test.ts`, `test/wishlist-screen.test.tsx`, `test/e2e/wishlist.spec.ts`.

## Verification

- Automated: `test/wishlist.test.ts` covers AC-1's write and undo, AC-2 and AC-3; `test/wishlist-review.test.ts` covers AC-1's review row and AC-5; `test/e2e/wishlist.spec.ts` covers AC-4 and AC-6 (axe, screenshots), with `test/wishlist-screen.test.tsx`.
- Manual: on `npm run dev`, find an Unlisted book (the master list's *Unlisted* chip), put a wishlist line naming it, open the wishlist review → expected: its row says it moves to Someday. Apply → expected: the book is under *To read* with no plan, and off the *Unlisted* chip. Press *Undo* → expected: the line is back in the review and the book is Unlisted again, leaving the development data as found.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- The undo entry is the client's to send: a forged DELETE could name a bare `to_read` book, or a promoted one, this Apply didn't write (schema-reviewer, minor) → not tracked: the same exposure `/api/books` DELETE (`undoAddBooks`) has had since 1.4c; a single-user app behind the passcode gate, and the undo's guards refuse an entry that no longer matches the database
- The 1.24 roadmap entry still says *The Check below is proposed* → not tracked: the owner settled it 2026-10-31 (this file § Context), and an entry's wording is the owner's; this PR changes only its mark

## Plan

Approved 2026-11-02.

### Steps

1. `src/db/writes.ts`: `acceptLine` writes through `writeDestination(tx, userId, SOMEDAY, [book])` instead of `toRead`, so an Unlisted book is promoted, a book with no status gets `to_read`, and any other status stays. Its ok result says whether it wrote (`added`) or promoted a status. New `WishlistUndo = { lines: [{ id, bookId }], created, added, promoted }`.
2. `src/db/writes.ts`: `undoAcceptWishlist(userId, entry)`, one transaction: `undoInside` with a Someday entry (skipped when the Apply wrote no status and created no book), then each line back to `book_id = NULL` where it still points at its book. Any refusal, or a line that moved, rolls the whole transaction back (a `false` from `undoInside` becomes a throw). Dismissed lines are not brought back (D-39).
3. `src/app/api/books/wishlist/route.ts`: POST also answers `undo`, built from the accepted lines; DELETE takes it back: 400 malformed, 409 refused, `{ ok: true }`.
4. `src/lib/wishlist-review.ts`: an Unlisted match reads *In your library, Unlisted: links this line and moves it to Someday.*; a `read`, `to_read`, `reading` or `dnf` match still says your status stays; a near match on an Unlisted book adds *Use that moves it to Someday.*
5. `src/components/Undo.tsx` (not in Files likely touched; AC-6 needs the button's name): optional `UndoEntry.name`, the Undo button's `aria-label`. The visible text stays *Undo*; every other toast is unchanged.
6. `src/components/WishlistReview.tsx`: Apply merges each chunk's undo entry and raises the toast (*3 wishlist lines accepted*, button *Undo: 3 wishlist lines*; a note when dismissed lines stay dismissed). Undo sends the DELETE, puts the lines back in the review, refreshes, and focuses the review's `h1` (`tabIndex=-1`, there in both states).

**Files**: the six above, plus `test/wishlist.test.ts`, `test/wishlist-review.test.ts`, `test/wishlist-screen.test.tsx`, `test/undo.test.tsx`, `test/e2e/wishlist.spec.ts`.

### Test strategy

- AC-1, AC-2: `test/wishlist.test.ts` § an Unlisted book (task 1.24): `{ id, use }` and `{ id, title, author }` promote with the rating and note kept, no plan row, the line linked; `reading`, `read`, `dnf` keep status, finish and precision.
- AC-1 (undo), AC-3: same file: the three-line undo; refusals for a plan row added and for `reading`, each leaving every row as it was; DELETE 400 and 409.
- AC-1 (review row), AC-5: `test/wishlist-review.test.ts`.
- AC-4, AC-6: `test/wishlist-screen.test.tsx` (inside `UndoProvider`: the toast's named button, the merged entry sent, lines back, focus on the `h1`, a failed undo); `test/undo.test.tsx` (`name` names the button); `test/e2e/wishlist.spec.ts` (every width and theme: the Unlisted row's why, `aria-describedby`, axe, contrast, screenshot; once at 390px light: Apply → toast → *Undo: 1 wishlist line* → line unresolved, book on the *Unlisted* list).

**Risks**: 10 files, over the 8-file size check; `splitPolicy` is `never-split` and the task is already attended, the extra files being tests and `Undo.tsx`. A re-accepted line whose created book was soft-deleted gets a `-x2` id, as `undoAddBooks` does today.

## Review log

Verify R1 round PASS → full PASS (vitest 1121, Playwright core 664) | Audit R1 PASS | Spec R1 APPROVE | Schema R1 APPROVE (4 minor: a cap test added; client-supplied entry → Follow-ups) | UI R1 PASS (read-only on the development data; Apply → Undo proven in e2e on TEST) | Verify R2 round PASS (cap and long-id tests) | R2 reviewers not re-run: the only change was a test, which no reviewer's verdict depended on

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 2 (R1 round + full, R2 round)
- Review rounds: 1
- First-pass AC FAILs: 0
- Plan revisions after approval: 0
