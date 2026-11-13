---
id: TASK-076
title: 3.4b Rank a book when you finish it (2 of 3) — Top books for every year, and the Library's year chips go
status: Draft
depends_on: [TASK-075, TASK-016]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-076 — 3.4b Rank a book when you finish it (2 of 3) — Top books for every year, and the Library's year chips go

## Goal

A Top books page shows any year's whole reading list: its top ten, a divider, then every other book read that year, any of which can be moved anywhere with an undo; it takes over from the Library's year chips.

## Context

- Roadmap: `docs/05-roadmap.md` § 3.4b Rank a book when you finish it, and every year's top ten (M14). The entry and its **Check:** are the contract (agreed by the owner 2026-11-13). Feature F-60. Pulled ahead of 1.26 (D-139).
- **Split, 2 of 3.** TASK-075 moved the rank onto `read_events` and owns its writes; this part is the screen and the Library change; TASK-077 adds ranking at the finish and the *Not ranked yet* control's sorter.
- **The screen** is mockup `top` (`design/mockups.html`, `powershell -NoProfile -File scripts/screen.ps1 top`): *Best of 2026*, a year select with *N read so far*, rows with the rank on the cover and a drag handle (`button.drag`, *Reorder <title>, rank n*). The entry changes it: a **year switcher over every year with a finished read**, ending with *No year*; this year says *so far*; each year shows its top ten, **a divider**, then every other book read that year, the rest of the ranks then *Not ranked yet*, **nothing collapsed** (D-122). The mockup's *+ Add a book to this list* and its *cap at ten?* note are superseded: every read of the year is already listed (D-101). The desktop puts the year control and the rules in the rail (`.dk-rail`). The sidebar draws *Top books* under Books.
- **Moving books**: 1.10's reorder controls (`src/components/ReorderList.tsx`, the comics queue's keyboard-operable handle and row menu, TASK-016), across the divider too; a move past it changes the top ten; moving an unranked read in ranks it; each move has an undo (TASK-075's writes).
- **The Library's year chips go** (D-122): the chip row and *No year* in `src/app/books/list/page.tsx`, `listBooks`'s `year` / `noYear` options (`src/db/queries.ts`), the `year` key in `libraryHref` (`src/lib/library-sort.ts`), the `yearSummary` / `unyeared` reads the chips use, and the years line of `src/app/books/list/loading.tsx`'s skeleton. The *Finished* sort stays. `test/year-chips.test.tsx` goes or is rewritten to prove no chip renders.
- **Where it lives** (route, `/books/top` or another, and its tab in 2.2i's tab row, `src/components/nav/`): the plan's to propose against the mockup and `test/nav-items.test.tsx`.
- A book with a listen is ranked like any read, with the headphones glyph (1.23).
- Design: `docs/04-design.md` § 11.2 Status screens, § 10 The UX floor; `design/STYLE_GUIDE.md` § 9 (states). Reference screenshots: `design/screenshots/README.md`.
- Decisions: D-65, D-101, D-122, R2-08, D-120. Hard rule 6.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves the browser clauses: a past year's first ten, the divider and the rest with none collapsed, *Not ranked yet*, *No year*, and no Library year chip. TASK-075 and TASK-077 prove the `npm test` clauses): `npm test`: placing a new read into a year of six ranked
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
- [ ] AC-5: `/books/list` renders no year chip and no *No year* chip, `?year=2024` is ignored, and the *Finished* sort still orders by finish date.
- [ ] AC-6: The Top books page meets the UX floor (`docs/04-design.md` § 10. The UX floor): empty (no finished read), loading (skeleton in the loaded geometry) and error states drawn; reorder handles and row menus are real buttons named with the title and rank, 44px on the phone; text 4.5:1 in both themes; nothing resolves to `--danger`; reduced motion stops the move animation; axe reports no new violations; screenshots at 360px, 834px and 1280px, light and dark.

## Out of scope

- *Rank it in 2026* beside the undo toast, *This or that* and *Skip* (TASK-077).
- Ranking comics.
- Changing the *Done* tab's grouping by year (`src/app/books/status/page.tsx`).
- Shelves (5.1).

## Files likely touched

- `src/app/books/top/page.tsx` and `loading.tsx` (new; route the plan's) — the screen.
- `src/components/TopBooks.tsx` (new) — the year's list, the divider, the reorder.
- `src/db/queries.ts` — the year's reads with ranks; the years list; `listBooks` loses `year`.
- `src/app/books/list/page.tsx`, `src/app/books/list/loading.tsx`, `src/lib/library-sort.ts` — the chips go.
- `src/components/nav/*` — the Top books item.
- `src/app/globals.css` — the divider and the rank-on-cover, from existing tokens.
- `test/top-books.test.tsx` (new), `test/year-chips.test.tsx`, `test/e2e/top-books.spec.ts` (new).

## Verification

- Automated: `test/top-books.test.tsx` (AC-2, AC-3), `test/e2e/top-books.spec.ts` (AC-1's browser clauses, AC-4, AC-5, axe), the Library's existing specs still pass.
- Manual: on the dev database, open Top books, pick a past year → top ten, divider, the rest; move one across the divider, then Undo → the order returns.

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
