---
id: TASK-117
title: 2.2l The universe and series on Add books' search results and the plan sheet
status: Draft
depends_on: [TASK-062, TASK-064]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-117 — 2.2l The universe and series on Add books' search results and the plan sheet

## Goal

A library book found in Add books' search, and a book in the plan sheet's header, name their universe and series the way every other books row does: *author · universe · series #n*.

## Context

- Roadmap: `docs/05-roadmap.md` § 2.2l (its **Check** is AC-1, verbatim; proposed by TASK-062, agreed by merging). `docs/06-tasklist.md` M10, after 2.2j.
- Noticed by TASK-062 (2.2j, PR #241); left out at its plan gate (owner, 2026-11-12). The plan sheet was added at its close-out the same day.
- The line: `bookSub` and `bookPlace` in `src/lib/format.ts` (D-134: the series alone with no universe, the universe alone with no series, the universe dropped when the series name contains it).
- Search: `src/components/BookSearch.tsx` builds its own sub-line, *author · series #n · pages* (around `const sub = [lib ? lib.author : authorList(...)`). A library hit should be `bookSub` then *N pages*; a Hardcover hit has no universe and stays as it is. The rows come from `librarySearch` in `src/db/queries.ts` (`LibraryHit`), which selects `bs.name AS series` but no universe: add `book_universes.name AS universe` as 2.2j's queries do.
- 2.2j's source scan: `test/format.test.ts` › the list of files allowed to build a book's line, which names `src/components/BookSearch.tsx`; this task removes it from that list.
- The plan sheet: `src/components/PlanPicker.tsx`. Its header line is `{book.author} · {words}`, from `PickerBook` (`author`, `words`, `estimated`). Two callers build it: `PlanPickerSheet` from `GET /api/plan?bookId=` (`planBook` in `src/db/queries.ts`), and `AddBooks.tsx`'s `pickerBody` from a search result (library or Hardcover). `RailStackSheet.tsx` uses `MoveBody` from the same file.
- Design: `design/mockups.html` `add` (Add books, search) and `moveplan` (the plan sheet). UX floor: `docs/04-design.md` § 10.
- Decisions: D-134 (the row's line), D-139.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): `npm test`: given a book by Brandon Sanderson in universe *Cosmere*, series *Mistborn* at 4, with `page_count` 330, its library hit has the line *Brandon Sanderson · Cosmere · Mistborn #4 · 330 pages*, built from `bookSub` and followed by its pages; a hit with no universe reads as it does today; a Hardcover hit is unchanged. 2.2j's source scan no longer exempts `BookSearch.tsx`. The plan sheet's header for that book reads *Brandon Sanderson · Cosmere · Mistborn #4* followed by its words. In the browser (0.11) a long series name wraps at 360px in both, with no horizontal scroll, and axe passes.
- [ ] AC-2: On the test database, `librarySearch` answers `universe` for each hit: the universe's name for a book in one, null for a book in none; and `planBook` answers the book's `universe`, `series` and `series_position`.
- [ ] AC-3: Given a library book in universe *Discworld* and series *Discworld City Watch* at 2 (the series name contains the universe's), its search line reads *author · Discworld City Watch #2 · N pages*, naming it once, as `bookSub` does on the Library row. Given a library book with no series and no universe, the line is *author · N pages*.
- [ ] AC-4: The plan sheet opened from a library search result in Add books and from the Library's `⋯` *Plan for…* show the same header line for the same book; from a Hardcover result it stays *author(s) · words*.
- [ ] AC-5: Add books' search results and the plan sheet meet the UX floor (`docs/04-design.md` § 10): a long line wraps with no ellipsis and no horizontal scroll at 360px, axe passes, text contrast, a screenshot at 360px and 1280px of each.

## Out of scope

- A Hardcover hit's series or universe beyond what it shows today (it has no universe).
- Any other books row: 2.2j drew them.
- What the plan sheet does (its chips, preview, Move): only its header line changes.
- Re-ordering or re-wording the search row's tag (*Someday*, *Q1 2027*, *Unlisted · Calibre*).

## Files likely touched

- `src/db/queries.ts`: `librarySearch` and `LibraryHit` gain `universe`; `planBook` gains `universe`, `series`, `series_position`
- `src/components/BookSearch.tsx`: a library hit's line from `bookSub`, then its pages
- `src/components/PlanPicker.tsx`: `PickerBook` gains the place; the header uses `bookSub`
- `src/components/AddBooks.tsx`: `pickerBody` passes a library pick's place
- `test/format.test.ts`: the source scan stops exempting `BookSearch.tsx`
- `test/add-book.test.ts` or a search query test: AC-2's universe on the hit and on `planBook`
- `test/e2e/book-search.spec.ts`, `test/e2e/plan-picker.spec.ts`: the lines, wrapping at 360px, axe

## Verification

- Automated: the query tests (AC-2), the source scan (`test/format.test.ts`), and the two e2e specs (AC-1, AC-4, AC-5).
- Manual: search *Mistborn* in Add books at 360px → expected: a library hit reads *Brandon Sanderson · Cosmere · Mistborn #n · N pages*; tap its *Year or quarter…* → expected: the sheet's header reads the same place, then the words.

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
