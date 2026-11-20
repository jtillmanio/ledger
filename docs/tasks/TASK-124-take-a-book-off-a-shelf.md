---
id: TASK-124
title: 5.1b Take a book off a shelf
status: Ready
depends_on: [TASK-095, TASK-096]
size: M
model: opus
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
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

- [ ] AC-1 (roadmap **Check:**, verbatim): (proposed; the owner agrees it by merging or edits it first) on the test database, taking the third of five books off a shelf deletes its one `shelf_books` row and leaves the shelf's ordinals 1–4 contiguous; its Undo puts the row back at 3 with its note and the others back where they were; the book, its status, its plan and its place on another shelf are unchanged throughout; an Undo after the shelf has been reordered since answers 409 and changes nothing. In the browser (0.11), the shelf page's `⋯` *Remove from shelf* takes it off with an Undo toast; axe passes; screenshots at 360px and 1280px.
- [ ] AC-2: Taking off a book that isn't on the shelf answers 404 and writes nothing; one on a shelf that doesn't exist answers 404; a malformed body is 400. A soft-deleted book can't be taken off (404), as 5.1's other writes treat it.
- [ ] AC-3: Taking off the only book leaves the shelf with no books (its empty state renders), and the shelf itself still exists; its Undo puts the book back at 1.
- [ ] AC-4: After taking a book off, the Shelves list's *next three unread* for that shelf and its `read / total` no longer count it (`shelf_progress` on the test database), and after Undo they count it again.
- [ ] AC-5: The shelf's page meets the UX floor (`docs/04-design.md` § 10): *Remove from shelf* is a named menu item reachable by keyboard, focus goes to the next row (or the empty state) after removal and back to the restored row after Undo, nothing on `--danger` (removal is not an error), axe, screenshots at 360px and 1280px with the toast shown.

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
