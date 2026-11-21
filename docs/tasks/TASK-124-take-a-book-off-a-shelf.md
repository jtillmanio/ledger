---
id: TASK-124
title: 5.1b Take a book off a shelf
status: Review
depends_on: [TASK-095, TASK-096]
size: M
model: opus
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: 7900912
---

# TASK-124 — 5.1b Take a book off a shelf

## Goal

From a shelf's page you can take a book off the shelf, with an Undo. The book stays in your library, on any other shelf, and in your plan, and the rest of the shelf closes up around the gap.

## Context

- Roadmap: `docs/05-roadmap.md` § 5.1b (its **Check** is AC-1, verbatim; still *proposed*: the owner agrees it by merging or edits it first). `docs/06-tasklist.md` M17, after 5.1. Added by the owner on 2026-11-18 for TASK-119 (3.5b part 2), whose *Shelves Edit* needs this write.
- **Why one task across three layers.** The sizing rules would split data, API and UI. Here the route is a thin branch of an existing handler, and the UI is one menu item that `ReorderList` already supports. A write with no screen would have no user until TASK-119, so the parts stay together (seven files). Say so again in the plan; split it at the plan gate if the owner prefers.
- Shelves (5.1, TASK-095 to TASK-097, D-139): `shelves` and `shelf_books(shelf_id, book_id, ordinal, note)` in `src/db/schema.ts`, primary key `(shelf_id, book_id)`, ordinals contiguous from 1. The writes in `src/db/writes.ts`: `createShelf`, `moveOnShelf` / `undoShelfMove` (the pattern to follow for the gap and for the undo's refusal), `saveShelfNote`, `saveShelfDescription`. Adding a book goes through `addBook` with a shelf destination (`POST /api/books`).
- **For the plan gate: Hard rule 4.** `shelf_books` has no `deleted_at`, so taking a book off deletes the row. The roadmap item argues that a shelf placement is the owner's opinion, not a catalog row, like `owned_copies` (whose *not owning* deletes its row) and a plan row (`takeOutOfPlan`). The plan confirms this. Adding a `deleted_at` column instead is a schema change: stop and ask.
- **For the plan gate: the route.** A new `PATCH /api/shelves/{id}` body (`{ bookId, remove: true }`, its undo through the existing `{ undo: change }`), or a `DELETE` that names the book. The existing `DELETE` is *+ New shelf*'s undo and refuses once the shelf has a book, so the plan must keep the two apart.
- The shelf page: `src/app/books/shelves/[id]/page.tsx` draws `src/components/ShelfBooks.tsx` over `ReorderList` (`src/components/ReorderList.tsx`), whose `⋯` has *Move to top · Move up · Move down* "and the *Remove* the caller offers". Toasts with Undo follow `moveOnShelf`'s in `ShelfBooks`.
- `shelf_progress` and the Shelves list's *next three unread* (`ShelfList.tsx`) read `shelf_books`; a removed book leaves both counts.
- Design: `design/mockups.html` `shelves` (a shelf's page). `ui.redrawFiles`: the frame gains the `⋯`'s *Remove from shelf* and its toast before it is built; `design/mockups-index.md` § `shelves` says so. UX floor: `docs/04-design.md` § 10.
- Tests: `test/shelves.test.ts` (5.1's writes), `test/e2e/shelves.spec.ts`.
- Decisions: D-91 (no `user_id` on a new table or column), D-139.

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim): (proposed; the owner agrees it by merging or edits it first) on the test database, taking the third of five books off a shelf deletes its one `shelf_books` row and leaves the shelf's ordinals 1–4 contiguous; its Undo puts the row back at 3 with its note and the others back where they were; the book, its status, its plan and its place on another shelf are unchanged throughout; an Undo after the shelf has been reordered since answers 409 and changes nothing. In the browser (0.11), the shelf page's `⋯` *Remove from shelf* takes it off with an Undo toast; axe passes; screenshots at 360px and 1280px.
- [x] AC-2: Taking off a book that isn't on the shelf answers 404 and writes nothing; one on a shelf that doesn't exist answers 404; a malformed body is 400. A soft-deleted book can't be taken off (404), as 5.1's other writes treat it.
- [x] AC-3: Taking off the only book leaves the shelf with no books (its empty state renders), and the shelf itself still exists; its Undo puts the book back at 1.
- [x] AC-4: After taking a book off, the Shelves list's *next three unread* for that shelf and its `read / total` no longer count it (`shelf_progress` on the test database), and after Undo they count it again.
- [x] AC-5: The shelf's page meets the UX floor (`docs/04-design.md` § 10): *Remove from shelf* is a named menu item reachable by keyboard, focus goes to the next row (or the empty state) after removal and back to the restored row after Undo, nothing on `--danger` (removal is not an error), axe, screenshots at 360px and 1280px with the toast shown.

## Out of scope

- *Shelves Edit* on the book sheet: TASK-119 uses this write.
- Deleting a shelf, or renaming one.
- Moving a book between shelves in one step.
- A `deleted_at` column on `shelf_books` (a stop-and-ask, if the plan gate wants one).

## Files likely touched

- `src/db/writes.ts`: `takeOffShelf` and its undo, closing and reopening the gap
- `src/app/api/shelves/[id]/route.ts`: the remove and its undo
- `src/components/ShelfBooks.tsx`: *Remove from shelf* in the `⋯`, its toast and Undo
- `src/app/globals.css`: only if the empty state after the last removal needs it
- `design/mockups.html`, `design/mockups-index.md`: the `shelves` frame redrawn first
- `test/shelves.test.ts`: AC-1's data clauses, AC-2 to AC-4
- `test/e2e/shelves.spec.ts`: AC-1's browser clause, AC-5

## Verification

- Automated: `test/shelves.test.ts` (the gap, the undo, the 409, the 404s, `shelf_progress`); `test/e2e/shelves.spec.ts` (the menu item, the toast, focus, axe, screenshots).
- Manual: on the Dark Tower shelf at 390px, `⋯` on the third book → *Remove from shelf* → expected: the rows close up and the toast offers Undo; Undo → expected: the book is back third with its note.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- Candidate decision: a shelf placement is deleted, not soft-deleted; Hard rule 4 covers catalog rows, and `shelf_books` is the owner's opinion like `owned_copies` and a plan row → docs/review/decisions.md § D-168 (approved at close-out); its doc update → docs/03-data-model.md § 2.5e (approved at plan)
- schema-reviewer: the removal's undo trusts the client's `bookId`, note and `before`, so a forged payload could put any live book of yours on your own shelf → not tracked: the same trust model as the move and note undos, in a single-user app (accepted at review)
- schema-reviewer: no test re-adds the book to the shelf before its Undo → not tracked: the order check refuses it as a 409, as "an Undo after another book has joined or left since" proves
- ui-verifier: the row menu's items are 36px high on a phone, under the 44px the floor asks of primary phone controls → not tracked: `Menu`'s existing style, the same on every `⋯` (Up next, Listen next, the shelf's moves), not this task's; over the 24px floor
- ui-verifier: a shelf row's `⋯` is named *More for {title}* without the mockup's *position n of N* → not tracked: as built by 5.1 (TASK-096), unchanged here; the new mockup frame draws it as built

## Plan

Approved 2026-11-20 at 7900912.

**Hard rule 4.** Taking a book off deletes its `shelf_books` row (no `deleted_at`): a placement is the owner's opinion, not a catalog row, as `owned_copies` and a plan row. No schema change.

**Route.** `PATCH /api/shelves/{id}` `{ bookId, remove: true }` answers `{ change: { shelfId, bookId, note, before, after } }`; `{ undo: change }` takes it back (the key set tells it from a move's). `DELETE` stays *+ New shelf*'s undo.

**Steps**

1. `src/db/writes.ts`: `takeOffShelf(userId, shelfId, bookId)`: lock the shelf; null (404) unless the book is a live book on it (a soft-deleted one included); read the order, delete the row, renumber the rest 1…N. `undoTakeOffShelf(userId, removal)`: null when the shelf isn't yours; false (409), changing nothing, unless the shelf is exactly in the order the removal left (`after`) and the book is still live; else reinsert the row with its note and set the order back to `before`.
2. `src/app/api/shelves/[id]/route.ts`: parse `{ bookId, remove: true }` and the removal's undo (`after` may be empty; a `before` that isn't `after` with the book is 400); the 400 message names the new body.
3. `src/components/ReorderList.tsx`: `remove.danger?: boolean` (default true, so Up next and Listen next stay red); after a removal focus goes to the next row's `⋯` (the previous row's when it was last, the empty state when none is left), and after its Undo to the restored row's `⋯` (Up next and Listen next gain this too); an optional `empty` slot drawn, in a `tabIndex=-1` wrapper, when no rows are left.
4. `src/components/ShelfBooks.tsx`: *Remove from shelf* (`danger: false`), toast *Removed {title} from {shelf}*, its Undo the change sent back; passes `empty`.
5. `src/app/books/shelves/[id]/page.tsx`: always renders `ShelfBooks`, with the `EmptySlate` as its `empty`, so the list stays mounted when the last book goes and its Undo can bring it back and focus it.
6. `design/mockups.html` § `shelves`: a new phone frame: the `⋯` open on *Wizard and Glass* with *Move to top · Move up · Move down · Remove from shelf* (not red), then the rows closed up with the toast and Undo; a notes bullet. `design/mockups-index.md` § `shelves` says so.

**Files**

- `src/db/writes.ts`, `src/app/api/shelves/[id]/route.ts`, `src/components/ShelfBooks.tsx`, `design/mockups.html`, `design/mockups-index.md`, `test/shelves.test.ts`, `test/e2e/shelves.spec.ts`: as listed in the task.
- `src/components/ReorderList.tsx` (**not listed**): the non-red *Remove*, the focus after a removal and its Undo, the empty slot (AC-5).
- `src/app/books/shelves/[id]/page.tsx` (**not listed**): the empty state moves into `ShelfBooks`'s slot (AC-3, AC-5).
- `src/app/globals.css` is not needed.

**Test strategy**

- AC-1 (data), `test/shelves.test.ts` *taking a book off a shelf (5.1b)*: five books, a note on the third, the third also on Favourites with a status and a plan row: one row gone, ordinals 1–4; book, status, plan and Favourites unchanged; Undo back at 3 with its note; Undo after a reorder 409 and nothing changed.
- AC-2: same file: 404 for a book not on the shelf, a soft-deleted book, a missing, another reader's or a titles shelf; 400 for malformed bodies and an inconsistent undo; a snapshot shows nothing written.
- AC-3: same file: Favourites' only book off; the shelf remains with no books (`shelfDetail` books `[]`); Undo puts it back at 1.
- AC-4: same file: `shelf_progress` and `shelfList`'s `next`, `read`, `total` before, after, after Undo.
- AC-1 (browser) and AC-5, `test/e2e/shelves.spec.ts`: an `ONCE` test by keyboard: `⋯` → *Remove from shelf*, rows close up, toast, database; the item not `--danger`; focus on the next row's `⋯`; Undo puts it third with focus on its `⋯`. A one-book shelf: focus to the empty state, and back after Undo. A `@floor` test: the floor (axe, contrast, nothing red) with the toast shown, screenshots (360px and 1280px among the widths).

**Size.** Nine files, over the eight-file line: kept whole as the task's Context argues (the route is a thin branch, the UI one menu item; the owner approved it whole).

## Review log

_Filled by /implement-task. One line per round._

- Verify R1 PASS (touched specs in w390-light: 39) | CI R1 PASS (7a123ee) | Spec R1 APPROVE | Schema R1 APPROVE | Audit R1 CHANGES (8 PATCH-400 cases NON-DISCRIMINATING) → fixed (b8c1573) → Audit R2 PASS | Verify R2 PASS | CI R2 PASS (b8c1573) | UI R1 NOT RUN (dev DB had no shelves) → UI R2 PASS (throwaway shelves through the app, left as found)
- Spec and schema reviewers not re-run after b8c1573: it changed only one assertion in test/shelves.test.ts (D-97)

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 2
- Review rounds: 1 (spec, schema); audit 2; UI 2 (the first not run)
- First-pass AC FAILs: 0
- Plan revisions after approval: 0
