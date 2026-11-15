---
id: TASK-093
title: 5.17 What you own (2 of 3) — the row menu's toggles, the sub-line and the Library's Owned filter
status: In progress
depends_on: [TASK-092]
size: M
model: opus
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: 4cfa4c1
---

# TASK-093 — 5.17 What you own (2 of 3) — the row menu's toggles, the sub-line and the Library's Owned filter

## Goal

From a Library row you can say you own the book on paper or as an audiobook, the row says what you own, and the Library can show just the books you own in each format, or the ones you don't.

## Context

- Roadmap: `docs/05-roadmap.md` § 5.17 What you own: physical copies and audiobooks (M17). The *Amended 2026-11-08 (D-132)* half wins. Its **Check:** is the contract (still marked *proposed*; the owner agrees it by merging or edits it first). Feature F-73. Pulled ahead of 1.26 (D-132).
- **Split, 2 of 3.** TASK-092 built the table, the route and `listBooks`'s `owned` option; this part draws them in the Library. TASK-094 adds the *Paste a list* destinations, and its merge ticks the entry.
- **The toggles.** Two items in the row's `⋯` (`src/components/BookRowMenu.tsx`, drawn by `BookStatus` with the live status, task 2.2c): *I own it on paper* and *I own the audiobook*, each one write with an undo toast (`src/components/Undo.tsx`), shown whatever the status. The menu item says which way it goes (owned or not): the copy is the plan's against the redrawn frame.
- **The sub-line.** The Library row's grey `row-sub` (`src/app/books/list/page.tsx`, `bookSub` in `src/lib/format.ts`) says *Physical*, *Audiobook* and *Ebook* as they apply. The entry says this holds *until 3.5*; 3.5's sheet (TASK-079) then says it too. Whichever of the two lands second draws the sheet's line and toggles (TASK-079's *From 5.17* note): if TASK-079 has merged by this plan, the plan adds them to the sheet.
- **The Owned filter** (D-121, D-132): *Physical · Audiobook · Ebook · Not owned*, in the URL (`?owned=physical`; the other values are the plan's), combining with every other filter and sort (D-110): `libraryHref` (`src/lib/library-sort.ts`) and every link that rebuilds the URL (`src/components/BookSort.tsx`, `genreChipHref`, `src/lib/series-list.ts`) carry it, so a chip never drops it. `/books/list?owned=physical` is the physical library, reached by a chip, not a page of its own. Whether it shows Unlisted books is TASK-092's plan-gate answer.
- **Not drawn yet** (the entry): the mockup's `blist` frame gains the two menu items, the sub-line and the *Owned* chips before they are built, in this PR (`ui.redrawFiles`: `design/mockups.html`, `design/mockups-index.md`). Print the frame with `powershell -NoProfile -File scripts/screen.ps1 blist`.
- **TASK-091** (Draft) takes the Library's year chips away; whichever lands second rebases the filter rows.
- Design: `design/mockups.html` § `blist`; `design/LedgerDesktop.dc.html` (desktop Library); `docs/04-design.md` § 10 The UX floor; `.claude/rules/ui.md` (DNF and grey stay grey: owning is not a state colour).
- Decisions: D-83, D-90, D-110, D-121, D-132.
- *From TASK-092 (5.17, PR #263):* built: `POST /api/books/owned` takes `{ bookId, format, owned }` (`format` `physical` or `audio`, `owned` a boolean) and answers `{ ok, prior }`; the toggle's undo posts `prior` back as `owned`. 400 for a bad body, 404 for a missing or soft-deleted book. `listBooks(userId, { owned })` takes `OWNED_FILTERS` (`physical`, `audio`, `ebook`, `none`, exported from `src/db/queries.ts`; anything else filters nothing), and each `BookRow` carries `owned: ('physical' | 'audio' | 'ebook')[]` in that order for the sub-line. The plan-gate answer (D-152): *Physical*, *Audiobook* and *Ebook* list Unlisted books, *Not owned* doesn't.

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
- 3.5's sheet (TASK-079), unless it has merged by this plan: see Context.
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

Approved by the owner 2026-11-15, with these choices: the menu items read *I own it on paper* / *I own the audiobook*, and *I don't own it on paper* / *I don't own the audiobook* once owned; the toast reads *You own it on paper* (or *You don't own it on paper*; the audiobook alike) with the title as its detail; tapping the current *Owned* chip clears it, keeping the rest, and *Everything* clears everything; an *Owned* chip keeps the search, status, level, genre and sort (the status chips still drop the search). TASK-079 hasn't merged, so the sheet stays out.

**Steps**

1. Tests first (`test/library-sort.test.ts`, `test/library-page.test.tsx`, `test/format.test.ts`, `test/e2e/library-owned.spec.ts`); confirm they fail.
2. `src/lib/library-sort.ts`: `LibraryParams.owned`; `libraryHref` writes it after `genre`; `genreChipHref` keeps it. `BookSort` and `seriesAllHref` then carry it unchanged.
3. `src/lib/format.ts`: `ownedWords(owned)` → *Physical · Audiobook · Ebook* in that order; `bookSub` untouched (shared with screens that don't show ownership).
4. `src/app/books/list/page.tsx`: parse `?owned=` against `OWNED_FILTERS` and pass it to `listBooks`; every chip and link carries it; an *Owned* group (*Physical · Audiobook · Ebook · Not owned*) between the levels and the genres; the current chip's link drops `owned`; *Everything* clears it and isn't current while one is chosen; the sub-line appends `ownedWords`; the row hands `physical` / `audio` to `BookStatus` only when set.
5. `BookStatus` → `BookRowMenu`: two items after *Follow…*, each one `POST /api/books/owned`, an undo toast (the undo posts `prior`), `router.refresh()`; failure → `fail` with *Retry*; the label flips locally and follows the server props after the refresh.
6. `src/app/books/list/loading.tsx`: one more chip line.
7. `design/mockups.html` `blist`: the first phone frame gains the *Owned* row and owned words on two rows; a new phone frame shows *Physical* current, a row's `⋯` open with the two items and the undo toast; the desktop frame gains the row; a notes bullet. `design/mockups-index.md`'s `blist` row names them.

**Files**: `src/lib/library-sort.ts`, `src/lib/format.ts`, `src/app/books/list/page.tsx`, `src/components/BookRowMenu.tsx`, `src/components/BookStatus.tsx` (not in Files likely touched: it draws the menu), `src/app/books/list/loading.tsx` (not listed: the skeleton), `design/mockups.html`, `design/mockups-index.md`, `test/library-sort.test.ts`, `test/library-page.test.tsx`, `test/format.test.ts` (not listed: `ownedWords`), `test/e2e/library-owned.spec.ts` (new). 12–13 files, over the split line, kept whole: UI only, no schema, and the redraw and tests must ship in the same PR.

**Test strategy**

- AC-1 / AC-2: `test/e2e/library-owned.spec.ts` — each toggle writes one row of its format (read from the test DB) and Undo removes it; the sub-line says *Physical* with no page load between (a window marker survives); a calibre + physical + audio book names all three; each *Owned* chip lists exactly its fixture books combined with *Read* and *Title*, and survives a reload.
- AC-3: `test/library-page.test.tsx` (both chips current, every link carries `owned`, *Everything* drops it, `listBooks` gets it) plus a browser step in the spec.
- AC-4: the mockup diff (spec review).
- AC-5: the spec — an *Owned* chip with no match draws the empty state; chips and menu items named, ≥ 24px (44px phone); axe, contrast; screenshots at 360, 834 and 1280px, light and dark.

**Risks**: the test DB has seeded Calibre books, so *Ebook* / *Not owned* assertions read only the spec's own `E2E Own …` books (by search or title).

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
