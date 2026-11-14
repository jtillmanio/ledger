---
id: TASK-076
title: 3.4b Rank a book when you finish it (2 of 3) — Top books for every year
status: In progress
depends_on: [TASK-075, TASK-016]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: ff28922
---

# TASK-076 — 3.4b Rank a book when you finish it (2 of 3) — Top books for every year

## Goal

A Top books page shows any year's whole reading list: its top ten, a divider, then every other book read that year, any of which can be moved anywhere with an undo; it becomes the home of a year's reading and of a read with no date, so the Library's year chips can go (TASK-091).

## Context

- Roadmap: `docs/05-roadmap.md` § 3.4b Rank a book when you finish it, and every year's top ten (M14). The entry and its **Check:** are the contract (agreed by the owner 2026-11-13). Feature F-60. Pulled ahead of 1.26 (D-139).
- **Split, 2 of 3.** TASK-075 moved the rank onto `read_events` and owns its writes; this part is the screen; TASK-077 adds ranking at the finish and the *Not ranked yet* control's sorter. The Library change was split out to TASK-091 at this task's plan gate (owner, 2026-11-14: about 22 files whole), with AC-5 and AC-1's *the Library renders no year chip* clause.
- **The screen** is mockup `top` (`design/mockups.html`, `powershell -NoProfile -File scripts/screen.ps1 top`): *Best of 2026*, a year select with *N read so far*, rows with the rank on the cover and a drag handle (`button.drag`, *Reorder <title>, rank n*). The entry changes it: a **year switcher over every year with a finished read**, ending with *No year*; this year says *so far*; each year shows its top ten, **a divider**, then every other book read that year, the rest of the ranks then *Not ranked yet*, **nothing collapsed** (D-122). The mockup's *+ Add a book to this list* and its *cap at ten?* note are superseded: every read of the year is already listed (D-101). The desktop puts the year control and the rules in the rail (`.dk-rail`). The sidebar draws *Top books* under Books.
- **Moving books**: 1.10's reorder controls (`src/components/ReorderList.tsx`, the comics queue's keyboard-operable handle and row menu, TASK-016), across the divider too; a move past it changes the top ten; moving an unranked read in ranks it; each move has an undo (TASK-075's writes).
- **The Library's year chips go** (D-122): TASK-091, which depends on this task, so *No year* keeps a home (R2-08).
- **Where it lives** (route, `/books/top` or another, and its tab in 2.2i's tab row, `src/components/nav/`): the plan's to propose against the mockup and `test/nav-items.test.tsx`.
- A book with a listen is ranked like any read, with the headphones glyph (1.23).
- Design: `docs/04-design.md` § 11.2 Status screens, § 10 The UX floor; `design/STYLE_GUIDE.md` § 9 (states). Reference screenshots: `design/screenshots/README.md`.
- Decisions: D-65, D-101, D-122, R2-08, D-120. Hard rule 6.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves the browser clauses: a past year's first ten, the divider and the rest with none collapsed, *Not ranked yet* and *No year*. TASK-091 proves *the Library renders no year chip*; TASK-075 and TASK-077 prove the `npm test` clauses): `npm test`: placing a new read into a year of six ranked
reads with scripted answers takes at most 3 picks and leaves ranks 1–7
contiguous, and its undo restores the six as they were; *Skip* writes no rank;
a book read in two years holds a rank in each; moving a book from rank 12 to
rank 3 leaves ranks contiguous and puts it in the top ten, and its undo restores
the order. In the browser (0.11), a past year lists its first ten, a divider,
then every other book read that year, with none collapsed; an unranked read
shows under *Not ranked yet*; a read with no date shows under *No year*; and the
Library renders no year chip. The up → down → up migration test passes.
- [ ] AC-2: Given 2024 with 14 reads, 12 ranked and 2 not, the 2024 view lists ranks 1–10, one divider, ranks 11–12, then *Not ranked yet* with the 2 unranked reads: 14 rows, none behind a disclosure.
- [ ] AC-3: The year switcher lists exactly the years with a finished read, newest first, then *No year* when an undated read exists; the current year's heading says *so far*; the chosen year is in the URL and survives a reload.
- [ ] AC-4: Moving the book at rank 11 to rank 4 with the reorder control (keyboard or row menu) shows it fourth, inside the top ten, and the old 10 below the divider; the undo toast restores the order on screen and in the database.
- AC-5 moved to TASK-091 (owner, at the plan gate, 2026-11-14): `/books/list` renders no year chip and no *No year* chip, `?year=2024` is ignored, and the *Finished* sort still orders by finish date.
- [ ] AC-6: The Top books page meets the UX floor (`docs/04-design.md` § 10. The UX floor): empty (no finished read), loading (skeleton in the loaded geometry) and error states drawn; reorder handles and row menus are real buttons named with the title and rank, 44px on the phone; text 4.5:1 in both themes; nothing resolves to `--danger`; reduced motion stops the move animation; axe reports no new violations; screenshots at 360px, 834px and 1280px, light and dark.

## Out of scope

- *Rank it in 2026* beside the undo toast, *This or that* and *Skip* (TASK-077).
- Ranking comics.
- Changing the *Done* tab's grouping by year (`src/app/books/status/page.tsx`).
- Shelves (5.1).
- The Library's year chips, `listBooks`'s `year` / `noYear` and the queries only they read (TASK-091).

## Files likely touched

- `src/app/books/top/page.tsx`, `loading.tsx` and `error.tsx` (new) — the screen.
- `src/components/TopBooks.tsx` (new) — the year's list, the divider, the reorder, the year switcher.
- `src/components/ReorderList.tsx` — a move's own undo, the handle's place name, a row's marker.
- `src/db/queries.ts` — the year's reads with ranks; the years list.
- `src/components/nav/items.ts`, `src/components/nav/Sidebar.tsx` — the Top books item.
- `src/app/globals.css` — the divider and the rank-on-cover, from existing tokens.
- `design/mockups.html`, `design/mockups-index.md` — the `top` frames redrawn (`ui.redrawFiles`).
- `test/top-books.test.tsx` (new), `test/e2e/top-books.spec.ts` (new), `test/nav-items.test.tsx`.

## Verification

- Automated: `test/top-books.test.tsx` (AC-2, AC-3, AC-6's states), `test/e2e/top-books.spec.ts` (AC-1's browser clauses, AC-3's reload, AC-4, AC-6), `test/e2e/queue.spec.ts` still passes.
- Manual: on the dev database, open Top books (tab row → *Top*; the desktop sidebar → *Top books*), pick a past year → top ten, divider, the rest; move one across the divider, then Undo → the order returns.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- The Library's year chips, split out at the plan gate: TASK-091 (new), and the 3.4b row of the task list names it (approved at plan) → docs/tasks/TASK-091-library-year-chips-go.md (new); docs/06-tasklist.md § M14 (3.4b row)
- D-65's text and the `books_by_year` comment in `etl/views.sql` still name the Library's year chips; they go with the chips (approved at plan) → docs/tasks/TASK-091-library-year-chips-go.md § Context

## Plan

Approved 2026-11-14 by the owner: split (the Library's chips → TASK-091), carry on in this session (model), heading *Best of 2026 so far* with *38 read so far* under it.

**Steps**
1. `src/db/queries.ts`: `topBookYears(userId)` → the years with a finished read (`book_reads`, live books), newest first, with each year's read count, and the undated reads' count. `topBooksYear(userId, year | null)` → the year's reads: ranked first (`year_rank`, then the read's id), then unranked (finish date, title); each with the read id (null for a read the status holds alone, moved with `{ bookId }`), the book, author and series, cover, finish month, listen flag, rank.
2. `src/components/ReorderList.tsx` (defaults keep the comics queue and Up next as they are): `move` may answer its own undo (an unranked read moved in has no old rank to move back to; the undo sends `{ change }` to `DELETE /api/progress/book/rank`); optional `place(row, i, n)` names the handle (*Reorder <title>, rank n* / *not ranked yet*) and the toast's detail; optional `marker(i)` draws the divider or the *Not ranked yet* heading inside the row's `<li>`, so the `<ol>` holds only `<li>`s (axe `list`).
3. `src/components/TopBooks.tsx` (client): one ReorderList, ranked then unranked; the divider before rank 11, *Not ranked yet* before the first unranked; a move POSTs `rank = index + 1` (the server clamps to the end, so any move of an unranked read ranks it, and a ranked read dropped among the unranked becomes the last rank); the rank on the cover, the headphones glyph on a listen; the year switcher a native `<select>` that writes `?year=` (`none` for *No year*). *No year* is a plain list with no handles (no year to rank in).
4. `src/app/books/top/page.tsx`: `?year=`, else this year when it has a read, else the newest; an unknown year is the default. Heading *Best of 2026 so far* (this year) / *Best of 2024*, the line *38 read so far* / *14 read*; the desktop puts the year control and the rules in `.dk-rail`. Empty (no finished read), `loading.tsx` (the loaded geometry) and `error.tsx` (neutral, *Try again*).
5. `src/components/nav/items.ts`: `books-top` enabled, and a `sideLabel` so the sidebar draws *Top books* (`Sidebar.tsx`); the tab row and the rail keep *Top*.
6. `src/app/globals.css`: the divider, the heading, the rank on the cover, from existing tokens; reduced motion stops the move animation.
7. `design/mockups.html` `top` frames redrawn (the switcher, the divider, *Not ranked yet*, no *+ Add a book*), `design/mockups-index.md` row.

**Files**: `src/app/books/top/page.tsx`, `loading.tsx`, `error.tsx` (new); `src/components/TopBooks.tsx` (new); `src/db/queries.ts`; `src/components/ReorderList.tsx`; `src/components/nav/items.ts`; `src/components/nav/Sidebar.tsx`; `src/app/globals.css`; `design/mockups.html`; `design/mockups-index.md`; `test/top-books.test.tsx` (new); `test/e2e/top-books.spec.ts` (new); `test/nav-items.test.tsx`. 14 files, over 8 after the split: UI only, no schema; the owner chose the split over the whole.

**Test strategy**
- AC-2, AC-3, AC-6 states: `test/top-books.test.tsx` (the test database, the real query, the page rendered): 2024 with 14 reads, 12 ranked → ranks 1–10, one divider, 11–12, *Not ranked yet*, the 2 unranked, 14 rows, no `<details>`; the switcher's options newest first then *No year*; *so far* on this year's heading; `?year=` chooses the year; the empty, skeleton and error states.
- AC-1 (browser clauses), AC-3 reload, AC-4, AC-6: `test/e2e/top-books.spec.ts`: a past year's ten, the divider, the rest, *Not ranked yet*, *No year*; the year survives a reload; rank 11 → 4 by the keyboard and by the row menu, the undo toast restoring the screen and the database; handle names, 44px handles at the phone, axe, contrast, reduced motion, screenshots at 360, 834 and 1280px light and dark.
- `test/e2e/queue.spec.ts` re-run unchanged for ReorderList.

**Revisions after approval**
- `test/query-budget.test.ts` (outside the file list): `/books/top` joins the budget at 2 queries, 1 wave, proving the page reads the years and the year together (task 0.9). Test only.
- The row menu is named with the rank too (*More for <title>, rank n*, AC-6): `ReorderList` adds the caller's `place` to the menu's name; the queue, which passes none, keeps *More for <title>* (spec review R1).

**Risks**: dropping a ranked read below the unranked ones makes it the last rank, not unranked; taking a read out of the ranking is not offered here.

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
