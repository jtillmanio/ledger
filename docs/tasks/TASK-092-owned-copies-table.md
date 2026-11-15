---
id: TASK-092
title: 5.17 What you own (1 of 3) — the owned_copies table, its write and undo, and the Owned filter's query
status: Review
depends_on: [TASK-047, TASK-029, TASK-043]
size: M
model: opus
autonomy: attended
ui: false
plan_status: approved
planned_at_commit: 8d31c4a
---

# TASK-092 — 5.17 What you own (1 of 3) — the owned_copies table, its write and undo, and the Owned filter's query

## Goal

The Ledger can record that you own a book on paper, as an audiobook, both or neither, undo that, export it, and list the books you own in each format (the ebook side read from Calibre).

## Context

- Roadmap: `docs/05-roadmap.md` § 5.17 What you own: physical copies and audiobooks (M17; tasklist depends on 2.2e, 1.4, 1.21; 3.5 for the sheet). The entry's *Amended 2026-11-08 (D-132)* half wins where the older bullets disagree: both formats, `owned_copies` replacing `physical_copies`. Its **Check:** is the contract; it is still marked *proposed*, and the owner agrees it by merging or edits it first. Feature F-73 (`docs/01-product.md` § Feature index; intake B34, B41). Pulled ahead of 1.26 (D-132), and built before 4.4, which writes these formats to Calibre's `#owned` (D-133; TASK-081 returns them).
- **Split, 1 of 3** (`workflow.splitPolicy: split`: a new table, a route, the Library's menu, filter and sub-line, and *Paste a list*'s destinations). This part is the data side: the table, the toggle's write and undo through a route, the export, and `listBooks`'s owned filter. TASK-093 draws the toggles, the sub-line and the *Owned* filter in the Library; TASK-094 adds the *Paste a list* destinations, and its merge ticks the entry.
- **A new table, and a stop-and-ask** (CLAUDE.md; `docs/03-data-model.md` § 4. Proposed additions, row 5.17): proposed `owned_copies(book_id → books.id, format)`, primary key both, `format IN ('physical', 'audio')`, no `user_id` (D-91, hard rule 3: a fact about your copy, not a column on `books`), in `src/db/export-tables.ts` (hard rule 7). **Stop and ask at plan time** for the table as proposed, and which export list it joins (it has no `user_id`, as `plan_acceptance` hasn't). A book can have neither, either or both, whatever its status: owning an audiobook is not listening to it (1.23, D-132). It touches no status, plan or capacity.
- **Ebook is derived, never stored** (D-90, D-121, hard rule 2): a book is an ebook you own when `books.calibre_id` is set. *Not owned* is a book with none of the three.
- **The write.** One toggle is one write with an undo, as the follow toggle is (`src/app/api/follows/route.ts`: `null` deletes, the undo posts the prior state back). Removing an owned format deletes its row: `owned_copies` is a fact, not a catalog row, so soft delete (hard rule 4) is about the book: a soft-deleted book is in no owned filter, and writes to one are refused.
- **The filter's query.** `listBooks` (`src/db/queries.ts`) gains an `owned` option (`physical`, `audio`, `ebook`, `none`; the URL names are TASK-093's, `?owned=physical` per the entry) that combines with every other option and sort (D-110), and each row carries its owned formats for TASK-093's sub-line. **Ask at plan time:** whether an owned filter shows Unlisted books (today only the *Unlisted* chip and a search do, D-83), since a paste to *Physical copy* creates Unlisted books (TASK-094) that the physical library would otherwise hide.
- **Loads.** `owned_copies` references `books`, so `etl/load.ps1` / `load.sh` truncate it through `CASCADE` like every table that references a book (CLAUDE.md § Non-obvious rules); extract writes nothing to it.
- Data model: `docs/03-data-model.md` § 2. Decisions (2.1, hard rule 3), § 4. Proposed additions. Architecture: `docs/02-architecture.md` § 5. Routes and data access.
- Decisions: D-83, D-90, D-91, D-110, D-121, D-132, D-133. Hard rules 2, 3, 4, 5 and 7.

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim; this part proves, on the test database: each toggle's one row and its Undo, the export test, and the four filters' membership through `listBooks`, a book with several in each, a soft-deleted book in none, each combined with a status filter and a sort. TASK-093 proves the toggles in the browser, the reload and the screenshots; TASK-094 the paste): (proposed; the owner agrees it by merging or edits it first)
each toggle writes one `owned_copies` row with its format, Undo removes
it, and the export test passes with the table. *Physical* lists only books
with a `physical` row, *Audiobook* only books with an `audio` row, *Ebook*
only books with a `calibre_id`, and *Not owned* only books with none of
the three; a book with several is in each; a soft-deleted book is in none;
each combines with a status filter and a sort, and the choice survives a
reload. Pasting three lines to *Physical copy*, two matched and one new,
writes three rows and one `unlisted` book, and Undo removes all of it.
Screenshots at 360px and 1280px.
- [x] AC-2: Given a book with no owned row, when the route is posted `physical`, then `owned_copies` holds exactly one row `(book, 'physical')`; posting `physical` again leaves one row; posting the undo leaves none. The same for `audio`, and a book holding both keeps the other row when one is undone.
- [x] AC-3: The route answers 400 for a format other than `physical` or `audio` and 404 for a missing or soft-deleted book, and writes nothing in either case; a request without the passcode cookie gets the gate's answer and writes nothing.
- [x] AC-4: `owned_copies` has no `user_id` column, is listed in `src/db/export-tables.ts`, and `GET /api/export` returns its rows (`test/export-tables.test.ts`).
- [x] AC-5: Given four fixture books (one physical, one audio and with a `calibre_id`, one with all three, one with none) and a fifth soft-deleted with a `physical` row, `listBooks({ owned })` returns exactly the books the Check names for each of the four values, and `listBooks({ owned: 'physical', status: 'read', sort: 'title' })` returns only the read physical books in title order.

