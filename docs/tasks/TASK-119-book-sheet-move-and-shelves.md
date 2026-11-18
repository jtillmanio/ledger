---
id: TASK-119
title: 3.5b The book sheet's own writes (2 of 3) — Move and Shelves, a sheet from the sheet
status: Draft
depends_on: [TASK-118]
size: M
model: opus
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-119 — 3.5b The book sheet's own writes (2 of 3) — Move and Shelves, a sheet from the sheet

## Goal

From a book's sheet you can move it in your plan and change which shelves hold it. The picker replaces the sheet rather than opening on top of it, and Back returns to the book.

## Context

- Roadmap: `docs/05-roadmap.md` § 3.5b (its **Check** is AC-1, verbatim). `docs/06-tasklist.md` M14. Part 2 of 3: TASK-118 does the note and owned toggles, TASK-120 the dashboards' rows.
- The sheet: `src/components/BookDetail.tsx` (*Planned for* and *Shelves* rows, text only today), in `src/app/@modal/(.)book/[id]/` (the intercepted route) and `src/app/book/[id]/` (the page, D-157).
- **D-34, one sheet at a time:** a sheet opened from a sheet replaces it, with a back chevron naming where you came from, and Back unwinds one level. The plan picker today is a client sheet (`PlanPickerSheet`, `src/components/PlanPicker.tsx`, opened by `BookRowMenu`, `PlanQuarterRows`, `PlanRail`), not a route. **For the plan gate:** how *Move* replaces the book sheet while keeping D-34's back chevron (*‹ The Book's Title*) and Back: the book sheet swaps its body for `PlanPickerBody`/`MoveBody`, or the picker becomes a route under the book. Name the approach, and what Back and Esc do from each.
- *Move*: only for a to-read book (`PlanPickerSheet` refuses any other status); its write and undo are 2.3's (`POST`/`DELETE /api/plan`, TASK-063 to TASK-065).
- *Shelves Edit*: the mockup draws the button, not what it opens. **There is no write that takes a book off a shelf** (`src/db/writes.ts` has `createShelf`, `moveOnShelf`, `saveShelfNote`, `saveShelfDescription`; adding goes through `addBook` with a shelf destination, `POST /api/books`). The roadmap entry says "through the routes that already exist", which taking a book off can't do. **For the plan gate, the owner's call:** (a) *Edit* only adds to a shelf (existing write), taking off waits for a later entry; or (b) this task adds `takeOffShelf` with its undo and a route (a data write, so `model: opus` and a schema-reviewer pass); or (c) *Edit* links to the shelf's page. Whichever, the sheet it opens is drawn in `design/mockups.html` `bookdetail` first (`ui.redrawFiles`).
- Shelves are books only (5.1, TASK-095 to TASK-097); `shelf_books` keys on the book, ordered.
- UX floor: `docs/04-design.md` § 10; § 13 (the detail sheet).
- Decisions: D-34, D-157, D-37 (plan levels), D-139.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves *Move* leaving exactly one sheet: TASK-118 proves the note and the owned toggles, TASK-120 the dashboards' rows): test that saving a note from the sheet writes `book_status.notes` once and its Undo puts the old note back; that each owned toggle writes or deletes exactly one `owned_copies` row and its Undo reverses it; that opening *Move* from the sheet leaves exactly one sheet in the DOM; and that a book row on each books dashboard opens `/book/{id}` as a sheet.
- [ ] AC-2: Given a to-read book planned for a quarter, opened as a sheet from the Library, when *Move* is pressed, then exactly one `[role=dialog]` sheet is in the DOM, it carries a back control naming the book, and confirming a move to another quarter moves the book (its `reading_plan.period` changes) with an Undo; afterwards the book's sheet shows the new *Planned for*. Back from the picker shows the book's sheet again, and Back once more returns to the Library at its scroll position.
- [ ] AC-3: A book that isn't to-read shows *Planned for* only when it has a plan row, and no *Move*.
- [ ] AC-4: *Shelves Edit* does what the plan gate decided, with one sheet in the DOM at a time; every write it makes has an Undo that reverses exactly that write (a shelf it added the book to loses only that `shelf_books` row; if (b), a shelf it took the book off gets the row back at its old place).
- [ ] AC-5: The book sheet, and each sheet opened from it, meets the UX floor (`docs/04-design.md` § 10): focus moves into the new sheet and returns to *Move* or *Edit* on Back, the back control is a named button of at least 44px on a phone, axe, nothing on `--danger`, reduced motion swaps without a slide, screenshots at 360px and 1280px of each sheet.

## Out of scope

- The note and the owned toggles: TASK-118.
- The dashboards' rows: TASK-120.
- A new plan level or any change to the picker's own behaviour (its chips, preview, budget).
- Creating a shelf from the sheet (*New shelf…* is Add books', TASK-097), unless the plan gate's option says otherwise.

## Files likely touched

- `src/components/BookDetail.tsx`: *Move* and *Edit* on their rows
- `src/components/PlanPicker.tsx`: the picker inside the book sheet, with its back control
- `src/app/@modal/(.)book/[id]/page.tsx` (and `layout.tsx`): one sheet at a time, Back
- `src/components/BookShelvesSheet.tsx` (new): what *Edit* opens
- `src/db/writes.ts`, `src/app/api/shelves/[id]/route.ts`: only if the plan gate picks (b)
- `design/mockups.html`, `design/mockups-index.md`: the *Edit* sheet drawn first
- `test/e2e/book-detail.spec.ts`: AC-1's *Move* clause, AC-2 to AC-5; a vitest file for (b)'s write and undo

## Verification

- Automated: `test/e2e/book-detail.spec.ts` counts `[role=dialog]` after *Move* and after *Edit*, walks Back twice, and checks each write and its Undo; with (b), a vitest test that taking a book off a shelf deletes one row and its undo restores its place.
- Manual: from the Library at 390px, open a planned book, press *Move*, choose next quarter, confirm → expected: one sheet the whole way, the book's sheet then reads the new quarter, Back twice lands on the Library where you were.

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
