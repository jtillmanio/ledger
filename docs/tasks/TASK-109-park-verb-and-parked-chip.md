---
id: TASK-109
title: 5.15 Parked (2 of 4) — Park on the status control and the row, the Parked chip and the search tag
status: In progress
depends_on: [TASK-108]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: ae89713
---

# TASK-109 — 5.15 Parked (2 of 4) — Park on the status control and the row, the Parked chip and the search tag

## Goal

From a book's status control or its row you can park it, with an Undo; the Library has a *Parked · N* chip, and search finds a parked book tagged *Parked*.

## Context

- Roadmap: `docs/05-roadmap.md` § 5.15 Parked (M17). D-105. Pulled ahead of 1.26 (D-139). Feature F-66. Its **Check (proposed):** is the contract.
- **Split, 2 of 4.** TASK-108 built the status, its column and the queries. This part draws the verb, the chip and the tag. TASK-110 and TASK-111 follow; TASK-111's merge ticks the entry.
- ***Park*** sits on the status control (`src/components/BookStatus.tsx`, *To read · Reading · Listening · Read · DNF*) and the master-list row's `⋯` (`src/components/BookRowMenu.tsx`), for a book that is `to_read`, `reading` or `listening`; on the book sheet too if 3.5's sheet (TASK-079) has merged by this plan. It is grey, like DNF (`.claude/rules/ui.md`: DNF and *Skip* are grey; parking is not a warning). One write through `useBookWrite` (`src/components/useBookWrite.ts`), whose toast's *Undo* restores the status, the plan period and the queue position (TASK-108's undo). `BookStatusName` and the status labels (`src/lib/format.ts`, `src/components/useBookWrite.ts`) gain *Parked*.
- **The chip.** The Library (`src/app/books/list/page.tsx`) gains *Parked · N* after *Unlisted · N* (1.21's pattern), in the URL, combining with the sort (D-110; `libraryHref` in `src/lib/library-sort.ts`).
- **The tag.** The Library box's search (1.22, `src/components/BookListSearch.tsx`) and Add books' search (`src/components/BookSearch.tsx`) tag a parked book *Parked*, as they tag a book's place or status today.
- **Not drawn yet:** the mockup gains the *Park* verb on the status control, the *Parked · N* chip and a parked row in `blist`, at phone, tablet and desktop widths, before they are built; `design/mockups-index.md` lists them (`ui.redrawFiles`).
- Design: `design/mockups.html` § `blist`; `docs/04-design.md` § 10 The UX floor.
- Decisions: D-83, D-105, D-110.
- *From TASK-108 (5.15, PR #293):* what TASK-108 built, for this plan: `parked` is in `SETTABLE_STATUSES`; `saveBookStatus` refuses it (400) unless the book is `to_read`, `reading` or `listening` (`PARKS_FROM`); the change answers `unplanned` (every plan row it took out, with its place) beside `unqueued`, and `undoBookStatus` puts both back; `listCounts().parked` is the chip's count; `listBooks({ status: "parked" })` is its list; `isParkedMidRead` (`src/lib/parked.ts`) says whether the start was held (D-163).
- *From TASK-108 (5.15, PR #293), open question for the plan:* an add flow's *Use that* into On deck or a quarter (`writeDestination`, Add books' search) keeps a status the book has, so a parked book added there becomes planned and still parked, on no rail; its `waiting` read also comes before the plan lock, so a park committing in between could leave the same state. Should an add to a plan level move a Parked book to `to_read` (as it moves an Unlisted one), refuse it, or leave it?
- *From TASK-108 (5.15, PR #293), open question for the plan:* `queueListen` (`/api/listen-queue`) checks only that a book is live, so a Parked book can be queued after it was parked. Should *Queue to listen* refuse a Parked book, unpark it, or leave it?

## Acceptance criteria

- [ ] AC-1 (roadmap **Check (proposed):**, verbatim; this part proves, in the browser (0.11) on the test database: a parked book present under the master list's *Parked* chip and in search tagged *Parked*. TASK-108 proves the data clauses, TASK-110 the cadence, TASK-111 the review and the dashboard line): (proposed; the owner agrees it by merging or edits it first)
`npm test`: parking the 2nd of 3 books in 2027 Q1
writes `parked`, removes its plan row and leaves Q1 at ordinals 1–2, and
Undo restores `to_read` at position 2. A parked book is absent from
`to_read_level`, `plan_period`, the three status-screen tabs and 2.10b's
suggestions, and present under the master list's *Parked* chip and in
search tagged *Parked*; a series with one read and one parked book reads
`1 / 2`. With a monthly cadence, one parked book and a last review 40 days
ago, the review is due; with nothing parked it is not; *Done reviewing*
makes it not due. In the browser (0.11), the review's *Plan…* opens 2.3's
picker, *Unlisted* writes `unlisted` and Undo puts back `parked`, and the
dashboard line shows only when the review is due. Nothing on the
dashboard or the review resolves to `--danger`.
- [ ] AC-2: Given a planned to-read book, choosing *Park* on its status control moves it under *Parked · N* (N up by one) without a reload, and the toast's *Undo* puts it back to *To read* in its quarter at its position.
- [ ] AC-3: *Park* is offered for a to-read, reading or listening book and not for a read, DNF or Unlisted one; it is drawn grey, never `--danger` or `--blocked`.
- [ ] AC-4: Typing a parked book's title into the Library box lists it tagged *Parked*; Add books' search shows it as yours, tagged *Parked*.
- [ ] AC-5: `design/mockups.html`'s `blist` frame draws *Park*, the *Parked · N* chip and a parked row, and `design/mockups-index.md` names them (task 5.15).
- [ ] AC-6: The Library and status control meet the UX floor (`docs/04-design.md` § 10): *Parked* with no books draws the list's empty state, the chip and verb are real controls with names, ≥ 24px, contrast in light and dark, screenshots at 360px and 1280px.

## Out of scope

- The status's data side (TASK-108); the cadence (TASK-110); `/parked`, the dashboard line and the Inbox row (TASK-111).
- Parked runs (5.16).

## Files likely touched

- `src/components/BookStatus.tsx`, `src/components/BookRowMenu.tsx`, `src/components/useBookWrite.ts` — *Park*.
- `src/app/books/list/page.tsx`, `src/lib/format.ts`, `src/lib/library-sort.ts` — the chip and labels.
- `src/components/BookListSearch.tsx`, `src/components/BookSearch.tsx` — the *Parked* tag.
- `design/mockups.html`, `design/mockups-index.md` — `blist` (redraw).
- `test/library-page.test.tsx`, `test/e2e/parked.spec.ts` (new).

## Verification

- Automated: `test/library-page.test.tsx` (the chip, its count, the labels), `test/e2e/parked.spec.ts` (AC-1's chip and search clauses, AC-2 to AC-4, axe; screenshots at 360 and 1280).
- Manual: on the dev database, Library → a planned book → *Park* → *Parked · 1* lists it → *Undo* → back in its quarter. Leave the data as found.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- An add to a plan level (On deck, a year, a quarter: `writeDestination`, Add books' *Use that*) moves a Parked book to `to_read` and plans it, as it moves an Unlisted one, re-reading the status under the plan lock so a park committing in between can't leave a planned Parked book; TASK-111's *Plan…* needs the same unparking (owner, at TASK-109's plan gate) (approved at plan) → `docs/tasks/TASK-111-parked-review-and-reminders.md` § Context
- `queueListen` (`/api/listen-queue`) refuses a Parked book (400), as the UI already hides *Queue to listen* for one (`queueable`) (owner, at TASK-109's plan gate) (approved at plan) → `docs/tasks/TASK-111-parked-review-and-reminders.md` § Context

## Plan

_Approved by the owner 2026-11-20._

**Steps**

1. **Labels.** `BookStatusName` and `NAMES` (`src/components/useBookWrite.ts`) gain `parked` (*parked*); `PLACE` in `src/lib/format.ts` gains *Parked* (Add books' search tag through `placeTag`). `parkable(status)` in `src/lib/parked.ts`: `to_read`, `reading`, `listening` — the client twin of `PARKS_FROM`, with a test that they agree.
2. **The status control** (`src/components/BookStatus.tsx`). *Park* after DNF, grey (the `dnf` class), drawn while `parkable(status)` or the book is Parked (then `aria-pressed`). A Parked book's badge is grey (`dn`), as Unlisted's. One write through `useBookWrite`, toast *<title>: parked · Was to read*, its Undo the server's (TASK-108 puts back status, plan rows and queue). An Undo that brings back a row the park took off the list puts focus on its status badge (the Unlisted `refocus` pattern). It reaches the Library, Now, the status screens and the book sheet (TASK-079 merged) through the one component.
3. **The row's `⋯`** (`src/components/BookRowMenu.tsx`). *Park* for a parkable book; `BookStatus` hands the menu its own park, so both routes are one write and one Undo.
4. **The chip** (`src/app/books/list/page.tsx`). *Parked · N* after *Unlisted · N* from `listCounts().parked`, named *Parked, N book(s)*, `libraryHref({ status: "parked", owned, ...order })`, `aria-current` when chosen, absent at 0; `?status=parked` with none draws the list's empty state.
5. **The redraw.** `design/mockups.html` `blist`: *Park* on the expanded control, the *Parked · N* chip and a Parked row (grey badge), at phone, tablet and desktop, plus a notes entry; `design/mockups-index.md`'s `blist` row names them (task 5.15).

**Files**

- `src/components/useBookWrite.ts`, `src/lib/format.ts`, `src/lib/parked.ts` (not in Files likely touched: `parkable`) — labels and the rule.
- `src/components/BookStatus.tsx`, `src/components/BookRowMenu.tsx` — *Park*.
- `src/app/books/list/page.tsx` — the chip.
- `design/mockups.html`, `design/mockups-index.md` — `blist` redraw, and *Park* on `bookdetail`'s *Your record* control (the sheet renders `BookStatus`).
- `test/add-book-sheet.test.tsx` and `test/parked.test.ts` (not listed), `test/library-page.test.tsx`, `test/e2e/parked.spec.ts` (new); `test/e2e/audiobooks.spec.ts` (pinned the control's buttons, which gain *Park* on a Listening book).
- Listed but unchanged: `src/lib/library-sort.ts` (`libraryHref` already carries any status), `src/components/BookListSearch.tsx` (the Library row's badge is its tag), `src/components/BookSearch.tsx` (gets *Parked* through `placeTag`).

**Test strategy**

- AC-1 (this part's clauses), AC-4: `test/add-book-sheet.test.tsx` — Add books' result for a Parked book is tagged *Parked* (through `placeTag`); `test/e2e/parked.spec.ts` — the chip lists a parked book, the Library box lists it with the *parked* badge, Add books' search tags it *Parked* under *In your library*.
- AC-2: `parked.spec.ts` seeds its own three to-read books in one quarter (deleted after); *Park* on the 2nd → *Parked, N+1* lists it without a reload; *Undo* → `to_read`, back in the quarter at ordinal 2.
- AC-3: `parked.spec.ts` — *Park* in the control and the `⋯` for to-read, reading and listening, absent for read, DNF and Unlisted; its colour and background are not `--danger` or `--blocked`. `test/parked.test.ts` — `parkable` agrees with `PARKS_FROM`.
- AC-5: manual / spec-reviewer reads the `blist` frames and the index row.
- AC-6: `test/library-page.test.tsx` — the chip's name, count, href (sort and owned kept), absent at 0; `parked.spec.ts` — empty state at `?status=parked`, the chip and *Park* real controls ≥ 24px with names, axe, contrast light and dark, screenshots at 360 and 1280.

**Risks**

- A book with no `book_status` row shows as to read and is offered *Park*; the server refuses (no row isn't in `PARKS_FROM`) and the control says why under it.
- Size: 11 files, over the split threshold; kept whole (owner, at plan): already 2 of 4, UI only, and the redraw ships in the same PR (`ui.redrawFiles`).

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
