---
id: TASK-037
title: 1.4e Paste a list: title and author in their own cells
status: In progress
depends_on: []
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: d9f4c74
---

# TASK-037 — 1.4e Paste a list: title and author in their own cells

## Goal

Two columns copied from a spreadsheet (title, author) paste straight into *Paste a list*, and the review shows each line's title and author as two cells you can fix in place. A line with no author gets its author typed into its cell, not retyped as `Title - Author`.

## Context

- Roadmap: `docs/05-roadmap.md` § 1.4e Paste a list: title and author in their own cells (M9, sitting 9, second after 1.25). The roadmap entry and its **Check:** are the contract. "In the browser (0.11)" is the Playwright harness, `test/e2e/` (TASK-013).
- Today's grammar: `src/lib/book-parse.ts` `parseBookLine` reads `Title - Author`, the author after the **last** spaced dash, with an optional `(Series #N)`. It calls `normalizeLine` (`src/lib/bulk-parse.ts`) first, and that collapses every run of whitespace, tabs included, to one space. So the tab has to be found before the line is normalised, or it is gone.
- The tab rule: a line with a tab splits at its **first** tab, title then author, and the dash grammar does not run on it, so a title holding ` - ` keeps it (the Check). The `(Series #N)` suffix and the bullet and list-number stripping apply to the title cell as they do now; the plan says so, or says why not.
- The review: `src/lib/book-review.ts` `buildBookReview` (pure) builds the rows; `src/components/ReviewTable.tsx` draws them. The table is **shared** with Add issues (`src/components/AddIssues.tsx`, 1.3b/1.3c) and the wishlist review (`src/components/WishlistReview.tsx`, 1.4d), whose rows must draw exactly as before. The wishlist review already edits a line in place through `ReviewTable`'s `extra` slot, with its edits kept apart from the parsed lines and the edited line asked again (`edits`, *Edit*, *Undo edit*): the pattern to copy or to say why not.
- A row's `key` is `${line}:${text}` today, and the check's answers are keyed by `bookKey(title, author)`. An edited cell changes the book key, so that line's answer is gone and it is asked again: your library first, then the near-duplicate check (D-25, `THRESHOLD` 0.4). The other lines keep their answers.
- Copy: the label `One book per line: Title - Author` and the empty slate's `Paste a list, one book per line: Title - Author.` (both in `src/components/PasteBooks.tsx`) become *One book per line: Title - Author, or paste two columns (title, author)*. The no-author why `No author. Add one after a dash: Title - Author.` (and its *add one after a dash, or use your book* variant) moves under the empty Author cell, worded for the cell.
- Design: mockup `add` (`design/mockups.html`, lines in `design/mockups-index.md`; print it with `scripts/screen.ps1 add`). The index's note 15 says the books review after *Check N lines* is the `bulk` screen's rows, not drawn on `add`. Standing rule 6: the `add` frame's paste copy follows this task's label in the same PR (`ui.redrawFiles`). Review tables: `docs/04-design.md` § 11.6 Review tables.
- Decisions: D-25 (only the same title and author is the same book; near duplicates default to *Create new*), D-37 (a new book lands at Someday).

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): a vitest parses `Piranesi\tSusanna Clarke` and `Piranesi - Susanna
Clarke` to the same title and author, and a tab-split line whose title has a
dash in it keeps the dash in the title. In the browser (0.11), editing the
Author cell of a line with no author clears its reason, and the line adds with
that author. Each cell has an accessible name (*Title, line 3*). Screenshots at
360px and 1280px.
- [ ] AC-2: `test/book-parse.test.ts`: `Star Wars - Thrawn\tTimothy Zahn` parses to title `Star Wars - Thrawn`, author `Timothy Zahn`; `Piranesi\t` (a tab, nothing after it) parses with `author: null` and flag `no_author`; `Mistborn (Mistborn #1)\tBrandon Sanderson` gives series `Mistborn`, position 1; and every existing dash-grammar case still passes unchanged.
- [ ] AC-3: Given a pasted list of three lines, checked, when the Title or Author cell of line 2 is edited, then only line 2 returns to *Not checked* and is asked again on the next *Check*, while lines 1 and 3 keep their answers and decisions (`test/book-review.test.ts` or `test/paste-books.test.tsx`). An edit that makes line 2 the same title and author as line 1 shows it as *Also on line 1* and *Skip*, as a pasted repeat does.
- [ ] AC-4: Add issues and the wishlist review draw exactly what they drew before: `test/review-table.test.tsx` (Add issues) and `test/wishlist-screen.test.tsx` pass without edits to their assertions, and neither screen shows a Title or Author cell.
- [ ] AC-5: The *Paste a list* label and the empty slate read *One book per line: Title - Author, or paste two columns (title, author)*, and the mockup's `add` frame shows the same copy (`design/mockups.html`).
- [ ] AC-6: *Paste a list*'s review meets the UX floor (`docs/04-design.md` § 10. The UX floor): each cell is a real labelled input (*Title, line N*, *Author, line N*); the reason under an empty Author cell is tied to it with `aria-describedby`; the empty, checking and check-failed states are drawn; targets are at least 24px; text is at 4.5:1 in both themes; screenshots at every `ui.viewports` width, light and dark.

