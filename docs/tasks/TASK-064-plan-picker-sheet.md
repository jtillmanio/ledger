---
id: TASK-064
title: 2.3 Plan editor (2 of 3) — the picker sheet, from the Library and Add books
status: Ready
depends_on: [TASK-063]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-064 — 2.3 Plan editor (2 of 3) — the picker sheet, from the Library and Add books

## Goal

One sheet picks where a book goes in the plan, with each year's and quarter's words in view before you choose, reached from *Plan for…* on a Library row and *Year or quarter…* when adding a book.

## Context

- Roadmap: `docs/05-roadmap.md` § 2.3 Plan editor (M11). The entry and its **Check:** are the contract. Feature F-23. **Pulled ahead of 1.26 by 1.25.**
- **Split, 2 of 3.** TASK-063 built the writes, the API and the totals; this part is the sheet and two of its three entry points; TASK-065 is the rail. The third entry point the entry names, **Move** on a plan-page row, arrives with 2.10 (TASK-069), which opens this sheet.
- **The sheet (mockup `moveplan`, *Move / add to a quarter*, `design/mockups.html` around lines 2169–2326).** The four to-read levels (D-37). One row of chips: the next five years, then **On deck** and **Someday**. Choosing a year opens a second row: **No quarter yet** (a bare year) and **Q1–Q4**. No month step (D-38). Each year and quarter chip shows that period's current word total; On deck and Someday skip the quarter row and show no budget. A live preview card shows the target's total after the move and turns **amber** (`--blocked`) if it would go over capacity, with the amount over: never red. The primary button names the target (*Move to Q3 2027*, *Move to Someday*). In add mode it is the same sheet minus the *currently planned* badge. The mockup's chip figures are sample data (D-7).
- **Accept as a stretch year.** The entry's preview offers *Accept as a stretch year* when a move would go over. Accepting is stored in 2.7's `plan_acceptance` table (TASK-066), which M11's order builds after 2.3. **Stop and ask at plan time** whether the preview draws *Accept* `aria-disabled` with its reason until 2.7, or leaves it out until 2.7 adds it.
- **Entry points.** *Plan for…* on the Library row's ⋯ menu (`src/components/BookRowMenu.tsx`, which today holds only *Follow…*). *Year or quarter…* on Add books (`src/components/AddBooks.tsx`): today an `aria-disabled` chip with the reason *Year or quarter… arrives with the plan editor.* (around lines 191–197); this task enables it, and adds the mockup's secondary *Year or quarter…* button on a search result row (`src/components/BookSearch.tsx`).
- *From 1.7 (TASK-011, PR #96):* undoing an add from a search result clears the toast but leaves that row reading *✓ Added to …* (disabled), so it can't be re-added without searching again. This task reworks those result-row buttons; reset the row when its add is undone.
- *From TASK-063 (2.3, PR #221):* the API this sheet calls, all in `src/app/api/plan/route.ts`:
  - **Chips:** `GET /api/plan?firstYear=YYYY` answers `{ years }`, five years each `{ year, quarters }` as `planCapacity` reads them (`planYears`). The client sends the Eastern year.
  - **Preview:** `GET /api/plan?to=…&bookId=…&from=…` answers `{ budget: { period, plannedWords, capacity, over } }`, with `over` null when it fits; `budget` is null for `on_deck` and `someday`.
    - In add mode, a book not in the library yet sends `words` instead of `bookId`/`from`.
    - `from` is the book's level now: a period, or `someday`.
  - **Move:** `POST /api/plan { bookId, from, to }` answers `{ ok, move }`. `move` is the undo: push it onto the 1.2 stack and send `DELETE /api/plan { move }`, which answers 409 when the book has moved on.
  - **Add into the plan:** `POST /api/books` takes `destination: { kind: "period", period }` for a year or a quarter. The screen-side `Target` and `destinationOf` in `src/lib/book-add.ts` don't have it yet; this task adds them.
- **The Check's Flip:** 1.9's empty Books *Up next* action (`src/app/books/status/page.tsx`, today *Add a book*) becomes *Plan a book*.
- The sheet is the shared `src/components/Sheet.tsx`: focus on its heading, Tab trapped, Esc and Back dismiss, focus back to the opener, the undo toast live above it (R1-11, D-63).
- Design: `docs/04-design.md` § 12 → Over-commitment is a decision, not an error; § 14 Per-screen refinements → Plan and → Master list.
- Decisions: D-37, D-38, D-7, D-63, R3-08.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves the preview in the sheet before the move is confirmed and the *Flip*'s screens, on TASK-063's writes): test that moving a 150k-word book from 2027 Q1 to 2028 Q2 changes
both periods' totals correctly and that the preview reflects the destination
period before the move is confirmed. The moved book takes 2028 Q2's last
ordinal, 2027 Q1 stays contiguous, and undo puts it back at its old position.
Test that On deck and Someday need no year or quarter; that Someday clears the
book's `reading_plan` row without touching `book_status`; that *No quarter yet*
writes a bare year; and that the sheet writes one `period` value, never a year
independent of a quarter and never a month. **Flip (R3-08):** 1.4c's add sheet
now offers *Year or quarter…* through this picker, and adding a book to a year
or quarter writes its `book_status` and `reading_plan` rows in one transaction;
1.9's empty Books *Up next* action becomes *Plan a book*.
- [ ] AC-2: Given a fixture plan and a book on a Library row, *Plan for…* opens the sheet showing the next five years then On deck and Someday; choosing a year shows *No quarter yet* and Q1–Q4, each chip carrying its period's total as TASK-063's query returns it; choosing a quarter fills the preview with that quarter's total plus the book's words, before anything is written, and the primary button reads *Move to Q<n> <year>*.
- [ ] AC-3: A target the move would push past capacity draws the preview amber with the amount over, and nothing on the sheet resolves to `--danger`. On deck and Someday show no quarter row and no total.
- [ ] AC-4: On Add books, *Year or quarter…* is enabled (no `aria-disabled`, no reason line) and a search result row has a secondary *Year or quarter…* button; both open the sheet without the *currently planned* badge, and adding to a quarter puts the book at its end. Undoing that add returns the result row to its addable state. The empty Books *Up next* tab's action reads *Plan a book*.
- [ ] AC-5: The sheet meets the UX floor (`docs/04-design.md` § 10. The UX floor): every chip a real button with a name and its pressed state, nothing interactive under 24px and the chips 44px on the phone, focus on the heading when it opens and back on the opener when it closes by any route, text 4.5:1 and outlines 3:1 in both themes, axe with no new violations, no horizontal scroll at 360px, and screenshots at 360px, 834px and 1280px, light and dark.

## Out of scope

- The writes and the API (TASK-063).
- The rail's blocks and the stack's list sheet (TASK-065).
- **Move** on a plan-page row (2.10, TASK-069), and desktop drag (TASK-070).
- Accepting a stretch year's storage (2.7, TASK-066).

## Files likely touched

- `src/components/PlanPicker.tsx` (new; the plan's name) — the sheet.
- `src/components/BookRowMenu.tsx` — *Plan for…*.
- `src/components/AddBooks.tsx` — the chip enabled.
- `src/components/BookSearch.tsx` — the result row's button, reset on undo.
- `src/app/books/status/page.tsx` — *Plan a book*.
- `src/app/globals.css` — the sheet's chips and preview, from tokens only.
- `test/add-book-sheet.test.tsx`, `test/e2e/plan-picker.spec.ts` (new), `test/e2e/book-search.spec.ts`, `test/e2e/status.spec.ts`.

## Verification

- Automated: `test/e2e/plan-picker.spec.ts` (AC-1's preview clause, AC-2, AC-3, AC-5's axe and screenshots); `test/add-book-sheet.test.tsx` and `test/e2e/book-search.spec.ts` (AC-4's chip, button and reset); `test/e2e/status.spec.ts` (*Plan a book*).
- Manual: `npm run dev`. On the Library, ⋯ → *Plan for…* on a To-read book → pick next year, then a quarter → the preview shows the total after; confirm → the book is last in that quarter on Up next; Undo → back. Add books → search → *Year or quarter…* → add to a quarter; Undo → the row can be added again. Put everything back, as found.

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
