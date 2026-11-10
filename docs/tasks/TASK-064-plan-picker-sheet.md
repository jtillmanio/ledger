---
id: TASK-064
title: 2.3 Plan editor (2 of 3) — the picker sheet, from the Library and Add books
status: Review
depends_on: [TASK-063]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: b9b7397
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

- [x] AC-1 (roadmap **Check:**, verbatim; this part proves the preview in the sheet before the move is confirmed and the *Flip*'s screens, on TASK-063's writes): test that moving a 150k-word book from 2027 Q1 to 2028 Q2 changes
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
- [x] AC-2: Given a fixture plan and a book on a Library row, *Plan for…* opens the sheet showing the next five years then On deck and Someday; choosing a year shows *No quarter yet* and Q1–Q4, each chip carrying its period's total as TASK-063's query returns it; choosing a quarter fills the preview with that quarter's total plus the book's words, before anything is written, and the primary button reads *Move to Q<n> <year>*.
- [x] AC-3: A target the move would push past capacity draws the preview amber with the amount over, and nothing on the sheet resolves to `--danger`. On deck and Someday show no quarter row and no total.
- [x] AC-4: On Add books, *Year or quarter…* is enabled (no `aria-disabled`, no reason line) and a search result row has a secondary *Year or quarter…* button; both open the sheet without the *currently planned* badge, and adding to a quarter puts the book at its end. Undoing that add returns the result row to its addable state. The empty Books *Up next* tab's action reads *Plan a book*.
- [x] AC-5: The sheet meets the UX floor (`docs/04-design.md` § 10. The UX floor): every chip a real button with a name and its pressed state, nothing interactive under 24px and the chips 44px on the phone, focus on the heading when it opens and back on the opener when it closes by any route, text 4.5:1 and outlines 3:1 in both themes, axe with no new violations, no horizontal scroll at 360px, and screenshots at 360px, 834px and 1280px, light and dark.

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

- *Accept as a stretch year* is drawn `aria-disabled` in the over-capacity preview, with the reason *Accepting a stretch year arrives with 2.7.*; enabling it to write the acceptance belongs to 2.7 → docs/tasks/TASK-066-stretch-year-stored.md § Context
- The Books status empty *Up next* frame in the mockups still read *Add a book* → not tracked: done in this PR (plan revision: `design/mockups.html` and `design/mockups-index.md` redrawn to *Plan a book*)
- Browser Back from the picker step inside the Add books sheet closes the whole sheet instead of unwinding one level, as `BatchSheet` does → not tracked: a deliberate departure from D-34's "Back unwinds one level at a time", chosen at the plan gate (as `BatchSheet` does) so a second sheet opened as the first closes can't race its history entry; the PR says so plainly
- An Add books preview for a library book already planned in the target quarter counts its words twice (it sends `words`, not `bookId`/`from`) → not tracked: an edge case outside the ACs; the write and the plan totals are unaffected

## Plan

_Written by /plan-batch or /implement-task Phase 1. Approved by the user (plan_status: approved) before any code is written._

Approved 2026-11-10 (owner, plan gate). Worked in the worktree `.claude/worktrees/task-2.3-picker` on `task/2.3-plan-picker-sheet`, with its own test database `ledger_test_3` and E2E port 3201 (`.env.worktree`); another session holds the main checkout.

**Owner's choices at the gate**
- *Accept as a stretch year* is drawn in the amber preview `aria-disabled`, with its reason shown (*Accepting a stretch year arrives with 2.7.*); TASK-066 enables it.
- *Plan a book* (the empty Books *Up next* tab) opens Add books with *Add to* set to the current Eastern quarter (`{ kind: "period", period: "<year>-Q<n>" }`), changeable through *Year or quarter…*.
- Kept whole, not split (10 source files, no schema; TASK-063 the same as 1 of 3).

