---
id: TASK-142
title: 5.9b Every other place line links its names (3 of 3) — Add books' results, and a gap row fills By hand
status: Done
depends_on: [TASK-140, TASK-141]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: 56a5a60
---

# TASK-142 — 5.9b Every other place line links its names (3 of 3) — Add books' results, and a gap row fills By hand

## Goal

Add books' search results link a book's series, author and universe names, and a series page's gap row *Add* opens By hand with the series and its number already filled in.

## Context

- Roadmap: `docs/05-roadmap.md` § 5.9b Every other place line links its names (M17). Feature F-38. Its **Check:** is AC-1, verbatim; proposed, and agreed when merged.
- **Split, 3 of 3.** TASK-140 and TASK-141 linked every other surface. **This part's merge ticks 5.9b**, with the other two merged first.
- **Add books' results.** Search's results (`src/components/BookSearch.tsx`, answered by `POST /api/books/search`, `src/app/api/books/search/route.ts`) draw their place line through `BookPlace` (`src/components/BookPlace.tsx`) where the result is a book the Ledger holds; a result from Hardcover alone has no ids to link, and draws its names as text. The answer gains the ids it needs.
- **A gap row fills By hand.** A series page's gap row *Add* (TASK-102; `src/components/SeriesBooks.tsx`, *task 5.9 decision 3*) opens Add books with Search holding the series' name (`/books/add?q=<name>`). Here it opens By hand with *Series* and *#* filled from the gap: `src/components/ByHand.tsx`, through `src/components/AddBooks.tsx` and a new parameter on `src/app/books/add/page.tsx` (which reads `shelf`, `q` and `note` today). The plan names the parameter and what Add books does with a series name it doesn't hold (the gap's series always exists, but the link may be shared).
- **Byte budgets.** `/books/add` and `/books/series/[id]` are in `scripts/perf/budget.json` (0.14c; the series page from 0.14e, TASK-138, if it has merged); each stays within its ceiling.
- Design: `design/mockups.html` §§ `add`, `series` (`design/mockups-index.md`): `a.plink` on a result, and By hand opened from a gap (`ui.redrawFiles`).
- Rules: `.claude/rules/ui.md` (every add surface opens on its segmented control; here By hand is chosen by the link). UX floor: `docs/04-design.md` § 10. The UX floor. Decisions: D-83, D-94.

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim; this part proves the clauses for Add books' results and the gap row, and the byte budgets of `/books/add` and the series page. TASK-140 and TASK-141 prove the rest, and this part's merge ticks 5.9b):
on the Up next cards, the status rows, the plan screens, Top books, Coming
out, Parked, Listen next, Add books' results, Now's *Next in* and the
follow sheet's rows, a book's series name is a link named by the series
alone to `/books/series/<id>`, and its author and universe names link to
their pages; a book with no series draws no series link. A gap row's
*Add* for #3 opens By hand with the series named and `3` in *#*. Every
route it changes stays within its byte budget (`scripts/perf/budget.json`).
Screenshots at 360px and 1280px.
- [x] AC-2: Given a search on Add books that returns a book the Ledger holds in a series and one only Hardcover has, the first result's series, author and universe names are links to their pages and the second's names are text with no link.
- [x] AC-3: Given a series with books #1, #2 and #4, when its gap row's *Add* for #3 is tapped, then Add books opens with By hand selected, *Series* holding the series' name and *#* holding `3`, focus in By hand's first empty field; saving adds the book at #3 and the series page's gap row is gone.
- [x] AC-4: Given `/books/add` opened with no new parameter, Search is selected and empty as before; given `?q=` alone, Search holds the text as before.
- [x] AC-5: Add books' results and By hand meet the UX floor (`docs/04-design.md` § 10. The UX floor): every link a real `<a>` with a name, link text 4.5:1 in both themes, axe reports no new violations, and screenshots at each `ui.viewports` width, light and dark.

## Out of scope

- The surfaces in TASK-140 and TASK-141.
- Filling anything but *Series* and *#* (author, universe, title) from the gap.
- Changing how Search ranks or matches results.

## Files likely touched

- `src/components/BookSearch.tsx`, `src/app/api/books/search/route.ts` — the results' links and ids.
- `src/components/SeriesBooks.tsx` — the gap row's link.
- `src/app/books/add/page.tsx`, `src/components/AddBooks.tsx`, `src/components/ByHand.tsx` — By hand opened and filled.
- `design/mockups.html`, `design/mockups-index.md` — `add` and `series`.
- `test/series-books.test.tsx`, `test/add-book-sheet.test.tsx`, `test/e2e/series.spec.ts`, `test/e2e/book-search.spec.ts` — AC-1 to AC-5.

## Verification

