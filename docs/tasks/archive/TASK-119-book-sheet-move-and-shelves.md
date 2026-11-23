---
id: TASK-119
title: 3.5b The book sheet's own writes (2 of 3) — Move and Shelves, a sheet from the sheet
status: Done
depends_on: [TASK-118, TASK-124]
size: M
model: opus
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: 75c88db
---

# TASK-119 — 3.5b The book sheet's own writes (2 of 3) — Move and Shelves, a sheet from the sheet

## Goal

From a book's sheet you can move it in your plan and change which shelves hold it. The picker replaces the sheet rather than opening on top of it, and Back returns to the book.

## Context

- Roadmap: `docs/05-roadmap.md` § 3.5b (its **Check** is AC-1, verbatim). `docs/06-tasklist.md` M14. Part 2 of 3: TASK-118 does the note and owned toggles, TASK-120 the dashboards' rows.
- The sheet: `src/components/BookDetail.tsx` (*Planned for* and *Shelves* rows, text only today), in `src/app/@modal/(.)book/[id]/` (the intercepted route) and `src/app/book/[id]/` (the page, D-157).
- **D-34, one sheet at a time:** a sheet opened from a sheet replaces it, with a back chevron naming where you came from, and Back unwinds one level. The plan picker today is a client sheet (`PlanPickerSheet`, `src/components/PlanPicker.tsx`, opened by `BookRowMenu`, `PlanQuarterRows`, `PlanRail`), not a route. **For the plan gate:** how *Move* replaces the book sheet while keeping D-34's back chevron (*‹ The Book's Title*) and Back: the book sheet swaps its body for `PlanPickerBody`/`MoveBody`, or the picker becomes a route under the book. Name the approach, and what Back and Esc do from each.
- *Move*: only for a to-read book (`PlanPickerSheet` refuses any other status); its write and undo are 2.3's (`POST`/`DELETE /api/plan`, TASK-063 to TASK-065).
- *Shelves Edit* both puts the book on a shelf and takes it off one (owner, 2026-11-18). Putting it on goes through `addBook` with a shelf destination (`POST /api/books`) and its undo; taking it off goes through 5.1b's write and route (TASK-124, which this task waits for), the only one there is. The roadmap entry's "through the routes that already exist" holds once TASK-124 has merged. The mockup draws the *Edit* button, not what it opens: the sheet it opens (each of your shelves, on or off for this book) is drawn in `design/mockups.html` `bookdetail` first (`ui.redrawFiles`). **For the plan gate:** whether *Edit* offers *New shelf…* too (Add books' TASK-097 has it), and whether each shelf saves as it is toggled or the sheet saves once.
- Shelves are books only (5.1, TASK-095 to TASK-097); `shelf_books` keys on the book, ordered.
- UX floor: `docs/04-design.md` § 10; § 13 (the detail sheet).
- Decisions: D-34, D-157, D-37 (plan levels), D-139.
- *From TASK-107 (5.14, PR #298):* the sheet's *Your record* now has a *Listen next* line with *Queue to listen* (`QueueListen`, `useQueueListen` in `src/lib/listen-queue.ts`), offered for every status but *Listening* and *Parked*. It doesn't say whether or where the book is already queued. Showing *#2 in Listen next* and a *Remove* belongs with the sheet's own writes: decide at this plan whether this task draws them (`booksListenNext` in `src/db/queries.ts` has the order; `DELETE /api/listen-queue` removes) or leaves them out. The sheet's rows don't follow its own status change until a reload: after *Listening* is chosen, *Planned for* and the *Listen next* line stay on screen (the UI walk, 2026-11-19); a fresh load hides them.

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim; this part proves *Move* leaving exactly one sheet: TASK-118 proves the note and the owned toggles, TASK-120 the dashboards' rows): test that saving a note from the sheet writes `book_status.notes` once and its Undo puts the old note back; that each owned toggle writes or deletes exactly one `owned_copies` row and its Undo reverses it; that opening *Move* from the sheet leaves exactly one sheet in the DOM; and that a book row on each books dashboard opens `/book/{id}` as a sheet.
- [x] AC-2: Given a to-read book planned for a quarter, opened as a sheet from the Library, when *Move* is pressed, then exactly one `[role=dialog]` sheet is in the DOM, it carries a back control naming the book, and confirming a move to another quarter moves the book (its `reading_plan.period` changes) with an Undo; afterwards the book's sheet shows the new *Planned for*. Back from the picker shows the book's sheet again, and Back once more returns to the Library at its scroll position.
- [x] AC-3: A book that isn't to-read shows *Planned for* only when it has a plan row, and no *Move*.
- [x] AC-4: Given a book on shelf A and not on shelf B, *Shelves Edit* opens one sheet in place of the book's (one `[role=dialog]` in the DOM) listing every shelf with A on and B off. Turning B on writes one `shelf_books` row for B at its end; turning A off deletes A's row through TASK-124's write, closing A's gap. Each has an Undo that reverses exactly that write (B loses only its row; A gets its row back at its old place with its note). Back returns to the book's sheet, whose *Shelves* row then names the shelves as they now are.
- [x] AC-5: The book sheet, and each sheet opened from it, meets the UX floor (`docs/04-design.md` § 10): focus moves into the new sheet and returns to *Move* or *Edit* on Back, the back control is a named button of at least 44px on a phone, axe, nothing on `--danger`, reduced motion swaps without a slide, screenshots at 360px and 1280px of each sheet.

## Out of scope

- The note and the owned toggles: TASK-118.
- The dashboards' rows: TASK-120.
- A new plan level or any change to the picker's own behaviour (its chips, preview, budget).
- Creating a shelf from the sheet (*New shelf…* is Add books', TASK-097), unless the plan gate decides otherwise.
- The take-off write and its route: TASK-124 (5.1b).

## Files likely touched

- `src/components/BookDetail.tsx`: *Move* and *Edit* on their rows
- `src/components/PlanPicker.tsx`: the picker inside the book sheet, with its back control
- `src/app/@modal/(.)book/[id]/page.tsx` (and `layout.tsx`): one sheet at a time, Back
- `src/components/BookShelvesSheet.tsx` (new): what *Edit* opens, on and off per shelf
- `design/mockups.html`, `design/mockups-index.md`: the *Edit* sheet drawn first
- `test/e2e/book-detail.spec.ts`: AC-1's *Move* clause, AC-2 to AC-5

## Verification

- Automated: `test/e2e/book-detail.spec.ts` counts `[role=dialog]` after *Move* and after *Edit*, walks Back twice, and checks each write (on and off a shelf) and its Undo.
- Manual: from the Library at 390px, open a planned book, press *Move*, choose next quarter, confirm → expected: one sheet the whole way, the book's sheet then reads the new quarter, Back twice lands on the Library where you were.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- *#2 in Listen next* and its *Remove* on the sheet (from TASK-107): left out (approved at plan). Placed with the status-change item below as one new roadmap item, not beside 5.14 as the plan said: both are the sheet following its own writes → docs/05-roadmap.md § 3.5c (new; its row in docs/06-tasklist.md § M14)
- The sheet's rows don't follow its own status change: after *Listening*, *Planned for*, *Move* and *Queue to listen* stay until a reload (from TASK-107; still so in this task's UI walk, 2026-11-22) → docs/05-roadmap.md § 3.5c (new; its row in docs/06-tasklist.md § M14)
- D-34 says a sheet from a sheet "is a route push". This task meets its intent with a pane and a same-URL history entry (spec-reviewer R1; approved at close-out) → docs/review/decisions.md § D-171
- The ui-verifier couldn't sign in under auto mode: the classifier refused its `APP_PASSCODE` read even after the owner approved it in the session. The walk ran on a session token the main session minted (UI R1) → docs/OWNER-CHECKLIST.md § Actions from follow-ups
- The UI walk set *The Dry* (development database) to *Listening* and back to *To read* by choosing it, not with Undo, which probably left a start date of 2026-11-22 on it (a status round trip keeps the start) → not tracked: development database, disposable (CLAUDE.md); reported in the PR so the owner can clear it if they care
- AC-3's "with a plan row" half wasn't walked by hand: no book in the development database is reading or read with a plan row (UI R1) → not tracked: proven by `test/e2e/book-detail.spec.ts` *a book that isn't to read…* and `test/book-detail-query.test.ts` *answers the plan row a book kept…*
- Leaving the pane through a link (the empty state's *Shelves*) would have left its history entry behind (spec-reviewer R1) → not tracked: done in this PR (the link replaces the entry)

## Plan

**Approach (the plan gate's question): the book sheet swaps its body; no new route.** `RouteSheet` gains one pane at a time (`useRoutePane()`): *Move* and *Edit* open a pane in the same `[role=dialog]`. The book's body stays mounted and goes `hidden`, so its scroll, a half-typed note and the button that opened the pane all survive. The sheetbar's *Book* label becomes the D-34 back control, `‹ <title>`, named *Back to <title>*, 44px on a phone. Opening a pane pushes one history entry with the same URL (as `Sheet` does). From the pane, browser Back, Esc and the back control each go one level, to the book with focus on *Move* or *Edit*. From the book, Esc and Back close the sheet as they do today, and so the second Back lands on the Library where it was. The close, the scrim, the grab and a drag close the whole sheet from either level (`history.go(-2)` from a pane). A pane has its own `h2`, which takes focus and labels the dialog. The swap slides in over `--dur-2`, and under reduced motion it just swaps. Ruled out: a route under the book (`/book/[id]/move`), which would need a page and an intercept for each pane, plus a full page on refresh, for no gain over a history entry.

On the full page (`/book/{id}`, no sheet under it), *Move* and *Edit* open a client `Sheet` holding the same body. That is one sheet, so D-34 doesn't apply.

**Steps**
1. Mockup first: `design/mockups.html` § `bookdetail` gains a third frame, the *Shelves* pane (back control, each shelf an `aria-pressed` toggle, on or off), and a note on *Move* opening the picker as a pane. `design/mockups-index.md` records it.
2. Tests first (`test/e2e/book-detail.spec.ts`), so they fail on main (see Test strategy).
3. `src/components/Sheet.tsx`: export the close context's provider, so `MoveBody`'s `useSheetClose()` closes a pane.
4. `src/components/RouteSheet.tsx`: the pane: state, history entry, popstate, back control, the pane's heading as the dialog's label, Esc one level, close-all `go(-2)`, focus back to the opener.
5. `src/components/BookSheetActions.tsx` (new): `MoveButton` (`MoveBody`, 2.3's write and undo, unchanged) and `ShelvesButton`. Each opens a pane inside a route sheet, else a `Sheet`.
6. `src/components/BookShelves.tsx` (new): every shelf, `GET /api/shelves`, each an `aria-pressed` toggle. Each saves as it is pressed, with its own Undo toast. On: `POST /api/books {item:{use}, destination:{kind:'shelf'}}`, undone by `DELETE /api/books`. Off: TASK-124's `PATCH /api/shelves/{id} {bookId, remove:true}`, undone by `{undo: change}`. A failed toggle springs back with the failure toast and *Retry*. With no shelves at all, it says so and links to Shelves. No *New shelf…* (out of scope, kept so).
7. `src/components/BookDetail.tsx`: *Planned for* gets *Move* for a to-read book. A book that isn't to-read shows *Planned for* only with a plan row, and never *Move* (AC-3). *Shelves* is always drawn for a book, with *Edit*.
8. `src/db/queries.ts`, `bookDetail`: `plan_period` for a book that isn't to-read, from `plan_period` (to-read keeps `to_read_level`), and `shelf_ids` beside `shelves`. Read-only; no schema change.
9. `src/app/globals.css`: the back control, the pane, the slide, and 44px on a phone.

**Files:** the 10 above, plus the task file. `Sheet.tsx`, `BookSheetActions.tsx`, `BookShelves.tsx` and `queries.ts` were not in *Files likely touched*. `PlanPicker.tsx` and the route files stay unchanged: the pane lives in `RouteSheet`, under the layout.

**Size check:** over 8 files. Kept whole, as the owner's recommendation-approval directs: this is already part 2 of a split, both panes share the one pane mechanism, and the mockup pair and the CSS are small. `autonomy` is already attended.

**Test strategy**
- AC-1 and AC-2: *Move from the sheet leaves one dialog…* Count `[role=dialog]` = 1. Check the back control's name. Confirm a move: `reading_plan.period` changes, Undo puts it back, and *Planned for* reads the new quarter. Back shows the book; Back again shows the Library at its scroll position.
- AC-3: *a book that isn't to-read…* A reading book with a plan row shows *Planned for* and no *Move*; one with no plan row shows neither.
- AC-4: *Shelves Edit…* Shelf A is on and shelf B off. Turning B on writes one row at B's end; Undo removes only that row. Turning A off deletes the row and closes the gap; Undo restores its place and note. One dialog throughout, and after Back the *Shelves* row names the shelves as they now are.
- AC-5: the floor test (ONCE) at 360 and 1280px, light and dark. Focus moves into each pane and returns to *Move* or *Edit* on Back. The back control is 44px on a phone. Axe, contrast and no `--danger`. Reduced motion has no running animation on the swap. Screenshots of each pane.

**Risks:** Next's popstate restore when a same-URL entry pops after a `router.refresh()`: the same pattern `PlanPickerSheet` already uses in the Library. `history.go(-2)` racing the RouteSheet exit.

**Follow-ups (approved at plan)**
- *#2 in Listen next* and its *Remove* on the sheet (from TASK-107): left out → `docs/05-roadmap.md`, as a new item beside 5.14.
- The sheet's rows not following its own status change (from TASK-107): checked in the UI walk, and placed at close-out if it still happens.

## Review log

Verify R1 PASS | CI R1 PASS (62985cf, every project) | Spec R1 APPROVE (3 notes: D-34 wording → D-171; the shelves pane's empty and failed states untested → tested; a link out of the pane left its history entry → `replace`) | Schema R1 APPROVE (minor: another reader's plan row and a quarter beside its own year → tested) | Verify R2 PASS | CI R2 PASS (0bb0c68) | Audit R1 PASS (every new test fails on 75c88db) | UI R1 NOT RUN (sign-in refused: the classifier denied the passcode read) → owner approved; R2 NOT RUN (still refused; file:// blocked) → R3 PASS at all six widths on a session the main session minted, 0 console errors, data left as found but for *The Dry*'s start date (Follow-ups) | Spec and schema not re-run after R1's fixes: tests and a `replace` on one link only | Close-out check R1 CHANGES (3.5c's task-list row; the D-171 bullet's approval mark) → fixed | Drift R1 update first (behind 1; decisions.md conflicted with #317's D-170) → rebased, D-171 after D-170 | Verify R3 FAIL (test/books-dashboard.test.ts: a 5 s timeout under the full run's load; 51/51 alone, no file of this branch) → Verify R4 PASS

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 4 (R3 a timeout under load)
- Review rounds: 1 (spec, schema), 3 (UI: two sign-in refusals, then PASS)
- First-pass AC FAILs: 0
- Plan revisions after approval: 0 (the shelves link's `replace` and the added tests answer review notes)