**Steps**
1. `src/lib/book-add.ts`: `Target` gains `{ kind: "period"; period }`; `targetName` says `Q3 2027` / `2027` (`quarterName`); `destinationOf` sends `{ kind: "period", period }`. Verifiable: `add-book-sheet.test.tsx` adds to a period target and reads the request body.
2. One book's plan level for the sheet: `planBook(userId, bookId)` in `src/db/queries.ts` (title, author, status, `to_read_level`'s `level` and `period`, words: the stated count, else pages × your words per page when 50 pages or more, as `plan_book_words`; `estimated`), and `GET /api/plan?bookId=…` (no `to`, no `firstYear`) answering `{ book }`, 404 for a removed or unknown book. Nothing added to the Library's 500-row payload. Verifiable: `test/plan-period.test.ts`.
3. `src/components/PlanPicker.tsx` (new): `PlanPickerBody` and `PlanPickerSheet` (the shared `Sheet`).
   - Header: title, *author · 118k words* (mono; `~` when estimated), and *planned · Q2 2027* (or *planned · On deck*) in move mode only.
   - Row 1, a group *Move to* / *Add to*: five years from `easternYear()`, then *On deck* and *Someday*; each a real `<button type="button" aria-pressed>`. Choosing a year opens row 2: *No quarter yet* (the bare year) and Q1–Q4, each with its period's current words (`GET /api/plan?firstYear=`), in mono. In move mode the sheet opens on the current period's year.
   - Preview card (`role="status"`, live): `GET /api/plan?to=…` with `bookId`/`from` (move) or `words` (add); *Q3 2027 after the move* · *533k of 760k*; over capacity it is `--blocked` amber with *1,010k of 760k · over 250k* and the disabled *Accept as a stretch year* with its reason. Never `--danger`. On deck and Someday: no quarter row, no preview.
   - Primary names the target: *Move to Q3 2027* / *Move to Someday* (move), *Add to Q3 2027* (a result row's picker), *Choose Q3 2027* (the Add to chip's picker, which sets the target only). `aria-disabled` with a reason until a target is chosen, and when the target is the book's current level (*It's already there.*). *Cancel* beside it.
   - Move: `POST /api/plan { bookId, from, to }` (from = `to_read_level`'s period, or `someday`); pushes an undo onto the 1.2 stack whose undo sends `DELETE /api/plan { move }` (a 409 rejects, so the stack reports it); `router.refresh()`; closes the sheet. A failed move keeps the sheet open with a neutral error line.
4. Library: `BookStatus` passes its live `saved.status` to `BookRowMenu`, which adds *Plan for…* (first item) on a `to_read` row and opens `PlanPickerSheet` (loaded with `next/dynamic`, as `FollowSheet`); focus returns to the `⋯`.
5. Add books (`AddBooks.tsx`, `BookSearch.tsx`): *Year or quarter…* chip enabled, the `addto-later` reason line gone; its picker sets the target (the chip then reads the period, pressed). Each result row gets a secondary *Year or quarter…* (`btn sec sm`) beside its primary, opening the picker for that book (words: the library hit's `word_count`, else pages × `answer.wordsPerPage`), whose primary adds that one book to the chosen level through `POST /api/books` with that destination (a per-row override of the target in `send`). Inside the add sheet (`AddBooksButton`), the picker is a step swapped inside the same `Sheet` (as `BatchSheet`, D-34: never two sheets), its heading focused and a *‹ Add books* back button returning focus to the opener; on the full page it is a `PlanPickerSheet`. Undoing an add returns its result row to addable (its outcome cleared), whatever level it went to.
6. `src/app/books/status/page.tsx`: the empty *Up next* action reads *Plan a book*, an `AddBooksButton` with the current Eastern quarter as its target.
7. `src/app/globals.css`: the picker's chips (min 44px tall under 1024px, 32px from there, never under 24px; pressed = `--brand` / `--on-brand`, as `.addto .chip`), the chip totals, the preview (`--raise`; over: `--blocked-soft` ground, `--blocked` text), all from tokens.

**Files**
- `src/components/PlanPicker.tsx` (new) — the sheet and its body.
- `src/components/BookRowMenu.tsx` — *Plan for…* on a to-read row.
- `src/components/BookStatus.tsx` — passes the live status to the menu. **Not in Files likely touched.**
- `src/components/AddBooks.tsx` — the chip enabled, the row picker's add, the in-sheet step.
- `src/components/BookSearch.tsx` — the row's *Year or quarter…*, reset on undo.
- `src/lib/book-add.ts` — `Target`'s period (the task's Context names it).
- `src/db/queries.ts` — `planBook`. **Not in Files likely touched.**
- `src/app/api/plan/route.ts` — `GET ?bookId=`. **Not in Files likely touched.**
- `src/app/books/status/page.tsx` — *Plan a book*.
- `src/app/globals.css` — the sheet's chips and preview.
- Tests: `test/plan-period.test.ts` (the new GET; **not in Files likely touched**), `test/add-book-sheet.test.tsx`, `test/e2e/plan-picker.spec.ts` (new), `test/e2e/book-search.spec.ts`, `test/e2e/status.spec.ts`.

**Test strategy** (years relative to `easternYear()`: Y+1 and Y+2, which in 2026 are the Check's 2027 and 2028; the chips only offer five years from now)
- AC-1: `test/e2e/plan-picker.spec.ts` › *moves a 150k book from Q1 to Q2 of the next year, previewed first*: fixture books in Y+1-Q1 (the 150k one in the middle) and Y+2-Q2; the preview reads Y+2-Q2's total + 150k while the DB is unchanged; after confirming, the book is Y+2-Q2's last ordinal, Y+1-Q1 is contiguous, both chips' totals moved by 150k; Undo puts it back at its old ordinal. › *On deck and Someday need no year or quarter* (no quarter row, the write lands; Someday deletes the `reading_plan` rows and leaves `book_status` as it was). › *No quarter yet writes a bare year*. › every POST body captured (`page.on("request")`) has `from`/`to` matching one period value and no `year`, `quarter` or `month` key. The Flip: AC-4's tests.
- AC-2: `plan-picker.spec.ts` › *Plan for… opens on five years, On deck and Someday*: chip names in order; a year shows *No quarter yet* and Q1–Q4 with totals equal to `planCapacity`'s for the fixture; a quarter fills the preview with its total + the book's words before anything is written; the primary reads `Move to Q{n} {year}`.
- AC-3: `plan-picker.spec.ts` › *over capacity is amber, never red*: the preview's colour equals `tokenColour(--blocked)` and shows the amount over; no descendant of the sheet has a colour, background or border colour equal to `--danger`; On deck and Someday show no quarter row and no total.
- AC-4: `test/add-book-sheet.test.tsx` › the chip has no `aria-disabled` and there is no reason line; a result row has *Year or quarter…*; a period target's add sends `{ kind: "period", period }`. `test/e2e/book-search.spec.ts` › *adds a result to a quarter at its end, and Undo makes it addable again*. `test/e2e/status.spec.ts` › the empty *Up next* action reads *Plan a book* and opens Add books on this quarter.
- AC-5: `plan-picker.spec.ts` › chips are buttons with names and `aria-pressed`; every control ≥ 24px, chips ≥ 44px at 360–412px; focus on the heading at open and back on the opener after Esc, Back, Cancel and a confirm; `contrastFailures` empty and outlines 3:1 in light and dark; `expectNoAxeViolations`; `expectNoHorizontalScroll` at 360px; screenshots at 360, 834 and 1280px, light and dark.

**Risks / open questions**
- The 1.7 reset (undo returns the row to addable) may already hold (`tell`'s undo clears the outcome); then the test proves it rather than fixes it, and the PR says so.
- A book with more than one plan row: `from` is `to_read_level`'s period (its earliest), the one the rest of the app shows.
- `planBook` repeats `plan_book_words`'s words rule for a book in no period (Someday); computed, not stored (hard rule 2).

**Size check**: 10 source files, over 8, no schema; kept whole by the owner (above). `autonomy: attended`.

**Follow-ups**: none at plan time.

**Plan revisions after approval** (two, both small; no scope added)

- `src/components/Sheet.tsx` (not in the Files list): the Tab trap skips controls inside `[hidden]` or `[inert]`. The Add books picker is a step that hides the rest of the sheet (plan step 5); without this, Tab from the step's first or last control left the dialog.
- `design/mockups.html` and `design/mockups-index.md` (`ui.redrawFiles`): the Books status empty *Up next* frame reads *Plan a book* (plan step 6's copy change), as the kit asks for a redrawn frame in the same PR.
- `src/components/AddBooksButton.tsx` was already named in plan step 5 but missing from the Files list: it holds the sheet's heading so the step can take it.

## Review log

Verify R1 full: 1,058 passed, 6 failed (my contrast check in `plan-picker.spec.ts` ran while a chip was mid-transition; the spec now waits for transitions) → R2 round PASS → R3 round PASS (after the review fixes) | Audit R1 CHANGES REQUIRED (book_status not asserted after the add; the amber state's contrast never measured; one joined line) → R2 PASS | Spec R1 APPROVE | Schema R1 APPROVE (two minors applied: a test that `planBook` agrees with `plan_book_words`, and the `?bookId=` branch only without `from`/`words`) | UI NOT RUN: ui-verifier was blocked reading the passcode and the owner chose to skip it for this task (2026-11-10), so the live walk was not independently run; `plan-picker.spec.ts` covers the sheet in every core project and at 360/834/1280px light and dark, and the owner's preview walk stays the gate.

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 3 (1 full chain, 2 round chains)
- Review rounds: 1 spec, 1 schema, 1 audit re-check; UI not run
- First-pass AC FAILs: 0 from reviewers (1 own test failure in the first full chain)
- Plan revisions after approval: 2 (Sheet.tsx Tab trap; the mockup redraw), plus AddBooksButton.tsx named in step 5 but not in Files
