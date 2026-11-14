---
id: TASK-091
title: 3.4b Rank a book when you finish it (2b of 3) — the Library's year chips go
status: Ready
depends_on: [TASK-076]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
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

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves *the Library renders no year chip*. TASK-075 and TASK-077 prove the `npm test` clauses, TASK-076 the other browser clauses): `npm test`: placing a new read into a year of six ranked
reads with scripted answers takes at most 3 picks and leaves ranks 1–7
contiguous, and its undo restores the six as they were; *Skip* writes no rank;
a book read in two years holds a rank in each; moving a book from rank 12 to
rank 3 leaves ranks contiguous and puts it in the top ten, and its undo restores
the order. In the browser (0.11), a past year lists its first ten, a divider,
then every other book read that year, with none collapsed; an unranked read
shows under *Not ranked yet*; a read with no date shows under *No year*; and the
Library renders no year chip. The up → down → up migration test passes.
- [ ] AC-2: `/books/list` renders no year chip and no *No year* chip, `?year=2024` is ignored, and the *Finished* sort still orders by finish date.

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
