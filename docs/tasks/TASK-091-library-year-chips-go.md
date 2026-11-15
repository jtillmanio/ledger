---
id: TASK-091
title: 3.4b Rank a book when you finish it (2b of 3) — the Library's year chips go
status: Review
depends_on: [TASK-076]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: 8d31c4a
---

# TASK-091 — 3.4b Rank a book when you finish it (2b of 3) — the Library's year chips go

## Goal

The Library stops drawing year chips and *No year*: a year's reading, and a read with no date, are found on Top books instead.

## Context

- Roadmap: `docs/05-roadmap.md` § 3.4b Rank a book when you finish it, and every year's top ten (M14). The entry and its **Check:** are the contract (agreed by the owner 2026-11-13). Feature F-60. Pulled ahead of 1.26 (D-139).
- **Split from TASK-076** (owner, at TASK-076's plan gate, 2026-11-14: `workflow.splitPolicy: split`, the whole task was about 22 files). TASK-076 builds the Top books page, with its year switcher ending in *No year*; this part takes the Library's chips away once that home exists (R2-08), so it depends on TASK-076. TASK-077 adds ranking at the finish. The roadmap entry is ticked when TASK-075, TASK-076, TASK-077 and this task are all Done.
- **The Library's year chips go** (D-122): the chip row and *No year* in `src/app/books/list/page.tsx`, `listBooks`'s `year` / `noYear` options (`src/db/queries.ts`; the `year` option also matched a book's plan year through `plan_period`, which goes with it), the `year` key in `libraryHref` (`src/lib/library-sort.ts`) and the links that pass it (`src/components/BookSort.tsx`, `src/lib/series-list.ts`), the `yearSummary` / `unyeared` reads the chips use (`listCounts`, `readWithoutYear`), and the years line of `src/app/books/list/loading.tsx`'s skeleton. The *Finished* sort stays. `test/year-chips.test.tsx` goes or is rewritten to prove no chip renders.
- **Tests that read the chips' queries move to Top books' query** (TASK-076's `topBooksYear` / `topBookYears` in `src/db/queries.ts`): `test/queries.test.ts`, `test/reading-log.test.ts`, `test/reading-log.test.tsx`, `test/unlisted.test.ts` and `test/soft-delete.test.ts` prove *every read counts in its year* (D-65) and *an undated read is under No year* through `listBooks({ year })`, `listBooks({ noYear })`, `yearSummary` and `readWithoutYear`; each keeps its claim, read off the Top books year instead. `test/library-page.test.tsx` and `test/list-totals.test.tsx` mock `yearSummary` and `listCounts.unyeared`.
- Docs that name the chips: D-65's text (*the books page's year filter counts from it*, *No year* chip) and the `books_by_year` comment in `etl/views.sql` (*the books page's No year chip counts it*).
- Design: `docs/04-design.md` § 10 The UX floor. Mockup `blist` draws no year chip.
- Decisions: D-65, D-122, R2-08, S-L6.

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim; this part proves *the Library renders no year chip*. TASK-075 and TASK-077 prove the `npm test` clauses, TASK-076 the other browser clauses): `npm test`: placing a new read into a year of six ranked
reads with scripted answers takes at most 3 picks and leaves ranks 1–7
contiguous, and its undo restores the six as they were; *Skip* writes no rank;
a book read in two years holds a rank in each; moving a book from rank 12 to
rank 3 leaves ranks contiguous and puts it in the top ten, and its undo restores
the order. In the browser (0.11), a past year lists its first ten, a divider,
then every other book read that year, with none collapsed; an unranked read
shows under *Not ranked yet*; a read with no date shows under *No year*; and the
Library renders no year chip. The up → down → up migration test passes.
- [x] AC-2: `/books/list` renders no year chip and no *No year* chip, `?year=2024` is ignored, and the *Finished* sort still orders by finish date.

## Out of scope

- The Top books page (TASK-076).
- Ranking at the finish (TASK-077).
- Changing the *Done* tab's grouping by year (`src/app/books/status/page.tsx`).

## Files likely touched

- `src/app/books/list/page.tsx`, `src/app/books/list/loading.tsx` — the chips go.
- `src/db/queries.ts` — `listBooks` loses `year` / `noYear`; `yearSummary`, `readWithoutYear` and `listCounts.unyeared` go.
- `src/lib/library-sort.ts`, `src/components/BookSort.tsx`, `src/lib/series-list.ts` — no `year` key.
- `test/year-chips.test.tsx`, `test/e2e/library.spec.ts` or the Library's existing spec — AC-1's Library clause, AC-2.
- `test/queries.test.ts`, `test/reading-log.test.ts`, `test/reading-log.test.tsx`, `test/unlisted.test.ts`, `test/soft-delete.test.ts`, `test/library-page.test.tsx`, `test/list-totals.test.tsx` — onto Top books' query.

## Verification

- Automated: `test/year-chips.test.tsx` rewritten (no chip, `?year=` ignored), a browser check that the Library draws no year chip, the moved query tests.
- Manual: on the dev database, open Library (tab row → *Library*) → no year chips, no *No year*; open `/books/list?year=2024` → the whole list; *Sort* → *Finished* → most recent first.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- B10's "(… the year chips)" now reads "Top books' year switcher" and B36's status is *shipped*, since the chips are gone (approved at plan) → docs/01-product.md § The owner's list, Books (fixed in this PR)
- Roadmap 3.4b ticked: TASK-075, -076, -077 and this task are all Done or in Review (approved at plan) → docs/05-roadmap.md § 3.4b (ticked in this PR), with the task list's Done cell → docs/06-tasklist.md § M14 (ticked in this PR)
- The ticked roadmap entries that still name the chips (1.5's check, 4.5's text) and prose naming the removed reads (`yearSummary` in docs/05-roadmap.md, `readWithoutYear` in docs/CLAUDE-CODE-PROMPTS.md, R2-08's fix column in docs/review/LEDGER.md) stay as written → not tracked: a ticked entry and a findings ledger are history and their text is never edited (approved at plan)
- The Library can no longer be filtered by plan year (the removed `year` option also matched `plan_period`) → not tracked: the task's own Context says that match goes with the option (D-122), and the plan rail has its own year pages

## Plan

Approved by the owner 2026-11-15. Planned on Opus; implemented on Sonnet (the task's `model:`) in the worktree `.claude/worktrees/task-3.4b-year-chips` (`ledger_test_2`, port 3200). Size: about 16 files, 6 of them source and the rest tests moved mechanically, no schema change; kept whole (`attended`), since a split would leave the suite red between parts.

**Steps**
1. Tests first.
   - Rewrite `test/year-chips.test.tsx`: the Library draws no `a.chip` whose href carries `year=` and no chip named *No year*; with `searchParams { year: "2024" }` `listBooks` is called without a `year` or `noYear` key; keep the `.chip .n` CSS check (the *Unlisted* chip still uses that rule). Drop the `yearSummary` mock and `listCounts.unyeared`.
   - `test/e2e/library-sort.spec.ts`: one `ONCE` test with its own books under the prefix `E2E Yr` (not `E2E Srt`, which the file's other tests filter on), two `read` books finished 2024-05-01 and 2023-05-01 (exact), made and removed by the test. Open `/books/list?year=2024&sort=finished&q=E2E Yr`: no link whose href has `year=`, no *No year* text in `.filters`, both books listed, the 2024 one first (*Finished*, most recent first).
   - Confirm both fail against the current page.
2. Move the chips' query tests onto Top books' queries (TASK-076), each keeping its claim:
   - `listBooks({ year: y })` → `topBooksYear(USER, y)`'s `book_id`s
   - `yearSummary` and the per-year counts → `topBookYears(USER).years` (`{ year, reads }`)
   - `readWithoutYear` → `topBookYears(USER).undated`
   - `listBooks({ noYear: true })` → `topBooksYear(USER, null)`'s `book_id`s

   In `test/queries.test.ts`, `test/reading-log.test.ts`, `test/reading-log.test.tsx`, `test/unlisted.test.ts`, `test/soft-delete.test.ts`. In `test/queries.test.ts` the three "findable under its plan year" lines go with the `plan_period` match (the row's `plan_year` assertion stays). In `test/library-page.test.tsx` and `test/list-totals.test.tsx` drop the `yearSummary` mock and `unyeared`, and fix the chip-count comment ("one year, No year").
3. `src/db/queries.ts`: `listBooks` loses `year` and `noYear`, their option types and their WHERE clauses (the `book_reads` and `plan_period` year match, the undated-read match); its doc comment drops the year chips. Delete `yearSummary` and `readWithoutYear`; `listCounts` loses `unyeared` (type, SELECT and doc comment). The `plan_period` LATERAL join for the row's `plan_year` stays.
4. `src/lib/library-sort.ts`: `year` out of `LibraryParams` and out of `libraryHref`'s key list. `src/components/BookSort.tsx` and `src/lib/series-list.ts` only pass `LibraryParams` through: no change.
5. `src/app/books/list/page.tsx`: drop the `year` search param, `yearSummary`, `unyeared`, `noYear`, `yearList`, the year chip row (with *No year*), and `year` from the `BookSort`, *Everything* `aria-current` and `seriesAllHref` calls. `src/app/books/list/loading.tsx`: `filters={[1, 3]}` and the comment "Chip lines: status (and its Sort), genres."
6. Docs:
   - `etl/views.sql`: the `books_by_year` comment, comments only, no view changes: "the books page's *No year* chip counts it instead" → Top books' *No year* lists it (D-122); "(the year chips count reads, not this)" → "(Top books' year switcher counts reads, not this)".
   - `docs/review/decisions.md`: append "Amended by D-122." to D-65's row (`classify.md`: the only edit to an old row).
7. Before pushing, grep `test/`, `etl/test_*.py`, `etl/test_views.sql` for `yearSummary`, `readWithoutYear`, `unyeared`, `noYear`, `year=` and "No year" chip checks a full suite would fail on.

**Files**: `src/app/books/list/page.tsx`, `src/app/books/list/loading.tsx`, `src/db/queries.ts`, `src/lib/library-sort.ts`, `etl/views.sql` (not in Files likely touched: comment only), `docs/review/decisions.md` (not in Files likely touched: D-65's amended note), `test/year-chips.test.tsx`, `test/e2e/library-sort.spec.ts`, `test/queries.test.ts`, `test/reading-log.test.ts`, `test/reading-log.test.tsx`, `test/unlisted.test.ts`, `test/soft-delete.test.ts`, `test/library-page.test.tsx`, `test/list-totals.test.tsx`; at close-out `docs/01-product.md`, `docs/05-roadmap.md` (tick), `docs/06-tasklist.md` (Done cell). Not touched, though listed: `src/components/BookSort.tsx`, `src/lib/series-list.ts`.

**Test strategy**
- AC-1 (the Library clause, *the Library renders no year chip*): `test/e2e/library-sort.spec.ts` › the new test (browser, 0.11); `test/year-chips.test.tsx` › no chip.
- AC-2: `test/year-chips.test.tsx` › no year chip, no *No year*, `?year=2024` not handed to `listBooks`; the e2e test › `?year=2024` lists the 2023 book too, and *Finished* orders 2024 before 2023; `test/library-sort.test.ts`'s existing *Finished* sort tests still pass.
- D-65 and R2-08 claims kept: the moved tests in step 2 (every read counts in its year; an undated read is under *No year*; a soft-deleted book counts in neither).

**Risks**: a browser spec or the skeleton height test (`library-sort.spec.ts` › loading skeleton) may depend on the years row; the skeleton test measures only the first chip group, which is unchanged.

## Review log

Verify R1 FAIL(1: lint, an unused mock argument in test/year-chips.test.tsx) → R2 PASS | CI R1 PASS (832947d, every project) | Audit R1 PASS | Spec R1 APPROVE (two notes taken: a redundant test dropped, a comment fixed) | Schema R1 APPROVE | UI R1 PASS (AC-1 to AC-4 at 360, 390, 412, 768, 1024, 1280; the skeleton not seen in the browser, covered by library-sort.spec.ts' skeleton height test) | Round 2: no reviewer re-run, the fixes touched one test and a views.sql comment only.

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 2
- Review rounds: 1
- First-pass AC FAILs: 0
- Plan revisions after approval: 0
