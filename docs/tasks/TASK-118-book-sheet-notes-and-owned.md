---
id: TASK-118
title: 3.5b The book sheet's own writes (1 of 3) — notes and what you own
status: Ready
depends_on: [TASK-079]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-118 — 3.5b The book sheet's own writes (1 of 3) — notes and what you own

## Goal

On a book's sheet you can write your note and say whether you own it on paper or as an audiobook, each with an Undo, without going back to the Library.

## Context

- Roadmap: `docs/05-roadmap.md` § 3.5b (its **Check** is AC-1, verbatim). `docs/06-tasklist.md` M14. Split from 3.5 at TASK-079's plan gate (owner, 2026-11-16; PR #275).
- **Why three tasks.** The entry is M, but its four parts touch more than eight files: the sheet's editors and toggles (this task), *Move* and *Shelves Edit* opening a sheet from the sheet (TASK-119), and the four books dashboards' rows opening the sheet (TASK-120). Each part proves its own clauses of the Check.
- The sheet: `src/components/BookDetail.tsx` (*Your record* shows notes, owned and plan as text: "their editors are a later item"), drawn by `src/app/@modal/(.)book/[id]/page.tsx` as a sheet and `src/app/book/[id]/page.tsx` as a page (D-157). Its data: `bookDetail` in `src/db/queries.ts` (`notes`, `owned`).
- Notes: `POST /api/progress/book/note` (`src/app/api/progress/book/note/route.ts`, TASK-074): a book with no status row is refused, as the route does today. No component calls it yet (2026-11-18), so the editor is new. 5.5's closing card (*Why did you stop?*, TASK-098) writes the note too: reuse its field and its Save pattern if it fits.
- What you own: `POST /api/books/owned` (TASK-092, `setOwned`), as the Library's `⋯` does in `src/components/BookRowMenu.tsx` (`postOwned`, `COPY`, `toggle` with its Undo toast). The ebook stays Calibre's (`books.calibre_id`, D-90), never toggled. Lift the toggle out of `BookRowMenu` so the row and the sheet share one path, rather than copying it.
- Design: `design/mockups.html` `bookdetail` draws *Notes* in *Your record* as text and no owned toggle. `ui.redrawFiles`: the frame gains the note's editor and the two toggles in this PR, before they are built (`design/mockups-index.md` § `bookdetail` says what was added). **For the plan gate:** where the toggles sit (a `⋯` in the sheet's bar, as the row's; or two switches on the *Owned* row), and whether the note edits in place or opens a field.
- UX floor: `docs/04-design.md` § 10; § 13 (the detail sheet, *What this changes*).
- Decisions: D-34 (one sheet at a time), D-121, D-132, D-152 (what you own), D-157 (the route).

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves the note and the owned toggles: TASK-119 proves *Move* leaving one sheet, TASK-120 the dashboards' rows): test that saving a note from the sheet writes `book_status.notes` once and its Undo puts the old note back; that each owned toggle writes or deletes exactly one `owned_copies` row and its Undo reverses it; that opening *Move* from the sheet leaves exactly one sheet in the DOM; and that a book row on each books dashboard opens `/book/{id}` as a sheet.
- [ ] AC-2: Given a book with status `to_read` and the note *old*, when the note is changed to *new* on the sheet and saved, then `book_status.notes` is *new*, the sheet shows *new* without a reload, and a toast offers Undo; Undo puts *old* back in the database and on the sheet. Given a book with no status row (Unlisted with none, or not in the library), the sheet offers no note editor, or saving it shows the route's refusal and writes nothing (the plan says which).
- [ ] AC-3: Given a book with no `owned_copies` rows, *I own it on paper* on the sheet writes one `physical` row and the *Owned* row then reads *Physical*; Undo deletes it. *I own the audiobook* does the same with `audio`. Turning off a format the book had deletes only that row, and its Undo writes it back. No toggle exists for the ebook.
- [ ] AC-4: The Library's `⋯` toggles behave exactly as before (TASK-093's `test/e2e/library-owned.spec.ts` passes unchanged), and they and the sheet's call one shared toggle.
- [ ] AC-5: The book sheet meets the UX floor (`docs/04-design.md` § 10): the note field labelled, its Save and both toggles named controls of at least 44px on a phone, a failed save says so and keeps the text typed, focus returns to the control after its toast, axe, text contrast, nothing on `--danger`, screenshots at 360px and 1280px of the sheet with the editor open.

## Out of scope

- *Move* and *Shelves Edit* from the sheet: TASK-119.
- Making the dashboards' rows open the sheet: TASK-120.
- Rating, ranking or re-dating from the sheet (3.4, 3.4b and 1.17b already cover them).
- A note on a book with no status row: the route refuses it today and keeps refusing.
- The ebook: Calibre's, never toggled (D-90).

## Files likely touched

- `src/components/BookDetail.tsx`: the note's editor and the owned toggles in *Your record*
- `src/components/BookNote.tsx` (new, or 5.5's closing card's field reused): the editor, its Save and Undo
- `src/components/BookRowMenu.tsx` → a shared owned toggle (`src/components/OwnedToggle.tsx` or a hook)
- `src/app/globals.css`: the editor's and toggles' styles, from tokens
- `design/mockups.html`, `design/mockups-index.md`: the `bookdetail` frame redrawn first
- `test/e2e/book-detail.spec.ts`: AC-1's note and owned clauses, AC-2, AC-3, AC-5

## Verification

- Automated: `test/e2e/book-detail.spec.ts` (note save and Undo, each toggle and Undo, the refused note, the floor); `test/e2e/library-owned.spec.ts` unchanged and green; the existing route tests for `/api/progress/book/note` and `/api/books/owned` still pass.
- Manual: open a to-read book's sheet from the Library at 390px, write a note, Save → expected: the note shows, the toast's Undo restores the old one; tap *I own the audiobook* → expected: *Owned* reads *Audiobook*, and the Library row's sub-line ends *Audiobook* after closing the sheet.

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