## Out of scope

- *By hand* (already two fields) and *Search* (1.4f moves it to Hardcover).
- Asking Open Library or Hardcover during the paste check: it asks only your library (owner, at TASK-008's plan gate).
- Pasting more than two columns (series, position, pages): a third column is part of the author cell, or the plan says how it is refused.
- Editable cells in Add issues or the wishlist review.
- Writing the edits back into the textarea.

## Files likely touched

- `src/lib/book-parse.ts`: the tab split before `normalizeLine`.
- `src/lib/book-review.ts`: rows carry title and author; an edited line's key and its no-author reason.
- `src/components/ReviewTable.tsx`: Title and Author cells for the book review only (an opt-in prop or the `extra` slot), the other two reviews unchanged.
- `src/components/PasteBooks.tsx`: the edits state, the label and empty-slate copy.
- `src/app/globals.css`: the two cells' layout, from the existing tokens.
- `test/book-parse.test.ts`, `test/book-review.test.ts`, `test/paste-books.test.tsx`: AC-1's vitest, AC-2, AC-3.
- `test/e2e/paste-books.spec.ts` (new): AC-1's browser half, with axe.
- `design/mockups.html`: the `add` frame's paste copy (AC-5).

## Verification

- Automated: `test/book-parse.test.ts` (AC-1's parse, AC-2); `test/book-review.test.ts` and `test/paste-books.test.tsx` (AC-3, AC-4); `test/e2e/paste-books.spec.ts` (AC-1's browser half, AC-6's names and axe, screenshots at 360px and 1280px).
- Manual: copy two columns, ten rows, from the Books workbook or any spreadsheet, paste them into *Paste a list* on `/books/add`, press *Check 10 lines* → expected: ten rows, each with its title and author in their own cells. Clear one Author cell → expected: that line shows its no-author reason and *Add N books* counts one fewer; type the author back → expected: the reason goes, the line is asked again and counts again.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- The mockup `add` frame's lede says *then Open Library*, but the paste check asks only your library (owner, TASK-008) (approved at plan) → not tracked: 1.4f reworks Search and this copy.

## Plan

Approved 2026-10-31 (attended, Phase 1).

**Steps**

1. `src/lib/book-parse.ts`: a raw line with a tab splits at its first tab **before** `normalizeLine`; each side is normalised on its own. The title cell drops bullets and list numbers and reads `(Series #N)` as today; the dash grammar does not run on a tab line. A third column stays in the author cell (visible and editable there), not refused. The tab path and the dash path both end in one `fromCells(titleCell, authorCell)` that sets the flags. `BookLine` gains `cells: { title, author }`, what the inputs show (the title keeps its series suffix). A new `editBookLine(line, cells)` re-parses edited cells through the same function and keeps the raw strings in `cells`, so typing a space isn't eaten.
2. `src/lib/book-review.ts`: each row carries `cells` and a new `authorWhy`. The two no-author reasons move from `why` to `authorWhy`, worded for the cell: *No author. Type one in this cell.* and *No author, so it can't be added as new: type one, or use your book.* The row key stays `${line}:${text}` (exported as `rowKey`), so it is stable while typing and the input keeps focus. The wishlist review's own wording is untouched.
3. `src/components/ReviewTable.tsx`: an opt-in `cells?: (row) => ReactNode`, drawn in place of the `.vl` text. Add issues and the wishlist pass nothing and draw as before.
4. `src/components/PasteBooks.tsx`: `edits: Record<rowKey, cells>`, kept apart from the parsed lines as the wishlist does. An edit clears that line's choice only; its new title and author are not in `answers`, so it returns to *Not checked* and *Check 1 line* comes back. Other lines keep their answers and choices. An edit typed back to the original cells is dropped. The cells are real inputs, each with a short visible caption (*Title*, *Author*) and an sr-only suffix, so their names are *Title, line N* and *Author, line N*. The author reason sits under its input and is tied to it with `aria-describedby`. The inputs are read-only while adding. The label and empty-slate copy change. Not the wishlist's *Edit*/*Save line* form, because the roadmap asks for cells edited in place.
5. `src/app/globals.css`: `.vcells`, stacked on a phone and side by side from 768px. Each cell is a caption beside an `input.txt`, existing tokens only, inputs at least 36px high.
6. `design/mockups.html` (`add`, both frames): the new label above the paste box. `design/mockups-index.md`: shift its line numbers to match.

**Files**: `src/lib/book-parse.ts`, `src/lib/book-review.ts`, `src/components/ReviewTable.tsx`, `src/components/PasteBooks.tsx`, `src/app/globals.css`, `design/mockups.html`, `design/mockups-index.md` (not in *Files likely touched*: its line numbers move with the mockup), `test/book-parse.test.ts`, `test/paste-books.test.tsx`, `test/review-table.test.tsx` and `test/wishlist-screen.test.tsx` (one new test each; existing assertions untouched), `test/e2e/paste-books.spec.ts` (new).

**Test strategy**

- AC-1 vitest, AC-2: `test/book-parse.test.ts`: a tab line parses the same as its dash line; a dash inside a tab-split title stays in the title; `Piranesi\t` gives `no_author`; the series suffix in a tab line's title cell; `editBookLine`. The existing cases are unchanged.
- AC-3: `test/paste-books.test.tsx`: three lines, checked; editing line 2's Title or Author returns only line 2 to unverified, asks only it on the next Check, and leaves lines 1 and 3 with their answers and choices. An edit that makes line 2 match line 1 gives *Also on line 1* and *Skip*.
- AC-4: `test/review-table.test.tsx` and `test/wishlist-screen.test.tsx` pass with their assertions unedited; one new test in each finds no Title or Author input.
- AC-5: `test/paste-books.test.tsx` checks the label and slate copy; a vitest reads the `add` frame in `design/mockups.html` for the same copy.
- AC-6: `test/paste-books.test.tsx` checks the input names and `aria-describedby`. `test/e2e/paste-books.spec.ts` checks names, axe, contrast, no sideways scroll, 24px targets, and screenshots at every width in light and dark.
- AC-1 browser half: `test/e2e/paste-books.spec.ts`: paste three lines, one with no author; type its Author and the reason clears; *Check 1 line*, then *Add*; the database holds the book with that author. The spec seeds and removes its own rows.

**Risks**: a value typed back that this session has already checked reuses its answer instead of asking again: one ask per title and author per paste, as for pasted repeats (owner approved at the plan gate). A wishlist `raw_entry` holding a tab would split there now; the seed CSVs hold no tab (checked). The other row reasons stay in `.vm`; only the no-author reason moves under the cell.

**Size**: 12 files, more than 8. `splitPolicy` is never-split, so the task stays whole and attended. The extra files are the shared table, the mockup and its index, and the per-screen tests.

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
