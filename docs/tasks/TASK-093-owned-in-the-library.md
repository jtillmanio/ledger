---
id: TASK-093
title: 5.17 What you own (2 of 3) — the row menu's toggles, the sub-line and the Library's Owned filter
status: Ready
depends_on: [TASK-092]
size: M
model: opus
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-093 — 5.17 What you own (2 of 3) — the row menu's toggles, the sub-line and the Library's Owned filter

## Goal

From a Library row you can say you own the book on paper or as an audiobook, the row says what you own, and the Library can show just the books you own in each format, or the ones you don't.

## Context

- Roadmap: `docs/05-roadmap.md` § 5.17 What you own: physical copies and audiobooks (M17). The *Amended 2026-11-08 (D-132)* half wins. Its **Check:** is the contract (still marked *proposed*; the owner agrees it by merging or edits it first). Feature F-73. Pulled ahead of 1.26 (D-132).
- **Split, 2 of 3.** TASK-092 built the table, the route and `listBooks`'s `owned` option; this part draws them in the Library. TASK-094 adds the *Paste a list* destinations, and its merge ticks the entry.
- **The toggles.** Two items in the row's `⋯` (`src/components/BookRowMenu.tsx`, drawn by `BookStatus` with the live status, task 2.2c): *I own it on paper* and *I own the audiobook*, each one write with an undo toast (`src/components/Undo.tsx`), shown whatever the status. The menu item says which way it goes (owned or not): the copy is the plan's against the redrawn frame.
- **The sub-line.** The Library row's grey `row-sub` (`src/app/books/list/page.tsx`, `bookSub` in `src/lib/format.ts`) says *Physical*, *Audiobook* and *Ebook* as they apply. The entry says this holds *until 3.5*; 3.5's sheet (TASK-079) then says it too.
- **The Owned filter** (D-121, D-132): *Physical · Audiobook · Ebook · Not owned*, in the URL (`?owned=physical`; the other values are the plan's), combining with every other filter and sort (D-110): `libraryHref` (`src/lib/library-sort.ts`) and every link that rebuilds the URL (`src/components/BookSort.tsx`, `genreChipHref`, `src/lib/series-list.ts`) carry it, so a chip never drops it. `/books/list?owned=physical` is the physical library, reached by a chip, not a page of its own. Whether it shows Unlisted books is TASK-092's plan-gate answer.
- **Not drawn yet** (the entry): the mockup's `blist` frame gains the two menu items, the sub-line and the *Owned* chips before they are built, in this PR (`ui.redrawFiles`: `design/mockups.html`, `design/mockups-index.md`). Print the frame with `powershell -NoProfile -File scripts/screen.ps1 blist`.
- **TASK-091** (Draft) takes the Library's year chips away; whichever lands second rebases the filter rows.
- Design: `design/mockups.html` § `blist`; `design/LedgerDesktop.dc.html` (desktop Library); `docs/04-design.md` § 10 The UX floor; `.claude/rules/ui.md` (DNF and grey stay grey: owning is not a state colour).
- Decisions: D-83, D-90, D-110, D-121, D-132.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves, in the browser (0.11) on the test database: each toggle from the row menu writes its row and its Undo removes it, each *Owned* chip lists its books combined with a status chip and a sort, the choice survives a reload, and the screenshots. TASK-092 proves the data clauses, TASK-094 the paste): (proposed; the owner agrees it by merging or edits it first)
each toggle writes one `owned_copies` row with its format, Undo removes
it, and the export test passes with the table. *Physical* lists only books
with a `physical` row, *Audiobook* only books with an `audio` row, *Ebook*
only books with a `calibre_id`, and *Not owned* only books with none of
the three; a book with several is in each; a soft-deleted book is in none;
each combines with a status filter and a sort, and the choice survives a
reload. Pasting three lines to *Physical copy*, two matched and one new,
writes three rows and one `unlisted` book, and Undo removes all of it.
Screenshots at 360px and 1280px.
- [ ] AC-2: Given a to-read book with no owned row, when *I own it on paper* is chosen from its `⋯`, then its sub-line reads *Physical* without a reload and an undo toast offers *Undo*; pressing *Undo* removes the word and the row. Given a book with a `calibre_id`, a `physical` and an `audio` row, its sub-line names all three.
- [ ] AC-3: Given `/books/list?status=read&sort=title&owned=physical`, the *Read* and *Physical* chips are both current, the rows are only read physical books in title order, and choosing *To read* or another sort keeps `owned=physical` in the URL; *Everything* clears it.
- [ ] AC-4: The `blist` frame in `design/mockups.html` draws the two menu items, the sub-line and the *Owned* chips, and `design/mockups-index.md`'s `blist` row names them (task 5.17).
- [ ] AC-5: The Library meets the UX floor (`docs/04-design.md` § 10): an *Owned* chip with no match draws the list's empty state; each chip and menu item is a real link or button with a name and ≥ 24px; text contrast holds in light and dark; screenshots at 360px and 1280px.

## Out of scope

- The table, the route and the query (TASK-092).
- *Paste a list*'s destinations (TASK-094).
- 3.5's sheet (TASK-079).
- Showing ownership on the dashboard, the status tabs, On deck or search results.

## Files likely touched

- `src/components/BookRowMenu.tsx` — the two toggles and their undo.
- `src/app/books/list/page.tsx` — the *Owned* chips and the sub-line.
- `src/lib/format.ts` — the sub-line's owned words.
- `src/lib/library-sort.ts`, `src/components/BookSort.tsx`, `src/lib/series-list.ts` — `owned` rides every link.
- `design/mockups.html`, `design/mockups-index.md` — the `blist` frame (redraw).
- `test/library-page.test.tsx`, `test/library-sort.test.ts`, `test/e2e/library-owned.spec.ts` (new).

## Verification

- Automated: `test/library-sort.test.ts` (`owned` kept by every href), `test/library-page.test.tsx` (chips current, sub-line words), `test/e2e/library-owned.spec.ts` (AC-1's browser clauses, AC-2, AC-3, axe; screenshots at 360 and 1280).
- Manual: on the dev database, Library → a book's `⋯` → *I own it on paper* → the row says *Physical*, *Undo* takes it back; tap *Physical* → only that book's kind; add *Read* and sort by *Title* → reload → both still chosen. Leave the data as found.

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
