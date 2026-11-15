---
id: TASK-095
title: 5.1 Shelves (1 of 3) — shelf context columns, creating and reordering shelves, and the shelf queries
status: Ready
depends_on: []
size: M
model: opus
autonomy: attended
ui: false
plan_status: none
planned_at_commit:
---

# TASK-095 — 5.1 Shelves (1 of 3) — shelf context columns, creating and reordering shelves, and the shelf queries

## Goal

The Ledger can create a book shelf, put a book on a new shelf in one undoable write, reorder a shelf, keep a shelf's description and a note per book on it, and answer each shelf's next three unread books.

## Context

- Roadmap: `docs/05-roadmap.md` § 5.1 Shelves (books only): create, add items, reorder (M17). Pulled ahead of 1.26 whole by the owner (D-139): the Dark Tower reading order is a shelf before `Books.xlsx` freezes (`docs/cutover-parity.md`). Feature F-34 (`docs/01-product.md` § Feature index). Its two **Check:** lines are the contract.
- **Split, 1 of 3** (`workflow.splitPolicy: split`: two columns, writes and routes, two new pages, the nav flag and the add sheet's picker). This part is the data side. TASK-096 draws the Shelves list and a shelf's page; TASK-097 adds *New shelf…* to the add sheet's *Shelf…* picker, and its merge ticks the entry.
- **Two columns, and a stop-and-ask** (CLAUDE.md; `docs/03-data-model.md` § 4. Proposed additions, row 5.1, 8.6): proposed `shelves.description text` and `shelf_books.note text`, both nullable, no `user_id` (D-91). **Stop and ask at plan time** before adding them. `shelf_titles.note` is 8.6's.
- **What exists.** `shelves(id, name, user_id, kind)` and `shelf_books(shelf_id, book_id, ordinal)` (`src/db/schema.ts`), `shelf_follows` and `shelf_progress` (2.2c, D-108), `bookShelves`/`shelfFor` (`src/db/queries.ts`), `GET /api/shelves` (Add books' *Shelf…*, "creating shelves is Phase 5"), and the add's shelf destination in `src/db/writes.ts` (`ownShelf`, `writeDestination`, `undoAddBooks`: a book goes on at the end of the shelf and an Unlisted book stays Unlisted).
- **A name already in use is refused** (the new-shelf part): whether that is a unique index on the user's book-shelf names (a schema change, case-insensitive or not) or a check in the write is the plan's question for the owner, with the stop-and-ask above.
- **New shelf in the same write as the book.** *New shelf…* writes one `shelves` row and the book's `shelf_books` row in one transaction; one Undo removes both, and leaves neither behind (the Check). A shelf id is a slug or generated id, never regenerated once written (as run ids).
- **Reorder** is an authored order, so it is stored, contiguous from 1 like `run_queue` (data model 2.16; `moveQueued` in `src/db/writes.ts` is the pattern), with an undo that puts the exact order back.
- **Next three unread** (design § 14 → Shelves): in shelf order, a live book neither read nor DNF, derived in the query (hard rule 2), never stored. A soft-deleted book is on no shelf's count or list (hard rule 4).
- **A note belongs to the placement on the shelf**, not the book: the same book on two shelves keeps two notes (the Check).
- Data model: `docs/03-data-model.md` § 2. Decisions (2.5e, 2.16), § 4. Proposed additions. Architecture: `docs/02-architecture.md` § 5. Routes and data access. `.claude/rules/schema.md` (shelves are typed, never polymorphic).
- Decisions: D-91, D-108, D-139. Hard rules 2, 3, 4, 5 and 7.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:** lines, verbatim; this part proves their data clauses on the test database: the note's save and isolation, the new shelf's two rows, its Undo and the refused name. TASK-096 proves the reload and the rendering, TASK-097 the add sheet):
**Check (the context part):** a note saves, survives a reload and renders
under its row; a shelf with no description renders no empty line; a note
on one shelf does not appear on another shelf holding the same book.
**Check (the new-shelf part):** *New shelf…* with a new name writes one
`shelves` row and one `shelf_books` row; Undo leaves neither; a name
already in use writes nothing and says why.
- [ ] AC-2: Given a book on shelves A and B, when a note is saved on A, then `shelf_books` for (A, book) holds it and (B, book) holds NULL; saving an empty note stores NULL; its undo puts the prior note back. The same for a shelf's description.
- [ ] AC-3: Given a new name, creating a shelf with a book writes exactly one `shelves` row (`kind = 'books'`, this user) and one `shelf_books` row at ordinal 1, and its undo deletes both; given a name already in use, the write answers a refusal naming the reason and leaves both tables unchanged.
- [ ] AC-4: Given a shelf of four books at ordinals 1–4, moving the 4th to position 2 leaves ordinals 1–4 contiguous in the new order, and its undo restores the original order exactly.
- [ ] AC-5: Given a shelf holding, in order, a read book, a soft-deleted book, a DNF book and four unread books, the shelf query's next three unread are the first three unread in shelf order, and its counts leave the soft-deleted book out.
- [ ] AC-6: The new and changed routes answer 400 for a malformed body and 404 for a shelf that is missing or not this user's, writing nothing; a request without the passcode cookie gets the gate's answer.

## Out of scope

- The Shelves list page, a shelf's page, the nav flag and in-place editing (TASK-096).
- *New shelf…* in the add sheet (TASK-097).
- Deleting or renaming a shelf, beyond what the plan needs for undo.
- Titles shelves and `shelf_titles.note` (8.1, 8.6).
- The follow control on a shelf (2.2c built it) and *In the middle of* (5.12).

## Files likely touched

- `src/db/schema.ts`, `drizzle/<new migration>.sql`, `drizzle/meta/*` — the two columns (as approved).
- `src/db/writes.ts` — create a shelf (with a first book), reorder, note and description writes, and their undos.
- `src/db/queries.ts` — the shelf list (counts, next three unread) and one shelf's rows.
- `src/app/api/shelves/route.ts` — `POST` to create; `src/app/api/shelves/[id]/route.ts` (new; the path is the plan's) — reorder, note, description.
- `test/shelves.test.ts` (new).

## Verification

- Automated: `test/shelves.test.ts` (AC-1's data clauses, AC-2 to AC-6 on `TEST_DATABASE_URL`), `npm run check:migrations`.
- Manual: none (TASK-096 shows it in the browser).

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
