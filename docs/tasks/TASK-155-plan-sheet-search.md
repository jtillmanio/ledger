---
id: TASK-155
title: 2.10c Suggestions keep series order, and the sheet can search (2 of 2) — search on the plan sheet
status: In progress
depends_on: [TASK-154]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: 2c630ac
---

# TASK-155 — 2.10c Suggestions keep series order, and the sheet can search (2 of 2) — search on the plan sheet

## Goal

The plan sheet has a search field, so any book on the owner's list can be found and placed in the year or quarter being planned.

## Context

- Roadmap: `docs/05-roadmap.md` § 2.10c (M11). Feature F-65. Its **Check:** is AC-1, verbatim; proposed in PR #342 and agreed when it merged (2026-11-25).
- **Split, 2 of 2.** TASK-154 fixes the suggestions' order.
- **What exists.** The sheet is `src/components/PlanSheet.tsx` (task 2.10b), reading `GET /api/plan/suggestions`; placing a suggestion is `POST /api/plan` or `POST /api/books`, with its undo. The Library's search as you type is 1.22's (`src/lib/use-search.ts`, `src/components/BookSearch.tsx`, the list's `?q=`), which matches title or author across your books. `POST /api/books/search` is Add books' Hardcover search and isn't the source here. Each row draws its place line through `BookPlace` (2.2l, 5.9b).
- **What it lists.** What the Library's search finds, less read and DNF books and those already planned in the target; an Unlisted or Parked book's placement moves it to To read (1.21, 5.15), as a suggestion's does. The plan says whether that is a new read in `src/db/queries.ts` behind a route or a parameter on an existing one.
- **Budget.** `/books/plan` is in `scripts/perf/budget.json`; the sheet's JS stays within it.
- Design: `design/mockups.html` § `plan` (the planning sheet); the frame gains the field (`ui.redrawFiles`). Rules: `.claude/rules/ui.md`. UX floor: `docs/04-design.md` § 10. The UX floor. Decisions: D-104, D-108, D-134.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves the search, the screenshots and axe, TASK-154 the suggestion clauses):
with
the test database: a series with books 1–4, none followed, all To read, each
50k words, and 200k of room left: the sheet for 2027 Q2 suggests book 1 under
*Fits the room left* and never books 2–4 in any group; with book 1 read it
suggests book 2 and not 3–4; with book 1 Reading, book 2; book 3 put On deck is
listed under *On deck*. An author followed Reading lists only the first unread
book of each of the author's series under *More from*. Typing two letters of a
title in the sheet's search lists that book with its place line and no read
book; *Put in Q2* on it writes one `reading_plan` row and Undo removes it.
Screenshots at 360px and 1280px; axe passes.
- [ ] AC-2: Given the sheet opens, the search field is its first control and has focus only when the owner moves to it (the sheet's focus rule is unchanged); typing filters as you type, Esc clears it, and an empty field shows the groups again.
- [ ] AC-3: Given a search matching an Unlisted book, placing it writes `to_read` and its plan row in one transaction, and Undo restores `unlisted` and removes the row.
- [ ] AC-4: Given a search with no match, the sheet says so in one line and keeps the groups below.
- [ ] AC-5: The sheet meets the UX floor (`docs/04-design.md` § 10. The UX floor): the field is labelled, results are real controls with names, 44 px targets at phone widths, contrast in both themes, and screenshots at each `ui.viewports` width, light and dark; `/books/plan` stays within its budget.

## Out of scope

- Searching Hardcover from the plan sheet (Add books does that).
- Changing the suggestion groups (TASK-154).

## Files likely touched

- `src/components/PlanSheet.tsx` — the field and its results.
- `src/db/queries.ts` — a plan-search read, if the plan needs one.
- `src/app/api/plan/suggestions/route.ts` or a new `src/app/api/plan/search/route.ts` — the search's answer.
- `src/app/globals.css` — tokens only.
- `design/mockups.html`, `design/mockups-index.md` — `plan` gains the field.
- `test/e2e/plan-sheet.spec.ts` — AC-1's search clauses, AC-2 to AC-5.

## Verification

- Automated: `test/e2e/plan-sheet.spec.ts` with axe at 360px and 1280px, light and dark; a route test if a route is added.
- Manual: `npm run dev`, Plan → *Plan this quarter* → type part of a title → *Put in* → expected: the book is in the quarter, Undo takes it out.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- Candidate decision: the plan sheet's search starts at **2 characters** (500 ms pause; Enter at any length), amending D-84's 3 for this box only: it reads only your own database, never an API, and the 2.10c Check types two letters. Not chosen: keeping 3 with Enter at 2; editing the Check to three. Record it with `next-id.ps1` and add "Amended by D-n" to D-84 (approved at plan, owner 2026-11-27).
- `.claude/rules/ui.md` § Design, the add-flow / search line: name the plan sheet's 2-character search as the one exception to D-84's 3 (approved at plan, owner 2026-11-27).

## Plan

_Approved by the owner 2026-11-27 (attended, Opus session; implementation handed to a Sonnet session per `model: sonnet`). Owner's answers at the gate: the field searches from **2 characters** (a decision amending D-84, above); **Reading and Listening books are left out** of the results, like read and DNF (POST /api/plan moves only a To-read book from Someday, so an in-hand book can't be placed)._