## Out of scope

- The row menu toggles, the sub-line and the *Owned* chips (TASK-093).
- *Paste a list*'s *Physical copy* and audiobook destinations (TASK-094).
- 3.5's book sheet line and toggle (TASK-079, whichever lands second draws it).
- Writing `#owned` to Calibre (4.4, TASK-081, TASK-082).
- Recording a format (paperback, hardcover) or comics' *Collected* (5.10, which stays separate).

## Files likely touched

- `src/db/schema.ts`, `drizzle/<new migration>.sql`, `drizzle/meta/*` — `owned_copies` (as approved).
- `src/db/export-tables.ts` — the table.
- `src/db/writes.ts` — the owned toggle and its undo.
- `src/app/api/owned/route.ts` (new; the path is the plan's) — the write, inside the gate.
- `src/db/queries.ts` — `listBooks`'s `owned` option and each row's owned formats.
- `test/owned-copies.test.ts` (new), `test/export-tables.test.ts`.

## Verification

- Automated: `test/owned-copies.test.ts` (AC-1's data clauses, AC-2, AC-3, AC-5 on `TEST_DATABASE_URL`), `test/export-tables.test.ts` (AC-4), `npm run check:migrations`.
- Manual: none (TASK-093 shows it in the browser).

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- Data model § 4.1 row 5.17 marked Built (migration 0028, TASK-092) (approved at plan) → docs/03-data-model.md § 4.1 By task (fixed in this PR)
- Candidate decision: the Owned filter's Physical, Audiobook and Ebook list Unlisted books, Not owned doesn't (owner, at the plan gate) (approved at plan) → docs/review/decisions.md § D-152
- TASK-093 note: the route contract, `listBooks`'s `owned` option, the row's `owned` field and the Unlisted rule (approved at plan) → docs/tasks/TASK-093-owned-in-the-library.md § Context
- TASK-094 note: the paste writes its rows inside `addBooks`'s transaction (`setOwned` opens its own) and its undo deletes only the rows it wrote (approved at plan) → docs/tasks/TASK-094-paste-owned-copies.md § Context
- `.claude/rules/schema.md` bullet for `owned_copies`, and the Unlisted sentence names the owned filters (approved at plan) → .claude/rules/schema.md § What you own is a fact about your copy
- Schema review (minor): `setOwned`'s `prior` comes from a read before the write, so two concurrent toggles of one book and format could answer a stale `prior`; the table stays right (primary key, `ON CONFLICT DO NOTHING`) → not tracked: single-user app, so two toggles of one row at once is not a real case; the reviewer marked it optional

## Plan

Approved by the owner 2026-11-15. At the plan gate the owner approved the table as proposed (D-132's shape, no other columns, in `CATALOG_TABLES`) and chose: an owned filter of `physical`, `audio` or `ebook` lists Unlisted books (as a search does); `none` leaves them out (as *Everything* does).

**Steps**

1. Tests first: `test/owned-copies.test.ts` (new), extend `test/export-tables.test.ts` and `test/comics-load.test.ts`; confirm they fail.
2. `src/db/schema.ts`: `ownedCopies` — `book_id text NOT NULL → books.id ON DELETE CASCADE`, `format text NOT NULL CHECK IN ('physical','audio')`, PK `(book_id, format)`, no `user_id`. `npm run db:generate` → `drizzle/0028_owned_copies.sql` + meta; `npm run test:db:reset`.
3. `src/db/export-tables.ts`: `owned_copies` in `CATALOG_TABLES`.
4. `src/db/writes.ts`: `setOwned(bookId, format, owned)` — one transaction: the book must be live, else `null`; then insert `ON CONFLICT DO NOTHING` or delete that row; answers the prior boolean for the undo.
5. `src/app/api/books/owned/route.ts` (new): `POST { bookId, format, owned: boolean }` → `{ ok, prior }`; the undo posts `owned: prior`. 400 bad format / missing id / non-boolean `owned`; 404 missing or soft-deleted book; 401 without a session. Inside the passcode gate.
6. `src/db/queries.ts` `listBooks`: `owned?: 'physical' | 'audio' | 'ebook' | 'none'` (Ebook = `calibre_id IS NOT NULL`; Not owned = none of the three); physical/audio/ebook bring Unlisted in, `none` doesn't; combines with every filter and sort. `BookRow.owned: ('physical'|'audio'|'ebook')[]`, in that order.
7. `docs/03-data-model.md` § 4.1 row 5.17 → Built (migration 0028, TASK-092).

**Files**: `src/db/schema.ts`, `drizzle/0028_owned_copies.sql`, `drizzle/meta/*`, `src/db/export-tables.ts`, `src/db/writes.ts`, `src/app/api/books/owned/route.ts` (new), `src/db/queries.ts`, `test/owned-copies.test.ts` (new), `test/export-tables.test.ts`, `test/comics-load.test.ts` (not in Files likely touched: its every-table check), `docs/03-data-model.md` (not in Files likely touched: the § 4.1 row).

**Test strategy**

- AC-2: `test/owned-copies.test.ts` › the toggle — one row per format, idempotent repost, undo leaves none, the other format survives an undo.
- AC-3: same file › refusals — 400 (`ebook`, `paper`, missing bookId) and 404 (missing, soft-deleted), table unchanged; 401 without a session, nothing written; the proxy matcher gates `/api/books/owned` and redirects a cookieless request.
- AC-4: `test/export-tables.test.ts` — no `user_id`, in `CATALOG_TABLES`, `GET /api/export` returns the seeded rows.
- AC-5 / AC-1 data clauses: `test/owned-copies.test.ts` › the filter — the AC's five fixtures plus an Unlisted physical book; exact ids per value, several-format book in each, soft-deleted in none, each value with `status: 'read'` + `sort: 'title'`, the rows' `owned` arrays.

**Risks**: `test/query-budget.test.ts` / `test/perf.test.ts` may time `listBooks`; the new lookups are primary-key probes.

## Review log

- Verify R1 PASS (tsc, lint, test:no-e2e: 104 files) | CI R1 PASS (check, tests, e2e full 8/8, Vercel, Lighthouse, Claude review: no issues) | Spec R1 APPROVE | Schema R1 APPROVE (2 minor: concurrent `prior`, accepted; rules bullet, placed at close-out) | Audit R1 PASS

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 1
- Review rounds: 1
- First-pass AC FAILs: 0
- Plan revisions after approval: 0 (the work moved to the worktree `.claude/worktrees/task-5.17-owned-copies` after the main checkout was switched to `main` mid-review; owner's choice)
