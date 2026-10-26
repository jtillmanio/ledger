---
id: TASK-029
title: 1.21 Owned: the books you have but haven't put on your list
status: Draft
depends_on: []
size: L
model: opus
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-029 — 1.21 Owned: the books you have but haven't put on your list

## Goal

Books the owner has but hasn't put on the to-read list sit at *Owned*, below Someday. Search finds them and a chip of their own lists them. They stay off every other list, plan and count until the owner promotes one with *Add to Someday*.

## Context

- Roadmap: `docs/05-roadmap.md` § 1.21 Owned (sitting 8, **before 1.18**, which creates Calibre's other books at this level). The roadmap entry and its **Check:** are the contract.
- **Why this is one large task** (`workflow.splitPolicy: never-split`): one stored status value reaches the list query, the add writes, the status control, the master-list screen and its mockup frame. Each half needs the other before it can be tested.
- **Stop and ask at plan time** (roadmap, CLAUDE.md *Stop and ask*): `owned` changes what a stored `book_status.status` means. No column is added, dropped or retyped. Today no CHECK constrains the column (`src/db/schema.ts` `bookStatus`, comment `to_read | reading | read | dnf`). Whether to add one is a plan-gate question, and adding one would mean a migration.
- Data model: `docs/03-data-model.md` § 4.1 By task (1.21: a fifth value, no new column); § 2. Decisions 2.9 and D-37 for the four to-read levels. `.claude/rules/schema.md`'s to-read-levels rule names four levels and gains Owned.
- What already holds, so it needs only a test: `to_read_level` reads only `status = 'to_read'` (`etl/views.sql`), and so do `booksUpNext`'s Someday count, `booksInFlight` (`reading`) and `booksDone` (`read`, `dnf`) in `src/db/queries.ts`. `series_progress`, `author_progress` and `universe_progress` count only `read` as read, so an Owned book is already unread there. `books_by_year` reads `book_reads`, which is reads only.
- What changes:
  - `listBooks`: *Everything* (no `status`) lists every live book today. It must leave Owned out unless the owner is searching. `status=owned` is the fifth chip, *Owned · N*.
  - `writeDestination` / `toRead` (`src/db/writes.ts`): `onConflictDoNothing` keeps any existing status, so Someday or On deck on an Owned book would report it as already there. Owned must move to the chosen destination, and the add's Undo must put back `owned`.
  - `BookStatus` (`src/components/BookStatus.tsx`): the row's status control knows four statuses. An Owned row offers *Add to Someday*, which writes `to_read` through `saveBookStatus` with Undo. `undoBookStatus` already restores `prior.status`. `/api/progress/book` validates against `BOOK_STATUSES`.
- There is no book detail sheet yet (`bookdetail`, 5.x). "Its sheet" in the roadmap means the row's expanded controls until there is one.
- For the plan gate:
  - Can the status buttons set a book *to* Owned, or is the only way in Calibre (1.18) and an Undo?
  - Does the Owned chip hide at zero, as *No year* does?
  - Does a shelf destination (1.4c *Add to*) move an Owned book's status, or leave it at Owned?
- Design: `design/mockups.html` `blist` (Master list) has no Owned chip or row; it is redrawn in this PR (`ui.redrawFiles`, standing rule 6). Owned is a level, not a state, so its badge is grey (`.claude/rules/ui.md`: anything without a meaning stays grey). Figures in the mockup are sample data (D-7).
- Decisions: D-83 (Owned, below Someday; search finds it, it has its own chip, and no list, plan, dashboard or count includes it), D-37 (Someday is `to_read` with no plan row), D-65 (years count reads), D-84 and 1.22 (the *Owned* tag on search results).

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): with a fixture of one `owned`, one `to_read` and one `read` book, *Everything* lists two and the *Owned* chip lists one with the count 1; a master-list search for the Owned book's title finds it; `to_read_level`, the status screens and the plan rail never return it; *Add to Someday* writes one `to_read` row and Undo puts back `owned`; a series holding one read and one Owned book reads `1 / 2`.
- [ ] AC-2: On the AC-1 fixture, the *To read* chip and its *Someday* level list only the `to_read` book. *Up next*'s Someday count is 1. The year chips and `books_by_year` count only the `read` book's read. The master list's `N shown` line under *Everything* says 2. `author_progress` for the series' author counts the Owned book in `books_listed` and not in `books_read`.
- [ ] AC-3: Given an Owned book, when it is added through *Add books* (Search or *Paste a list*) to Someday, then its status is `to_read` with no plan row, and the add reports it as added, not already there. Added to On deck, it is `to_read` with one `on_deck` plan row. Undoing either add puts back `owned` and removes any plan row the add wrote. A `to_read`, `reading` or `read` book added to Someday keeps its status, as today.
- [ ] AC-4: `src/db/schema.ts`'s `book_status.status` comment and `.claude/rules/schema.md`'s to-read-levels rule name `owned` as the level below Someday. The owner's plan-gate answer on the stored value (and on a CHECK) is recorded in `## Plan`.
- [ ] AC-5: `design/mockups.html` `blist` draws the *Owned · N* chip after *Read*, and an Owned row with a grey *Owned* badge and *Add to Someday*. `design/mockups-index.md` notes the change.
- [ ] AC-6: The master list with *Owned* selected meets the UX floor (`docs/04-design.md` § 10. The UX floor). An empty Owned list shows the empty state. The chip is a real link whose accessible name includes its count (as the year chips' `aria-label` does). *Add to Someday* is a real `<button>` at least 24px tall. The Owned badge resolves to no `--ready`, `--blocked` or `--danger` colour. Text is at 4.5:1 in both themes, and focus returns to the row after Undo. Screenshots at each `ui.viewports` width, light and dark.

## Out of scope

- Creating Owned books. Calibre's other books arrive in 1.18 (TASK-030). Nothing in this task writes `owned` except Undo.
- The *Owned* tag on add-sheet and 6.1 search results, and as-you-type search (1.22, D-84). The add sheets' library search already returns any live book.
- The books dashboard, capacity sums and the plan rail screens (2.x, M10). They read `to_read_level`, so Owned stays out of them by construction.
- A book detail sheet (`bookdetail`).
- A CHECK constraint or any migration, unless the owner asks for one at the plan gate.

## Files likely touched

- `src/db/queries.ts`: `listBooks` (*Everything* without Owned unless `q` is set; the Owned count).
- `src/db/writes.ts`: `toRead` / `writeDestination` move an Owned book; `undoAddBooks` puts back `owned`; `BOOK_STATUSES`.
- `src/db/schema.ts`: the status comment.
- `src/app/api/progress/book/route.ts`: accepts `owned` as a prior status in an undo.
- `src/app/books/list/page.tsx`: the *Owned · N* chip.
- `src/components/BookStatus.tsx`: the Owned badge and *Add to Someday*.
- `test/owned.test.ts` (new, DB), `etl/test_views.sql` (`to_read_level`, `series_progress` with an Owned book), a `test/e2e/` spec for the chip and the promote-and-Undo flow.
- `design/mockups.html`, `design/mockups-index.md`: the `blist` redraw.
- `.claude/rules/schema.md`: the fifth level.

## Verification

- Automated: `test/owned.test.ts` against `TEST_DATABASE_URL` covers AC-1's fixture (listBooks counts, search, `to_read_level`, the three status queries, `series_progress`, *Add to Someday* and Undo), AC-2's counts and AC-3's add and undo cases. `etl/test_views.sql` asserts `to_read_level` has no row for an Owned book. An e2e spec at `w390-light` opens `/books/list?status=owned`, presses *Add to Someday*, checks the row has left, presses Undo, and checks it is back.
- Manual: the ui-verifier walks `/books/list` on the e2e test database at each width → expected: *Everything* without the Owned book, the *Owned · 1* chip, search finding it, and *Add to Someday* then Undo returning it to Owned.

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
