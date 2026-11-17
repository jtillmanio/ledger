---
id: TASK-095
title: 5.1 Shelves (1 of 3) — shelf context columns, creating and reordering shelves, and the shelf queries
status: Done
depends_on: []
size: M
model: opus
autonomy: attended
ui: false
plan_status: approved
planned_at_commit: add550d
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

- [x] AC-1 (roadmap **Check:** lines, verbatim; this part proves their data clauses on the test database: the note's save and isolation, the new shelf's two rows, its Undo and the refused name. TASK-096 proves the reload and the rendering, TASK-097 the add sheet):
**Check (the context part):** a note saves, survives a reload and renders
under its row; a shelf with no description renders no empty line; a note
on one shelf does not appear on another shelf holding the same book.
**Check (the new-shelf part):** *New shelf…* with a new name writes one
`shelves` row and one `shelf_books` row; Undo leaves neither; a name
already in use writes nothing and says why.
- [x] AC-2: Given a book on shelves A and B, when a note is saved on A, then `shelf_books` for (A, book) holds it and (B, book) holds NULL; saving an empty note stores NULL; its undo puts the prior note back. The same for a shelf's description.
- [x] AC-3: Given a new name, creating a shelf with a book writes exactly one `shelves` row (`kind = 'books'`, this user) and one `shelf_books` row at ordinal 1, and its undo deletes both; given a name already in use, the write answers a refusal naming the reason and leaves both tables unchanged.
- [x] AC-4: Given a shelf of four books at ordinals 1–4, moving the 4th to position 2 leaves ordinals 1–4 contiguous in the new order, and its undo restores the original order exactly.
- [x] AC-5: Given a shelf holding, in order, a read book, a soft-deleted book, a DNF book and four unread books, the shelf query's next three unread are the first three unread in shelf order, and its counts leave the soft-deleted book out.
- [x] AC-6: The new and changed routes answer 400 for a malformed body and 404 for a shelf that is missing or not this user's, writing nothing; a request without the passcode cookie gets the gate's answer.

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

