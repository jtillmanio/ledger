---
id: TASK-075
title: 3.4b Rank a book when you finish it (1 of 3) — the rank moves to the read
status: Draft
depends_on: [TASK-074, TASK-010]
size: M
model: opus
autonomy: attended
ui: false
plan_status: none
planned_at_commit:
---

# TASK-075 — 3.4b Rank a book when you finish it (1 of 3) — the rank moves to the read

## Goal

A rank belongs to a read, not a book, so a book read in 2024 and again in 2026 can hold a place in each year's ranking, and the workbook's past top-ten ranks arrive on the reads they belong to.

## Context

- Roadmap: `docs/05-roadmap.md` § 3.4b Rank a book when you finish it, and every year's top ten (M14; order 3.4 → 3.4b → 3.5; depends on 3.4 and 1.5). The entry and its **Check:** are the contract; the owner agreed the Check on 2026-11-13 (it was *proposed*). Feature F-60. Pulled ahead of 1.26 (D-139).
- **Split, 1 of 3** (`workflow.splitPolicy: split`: a column moved, ETL and UI together). This part: the column, the load, the writes and their undo. TASK-076 builds the Top books screen and removes the Library's year chips; TASK-077 builds ranking at the finish. TASK-077's merge ticks the roadmap entry.
- **The column, and a stop-and-ask** (CLAUDE.md: a column added and a column dropped). Proposed by the entry and D-101: add `read_events.year_rank` (the year being the read's finish year, `extract(year FROM finished_on)`, never stored), drop `book_status.year_rank`, with `drizzle/down/<tag>.sql` and an up → down → up test that asserts row values (`.claude/rules/schema.md`). **Stop and ask at plan time**, with the down file's rule for a book whose ranked reads span two years (one `book_status` column can hold one).
- **A year's ranks are contiguous from 1** over every ranked read of that year (D-101); the top ten is the first ten, read off the order, never stored (hard rule 2). A read with no date (`finished_on_precision = 'none'`) has no year and no rank: it is *No year* (R2-08). A `read` status with no log row (`book_reads`) has no read to hold a rank: the plan says whether it can be ranked.
- **3.4's writes move here.** TASK-074 writes `book_status.year_rank`; this part moves those writes onto the read (rank at a position, take out, and 3.4b's *move anywhere in the year, across the divider too*, where moving an unranked read in ranks it, D-122). Each pushes one undo that restores every rank it changed.
- **The workbook's past ranks** load into the reads they belong to: `seed/workbook_reads.csv` (`title, year, genre, tab, rank`; product B4) holds the Top Books tab's ranked top ten per year, 2021–2026 (`docs/cutover-parity.md` § `Top Books`), keyed by title and year only, with no author. The plan says how a rank finds its read (the extract's title resolution, against `seed/read_events.csv`), and what is reported, never dropped (D-93), when none or two match. Before 1.26 extract and a rebuild can fill it (D-139).
- Readers of `book_status.year_rank` to move: `src/db/writes.ts` (~296, ~1950: the empty-row checks), `etl/extract.py` (writes `year_rank` empty), `etl/load.ps1` / `load.sh` (`\copy book_status(...)`), `etl/test_extract.py`.
- Data model: `docs/03-data-model.md` § 2. Decisions, 2.16 and 2.17; § 3. Views (`book_reads`); § 4.1 By task (add the row for 3.4b).
- Decisions: D-3, D-21, D-41, D-65, D-93, D-101, D-122, D-139. Hard rules 2, 3 and 7.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves *a book read in two years holds a rank in each*, *moving a book from rank 12 to rank 3 … its undo restores the order*, and *the up → down → up migration test passes*. TASK-077 proves the placement and *Skip*; TASK-076 the browser clauses): `npm test`: placing a new read into a year of six ranked
reads with scripted answers takes at most 3 picks and leaves ranks 1–7
contiguous, and its undo restores the six as they were; *Skip* writes no rank;
a book read in two years holds a rank in each; moving a book from rank 12 to
rank 3 leaves ranks contiguous and puts it in the top ten, and its undo restores
the order. In the browser (0.11), a past year lists its first ten, a divider,
then every other book read that year, with none collapsed; an unranked read
shows under *Not ranked yet*; a read with no date shows under *No year*; and the
Library renders no year chip. The up → down → up migration test passes.
- [ ] AC-2: After the migration, `read_events` has a nullable `year_rank` and `book_status` has none; `npm run test:db:reset` builds the schema, and no query, view, loader or test names `book_status.year_rank`.
- [ ] AC-3: Up → down → up on a fixture with a ranked read, an unranked read and a precision-`none` read keeps every `read_events` row's `year_rank`, date and precision, the `none` read still `none` with a NULL date.
- [ ] AC-4: Given 2025 with twelve ranked reads, moving the read at rank 12 to rank 3 leaves ranks 1–12 contiguous with it at 3; moving an unranked 2025 read to rank 5 ranks it and leaves 1–13 contiguous; one undo restores each. A rank on a read with no date is refused with 400 and writes nothing.
- [ ] AC-5: An extract over a fixture workbook whose Top Books tab ranks two books in 2023 writes each rank onto that book's 2023 read in the seed the loaders read; a ranked title with no 2023 read, or two, is reported, never dropped; `npm run test:etl` covers both.

## Out of scope

- The Top books screen, the year switcher, *Not ranked yet*, *No year* and removing the Library's year chips (TASK-076).
- *Rank it in 2026* at the finish and the *This or that* sorter (TASK-077).
- Ranking comic reads (only books write `read_events` today).
- Removing the other `user_id` columns (6.18).

## Files likely touched

- `src/db/schema.ts`, `drizzle/<new migration>.sql`, `drizzle/meta/*`, `drizzle/down/<tag>.sql` — the column moved.
- `src/db/writes.ts` — rank, take out and move on the read, with undo; the empty-row checks.
- `etl/extract.py`, `etl/load.ps1`, `etl/load.sh` — the workbook's ranks onto the reads; `book_status` loses the column.
- `etl/test_extract.py` — AC-5.
- `test/year-rank.test.ts` — AC-1's write clauses, AC-4.
- `test/year-rank-migration.test.ts` (new) — AC-2, AC-3.

## Verification

- Automated: `test/year-rank.test.ts`, `test/year-rank-migration.test.ts`, `npm run test:etl`, `npm run check:migrations`.
- Manual: `npm run extract` against `Books.xlsx` → the PR reports how many workbook ranks found their read and how many were reported.

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
