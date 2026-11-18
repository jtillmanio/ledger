---
id: TASK-097
title: 5.1 Shelves (3 of 3) — New shelf… in the add sheet's Shelf picker
status: Review
depends_on: [TASK-095]
size: S
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: 54e8281
---

# TASK-097 — 5.1 Shelves (3 of 3) — New shelf… in the add sheet's Shelf picker

## Goal

When adding a book, you can put it on a shelf that doesn't exist yet: name the shelf, and the book goes on it in the same step, with one Undo for both.

## Context

- Roadmap: `docs/05-roadmap.md` § 5.1 Shelves (books only): create, add items, reorder (M17), the *A new shelf from the add sheet* bullet (2026-10-26 intake: *create a new shelf; right now I can only add to an existing one*). Pulled ahead of 1.26 (D-139). Its **Check (the new-shelf part):** is the contract for this part.
- **Split, 3 of 3.** TASK-095 built the write that creates a shelf with its first book and its undo; TASK-096 the pages. This part puts *New shelf…* at the end of 1.4c's *Shelf…* picker, and **its merge ticks 5.1** (both Checks then hold).
- **The picker** is in `src/components/AddBooks.tsx` (the `Shelf…` chip opens the user's shelves from `GET /api/shelves`, each an `aria-pressed` choice). *New shelf…* ends the list: a name field, then the book goes on the new shelf in the same write, and one Undo removes both. A name already in use is refused, with the reason under the field (`--danger` text is for validation only, `.claude/rules/ui.md`). The same choice serves the full page (`/books/add`) and the sheet from Books, and the paste's *Add N books* when the destination is the new shelf: the plan says whether a paste to a new shelf creates it once for all the lines.
- `undoAddBooks` (`src/db/writes.ts`) already removes the shelf rows an add wrote; the new shelf's row goes with the same Undo (TASK-095's write).
- **Not drawn yet:** the `add` frame (`powershell -NoProfile -File scripts/screen.ps1 add`) gains the picker's *New shelf…* with its name field and the refused name, in this PR (`ui.redrawFiles`).
- Design: `design/mockups.html` § `add`; `docs/04-design.md` § 10 The UX floor.
- Decisions: D-139; R1-07.
- *From TASK-095 (5.1, PR #278):* the write is built, not wired. `addBook` and `addBooks` (`src/db/writes.ts`) take `{ kind: "new_shelf", name }`: one shelf, made in the add's transaction (a paste's lines all go on it, in order); the answer names it as `destination: { kind: "shelf", shelfId }` with `newShelf: true`, and `undoAddBooks` removes the place and then the shelf, refusing once the shelf has gained another book, a description or a follow. A name in use answers `{ ok: false, reason: "taken", name }` (the existing shelf's name; `POST /api/shelves` words it *You already have a shelf called Dark Tower.*). Still to do here: `parseDestination` (`src/lib/book-add.ts`) accepts `new_shelf` for `POST /api/books` and `/api/books/bulk`, refusing an empty name or one past `MAX_FIELD` with a 400 (the write throws on an empty one); the `DELETE /api/books` body and `undoAdd` carry `newShelf` back; and both add routes' `!result.ok` branches, which word only *gone* and *no shelf* today, answer `taken` with its reason (schema review of PR #278).

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim; this part proves it end to end in the browser (0.11) on the test database):
**Check (the new-shelf part):** *New shelf…* with a new name writes one
`shelves` row and one `shelf_books` row; Undo leaves neither; a name
already in use writes nothing and says why.
- [x] AC-2: Given the add sheet with a search result, when *Shelf…* → *New shelf…* is chosen, a name typed and the book added, then the toast names the new shelf, *Shelves* lists it with `0 / 1` (the book unread), and *Undo* removes both the book's place and the shelf from the list.
- [x] AC-3: Given a shelf named *Dark Tower* exists, typing *Dark Tower* in *New shelf…* and adding shows the refusal under the name field, focus stays in the field, and no `shelves` or `shelf_books` row is written.
- [x] AC-4: The `add` frame in `design/mockups.html` draws *New shelf…*, its name field and the refused name, and `design/mockups-index.md`'s `add` row names them (task 5.1).
- [x] AC-5: The add sheet meets the UX floor (`docs/04-design.md` § 10) for this control: the name field has a visible label, the refusal is announced (`aria-describedby` or a live region), targets ≥ 24px, contrast in light and dark, screenshots at 360px and 1280px.

## Out of scope

- The create write and its undo (TASK-095); the Shelves pages (TASK-096).
- A new shelf from anywhere but the add sheet's picker and the Shelves page.
- Choosing a shelf for a paste's individual lines.

## Files likely touched

- `src/components/AddBooks.tsx` — *New shelf…* in the picker, the name field, the refusal.
- `src/app/api/books/route.ts`, `src/app/api/books/bulk/route.ts` — a new-shelf destination, if TASK-095's plan routes it through the add.
- `design/mockups.html`, `design/mockups-index.md` — the `add` frame (redraw).
- `test/add-book-sheet.test.tsx`, `test/e2e/new-shelf.spec.ts` (new).