- Automated: `test/series-books.test.tsx` (the gap row's `href`); a component test for By hand's filled fields and AC-4; `test/e2e/series.spec.ts` for AC-3 end to end on the test database; `test/e2e/book-search.spec.ts` for AC-2 with axe; `test/perf.test.ts` still passes.
- Manual: the ui-verifier opens a series with a gap at 360px and 1280px, taps *Add* → expected: By hand with the series and number filled; saves → the gap row is gone.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- By hand reaches a series only by `slug(name)` (`addBook`'s `seriesOf`, `src/db/writes.ts`), but the Calibre sync mints `<slug>-x` when two names share a slug (`freshId`, `src/db/calibre-sync.ts`). Such a series can't be reached by typing its name, nor by a gap row's link, and an add lands in the other series. Older than this task → docs/05-roadmap.md § 5.19 (new, approved at plan; Check proposed), and its row in docs/06-tasklist.md § M17 and the F-38 line of § Coverage
- The series page has no `scripts/perf/budget.json` entry until 0.14e (TASK-138) merges, so its byte-budget clause holds trivially here; `books-add` is measured on the preview → not tracked: already tracked in TASK-138 (0.14e adds the entry)
- `/books/add?q=` fills Search's field but runs no search until you type (as before); the ui-verifier noticed it → not tracked: unchanged by this task, and AC-4 says "as before"
- `src/app/books/add/loading.tsx` briefly shows Search's skeleton before By hand appears on a gap link (accepted at plan) → not tracked: accepted at plan

## Plan

_Approved 2026-11-25 (owner: "approve"), keeping the task whole although it touches 11 files: it is the last of a three-way split, every change is small, and there's no schema change._

**The parameter.** A gap row's *Add* links to `/books/add?series=<name>&n=<n>`. When `series` is present, Add books opens on By hand with *Series* filled. *#* is filled only when `n` is a number from 0 to `MAX_POSITION`, else left empty. Focus goes to By hand's first empty field (Title). `q` is ignored when `series` is present. With no new parameter, `/books/add` and `?q=` behave as before. A series name the Ledger doesn't hold (a shared link) is still filled in, and saving creates that series, as typing it does. The name is used, not the id, because By hand already finds a series by the slug of its name: no lookup query, no added bytes.

**Steps**

1. `librarySearch` selects `b.author_id`, `b.series_id`, `b.universe_id`, and `LibraryHit` gains them. `BookSearch`'s row draws its place line through `BookPlace` (`subParts`), then ` · N pages`, in `.rs.res-place`. A Hardcover-only result has no ids, so its names draw as text. `globals.css`'s place-link rules gain `.res-place a`.
2. `src/lib/book-add.ts` gains `handHref(series, n)` (the link) and `handParam(series, n)` (the page's reader: `{ series, position } | null`). `SeriesBooks`' gap row uses `handHref`; the empty slate keeps `seriesAddHref` (`?q=`).
3. `src/app/books/add/page.tsx` reads `series` and `n` through `handParam` and passes `hand` to `AddBooks`. `AddBooks` starts in mode `hand` when given one, and its By hand state carries the series and position. `ByHand` takes starting `series` and `position` plus `focusFirstEmpty`, which on mount focuses the first empty field in `ORDER`. *Add it by hand* from Search still carries only the title.
4. `design/mockups.html`: on the `add` screen, `a.plink` on the library results' author, universe and series (the Hardcover result stays text), and a By hand frame opened from a gap (*The Dark Tower*, `6`); on the `series` screen, the gap-row note says *Add* opens By hand filled. `design/mockups-index.md` follows.

**Files:** `src/db/queries.ts`, `src/components/BookSearch.tsx`, `src/app/globals.css`, `src/lib/book-add.ts`, `src/components/SeriesBooks.tsx`, `src/app/books/add/page.tsx`, `src/components/AddBooks.tsx`, `src/components/ByHand.tsx`, `design/mockups.html`, `design/mockups-index.md`, this task file. Not in the task's list: `queries.ts` (the answer's ids), `globals.css` (the link style), `book-add.ts` (the href and the reader).

**Test strategy**

- AC-2: `test/add-book-sheet.test.tsx` (a library result's author, universe and series are links to `/books/authors/…`, `/books/universes/…`, `/books/series/…`; a Hardcover result's `.rs` has no `<a>`); `test/hardcover-search.test.ts` (the route's library hits carry `author_id`, `series_id`, `universe_id`); `test/e2e/book-search.spec.ts` (the same in a browser, with axe).
- AC-3: `test/series-books.test.tsx` (the gap row's `href` is `/books/add?series=…&n=3`, encoded); a component test (By hand selected, *Series* and *#* filled, focus on Title); `test/e2e/series.spec.ts` (tap *Add* for #3, By hand filled, save, then the series page has no gap row for #3).
- AC-4: component tests: no parameter means Search is selected and empty; `?q=` alone means Search holds the text; a bad `n` leaves *#* empty.
- AC-5 and AC-1's screenshots: floor checks (axe, contrast, named links) with screenshots at each `ui.viewports` width, light and dark, in the two browser specs.
- AC-1's byte budgets: `books-add` is measured on the preview. The series page has no `scripts/perf/budget.json` entry until 0.14e merges; the PR says so.

**Risks:** `src/app/books/add/loading.tsx` draws Search's skeleton, so a gap link briefly shows Search before By hand. Accepted at plan.

## Review log

_Filled by /implement-task. One line per round._

Verify R1 FAIL(2: paste-books frame-count pin, reading-log load-only flake) -> R2 PASS | CI R1 PASS (check, 10 e2e shards, tests) | Audit R1 PASS | Spec R1 APPROVE | Schema R1 APPROVE | UI R1 PASS (AC-3's save not walked on the dev DB; the e2e spec covers it) | Drift: see PR

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 2
- Review rounds: 1
- First-pass AC FAILs: 0
- Plan revisions after approval: 0
