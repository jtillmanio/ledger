---
id: TASK-141
title: 5.9b Every other place line links its names (2 of 3) — the status rows, lists and follow sheet
status: Review
depends_on: [TASK-140]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: 64dd15c
---

# TASK-141 — 5.9b Every other place line links its names (2 of 3) — the status rows, lists and follow sheet

## Goal

On the books status rows, Top books, Coming out, Parked, Listen next and the follow sheet, a book's series, author and universe names are links to their pages.

## Context

- Roadmap: `docs/05-roadmap.md` § 5.9b Every other place line links its names (M17). Feature F-38. Its **Check:** is AC-1, verbatim; proposed, and agreed when merged.
- **Split, 2 of 3.** TASK-140 linked the dashboard and the plan screens and set the pattern (which link form each route takes, the ids each query returns); this part follows it. TASK-142 does Add books and ticks 5.9b.
- *From TASK-125 (5.9, PR #330):* each surface draws its place line through `BookPlace` (`src/components/BookPlace.tsx`): a plain `<a>` where a route's byte budget is tight, `<Link prefetch={false}>` elsewhere; the queries gain `author_id`, `universe_id` and `series_id`; the mockup draws `a.plink` on each.
- *From TASK-140 (5.9b part 1, PR #341):* `booksUpNext` now carries `author_id`, `series_id` and `universe_id`, so the On deck and bare-year `StatusBookRow` rows on Up next need no query change for them. `BookPlace.tsx` also exports `followHref` and `FollowName` (a series, universe or author name as a link; a subseries or shelf as text), for any line that names a followed thing, the follow sheet's among them. The place-links rule in `globals.css` lists its containers by selector: add yours there (a line at 11px needs `padding-bottom:.5rem` to make a 24px box). In a sheet, a place link is held to 24px, not the 44px of its buttons (`plan-sheet.spec.ts`, AC-6). Every surface used `<Link prefetch={false}>`; the byte budgets are unmeasured on PR #341 (Lighthouse is off), so check `test/perf.test.ts` and each route's ceiling after merge.
- **Surfaces in this part:** the status rows (`src/components/StatusBookRow.tsx`, `/books/status`), Top books (`src/components/TopBooks.tsx`, `/books/top`), Coming out (`src/app/books/releases/page.tsx`), Parked (`src/components/ParkedRow.tsx`, `/parked`), Listen next (`src/components/ListenNext.tsx`) and the follow sheet's rows (`src/components/FollowSheet.tsx`).
- **Rows that are controls.** Top books' rows carry a drag handle and `⋯` (task 3.4b), the status rows a status control; a place link inside them must not start a drag or open the row's menu.
- Design: `design/mockups.html` §§ `status`, `top`, `releases`, `parked`, `follow` (`design/mockups-index.md`): `a.plink` on each (`ui.redrawFiles`).
- Rules: `.claude/rules/ui.md`, `.claude/rules/schema.md`. Hard rule 4. UX floor: `docs/04-design.md` § 10. The UX floor. Decisions: D-119, D-122.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves the clauses for the status rows, Top books, Coming out, Parked, Listen next and the follow sheet's rows, and the byte budgets of the routes it changes. TASK-140 and TASK-142 prove the rest):
on the Up next cards, the status rows, the plan screens, Top books, Coming
out, Parked, Listen next, Add books' results, Now's *Next in* and the
follow sheet's rows, a book's series name is a link named by the series
alone to `/books/series/<id>`, and its author and universe names link to
their pages; a book with no series draws no series link. A gap row's
*Add* for #3 opens By hand with the series named and `3` in *#*. Every
route it changes stays within its byte budget (`scripts/perf/budget.json`).
Screenshots at 360px and 1280px.
- [x] AC-2: Given a book in a series, by an author, in a universe, on the seeded test database, each surface in this part draws the series link (named by the series alone, `href` `/books/series/<id>`), the author link (`/books/authors/<id>`) and the universe link (`/books/universes/<id>`); given a standalone book, no series or universe link.
- [x] AC-3: On Top books, a pointer press on a place link opens its page and starts no drag (the row's order is unchanged after); on the status rows and Parked, a place link's tap opens its page, not the row's control or menu.
- [x] AC-4: These surfaces meet the UX floor (`docs/04-design.md` § 10. The UX floor): every link a real `<a>` with a name, targets at least 24px, link text 4.5:1 in both themes, axe reports no new violations, and screenshots at each `ui.viewports` width, light and dark.

## Out of scope

- The dashboard and plan screens (TASK-140) and Add books (TASK-142).
- Changing what any row shows besides the links (order, counts, menus).

## Files likely touched

- `src/components/StatusBookRow.tsx`, `src/components/TopBooks.tsx`, `src/app/books/releases/page.tsx`, `src/components/ParkedRow.tsx`, `src/components/ListenNext.tsx`, `src/components/FollowSheet.tsx` — the place lines.
- `src/db/queries.ts` — the ids on their rows.
- `design/mockups.html`, `design/mockups-index.md` — `a.plink` on each.
- `test/top-books.test.tsx`, `test/status.test.ts`, `test/parked.test.ts`, `test/e2e/status.spec.ts`, `test/e2e/top-books.spec.ts`, `test/e2e/follows.spec.ts` — AC-1 to AC-4.

## Verification

- Automated: `test/place-links.test.tsx` for each surface's links, the no-series case and the queries' ids (AC-2); `test/e2e/top-books.spec.ts` for AC-3's drag clause; `test/e2e/status.spec.ts`, `parked-review.spec.ts`, `releases.spec.ts` and `follows.spec.ts` with axe, 24px boxes and contrast (AC-3, AC-4). The byte-budget clause of AC-1 is not automated: `test/perf.test.ts` tests the report helpers, not route bytes, and Lighthouse is off, so it is checked after merge (the four measured views: `books-status` In flight, `top` one year, `parked`, `releases`; a route over takes `plain`).
- Manual: the ui-verifier taps each surface's names at 360px and 1280px → expected: each opens its page, and no row's drag, menu or control fires.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- AC-1's byte-budget clause (`books-status`, `top`, `parked`, `releases` in `scripts/perf/budget.json`) is unmeasured: Lighthouse is off → not tracked: the PR's *How it was verified* names it as the after-merge check; a route over its ceiling takes `plain` links
- The follow sheet opened from a finish's toast closes on a navigation through `onClose`, so the history entry `Sheet` pushed on open stays behind and may cost one dead Back press; the sheets TASK-140 linked behave the same → not tracked: not shown to fail in any test, same behaviour as the sheets already shipped; the owner's preview walk is the check
- The ui-verifier could not see Top books' `⋯` button in the dark 360px screenshot (it exists, 44px) → not tracked: predates this task (no link or style of this task touches it) and unconfirmed; the owner's preview walk is the check

## Plan

Approved by the owner 2026-11-25 ("approved with recommendations"): the task kept whole (attended), Parked's picker header linked too.

**Steps**

1. **Queries** (`src/db/queries.ts`): `author_id`, `series_id`, `universe_id` move from `PlannedBook` into `StatusBook`, and are selected by `booksInFlight`, `booksListenNext`, `booksDone`, `topBooksYear` and `rankSorterRead` (`TopRead`), `wantedReleases` (`WantedRelease`) and `parkedBooks` (`ParkedBook`). Each already joins `authors`, `book_series`, `book_universes` and filters `b.deleted_at IS NULL`: no new join, no new book read.
2. **Status rows** (`src/components/StatusBookRow.tsx`): `.row-sub` draws `<BookPlace parts={subParts(book)} />` (In flight, Done, Stopped, On deck, the bare-year lane).
3. **Listen next** (`src/components/ListenNext.tsx`): `.qplace` draws `BookPlace`.
4. **Top books** (`src/components/TopBooks.tsx`, `src/app/books/top/page.tsx`): `TopRow.sub: string` becomes `place: PlacePart[]`; `Body` draws it through `BookPlace`; the sorter's `sub` is `place.map(partText).join(" · ")`. The drag stays on the handle alone (`ReorderList`); the place line is in the row body.
5. **Coming out** (`src/app/books/releases/page.tsx`) and **Parked** (`src/app/parked/page.tsx`): `.row-sub` draws `BookPlace`. Parked's *Plan…* picker gets the ids too (`ParkedRowBook`, `src/components/ParkedRow.tsx`), so its header links the names (TASK-140 left it text).
6. **Follow sheet** (`src/components/FollowSheet.tsx`): `.follow-name` draws `<FollowName>` (series, author, universe linked; subseries, shelf text). Opened from a finish's toast it lives above every page (`FollowOfferProvider`), so it closes itself when the pathname changes.
7. **Styles** (`src/app/globals.css`): `.follow-name a` joins the place-links rule, with a 24px box; `.row-sub a` and `.qplace a` are covered already.
8. **Mockup** (`design/mockups.html`, `design/mockups-index.md`): `a.plink` on `status` (In flight, Done, Listen next), `top`, `releases`, `parked`, `follow`; the index notes say so.

**Link form.** `<Link prefetch={false}>` on every surface, as TASK-140. Budgets are compressed transfer bytes on the measured views (`books-status` In flight, `top` one year, `parked`, `releases`); a route over takes `plain`.

**Files**

- `src/db/queries.ts` — the ids (step 1).
- `src/components/StatusBookRow.tsx`, `ListenNext.tsx`, `TopBooks.tsx`, `FollowSheet.tsx`, `ParkedRow.tsx` — the place lines (steps 2–6). `ParkedRow.tsx` is not in *Files likely touched*: the picker's ids.
- `src/app/books/top/page.tsx`, `src/app/books/releases/page.tsx`, `src/app/parked/page.tsx` — the rows built server-side (steps 4, 5). Not in *Files likely touched* except releases.
- `src/app/globals.css` — not in *Files likely touched*: `.follow-name a` (step 7).
- `design/mockups.html`, `design/mockups-index.md` — step 8.
- Tests: `test/top-books.test.tsx`, a new `test/place-links.test.tsx`, `test/status.test.ts`, `test/parked.test.ts`, `test/releases.test.ts`; `test/e2e/status.spec.ts`, `top-books.spec.ts`, `parked.spec.ts`, `releases.spec.ts`, `follows.spec.ts`; any test pinning `TopRow.sub` or these queries' columns (grep first).

**Test strategy**

- AC-2: component tests (`test/top-books.test.tsx`; `test/place-links.test.tsx` for `StatusBookRow`, `ListenNext`, the follow sheet's row, the Parked and Coming out lines): link names and hrefs, the series link named alone, a standalone with no series or universe link. Query tests pin the ids (`status.test.ts`, `parked.test.ts`, `releases.test.ts`).
- AC-3: `top-books.spec.ts` presses a place link → the series URL, the ranks unchanged; `status.spec.ts` and `parked.spec.ts`: a link opens its page, the status control or verbs don't fire.
- AC-4: axe, contrast, 24px boxes and screenshots at each width, light and dark, in the status, top-books, parked, releases and follows specs.
- AC-1: the byte budgets checked after merge (Lighthouse off).
- Manual: the ui-verifier taps each surface's names at 360 and 1280.

**Risks.** A test pinning Top books' `sub` or these queries' columns; the follow sheet's close on navigation.

**Size.** About 12 source files plus tests, over the split policy's 8; already part 2 of 3 and each edit small, so kept whole, attended (owner, at plan).

## Review log

Verify R1 PASS (135 files, 2724 tests) | Audit R1 PASS (advisory: the drag-handle unit test passed on main by looping over zero links → asserts 3 links) | Spec R1 CHANGES (AC-4 Parked: new tests pinned to light, no dark axe/contrast/screenshots) → fixed (both themes at all six widths; picker header axe and contrast in both) | Schema R1 APPROVE | UI R1 PASS on the surfaces the dev data holds (Done, Top books, the follow sheet; In flight, Listen next, Coming out and Parked are empty there, covered by the seeded e2e specs; no axe tool in that session, the e2e specs carry axe) | CI R1 FAIL (releases.spec.ts:280 w360-light: read the links before the streamed row was visible; parked-review.spec.ts:371 skeleton, w390-light: my fixture gave the oldest row a place line, 20px over the skeleton) → fixed (wait for visibility; the place fixtures moved to the other two books) | Verify R2 PASS (135 files, 2724 tests) | CI R2 pending at close-out

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 2 (full chain both times; the audit and CI fixes were spec-only)
- Review rounds: 1 (spec-reviewer CHANGES → fixed; no second round: the fix touched only a spec, which the reviewer had asked for)
- First-pass AC FAILs: 1 (AC-4, Parked, light theme only)
- Plan revisions after approval: 0