## Verification

- Automated: `test/add-book-sheet.test.tsx` (the picker's last item, the refusal under the field), `test/e2e/new-shelf.spec.ts` (AC-1, AC-2, AC-3, axe; screenshots at 360 and 1280).
- Manual: on the dev database, Books → Add → search a book → *Shelf…* → *New shelf…* → name it → *Add* → Shelves lists it → *Undo* → gone. Leave the data as found.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- Schema review R1 (two minors): a new shelf's name went through `text()`, which rewrote dashes, so the taken check could miss a shelf made by `POST /api/shelves`; no route test refused the undo once the new shelf gained a book → not tracked: done in this PR (review round 2)
- A long shelf name pushed a result's *Year or quarter…* past its card at 360px (`.res-btns` didn't wrap; predates this task) → not tracked: done in this PR (plan revision 1)
- Rebased onto task 5.7 (#287), which added a `release` destination to the same functions: POST takes both, DELETE keeps `release` and never takes `new_shelf`; the New shelf frame is the `add` screen's fifth, after 5.7's → not tracked: done in this PR (merge resolution)
- test-auditor: "an empty or over-long name is a 400" also passes on the pre-task code (the unknown kind was a 400 already) → not tracked: kept as a regression guard
- `shelfLabel` (`src/lib/book-add.ts`) repeats `shelfName` (`src/db/writes.ts`) because the browser can't import writes.ts; each names the other → not tracked: accepted as is (two lines, one rule)
- ui-verifier stopped part-way (a usage limit) after the add and before its report; the dev database was checked through the app afterwards and holds no shelf from the walk → not tracked: its checklist was run by Claude instead (see Review log)

## Plan

Approved by the owner, 2026-11-17 (planned on Opus; implemented on Sonnet, the task's model).
Worktree `.claude/worktrees/task-5.1-new-shelf`, branch `task/5.1-new-shelf-from-add-sheet`,
test database `ledger_test_2`, port 3200 (`.env.worktree`; run `npm run test:db:reset` once first).

The write is TASK-095's (`addBook` / `addBooks` take `{ kind: "new_shelf", name }`; `undoAddBooks`
removes the shelf with `newShelf`); this part wires it to the routes and the screen.

### Steps

1. **`src/lib/book-add.ts`.** `Target` gains `{ kind: "new_shelf"; name: string }`. `targetName`
   answers the typed name (so `addTo` reads *Add to Dark Tower*); `destinationOf` passes
   `{ kind: "new_shelf", name }` through. `parseDestination(raw, { owned, newShelf })` accepts
   `new_shelf` only when `newShelf` is set (the two POSTs): its name through `text()`, so an empty
   name or one past `MAX_FIELD` is undefined, a 400. `destinationShapes` names it. `undoAdd` sends
   `newShelf: true` when the entry has it.
2. **`src/app/api/books/route.ts`, `src/app/api/books/bulk/route.ts`.** POST parses with
   `{ newShelf: true }` (bulk: `{ owned: true, newShelf: true }`). A `!result.ok` with
   `reason === "taken"` answers 409 `{ reason: "taken", error: "You already have a shelf called <name>." }`
   (the wording `POST /api/shelves` uses); *gone* and *no-shelf* keep their 409s. DELETE never
   accepts `new_shelf`, and reads `newShelf: true` (a boolean, else 400) into the entry it undoes.
3. **`src/components/AddBooks.tsx`, the picker.** *New shelf…* is the last chip of the open picker,
   also shown after *No shelves yet…* when there are none. Choosing it sets the target to
   `{ kind: "new_shelf", name: "" }` and shows a **Shelf name** field (visible `<label>`,
   `maxLength` MAX_FIELD) under the picker, outside the `role="status"` region; typing updates the
   target's name. *Shelf…* is pressed for `shelf` and `new_shelf`; its label is the shelf's name, else
   *Shelf…*. A refusal sits under the field as `NewShelf.tsx`'s does: `.field-err`, `role="alert"`,
   the field `aria-invalid` and `aria-describedby` it; typing clears it.
4. **`AddBooks.tsx`, the add.** Before sending to a new shelf with an empty name: *Give the shelf a
   name.* under the field, focus to it, no request. A 409 `taken`: the route's reason under the field,
   focus to it, nothing else changes. On success with `newShelf`: the target becomes
   `{ kind: "shelf", shelfId: result.destination.shelfId, name }` (the name normalised as `shelfName`
   does: NFKC, trimmed, spaces collapsed) without clearing the results' outcomes, and an open
   picker lists the shelf, pressed. The toast: label `Added to {name}`, detail `{title} · new shelf`.
   The entry carries `newShelf`; its Undo removes the place and the shelf, and when the target is
   still that shelf puts it back to `new_shelf` with the same name (and takes the shelf out of the
   open picker).
5. **`src/components/PasteBooks.tsx`.** A paste to a new shelf creates it **once for all the lines**
   (the write does), one Undo. The entry is built from the response's `destination` and `newShelf`,
   not `destinationOf(target)`. New props: `hold?: () => boolean` (called before the confirm posts;
   true stops it: AddBooks's empty-name check) and `refused?: (why: string) => void` (a 409
   `taken`: AddBooks shows it under the field; the paste keeps its lines, button back). `onAdded`
   receives the response's destination, so the full page's `pasted` opens the new shelf's page.
6. **`design/mockups.html`, `design/mockups-index.md`.** The `add` screen gains a fourth phone frame:
   *Search*, *Add to* with *Shelf…* open, the shelves then *New shelf…* pressed, the **Shelf name**
   field holding *Dark Tower* and under it *! You already have a shelf called Dark Tower.*; a dated
   note in the notes column (task 5.1: one write, one Undo for both, a paste makes one shelf for all
   its lines, the refusal under the field). The index's `add` row names the frame.

### Files

- `src/lib/book-add.ts`: the target, the destination, the parse, the undo's `newShelf`.
- `src/app/api/books/route.ts`, `src/app/api/books/bulk/route.ts`: `new_shelf` in, `taken` out, `newShelf` on DELETE.
- `src/components/AddBooks.tsx`: *New shelf…*, the field, the refusal, the switch to the made shelf, the undo.
- `src/components/PasteBooks.tsx` (**not in Files likely touched**): the paste to a new shelf, its undo and refusal.
- `src/app/globals.css` (**not in Files likely touched**; only if the field needs spacing): reuse `.add-label`, `.txt`, `.field-err` first.
  **Revision 1 (owner, 2026-11-18):** the field needed none (it is `.hfield`); `.res-btns` gains
  `flex-wrap:wrap`, because a long shelf name on a result's primary pushed *Year or quarter…* past
  its card at 360px (it predates this task; *New shelf…* makes long names common). Checked in
  `test/e2e/new-shelf.spec.ts`'s floor test.
- `design/mockups.html`, `design/mockups-index.md`: the `add` frame (`ui.redrawFiles`).
- Tests: `test/add-book.test.ts`, `test/books-bulk.test.ts`, `test/add-book-sheet.test.tsx`, `test/paste-books.test.tsx`, `test/e2e/new-shelf.spec.ts` (new).

### Test strategy

- **AC-1:** `test/add-book.test.ts` (POST then DELETE on the test database: one `shelves` row and one
  `shelf_books` row, Undo leaves neither; a taken name is 409 `taken` with the reason and writes
  nothing; an empty or over-long name is 400) and `test/books-bulk.test.ts` (a paste to a new shelf:
  one shelf, every line on it, one undo); end to end in `test/e2e/new-shelf.spec.ts`, rows counted
  through `testSql`.
- **AC-2:** `test/e2e/new-shelf.spec.ts`: the add sheet from Books, a library search result, *Shelf…* →
  *New shelf…* → a name → add: the toast names it, *Shelves* lists it `0 / 1`, *Undo* removes both
  (rows and list). `test/add-book-sheet.test.tsx`: *New shelf…* is the picker's last item, the
  request sends `new_shelf`, the target becomes the made shelf, Undo's DELETE carries `newShelf`.
- **AC-3:** `test/e2e/new-shelf.spec.ts`: *Dark Tower* seeded, the same name refused under the field,
  focus in the field, no rows written. `test/add-book-sheet.test.tsx`: a 409 `taken` puts the reason
  under the field (`aria-describedby`, `role="alert"`), focus on the field; an empty name sends nothing.
- `test/paste-books.test.tsx`: the paste's undo entry carries the response's shelf and `newShelf`;
  `onAdded` gets the destination; a 409 `taken` calls `refused`.
- **AC-4:** the frame, checked by spec-reviewer and ui-verifier against the build.
- **AC-5:** `test/e2e/new-shelf.spec.ts`: axe (`label`, `target-size`, `color-contrast`, …), contrast
  in light and dark, 24px targets, screenshots at 360 and 1280.

### Risks / open questions

- AC-3's *focus stays in the field*: with Search the add is the result's button, so focus
  **returns** to the field on the refusal (read so at the plan gate).
- The made shelf's name on the screen is normalised in the browser (the answer doesn't carry it).
- Size: 8 non-test files with `globals.css`, at the split line; kept whole (one control, and the
  frame redraw ships in the same PR).

## Review log

Verify R1 PASS | Spec R1 CHANGES (rebase onto #287 only; every AC PASS) · Schema R1 APPROVE (2 MINOR) → rebased, both minors fixed → Verify R2 PASS | Spec R2 APPROVE · Schema R2 APPROVE | Audit R1 PASS (one guard) | UI: ui-verifier stopped by a usage limit mid-walk; its checklist run by Claude, not independent: new-shelf.spec.ts @floor green in CI at every floor project (axe, contrast light and dark, 24px, no sideways scroll), the 360 and 1280 screenshots match the add frame, releases.spec.ts green (Coming out intact) | CI R1 not run (PR conflicted with #287) → CI R2 PASS (every project, 8 shards) | Vercel preview pass

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 2
- Review rounds: 2
- First-pass AC FAILs: 0
- Plan revisions after approval: 1 (`.res-btns` wraps)
