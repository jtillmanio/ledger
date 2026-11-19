---
id: TASK-107
title: 5.14 A queue to listen next (2 of 2) — Queue to listen, Listen next on Up next, and Done's Listened chip
status: Review
depends_on: [TASK-106]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: 51c9ebf
---

# TASK-107 — 5.14 A queue to listen next (2 of 2) — Queue to listen, Listen next on Up next, and Done's Listened chip

## Goal

From a book's row or the add sheet you can queue an audiobook to listen next and reorder the queue; Up next shows *Listen next* in that order, and Done can show just the books you listened to.

## Context

- Roadmap: `docs/05-roadmap.md` § 5.14 Audiobooks: a queue to listen next (M17). Pulled ahead of 1.26 (D-139). Feature F-59. Its **Check (proposed):** is the contract.
- **Split, 2 of 2.** TASK-106 built the table, the writes and the route. This part draws them, and **its merge ticks 5.14**.
- **The verbs:** *Queue to listen* on the master-list row's `⋯` (`src/components/BookRowMenu.tsx`) and the add sheet (1.4c, `src/components/AddBooks.tsx`: a destination or a second action, the plan's against the redrawn frame), and *Move to…* to reorder with 1.10's controls (`src/components/ReorderList.tsx`, `src/components/QueueList.tsx`). On the book sheet too, if 3.5's sheet (TASK-079) has merged by this plan. Each write raises the undo toast (`src/components/Undo.tsx`).
- **The three states on the status screens** (`src/app/books/status/page.tsx`, `src/lib/status-tabs.ts`, `booksUpNext`/`booksDone` in `src/db/queries.ts`): Up next gains a *Listen next* group, in queue order, after the reading plan's levels. In flight already has *Listening* (1.23). Done gains a *Listened* chip that keeps only books with an audio read (`book_reads.format = 'audio'`), beside its existing grouping. Each tab's count equals its rows (the Check), so the Up next count includes the queue's books unless the plan's answer (TASK-106: a book on the plan and the queue at once) means one book would count twice: then it counts once.
- **The dashboard** shows the first queued listen in its *Up next* slot only if TASK-106's plan gate said so.
- *From TASK-106 (5.14, PR #290):* the owner's answers at TASK-106's plan gate (2026-11-18): a book may be on the reading plan and the listen queue at once, and the books dashboard's *Up next* slot does **not** show the first queued listen (*Listen next* lives on the Up next tab only). Entering Listening, Read or DNF takes a queued book off (`saveBookStatus`; the change's `unqueued` is the position it had, and `undoBookStatus` puts it back); a Read book re-dated stays queued. The route is `/api/listen-queue`: POST `{ bookId }` (answers `position`, `added`), POST `{ bookId, restore }` (remove's undo), PATCH `{ bookId, to }` (answers `position` and `from`, which a move's undo PATCHes back), DELETE `{ bookId }` (answers the `position` it had).
- *From TASK-106 (5.14, PR #290), open question for the plan:* a soft-deleted book keeps its `listen_queue` row and position (as `run_queue`'s does), so the reads must filter `deleted_at` and number the rows they show (`row_number()`), never print the stored `position`, and a *Move to…* must turn the shown place into a stored position. The add undos (`undoAddBooks`, `undoRelease`, `undoOwned`) soft-delete a book they created without looking at the queue: if *Queue to listen* on the add sheet can queue a book its add's undo then removes, decide whether that undo refuses or deletes the queue row. `queueListen` takes no book row lock, so a queued book may already be finished; no test yet races two queue writes (schema review, TASK-106).
- **Not drawn yet:** the `status` frames gain *Listen next* and the *Listened* chip, and `blist`/`add` the *Queue to listen* verb, in this PR (`ui.redrawFiles`).
- Design: `design/mockups.html` § `status`, § `blist`, § `add`; `docs/04-design.md` § 10 The UX floor; `.claude/rules/ui.md` (every status screen keeps *In flight · Up next · Done*, in that order and under those names).
- Decisions: D-85, D-139.

## Acceptance criteria

- [x] AC-1 (roadmap **Check (proposed):**, verbatim; this part proves the browser sentence on the test database: *Listen next* in queue order, the *Listened* chip, each tab's count. TASK-106 proves the `npm test` sentence and the export): (proposed; the owner agrees it by merging or edits it first)
`npm test`: queueing three books gives positions
1–3; setting #2 to *Listening* leaves the other two at 1–2, and its undo
restores all three in order. In the browser (0.11), Up next lists *Listen
next* in queue order; Done's *Listened* chip lists only books with an
audio read; each tab's count equals its rows. The export test passes with
`listen_queue`.
- [x] AC-2: Given a to-read book, choosing *Queue to listen* from its `⋯` raises an undo toast and Up next's *Listen next* lists it last; *Undo* takes it off.
- [x] AC-3: Given three queued books, *Move to…* position 1 on the third redraws *Listen next* as 3, 1, 2 without a reload, and the order survives a reload.
- [x] AC-4: Given one book read as text and one listened, Done's *Listened* chip lists only the listened book, the chip is current (`aria-pressed` or `aria-current`) and in the URL, and *All* lists both.
- [x] AC-5: The `status`, `blist` and `add` frames in `design/mockups.html` draw *Listen next*, the *Listened* chip and *Queue to listen*, and `design/mockups-index.md` names them (task 5.14).
- [x] AC-6: The status screen and the verbs meet the UX floor (`docs/04-design.md` § 10): *Listen next* with no books is absent (not an empty heading), the chip and menu items are real controls with names, ≥ 24px, *Move to…* has a keyboard route, contrast in light and dark, reduced motion on reorder, screenshots at 360px and 1280px.

## Out of scope

- The table, writes and route (TASK-106).
- Parking a queued book (5.15).
- The book sheet, unless TASK-079 has merged by this plan.

## Files likely touched

- `src/components/BookRowMenu.tsx` — *Queue to listen*.
- `src/components/AddBooks.tsx` — the add sheet's verb.
- `src/app/books/status/page.tsx`, `src/lib/status-tabs.ts`, `src/db/queries.ts` — *Listen next* and the *Listened* chip.
- `src/components/QueueList.tsx` or `src/components/ReorderList.tsx` — reuse for the listen queue's *Move to…*.
- `design/mockups.html`, `design/mockups-index.md` — `status`, `blist`, `add` (redraw).
- `test/status.test.ts`, `test/e2e/listen-queue.spec.ts` (new).

## Verification

- Automated: `test/status.test.ts` (the groups, chip and counts against their rows), `test/e2e/listen-queue.spec.ts` (AC-1's browser sentence, AC-2 to AC-4, axe; screenshots at 360 and 1280).
- Manual: on the dev database, Library → a book's `⋯` → *Queue to listen* → Status → Up next → *Listen next* lists it → *Undo*. Leave the data as found.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- (approved at plan) Candidate decision: the add sheet's *Queue to listen* is a second action, and one toast at a time means an add's undo never meets a book it queued; the add undos stay as they are, and a book soft-deleted otherwise keeps its hidden queue row (TASK-106). → docs/review/decisions.md § D-165
- (approved at plan) The book sheet doesn't say whether or where a book is queued; it offers *Queue to listen* only. Showing *#2 in Listen next* (and *Remove*) belongs with the sheet's own writes. → docs/tasks/TASK-119-book-sheet-move-and-shelves.md § Context
- The book sheet's rows don't follow its own status change until a reload: after *Listening*, *Planned for* and *Listen next* stay drawn (UI walk; *Planned for* did before this task). → docs/tasks/TASK-119-book-sheet-move-and-shelves.md § Context
- No test races two queue writes, and `queueListen` takes no book row lock (TASK-106's schema review, repeated in this plan's Risks). → not tracked: TASK-106's own finding, outside this task's UI scope, and already recorded in TASK-106's archived task file

## Plan

Approved by the owner, 2026-11-19 ("go with all recommendations"; the session runs on Opus by the owner's choice, the task says `sonnet`).

**Decisions taken at the gate (the recommendations):**
- *Move to…* is 1.10's controls as they are (`ReorderList`): the handle (drag, long-press, Space and the arrows) and the row menu's *Move to top · Move up · Move down*, plus *Remove from Listen next*. AC-3's "Move to… position 1" is *Move to top*. A drop sends the stored position of the row it lands on, so a soft-deleted book's hidden row keeps its place and the shown place (the list index, the `row_number` of the rows drawn) never prints a stored position.
- *Listen next* is drawn after every plan level, Someday's closing row included, in queue order, absent with no books. It lists every queued book that isn't soft-deleted, whatever its status (a Read book re-dated stays queued, TASK-106). The Up next count is the plan's drawn books plus the queued books not already drawn in the plan (a book on both counts once).
- The add sheet's verb is a second action, not a destination: *Queue to listen* on a result that has a book (a library result at once, a Hardcover one once added), a write of its own with its own toast. One toast at a time (task 1.8b) means its push commits the add, so an add's undo never meets a book it queued: `undoAddBooks`, `undoRelease` and `undoOwned` stay as they are. A book soft-deleted some other way keeps its hidden row, as TASK-106 chose.
- The verb is offered for every status but *Listening* and *Parked* (entering either takes a book off). Its toast is *Added to Listen next* with the title, Undo a DELETE; a book already queued says *Already in Listen next* and writes nothing.
- Done's chip row is *All · Listened*: real links, `?format=audio` in the URL, the chosen one `aria-current`, drawn whenever Done has a book. *Listened* keeps the years and *Stopped* with only books that have an audio read, and the Done count is what it draws; with none, *Nothing listened to yet.* links back to *All*.
- The book sheet (TASK-079 merged) gets a *Listen next* line in *Your record* holding the same *Queue to listen* button. It doesn't say whether or where the book is queued (follow-up below).
- The books dashboard is unchanged (TASK-106's gate).

**Steps**
1. `src/db/queries.ts`: `booksListenNext(userId)`, the queued books not soft-deleted in position order (`StatusBook` plus `ordinal` = the stored position, `status`, `cover_url`).
2. `src/lib/status-tabs.ts`: `parseFormat` for `?format=`, `listenedOnly(done, on)` and `upNextCount(drawnIds, queue)`, pure, for the page and the unit tests.
3. `src/lib/listen-queue.ts` (new, client-safe): the `/api/listen-queue` calls and `useQueueListen()`, the verb with its toast and undo, shared by the three surfaces.
4. `src/components/ListenNext.tsx` (new): `ReorderList` over the queue (PATCH to move, DELETE/POST restore to remove), cover, title, glyph, the book's place and the status control.
5. `src/app/books/status/page.tsx`: the *Listen next* section, the Up next count, the Done chip row and its filter, and the empty *Listened*.
6. `src/components/BookRowMenu.tsx`: *Queue to listen*. `BookSearch.tsx` + `AddBooks.tsx`: the result's *Queue to listen*. `BookDetail.tsx` + `src/components/QueueListen.tsx` (new): the sheet's line.
7. `design/mockups.html` + `design/mockups-index.md`: `status` (a 360 Up next frame with *Listen next*, a 360 Done frame with *Listened* chosen), `blist` (*Queue to listen* in the open `⋯`), `add` (the result's *Queue to listen*), `bookdetail` (the *Listen next* line), with notes.
8. Tests (below), then `verify.full`.

**Files** (not in "likely touched": `src/lib/listen-queue.ts`, `src/components/ListenNext.tsx`, `src/components/QueueListen.tsx`, `src/components/BookSearch.tsx`, `src/components/BookDetail.tsx`; `src/app/globals.css` only if a class is missing.) **Size:** about 11 files besides tests, UI only, no schema. This is already the second half of a split, and the redraw files are required, so it stays whole.

**Test strategy**
- AC-1 (counts, order, chip): `test/status.test.ts` › *books Listen next and Listened (roadmap 5.14 check)*: queue order, a soft-deleted book hidden and its place kept, `upNextCount` counting a planned and queued book once, `listenedOnly`. `test/e2e/listen-queue.spec.ts` › *Up next lists Listen next in queue order and each tab's count equals its rows* and *Done's Listened chip*.
- AC-2: e2e › *Queue to listen from a row's ⋯ lists it last; Undo takes it off*.
- AC-3: e2e › *Move to top on the third redraws 3, 1, 2 without a reload, and a reload keeps it*.
- AC-4: e2e › *the Listened chip keeps only the listened book, is current and in the URL; All lists both*.
- AC-5: manual review of the frames (the reviewer reads the diff of `design/mockups.html`).
- AC-6: e2e › axe at 360 and 1280, light and dark, screenshots; no *Listen next* heading with an empty queue; the target sizes of the chip and menu items; the keyboard route on the handle; reduced motion (the reorder animates nothing).

**Plan revision 1 (Phase 3, under the owner's "go with all recommendations"):** `/books/status` reads the listen queue as a fifth query in its one wave, so its budget goes from 4 to 5, with the reason in `docs/02-architecture.md` § Performance budget and beside it in `test/query-budget.test.ts` (both outside the plan's files); `test/library-page.test.tsx`'s mock of `@/db/queries` gains `booksListenNext`. Folding the queue into another query would only hide the cost.

**Plan revision 2 (Phase 5, the UI walk):** the Listen next row's `⋯` was the shared 32px on the phone; `src/app/globals.css` raises it to 44px under 768px, as Top books and Shelves do, and the AC-3 browser test asserts it.

**Risks:** `ReorderList`'s undo moves back to the stored position it came from, which is right while the hidden rows don't move. No test races two queue writes (TASK-106's schema review); that isn't this task's.

**Follow-ups (approved at plan):** see `## Follow-ups`.

## Review log

Verify R1–R2 FAIL (library-page mock, query budget 5 > 4) → R3 PASS | Audit R1 CHANGES (2 NON-DISCRIMINATING: empty-queue absence, axe scan) → R2 PASS | Schema R1 APPROVE | Spec R1 CHANGES (Follow-ups bullets' destinations) → close-out check | UI R1 PASS (phone ⋯ 32px → fixed, plan revision 2) | Rebased on b2e3071 (5.12, #297) → verify PASS

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 3 (then 2 more after the audit's test changes and the rebase, both PASS)
- Review rounds: 1 (spec, schema, UI) + the close-out check
- First-pass AC FAILs: 0 (AC-6's phone ⋯ was under the 44px floor, not under 24px; fixed in plan revision 2)
- Plan revisions after approval: 2
