---
id: TASK-097
title: 5.1 Shelves (3 of 3) — New shelf… in the add sheet's Shelf picker
status: Ready
depends_on: [TASK-095]
size: S
model: sonnet
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
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

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves it end to end in the browser (0.11) on the test database):
**Check (the new-shelf part):** *New shelf…* with a new name writes one
`shelves` row and one `shelf_books` row; Undo leaves neither; a name
already in use writes nothing and says why.
- [ ] AC-2: Given the add sheet with a search result, when *Shelf…* → *New shelf…* is chosen, a name typed and the book added, then the toast names the new shelf, *Shelves* lists it with `0 / 1` (the book unread), and *Undo* removes both the book's place and the shelf from the list.
- [ ] AC-3: Given a shelf named *Dark Tower* exists, typing *Dark Tower* in *New shelf…* and adding shows the refusal under the name field, focus stays in the field, and no `shelves` or `shelf_books` row is written.
- [ ] AC-4: The `add` frame in `design/mockups.html` draws *New shelf…*, its name field and the refused name, and `design/mockups-index.md`'s `add` row names them (task 5.1).
- [ ] AC-5: The add sheet meets the UX floor (`docs/04-design.md` § 10) for this control: the name field has a visible label, the refusal is announced (`aria-describedby` or a live region), targets ≥ 24px, contrast in light and dark, screenshots at 360px and 1280px.

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
