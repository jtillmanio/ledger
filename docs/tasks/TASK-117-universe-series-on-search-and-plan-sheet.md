---
id: TASK-117
title: 2.2l The universe and series on Add books' search results and the plan sheet
status: Review
depends_on: [TASK-062, TASK-064]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: e01e95d
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

- [x] AC-1 (roadmap **Check:**, verbatim): `npm test`: given a book by Brandon Sanderson in universe *Cosmere*, series *Mistborn* at 4, with `page_count` 330, its library hit has the line *Brandon Sanderson · Cosmere · Mistborn #4 · 330 pages*, built from `bookSub` and followed by its pages; a hit with no universe reads as it does today; a Hardcover hit is unchanged. 2.2j's source scan no longer exempts `BookSearch.tsx`. The plan sheet's header for that book reads *Brandon Sanderson · Cosmere · Mistborn #4* followed by its words. In the browser (0.11) a long series name wraps at 360px in both, with no horizontal scroll, and axe passes.
- [x] AC-2: On the test database, `librarySearch` answers `universe` for each hit: the universe's name for a book in one, null for a book in none; and `planBook` answers the book's `universe`, `series` and `series_position`.
- [x] AC-3: Given a library book in universe *Discworld* and series *Discworld City Watch* at 2 (the series name contains the universe's), its search line reads *author · Discworld City Watch #2 · N pages*, naming it once, as `bookSub` does on the Library row. Given a library book with no series and no universe, the line is *author · N pages*.
- [x] AC-4: The plan sheet opened from a library search result in Add books and from the Library's `⋯` *Plan for…* show the same header line for the same book; from a Hardcover result it stays *author(s) · words*.
- [x] AC-5: Add books' search results and the plan sheet meet the UX floor (`docs/04-design.md` § 10): a long line wraps with no ellipsis and no horizontal scroll at 360px, axe passes, text contrast, a screenshot at 360px and 1280px of each.

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

- The search row's buttons (*Add to Someday*, *Year or quarter…*, *Queue to listen*) are 34px high at phone widths, under the 44px the UX floor gives primary controls (ui-verifier, 2.2l) → not tracked: pre-existing, drawn that way since 1.4c, and above the 24px floor the browser specs hold
- The Library's genre chip strip scrolls sideways inside its own container at 1280px (ui-verifier, 2.2l) → not tracked: pre-existing and by design; the page itself does not scroll

## Plan

Approved by the owner, 2026-11-20. Kept whole past the size check (about 12 files, 4 of them source): the roadmap's one Check covers both screens, and the source change is about 30 lines.

### Steps

1. `src/db/queries.ts`: `librarySearch` adds `LEFT JOIN book_universes u ON u.id = b.universe_id` and `u.name AS universe`, as 2.2j's queries do; `LibraryHit` gains `universe: string | null`. `planBook` adds `LEFT JOIN book_series` and `book_universes` and answers `universe`, `series` and `series_position`; `PlanBook` gains them.
2. `src/components/BookSearch.tsx`: a library hit's line is `bookSub(lib)`, then *N pages*. A Hardcover hit's is `bookSub({ author: authorList(authors), universe: null, series, series_position: position })`, then *N pages*: the same text it prints today, with no `#${…position…}` template left in the file.
3. `src/components/PlanPicker.tsx`: `PickerBook` gains optional `universe`, `series` and `series_position`. The header is `bookSub(book)`, then ` · ` and the words; `MoveBody` passes them from `planBook`.
4. `src/components/AddBooks.tsx`: `pickerBody` passes a library pick's universe, series and position. A Hardcover pick passes its authors only, so it stays *author(s) · words* (AC-4).
5. `design/mockups.html`: redraw one library row in `add` and the header in `moveplan` as *author · universe · series #n*. `design/mockups-index.md` notes it (task 2.2l, D-134), as 2.2j did.

### Files

- `src/db/queries.ts`, `src/components/BookSearch.tsx`, `src/components/PlanPicker.tsx`, `src/components/AddBooks.tsx`: steps 1–4
- `design/mockups.html`, `design/mockups-index.md`: step 5 (not in Files likely touched: `ui.redrawFiles`)
- `test/format.test.ts`: the source scan stops exempting `BookSearch.tsx`
- `test/add-book-sheet.test.tsx`: the search lines and the sheet header from a library result (not in Files likely touched)
- `test/add-book.test.ts`: AC-2's `universe` on a hit, through the search route
- `test/plan-period.test.ts`: AC-2's `planBook` fields, in `GET /api/plan?bookId=` (not in Files likely touched)
- `test/e2e/book-search.spec.ts`, `test/e2e/plan-picker.spec.ts`: AC-1's browser part, AC-4, AC-5

### Test strategy

- AC-1 (`npm test`), AC-3: `test/add-book-sheet.test.tsx`. The Sanderson / Cosmere / Mistborn #4 / 330 pages line; a hit with no universe as today; the Discworld City Watch #2 hit names it once; a hit with no series and no universe reads *author · N pages*; the existing Hardcover test is unchanged. The same book's plan sheet header, from its *Year or quarter…*, reads *Brandon Sanderson · Cosmere · Mistborn #4* and its words.
- AC-1, the source scan: `test/format.test.ts` › no other builder of a book's place line. This fails before the change.
- AC-2: `test/add-book.test.ts` gives the universe's name, or null, for a hit. `test/plan-period.test.ts` › `GET /api/plan?bookId=` gives `universe`, `series` and `series_position`.
- AC-4: `test/e2e/book-search.spec.ts`, with one E2E library book in a universe and a long series. Its sheet header from the search result and from the Library's `⋯` *Plan for…* match; a Hardcover result's stays *authors · words*.
- AC-1's browser part, AC-5: in both specs, the long line wraps at 360px, with no horizontal scroll, axe and contrast passing, and screenshots at 360 and 1280px.

## Review log

Verify R1 PASS | CI R1 PASS (tests, 8 e2e shards) | Audit R1 CHANGES (AC-3 test non-discriminating; added the Discworld sheet header) → fixed | Verify R2 PASS | Spec R1 APPROVE | Schema R1 APPROVE | UI R1 NOT RUN (sign-in blocked; owner approved reading the passcode line) → R2 PASS (6 widths)

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 2
- Review rounds: 1 (spec, schema and UI each once; UI needed a second run to sign in)
- First-pass AC FAILs: 0
- Plan revisions after approval: 0
