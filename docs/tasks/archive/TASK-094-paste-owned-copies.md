---
id: TASK-094
title: 5.17 What you own (3 of 3) — Paste a list marks many: a destination for each format
status: Done
depends_on: [TASK-092, TASK-093, TASK-007, TASK-029]
size: M
model: opus
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: 00f003e
---

# TASK-094 — 5.17 What you own (3 of 3) — Paste a list marks many: a destination for each format

## Goal

You can paste a list of books you own on paper, or as audiobooks, and the Ledger marks each one, creating any it doesn't have, with one Undo for the whole paste.

## Context

- Roadmap: `docs/05-roadmap.md` § 5.17 What you own: physical copies and audiobooks (M17). The *Amended 2026-11-08 (D-132)* half wins: *Paste a list gains a destination for each format*. Its **Check:** is the contract (still marked *proposed*; the owner agrees it by merging or edits it first). Feature F-73. Pulled ahead of 1.26 (D-132).
- **Split, 3 of 3.** TASK-092 built the table and its write; TASK-093 the Library's toggles and filter. This part's merge ticks the entry in `docs/05-roadmap.md` and the row's Done cell in `docs/06-tasklist.md`.
- **The destinations.** *Paste a list* (`src/components/PasteBooks.tsx`, inside `src/components/AddBooks.tsx`) sends `{ items, destination }` to `POST /api/books/bulk` (`src/app/api/books/bulk/route.ts`), which runs `addBooks` (`src/db/writes.ts`) in one transaction; `Target`, `destinationOf` and `parseDestination` are in `src/lib/book-add.ts`, `Destination` and `AddedEntry` in `src/db/writes.ts`. Two new destinations, *Physical copy* and one for the audiobook (its name is the plan's against the redrawn frame): a matched book gets its `owned_copies` row; a new one is created at Unlisted (1.21, D-83) with its row. Neither touches the plan or a status the book already has.
- **One Undo.** The paste's undo (`undoAddBooks`, `DELETE /api/books`) removes the owned rows this paste wrote and the books it created, and leaves a row the book already had before the paste.
- **Paste only.** The entry gives the destinations to *Paste a list*; `Target` is shared with Search and *By hand* (`src/components/ByHand.tsx`). **Ask at plan time** whether they also offer it or the picker hides it outside the paste.
- **Not drawn yet** (the entry): the mockup's `add` frame gains the destinations before they are built, in this PR (`ui.redrawFiles`: `design/mockups.html`, `design/mockups-index.md`). Print it with `powershell -NoProfile -File scripts/screen.ps1 add`.
- Design: `design/mockups.html` § `add`; `docs/04-design.md` § 10 The UX floor; `.claude/rules/ui.md` (every add surface opens on Search; *Paste a list · By hand* beside it).
- Decisions: D-83, D-86, D-121, D-132. Hard rules 2, 3 and 4.
- *From TASK-092 (5.17, PR #263):* built: `owned_copies(book_id, format)` with `OWNED_FORMATS` (`physical`, `audio`) and `setOwned` in `src/db/writes.ts`. `setOwned` opens its own transaction, so `addBooks` writes the paste's rows inside its one transaction (`INSERT ... ON CONFLICT DO NOTHING`) and keeps which rows it wrote, so that `undoAddBooks` deletes only those and leaves a row the book already had. A pasted book created at Unlisted shows under *Physical* (D-152).

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim; this part proves the paste: three lines to *Physical copy*, two matched and one new, write three rows and one `unlisted` book, and one Undo removes all of it, on the test database and in the browser (0.11), with screenshots at 360px and 1280px. TASK-092 and TASK-093 prove the rest): (proposed; the owner agrees it by merging or edits it first)
each toggle writes one `owned_copies` row with its format, Undo removes
it, and the export test passes with the table. *Physical* lists only books
with a `physical` row, *Audiobook* only books with an `audio` row, *Ebook*
only books with a `calibre_id`, and *Not owned* only books with none of
the three; a book with several is in each; a soft-deleted book is in none;
each combines with a status filter and a sort, and the choice survives a
reload. Pasting three lines to *Physical copy*, two matched and one new,
writes three rows and one `unlisted` book, and Undo removes all of it.
Screenshots at 360px and 1280px.
- [x] AC-2: Given one matched book that already has a `physical` row and one that has none, pasting both to *Physical copy* leaves one `physical` row each; Undo removes only the row the paste wrote, and the earlier row stays.
- [x] AC-3: Pasting two lines to the audiobook destination writes two `audio` rows and no `read_events`, no status change on a matched book, and no `reading_plan` row; Undo removes both rows.
- [x] AC-4: `POST /api/books/bulk` answers 400 for an unknown destination kind and writes nothing (`test/books-bulk.test.ts`).
- [x] AC-5: The `add` frame in `design/mockups.html` draws both destinations, its `design/mockups-index.md` row names them (task 5.17), and *Paste a list* meets the UX floor (`docs/04-design.md` § 10): the destination is a real control with a name, the confirm button names it (*Add to Physical copy*), contrast holds in light and dark, screenshots at 360px and 1280px.

## Out of scope

- The table, its route and the Library filter (TASK-092, TASK-093).
- Marking owned from Search's or *By hand*'s results unless the plan gate says so.
- Matching changes to the paste itself (1.4, 1.18's rules stay as they are).
- Writing `#owned` to Calibre (4.4).

## Files likely touched

- `src/lib/book-add.ts` — the two targets, their names and `parseDestination`.
- `src/db/writes.ts` — `Destination`, `addBooks` writing owned rows, and the undo.
- `src/app/api/books/bulk/route.ts`, `src/app/api/books/route.ts` — the destination's error text and the undo.
- `src/components/AddBooks.tsx`, `src/components/PasteBooks.tsx` — the picker.
- `design/mockups.html`, `design/mockups-index.md` — the `add` frame (redraw).
- `test/books-bulk.test.ts`, `test/paste-books.test.tsx`, `test/e2e/paste-books.spec.ts`.

## Verification

- Automated: `test/books-bulk.test.ts` (AC-1's paste clause, AC-2, AC-3, AC-4 on `TEST_DATABASE_URL`), `test/paste-books.test.tsx` (the picker and the confirm's name), `test/e2e/paste-books.spec.ts` (the paste and its Undo in the browser, axe; screenshots at 360 and 1280).
- Manual: on the dev database, Add books → *Paste a list* → choose *Physical copy* → paste two titles you have and one you don't → confirm → Library *Physical* shows all three, the new one *Unlisted*; *Undo* → all three gone from *Physical* and the new book gone. Leave the data as found.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- Search and *By hand* should offer *Physical copy* and *Audiobook* too (owner, at the plan gate: paste only here, the other modes as a roadmap item) → docs/05-roadmap.md § 5.17b (new), docs/06-tasklist.md § M17 (approved at plan)
- `.claude/rules/schema.md` § Unlisted says only an undo or the Calibre import writes `unlisted`; a paste to an owned format now does too → .claude/rules/schema.md § Below Someday sits Unlisted (approved at plan)
- `.claude/rules/schema.md` § What you own said `owned_copies` is written only through `setOwned`; the paste and `undoOwned` write it too (schema review) → .claude/rules/schema.md § What you own is a fact about your copy (approved at close-out: the owner's standing instruction to take the recommended option)
- D-86 says only Calibre and an Undo write `unlisted`; D-152 already anticipated the paste → docs/review/decisions.md § D-86 (an *Amended by D-152* note; approved at close-out, as above)
- The paste check doesn't know which formats a matched book already owns, so *Add N books to Physical copy* can count a book whose row already exists and the toast then counts fewer (spec review) → docs/05-roadmap.md § 5.17b (new)
- `undoInside` (Someday, On deck, a period, a shelf) doesn't refuse a created book that 4.4's sync has linked since; `undoOwned` now does (schema review) → docs/05-roadmap.md § 5.17b (new)
- AC-5's example confirm text reads *Add to Physical copy*; the owner chose *Add N books to Physical copy* at the plan gate (spec review) → not tracked: the owner's wording, recorded in ## Plan; the AC is the owner's to edit
- ui-verifier stopped part-way when browser actions were denied; the 360/412/768/1024 widths and dark mode were not walked by it → not tracked: CI's browser suite runs the paste's axe and contrast test in every project, and the owner's preview walk is a gate

## Plan

Owner decisions at the gate (2026-11-15): the owned destinations are **Paste a list only** (the other modes go to a new roadmap item, 5.17b); the audio one is named **Audiobook**; the confirm reads **Add 3 books to Physical copy** (plan destinations keep *Add 3 books*).

**Steps**
1. `src/lib/book-add.ts`: `Target` gains `{ kind: "owned"; format: OwnedFormat }`; `targetName` → *Physical copy* / *Audiobook*; `destinationOf` passes it through; `parseDestination(raw, { owned })` accepts `{ kind: "owned", format: "physical" | "audio" }` only when the caller allows it.
2. `src/db/writes.ts`: `Destination` gains the owned kind. `addBooks` (via `writeDestination`) writes `owned_copies` `ON CONFLICT DO NOTHING RETURNING`, so `added` is only the rows this paste wrote; each created book gets an `unlisted` status (`statused`). No plan, no status change on a matched book, no promotion, no read.
3. `undoInside` owned branch: refuses, changing nothing, when a row it wrote is gone, a created book's status is no longer a bare `unlisted`, or a created book has gained another format, shelf, plan row, status or read; otherwise deletes this paste's rows (that format, `added`), the created books' `unlisted` statuses, and soft-deletes the created books. A row the book had before is never named, so it stays.
4. `src/app/api/books/bulk/route.ts` accepts owned, its 400 text names the shape; `src/app/api/books/route.ts` DELETE accepts owned (the paste's undo), POST answers 400 for it (paste only).
5. `src/components/AddBooks.tsx`: *Physical copy* and *Audiobook* chips after *Shelf…*, shown only in Paste a list mode; leaving paste mode with one chosen puts Add to back on Someday; after the add, the full page goes to `/books/list?owned=physical|audio`.
6. `src/components/PasteBooks.tsx`: confirm *Add N books to Physical copy*; toast *N books added to Physical copy* with its Undo.
7. `design/mockups.html` `add`: a phone frame for Paste a list with *Physical copy* chosen, the review of 3 and that confirm, and a note; `design/mockups-index.md` row.

8. *(Plan revision 1, approved 2026-11-15: the review skipped a matched book with a status, so it never reached the write.)* `src/lib/book-review.ts`: for an owned destination, a matched book with any status is *Add · Drop*, default *Add*, and counted (*In your library: marks it as owned on paper.* / *marks the audiobook as yours.*); a new line reads *New: creates the book, Unlisted.*; plan destinations unchanged. Test: `test/book-review.test.ts`.

**Files**: the seven above, `src/lib/book-review.ts` and `test/book-review.test.ts` (revision 1), and `test/books-bulk.test.ts`, `test/paste-books.test.tsx`, `test/e2e/paste-books.spec.ts`. Ten files, over the split line, no schema: kept whole because it is already part 3 of 3 and the redraw ships in the same PR.

**Test strategy**
- AC-1 (paste clause): `test/books-bulk.test.ts` — 2 matched + 1 new to Physical copy → 3 `physical` rows, 1 `unlisted` book; Undo removes all; `test/e2e/paste-books.spec.ts` the same in the browser, axe, screenshots 360/1280.
- AC-2: `test/books-bulk.test.ts` — the earlier row survives Undo, the paste's goes.
- AC-3: `test/books-bulk.test.ts` — audio: two rows, no `read_events`, no status change, no `reading_plan`; Undo removes both.
- AC-4: `test/books-bulk.test.ts` — 400 and nothing written for an unknown kind and an unknown format; single-add POST 400 for owned.
- AC-5: `test/paste-books.test.tsx` — chips only in paste mode, named and pressed; the confirm's name; the toast and Undo body; e2e axe and contrast light/dark; the mockup frame and index row checked by the spec reviewer.

**Risks**: the paste pane also shows under Search, where it keeps the plan or shelf destinations. Writing `unlisted` on a create widens D-86's "only an undo or Calibre writes it" (follow-up 2).

## Review log

_Filled by /implement-task. One line per round._

- Verify R1 PASS (eecfa8a) | CI R1 every job PASS, run marked cancelled by the next push | Spec R1 APPROVE | Schema R1 APPROVE (3 MINOR: lock and refuse a Calibre-linked book in `undoOwned`, wider refusal test → fixed in 986f073) | Verify R2 PASS | CI R2 PASS (986f073) | Audit R1 PASS (every AC PROVEN) | UI R1 partial: PASS at 390 and 1280 for the chips, the review copy, the confirm, the landing and the toast; stopped when browser actions were denied (data left as found through the paste's own undo request) | Spec and Schema not re-run in round 2: the fix was the schema reviewer's own finding, applied as written, and touched no spec-checked behaviour

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 2
- Review rounds: 1 (one schema-review fix)
- First-pass AC FAILs: 0
- Plan revisions after approval: 1 (src/lib/book-review.ts and its test)
