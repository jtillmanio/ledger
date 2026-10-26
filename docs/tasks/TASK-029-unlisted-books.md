---
id: TASK-029
title: 1.21 Unlisted: the books you have but haven't put on your list
status: Draft
depends_on: []
size: L
model: opus
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: af3aef9
---

# TASK-029 — 1.21 Unlisted: the books you have but haven't put on your list

## Goal

Books the owner has but hasn't put on the to-read list sit at *Unlisted*, below Someday. Search finds them and a chip of their own lists them. They stay off every other list, plan and count until the owner promotes one with *Add to Someday*.

## Context

- Roadmap: `docs/05-roadmap.md` § 1.21 Unlisted (sitting 8, **before 1.18**, which creates Calibre's other books at this level). The roadmap entry and its **Check:** are the contract.
- **Named *Unlisted*, stored `unlisted`** (D-86, owner at this task's plan gate, 2026-10-26; amends D-83's *Owned*). The rename reached the roadmap, the decisions log, the planning docs and TASK-030/031 in a docs PR before any code.
- **Why this is one large task** (`workflow.splitPolicy: never-split`): one stored status value reaches the list query, the add writes, the status control, the master-list screen and its mockup frame. Each half needs the other before it can be tested.
- **Plan-gate answers** (owner, 2026-10-26; D-86): store `unlisted`, with **no CHECK** and no migration; the row's status buttons **never set** Unlisted (only Calibre, 1.18 and 4.4, and an Undo write it); the *Unlisted · N* chip **hides at zero**, as *No year* does; a **shelf** add leaves an Unlisted book Unlisted, and only Someday and On deck promote it.
- Data model: `docs/03-data-model.md` § 4.1 By task (1.21: a fifth value, no new column); § 2. Decisions 2.9 and D-37 for the four to-read levels. `.claude/rules/schema.md`'s to-read-levels rule names four levels and gains Unlisted.
- What already holds, so it needs only a test: `to_read_level` reads only `status = 'to_read'` (`etl/views.sql`), and so do `booksUpNext`'s Someday count, `booksInFlight` (`reading`) and `booksDone` (`read`, `dnf`) in `src/db/queries.ts`. `series_progress`, `author_progress` and `universe_progress` count only `read` as read, so an Unlisted book is already unread there. `books_by_year` reads `book_reads`, which is reads only.
- What changes:
  - `listBooks`: *Everything* (no `status`) lists every live book today. It must leave Unlisted out unless the owner is searching. `status=unlisted` is the fifth chip, *Unlisted · N*.
  - `writeDestination` / `toRead` (`src/db/writes.ts`): `onConflictDoNothing` keeps any existing status, so Someday or On deck on an Unlisted book would report it as already there. Unlisted must move to the chosen destination, and the add's Undo must put back `unlisted`.
  - *Paste a list*'s review (`src/lib/book-review.ts`) skips a matched book that has any status, so an Unlisted match would never be added. It must read as *not on your list yet*, as a book with no status does.
  - `BookStatus` (`src/components/BookStatus.tsx`): the row's status control knows four statuses. An Unlisted row offers *Add to Someday*, which writes `to_read` through `saveBookStatus` with Undo. `undoBookStatus` already restores `prior.status`. `/api/progress/book` validates against `BOOK_STATUSES`.
- There is no book detail sheet yet (`bookdetail`, 5.x). "Its sheet" in the roadmap means the row's controls until there is one.
- Design: `design/mockups.html` `blist` (Master list) has no Unlisted chip or row; it is redrawn in this PR (`ui.redrawFiles`, standing rule 6). Unlisted is a level, not a state, so its badge is grey (`.claude/rules/ui.md`: anything without a meaning stays grey). Figures in the mockup are sample data (D-7).
- Decisions: D-83 (a level below Someday; search finds it, it has its own chip, and no list, plan, dashboard or count includes it), D-86 (its name and stored value, and the plan-gate answers above), D-37 (Someday is `to_read` with no plan row), D-65 (years count reads), D-84 and 1.22 (the *Unlisted* tag on search results).

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): with a fixture of one `unlisted`, one `to_read` and one `read` book, *Everything* lists two and the *Unlisted* chip lists one with the count 1; a master-list search for the Unlisted book's title finds it; `to_read_level`, the status screens and the plan rail never return it; *Add to Someday* writes one `to_read` row and Undo puts back `unlisted`; a series holding one read and one Unlisted book reads `1 / 2`.
- [ ] AC-2: On the AC-1 fixture, the *To read* chip and its *Someday* level list only the `to_read` book. *Up next*'s Someday count is 1. The year chips and `books_by_year` count only the `read` book's read. The master list's `N shown` line under *Everything* says 2. `author_progress` for the series' author counts the Unlisted book in `books_listed` and not in `books_read`.
- [ ] AC-3: Given an Unlisted book, when it is added through *Add books* (Search or *Paste a list*) to Someday, then its status is `to_read` with no plan row, and the add reports it as added, not already there. Added to On deck, it is `to_read` with one `on_deck` plan row. Undoing either add puts back `unlisted` and removes any plan row the add wrote. Added to a shelf, it stays `unlisted` with one `shelf_books` row. A `to_read`, `reading` or `read` book added to Someday keeps its status, as today.
- [ ] AC-4: `src/db/schema.ts`'s `book_status.status` comment and `.claude/rules/schema.md`'s to-read-levels rule name `unlisted` as the level below Someday. The owner's plan-gate answer on the stored value (and on a CHECK) is recorded in `## Plan`.
- [ ] AC-5: `design/mockups.html` `blist` draws the *Unlisted · N* chip after *Read*, and an Unlisted row with a grey *Unlisted* badge and *Add to Someday*. `design/mockups-index.md` notes the change.
- [ ] AC-6: The master list with *Unlisted* selected meets the UX floor (`docs/04-design.md` § 10. The UX floor). An empty Unlisted list shows the empty state. The chip is a real link whose accessible name includes its count (as the year chips' `aria-label` does). *Add to Someday* is a real `<button>` at least 24px tall. The Unlisted badge resolves to no `--ready`, `--blocked` or `--danger` colour. Text is at 4.5:1 in both themes, and focus returns to the row after Undo. Screenshots at each `ui.viewports` width, light and dark.

## Out of scope

- Creating Unlisted books. Calibre's other books arrive in 1.18 (TASK-030). Nothing in this task writes `unlisted` except Undo.
- The *Unlisted* tag on add-sheet and 6.1 search results, and as-you-type search (1.22, D-84). The add sheets' library search already returns any live book.
- The books dashboard, capacity sums and the plan rail screens (2.x, M10). They read `to_read_level`, so Unlisted stays out of them by construction.
- A book detail sheet (`bookdetail`).
- A CHECK constraint or any migration (owner, plan gate: none).

## Files likely touched

- `src/db/queries.ts`: `listBooks` (*Everything* without Unlisted unless `q` is set; the Unlisted count).
- `src/db/writes.ts`: `writeDestination` moves an Unlisted book; `undoAddBooks` puts back `unlisted`; `BOOK_STATUSES`.
- `src/db/schema.ts`: the status comment.
- `src/app/api/progress/book/route.ts`: accepts `unlisted` as a prior status in an undo.
- `src/app/api/books/route.ts`, `src/lib/book-add.ts`, `src/components/AddBooks.tsx`, `src/components/PasteBooks.tsx`: carry the promoted books to the undo.
- `src/lib/book-review.ts`: an Unlisted match is added, not skipped.
- `src/app/books/list/page.tsx`: the *Unlisted · N* chip.
- `src/components/BookStatus.tsx`: the Unlisted badge and *Add to Someday*.
- `test/unlisted.test.ts` (new, DB), `etl/test_views.sql` (`to_read_level` with an Unlisted book), `test/e2e/unlisted.spec.ts` with `test/e2e/global-setup.ts` and `helpers.ts` for the chip and the promote-and-Undo flow.
- `design/mockups.html`, `design/mockups-index.md`: the `blist` redraw.
- `.claude/rules/schema.md`: the fifth level.

## Verification

- Automated: `test/unlisted.test.ts` against `TEST_DATABASE_URL` covers AC-1's fixture (listBooks counts, search, `to_read_level`, the three status queries, `series_progress`, *Add to Someday* and Undo), AC-2's counts and AC-3's add and undo cases. `etl/test_views.sql` asserts `to_read_level` has no row for an Unlisted book. An e2e spec at `w390-light` opens `/books/list?status=unlisted`, presses *Add to Someday*, checks the row has left, presses Undo, and checks it is back and focused.
- Manual: the ui-verifier walks `/books/list` on the e2e test database at each width → expected: *Everything* without the Unlisted book, the *Unlisted · 1* chip, search finding it, and *Add to Someday* then Undo returning it to Unlisted.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- Wishlist accept (`acceptLine` → `toRead` in `src/db/writes.ts`) leaves an Unlisted book Unlisted, and `src/lib/wishlist-review.ts` tells the owner "your status stays". It matters only once 1.18 creates Unlisted books: decide there whether a wishlist line promotes one to Someday. (approved at plan) → `docs/tasks/TASK-030-calibre-import.md` § Context, at close-out
- `BookSearch` and `wishlist-review` have no label for `unlisted` and show the raw value. 1.22's entry already requires the *Unlisted* tag on every library result. (approved at plan) → not tracked: covered by `docs/05-roadmap.md` § 1.22

## Plan

_Approved by the owner 2026-10-26 at the plan gate; the answers are in Context and D-86. `planned_at_commit` is the main commit the plan was read against (af3aef9): none of the planned files has changed since._

**Steps**

1. **Writes** (`src/db/writes.ts`). `BOOK_STATUSES` gains `unlisted` (every stored value); a new `SETTABLE_STATUSES` (the four) is what a status POST may set, so nothing but an Undo writes `unlisted`. `writeDestination` moves an Unlisted book to `to_read` for Someday and On deck (On deck then writes its plan row as today) and returns those books as a new `AddedEntry.promoted`; a shelf add leaves the status alone. `undoInside` puts `promoted` back to `unlisted`, by an update and never a delete, and only when the book is still `to_read`, has no plan row the add didn't write and no read; the other undo rules are unchanged. `toRead` and wishlist accept are unchanged (follow-up).
2. **Undo plumbing.** `promoted` travels with the add's answer and back on its undo: `src/app/api/books/route.ts` (DELETE parses it, optional like `statused`), `src/lib/book-add.ts` (`undoAdd`), `src/components/AddBooks.tsx` and `src/components/PasteBooks.tsx` (the entry). `/api/books/bulk` returns `addBooks`'s answer as it is. `src/app/api/progress/book/route.ts`: POST accepts `SETTABLE_STATUSES`; DELETE accepts `unlisted` as a change's `prior`.
3. **Paste review** (`src/lib/book-review.ts`): a match whose status is `unlisted` reads *In your library, not on your list yet: adds it to Someday*, as one with no status does; a near match counts the same way.
4. **Queries** (`src/db/queries.ts`): `listBooks` leaves `unlisted` out when neither `status` nor `q` is set (*Everything*, the genre and year chips); a search, and `status=unlisted`, include it. A new `unlistedCount(userId)` for the chip.
5. **List page** (`src/app/books/list/page.tsx`): *Unlisted · N* after *Read*, a link with `aria-label="Unlisted, N books"`, hidden at zero; the empty state stays *Nothing matches*.
6. **`BookStatus.tsx`**: an Unlisted row's badge reads *unlisted*, grey (`.bdg.dn`, no new CSS). Beside it, on the collapsed row, *Add to Someday*: a `btn sec sm` `<button>` that writes `to_read` through the same `write()` with Undo (*Was unlisted*). Expanded, the four status buttons stay, none pressed. On the Unlisted list the row leaves after the add; the Undo marks the book for focus, and the row that comes back takes focus on mount.
7. **Docs.** `src/db/schema.ts` comment and `.claude/rules/schema.md`'s levels rule name `unlisted`; `design/mockups.html` `blist`'s first phone frame gains *Unlisted · 41* after *Read* and an Unlisted row with its badge and *Add to Someday*; `design/mockups-index.md` notes it.

**Test strategy**

- AC-1, AC-2: `test/unlisted.test.ts` › *the AC-1 fixture: lists, counts, search, levels, status tabs, series and author progress*, and › *Add to Someday writes to_read and Undo puts back unlisted* (through `saveBookStatus` / `undoBookStatus` and the route's validation).
- AC-3: `test/unlisted.test.ts` › *Someday and On deck promote an Unlisted book, by search and by paste, and Undo puts it back*; › *a shelf leaves it Unlisted*; › *to_read, reading and read keep their status*; › *the paste review offers an Unlisted match*.
- `etl/test_views.sql`: `to_read_level` has no row for an `unlisted` book.
- AC-6: `test/e2e/unlisted.spec.ts` (one Unlisted book seeded in global-setup, reset to `unlisted` before each test): the chip's name and count, *Add to Someday* (the row leaves), Undo (it returns and has focus), the empty state, axe, the button's height. Screenshots and contrast by the ui-verifier.
- AC-4, AC-5: the spec-reviewer reads the files.

**Risks.** About 18 files: `never-split` keeps it whole (`autonomy: attended`). An e2e test that fails between the add and its Undo would leave the book `to_read`; the spec resets it before each test.

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