- TASK-096 draws on what this part built: `shelfList` / `shelfDetail`, `POST /api/shelves` and its `DELETE` undo, `PATCH /api/shelves/[id]` with `{ undo: change }`, and a move's `to` counting live books → docs/tasks/TASK-096-shelves-pages.md § Context
- TASK-097 wires the `new_shelf` destination into `/api/books` and `/api/books/bulk`: `parseDestination` must refuse an empty name or one past `MAX_FIELD` with a 400 (the write throws on an empty one; schema review), the undo body carries `newShelf`, and both routes answer the `taken` refusal → docs/tasks/TASK-097-new-shelf-from-add-sheet.md § Context
- Candidate decision: a shelf name in use is refused in the write under `addLock`, not by an index (owner's choice at the plan gate; approved for the log at close-out) → docs/review/decisions.md § D-159
- Data model and architecture: the 5.1 columns are built, and `/api/shelves/[id]` is a route → docs/03-data-model.md § 4. Proposed additions (approved at plan); docs/02-architecture.md § 5. Routes and data access (approved at plan)
- `test/schema-additions.test.ts` records the two approved columns in its column list (not in Files likely touched; spec review judged it justified) → not tracked: done in this PR
- Schema review: `DELETE /api/shelves/<id>` removes any bare shelf of yours, not only one made this session; and `shelfNamed` collapses spaces in SQL but doesn't NFKC-fold a stored name → not tracked: accepted as is (a bare shelf holds nothing to lose; no shelf existed before this task, since extract and load write none and the app could make none)
- Review round 1's lock-order and undo-`prior` notes → not tracked: done in this PR (commit 643b5f5)

## Plan

Approved by the owner 2026-11-16, with both columns and the name check in the write (option a, no index).

**Steps**

1. Schema: `shelves.description text` and `shelf_books.note text`, both nullable, no `user_id` (D-91); `npm run db:generate` makes migration 0031 (adds columns only: no down file).
2. Create (`src/db/writes.ts`): `createShelf(userId, name)` makes an empty books shelf (TASK-096's *+ New shelf*); `undoCreateShelf` deletes it only while it has no `shelf_books` row, no description and no follow, else refuses. A `{ kind: "new_shelf", name }` destination in `addBook` and `addBooks` writes the shelf, any new book and its `shelf_books` row (ordinal 1, a paste's lines in order) in one transaction; the entry answers `destination: { kind: "shelf", shelfId }` and `newShelf: true`, and `undoAddBooks` removes the place, then the shelf, by the same rule. The id is `slug(name)`, `-2`, `-3` on a clash, never regenerated. A name already in use is checked in the write under `addLock`: case-insensitive, whitespace collapsed, among this user's books shelves; it writes nothing and answers `taken` with the existing shelf's name.
3. Reorder: `moveOnShelf(userId, shelfId, bookId, to)`, `to` a place among the shelf's live books; a soft-deleted book's row keeps its place among its neighbours; every row renumbered 1…N. Answers `{ shelfId, bookId, before, after }` (full orders); `undoShelfMove` writes `before` back exactly, refusing unless the order is still `after`.
4. Note and description: `saveShelfNote(userId, shelfId, bookId, text)` and `saveShelfDescription(userId, shelfId, text)` as `saveBookNote` (trimmed, empty is NULL), each answering a change its undo puts back unless the text changed since. A note is the placement's, so another shelf's row is untouched.
5. Queries (`src/db/queries.ts`): `shelfList(userId)` (each books shelf's name, description, read/total from `shelf_progress`, follow state, and its next three unread: live, neither read nor DNF, in shelf order) and `shelfDetail(userId, id)` (the shelf and its live books in order, each with status, cover and note).
6. Routes: `POST /api/shelves { name }` (409 with the reason when taken); new `src/app/api/shelves/[id]/route.ts` with `PATCH` `{ description }` | `{ bookId, note }` | `{ bookId, to }` | `{ undo: change }`, and `DELETE` (the create's undo). 400 malformed, 404 a shelf missing or not yours, 409 changed since; inside the passcode gate.
7. Docs: `docs/03-data-model.md` § 4 row 5.1 → Built (migration 0031); `docs/02-architecture.md` § 5 adds `/api/shelves/[id]`.

**Files**

- `src/db/schema.ts`, `drizzle/0031_*.sql`, `drizzle/meta/*` — the two columns.
- `src/db/writes.ts` — create (empty and as an add's destination), reorder, note, description, and their undos.
- `src/db/queries.ts` — `shelfList`, `shelfDetail`.
- `src/app/api/shelves/route.ts` — `POST`.
- `src/app/api/shelves/[id]/route.ts` (new) — `PATCH`, `DELETE`.
- `test/shelves.test.ts` (new).
- `docs/03-data-model.md`, `docs/02-architecture.md` — not in Files likely touched: the built column row and the new route.

**Test strategy** (`test/shelves.test.ts`, TEST database)

- AC-1, AC-3: a new shelf with a book writes one row each, its undo leaves neither; a name in use (another case) writes nothing and says why; through `addBook`/`addBooks` and `POST /api/shelves`.
- AC-2: note on A, B's NULL; empty is NULL; undo puts the prior back; the same for a description.
- AC-4: 4th to 2nd, contiguous, undo exact.
- AC-5: read, soft-deleted, DNF, four unread: the next three and the counts.
- AC-6: 400, 404, 401 and the gate's redirect for both routes, each writing nothing.
- `npm run check:migrations`.

**Risks**: the `Destination` union gains a kind; every switch over it is checked by `tsc`. The add routes don't parse `new_shelf` yet (TASK-097 wires them).

## Review log

_Filled by /implement-task. One line per round._

- Verify R1 PASS (a first try from Git Bash ran vitest from `c:\`, every file "failed to find the runner"; rerun from `C:\`) | CI R1 PASS | rebased on main (#279 Lighthouse switch, #276 deps) | Verify R2 PASS
- Spec R1 APPROVE (minor: an add to an existing shelf took no shelf lock) | Schema R1 APPROVE (5 minor: a lock-order deadlock in the add's undo, an undo's `prior` uncapped, `new_shelf` name validation for TASK-097, two accepted as is) → fixed in 643b5f5 | Verify R3 PASS | Spec R2 APPROVE | Schema R2 APPROVE
- Audit R1 PASS (46 of 46 shelf tests fail against the pre-task code; every AC proven)

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 3 (all PASS; R2 after the rebase, R3 after the review fixes)
- Review rounds: 2 (spec and schema each APPROVE twice)
- First-pass AC FAILs: 0
- Plan revisions after approval: 0 (the review fixes stayed inside the plan's files; `test/schema-additions.test.ts` gained two rows, see Follow-ups)
