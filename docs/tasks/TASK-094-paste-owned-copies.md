---
id: TASK-094
title: 5.17 What you own (3 of 3) — Paste a list marks many: a destination for each format
status: Ready
depends_on: [TASK-092, TASK-093, TASK-007, TASK-029]
size: M
model: opus
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
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

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves the paste: three lines to *Physical copy*, two matched and one new, write three rows and one `unlisted` book, and one Undo removes all of it, on the test database and in the browser (0.11), with screenshots at 360px and 1280px. TASK-092 and TASK-093 prove the rest): (proposed; the owner agrees it by merging or edits it first)
each toggle writes one `owned_copies` row with its format, Undo removes
it, and the export test passes with the table. *Physical* lists only books
with a `physical` row, *Audiobook* only books with an `audio` row, *Ebook*
only books with a `calibre_id`, and *Not owned* only books with none of
the three; a book with several is in each; a soft-deleted book is in none;
each combines with a status filter and a sort, and the choice survives a
reload. Pasting three lines to *Physical copy*, two matched and one new,
writes three rows and one `unlisted` book, and Undo removes all of it.
Screenshots at 360px and 1280px.
- [ ] AC-2: Given one matched book that already has a `physical` row and one that has none, pasting both to *Physical copy* leaves one `physical` row each; Undo removes only the row the paste wrote, and the earlier row stays.
- [ ] AC-3: Pasting two lines to the audiobook destination writes two `audio` rows and no `read_events`, no status change on a matched book, and no `reading_plan` row; Undo removes both rows.
- [ ] AC-4: `POST /api/books/bulk` answers 400 for an unknown destination kind and writes nothing (`test/books-bulk.test.ts`).
- [ ] AC-5: The `add` frame in `design/mockups.html` draws both destinations, its `design/mockups-index.md` row names them (task 5.17), and *Paste a list* meets the UX floor (`docs/04-design.md` § 10): the destination is a real control with a name, the confirm button names it (*Add to Physical copy*), contrast holds in light and dark, screenshots at 360px and 1280px.

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