**Steps**

1. **Query** `planSearch(userId, target, q)` in `src/db/queries.ts`, beside `planSuggestions`. Raw SQL. Matches as `listBooks` does: `b.title ILIKE '%' || q || '%' OR a.name ILIKE '%' || q || '%'`, live books only (`deleted_at IS NULL`). Keeps a book whose status is NULL, `to_read`, `unlisted` or `parked`; leaves out `read`, `dnf`, `reading`, `listening`. Leaves out a book already planned in the target with `plan_suggestions`' own test (`NOT EXISTS plan_period … pp.period = target OR (target is a year AND pp.year = year)`). Each row: the `PlanSuggestion` fields the sheet's `Row` reads (`id, title, author, universe, series, seriesPosition, authorId, seriesId, universeId, status, unlisted, period, words, estimated`), `period` from `to_read_level` (a planned book elsewhere gets *Move here*), words as `plan_book_words` counts them (stated count, else `page_count × words_per_page` at 50 pages or more, else NULL), plus `level` (from `to_read_level`) and `calibre` (`calibre_id IS NOT NULL`) for `placeTag`. Order: title starts with `q` first, then `b.title`, `b.id`. `LIMIT 20`. Export a `PlanSearchHit` type. Throws on a bad target, as `planSuggestions` does (reuse `TARGET`).
2. **Route** `src/app/api/plan/search/route.ts` (new): `GET ?target=2027-Q2&q=…` → `{ hits }`, `cache-control: no-store`; `apiUserId()` gate; 400 for a target that isn't a year or quarter (same regex as the suggestions route) or a trimmed `q` shorter than 2 or longer than 200. Doc comment in the suggestions route's style.
3. **`useSearch` option** `minChars` in `src/lib/use-search.ts` (default `MIN_CHARS`, 3): the plan sheet passes 2. No other caller changes.
4. **Sheet** (`src/components/PlanSheet.tsx`, `PlanBody`):
   - A `<form role="search">` with a visible `<label>` *Title or author* and an `<input type="search">` directly under the lede, **before** the budget line, so it is the sheet's first control. The heading still takes focus on open (Sheet and SideRail unchanged).
   - `useSearch` with `minChars: 2` fetching `/api/plan/search?target=…&q=…` (abort signal passed).
   - Matches: a section *Matches* (`aria-labelledby` heading, `ps-group`-like) of `Row`s **in place of** the groups. Each row's why line is `placeTag({ status, level, period, calibre })`; the Unlisted tag and words as now. *Not now* hides a hit as it hides a suggestion. `Row`'s `s.detail` becomes the caller's line, so the hit type maps onto `PlanSuggestion` (`reason`/`rank` not shown) or `Row` takes `detail` as a prop; keep `Row`'s export for `test/plan-page.test.tsx`.
   - No match: one line in the polite status region, *Nothing on your list matches “…”.*, and the groups stay below. Loading: the status line *Searching your books…*; failure: a `neutral-error` line with *Try again*.
   - Empty field (or under 2 characters): the groups show again.
   - Esc in the field with text: clears it (`search.change("")`), `e.preventDefault()` and `e.stopPropagation()` so the Sheet's / SideRail's Esc doesn't close the sheet. Esc in an empty field reaches the sheet and closes it, as today.
   - Placement and undo share `place` / `undoRow` and `placed` state keyed by book id. `write()` sends a book to `POST /api/books` `{ use }` when it is Unlisted, Parked or has no status (`s.unlisted || s.status === null || s.status === "parked"`; extend `PlanSuggestion['status']`'s type or the hit type), so placing a Parked book unparks it with its undo (5.15); every other book is `POST /api/plan` from its `period ?? "someday"`.
5. **CSS** in `src/app/globals.css`: `.ps-search` (field full width, 44px tall at phone widths, label above), tokens only, no literal colours.
6. **Mockup**: `design/mockups.html` § `plan`, the phone planning-sheet frame (line ~3569): add the label and field under the lede, before the budget `decide` block, with an HTML comment *Task 2.10c: the sheet's search, its first control*. `design/mockups-index.md`: the `plan` row notes the field.
7. **Tests** (write first, see each fail):
   - `test/plan-search.test.ts` (new, vitest, TEST database; seed with `e2e`-style ids of its own and clean up): two letters of a title find a To-read book; a read, DNF, Reading and Listening book with the same letters are absent; a book planned in the target is absent, one planned in another quarter is present with its `period`; an Unlisted and a Parked book are present with their status; `LIMIT 20`; the route answers 400 for `target=2027-Q5`, a missing target, and a 1-character `q`.
   - `test/e2e/plan-sheet.spec.ts`, beside the existing tests, reusing `seed`, `panel`, `row`, `open`, `planOf`, `statusOf`:
     - *Check, AC-1 (search)*: type two letters of a seeded title → its row with the place line (`.ps-sub`), no read book's row; *Put in Q2* → one `reading_plan` row in Q2; Undo → none.
     - *AC-2*: the first focusable control after the heading is the field; focus is on the heading at open; typing filters with no Enter; Esc clears the field and the sheet stays open; empty field → the groups are back; Esc again closes the sheet.
     - *AC-3*: an Unlisted match placed → `statusOf` is `to_read` and `planOf` has the row; Undo → `unlisted` and no row.
     - *AC-4*: a query matching nothing → one line saying so, and `section.ps-group` still visible.
     - *AC-5*: the field has an accessible name, every hit control is a named button at least 44px tall at 360px, contrast 4.5:1, axe clean, screenshots at each `ui.viewports` width (360, 390, 412, 768, 1024, 1280) in light and dark, tagged `@at-w390-light` like the existing screenshot test.

**Files**: `src/db/queries.ts`, `src/app/api/plan/search/route.ts` (new), `src/lib/use-search.ts` (the `minChars` option; not in Files likely touched, needed for the 2-character answer), `src/components/PlanSheet.tsx`, `src/app/globals.css`, `design/mockups.html`, `design/mockups-index.md`, `test/e2e/plan-sheet.spec.ts`, `test/plan-search.test.ts` (new, not in Files likely touched). Nine files, one of them a one-option change; no schema, no migration, no view.

**Test strategy**: AC-1's search clause, AC-2, AC-4, AC-5 → the `plan-sheet.spec.ts` tests above; AC-3 → the spec plus `plan-search.test.ts`'s Unlisted row; the query's filters → `plan-search.test.ts`. AC-1's suggestion clauses are TASK-154's (`test/plan-suggestions.test.ts`). `/books/plan`'s JS budget (`scripts/perf/budget.json` `plan.jsBytes` 25200) is the Lighthouse gate: only while `LIGHTHOUSE_MODE` is on or the owner starts a hand run; otherwise say so in the PR.

**Risks**: the JS budget (the sheet is in `/books/plan`'s first load; keep the search code small, no new dependency). Esc ordering: the input's handler must stop the event only when the field has text. Grep `test/` for `MIN_CHARS` and `useSearch` before the first run: a test may pin the hook's signature.

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
