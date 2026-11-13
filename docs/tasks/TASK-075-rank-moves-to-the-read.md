---
id: TASK-075
title: 3.4b Rank a book when you finish it (1 of 3) — the rank moves to the read
status: Review
depends_on: [TASK-074, TASK-010]
size: M
model: opus
autonomy: attended
ui: false
plan_status: approved
planned_at_commit: baed953
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
- *From TASK-074 (3.4, PR #251):* 3.4's rank writes are `rankBook` / `undoRank` in `src/db/writes.ts` (`/api/progress/book/rank`): a per-user advisory lock, the year's ranked live books renumbered from 1 on every write, and an undo that refuses unless the whole year is still as the write left it (`RankChange.left`). Nothing keeps `book_status.year_rank` with its year when the finish moves: a re-date across years (`redateBookRead`, a `read` re-date) or a status undo that clears the finish leaves the rank in the wrong year or in none (the next rank write to that year heals the list). Moving the rank onto the read should keep it with the read's year; until then a reader treats a rank as meaningful only where `finished_on` is set.

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim; this part proves *a book read in two years holds a rank in each*, *moving a book from rank 12 to rank 3 … its undo restores the order*, and *the up → down → up migration test passes*. TASK-077 proves the placement and *Skip*; TASK-076 the browser clauses): `npm test`: placing a new read into a year of six ranked
reads with scripted answers takes at most 3 picks and leaves ranks 1–7
contiguous, and its undo restores the six as they were; *Skip* writes no rank;
a book read in two years holds a rank in each; moving a book from rank 12 to
rank 3 leaves ranks contiguous and puts it in the top ten, and its undo restores
the order. In the browser (0.11), a past year lists its first ten, a divider,
then every other book read that year, with none collapsed; an unranked read
shows under *Not ranked yet*; a read with no date shows under *No year*; and the
Library renders no year chip. The up → down → up migration test passes.
- [x] AC-2: After the migration, `read_events` has a nullable `year_rank` and `book_status` has none; `npm run test:db:reset` builds the schema, and no query, view, loader or test names `book_status.year_rank`.
- [x] AC-3: Up → down → up on a fixture with a ranked read, an unranked read and a precision-`none` read keeps every `read_events` row's `year_rank`, date and precision, the `none` read still `none` with a NULL date.
- [x] AC-4: Given 2025 with twelve ranked reads, moving the read at rank 12 to rank 3 leaves ranks 1–12 contiguous with it at 3; moving an unranked 2025 read to rank 5 ranks it and leaves 1–13 contiguous; one undo restores each. A rank on a read with no date is refused with 400 and writes nothing.
- [x] AC-5: An extract over a fixture workbook whose Top Books tab ranks two books in 2023 writes each rank onto that book's 2023 read in the seed the loaders read; a ranked title with no 2023 read, or two, is reported, never dropped; `npm run test:etl` covers both.

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

- The data model says the rank is on the read: 2.16 gains a year ranking's shape (2.17's `none` read has no rank), and § 4.1 gains the 3.4b row → docs/03-data-model.md § 2. Decisions (2.16) and § 4.1 By task (approved at plan)
- Candidate decision: the rank is on the read, and the workbook's Top Books ranks load onto Calibre's reads, narrowing D-41; D-41 and D-101 get *Amended by D-150*, and the schema rule that said the workbook loads no read state now names the exception → docs/review/decisions.md § D-150 and .claude/rules/schema.md § A book is its title and author (approved at close-out)
- The ER diagram still drew `year_rank` on `BOOK_STATUS` → docs/DIAGRAMS.md § 2. Books data model (approved at close-out)
- Product B4 said the workbook's ranks don't load → docs/01-product.md § The owner's list (Books, B4) (approved at close-out)
- A ranked read re-dated into another year, or to no date, carries its rank (a gap in one year, a tie in the other, until the next rank write to each); and a finish's undo now refuses once its read is ranked, which the finish toast's two undos must order → docs/tasks/TASK-077-rank-at-the-finish-this-or-that.md § Context (approved at plan)
- Production check before the Release that carries 0026: a rank no read can hold is only named in a `RAISE NOTICE` (schema review); production's books are rebuilt by extract before cutover (D-139), so nothing there is lost → not tracked: production is rebuilt from extract before the books cutover (D-139), which re-derives every rank
- The `book_reads` view and the Library still read nothing of the rank; the Top books screen that reads `read_events.year_rank` is TASK-076's → not tracked: already tracked in TASK-076 (the screen)

## Plan

Approved 2026-11-13 by the owner, with the three decisions below.

**Owner decisions at the plan gate (CLAUDE.md stop-and-ask: a column added and a column dropped)**
1. Approved: add `read_events.year_rank` (nullable integer), drop `book_status.year_rank`.
2. Down rule: `book_status.year_rank` comes back holding the rank of the book's latest read (the highest `read_events.id`), the read whose finish `book_status.finished_on` mirrors (D-133), so 3.4's code reads it in the right year. A rank on an earlier read of the same book is lost going down; the gap it leaves heals on the next rank write to that year.
3. A `read` status with no log row (`book_reads`' second branch) can be ranked: the rank write logs the read first from the status's finish (as `saveBookStatus` does when leaving `read`), and its undo deletes that row.

**Steps**
1. Migration 0026 (`drizzle-kit generate`, hand-edited): add `read_events.year_rank`; log a read for each ranked `read` status with no log row; copy each `book_status.year_rank` onto the book's latest read where its finish year equals `book_status.finished_on`'s; drop `book_status.year_rank`. `schema.ts` follows.
2. `drizzle/down/0026_<tag>.sql`: add `book_status.year_rank`, fill it from the latest read's rank, drop `read_events.year_rank`.
3. `src/db/writes.ts`: `rankBook` → `rankRead` over the year's ranked live reads (`read_events` of live books, year `extract(year FROM finished_on)`), same advisory lock, renumbering 1…N, `RankChange` with `readId`, `backfilled` and `left` (read ids); `undoRank` restores every rank it changed and deletes a backfilled read. A read with no date is refused (`RefusedStatus` → 400), writing nothing. The route takes `{ readId, rank }` or `{ bookId, rank }` (the book's latest read; a status-only read is logged first).
4. The empty-row checks (`undoBookStatus`, the Someday add's undo) stop naming `yearRank`; `undoBookStatus` refuses (409) when the read it would delete holds a rank.
5. `etl/extract.py`: each Top Books row resolves by title (`find_book`, no author) to its book, then to that book's read in that year in `read_events`; exactly one → `year_rank` on that `seed/read_events.csv` row; none, a title naming several books, two reads, or a second rank for one read → reported (`flag`), never dropped (D-93). Each year's landed ranks are renumbered 1…N in the workbook's order. `book_status.csv` loses the column; `read_events.csv` gains it.
6. `etl/load.ps1`, `etl/load.sh`: the `\copy` column lists.

**Files**: `src/db/schema.ts`; `drizzle/0026_*.sql`, `drizzle/meta/*`; `drizzle/down/0026_*.sql`; `src/db/writes.ts`; `src/app/api/progress/book/rank/route.ts` (not in "Files likely touched": the API's input moves to the read); `etl/extract.py`; `etl/load.ps1`; `etl/load.sh`; `etl/test_extract.py`; `test/year-rank.test.ts`; `test/year-rank-migration.test.ts` (new). Over 8 files, kept whole: it is already 1 of 3 and has no UI.

**Test strategy**
- AC-1, AC-4: `test/year-rank.test.ts` — a book read in 2024 and 2025 holds a rank in each; 2025 with twelve ranked reads, rank 12 → 3 keeps 1–12 contiguous and puts it in the top ten, undo restores; an unranked read → 5 gives 1–13, undo restores; a read with no date → 400, nothing written; a status-only read is logged and ranked, its undo removes the log row.
- AC-2, AC-3: `test/year-rank-migration.test.ts` — up → down → up on a ranked read, an unranked read and a precision-`none` read, asserting every row's `year_rank`, date and precision and both columns' shapes; plus the grep that nothing names `book_status.year_rank`.
- AC-5: `etl/test_extract.py` — Top Books ranks two books in 2023, each rank lands on its 2023 read; a ranked title with no 2023 read and one with two are reported.

**Risks**: a ranked read re-dated across years carries its rank (follow-up to TASK-077).

## Review log

Verify R1 FAIL (test/load-scripts.test.ts:92 and etl/test_calibre.py:432 pinned the old columns) → fixed | Verify R1b PASS | CI R1 PASS (4b8d9ab, e2e full 8/8) | Spec R1 CHANGES (follow-up destinations only; every AC PASS) | Schema R1 APPROVE (3 MINOR: stale read before the book lock, a forgeable `backfilled`, an untested year-mismatch rank) → fixed | Verify R2 PASS | CI R2 PASS (f134faa) | Audit R1 NOT RUN (owner's uncommitted files) → re-run in a clean worktree on ledger_test_2 (owner: free the merged 2.10b worktree) | Audit R1 CHANGES (AC-5: the two-reads and ranked-twice branches untested) → test added | Audit R2 PASS (both mutants killed) | Verify R3 PASS | Schema R2 not re-run (no data-layer change since its APPROVE but tests)

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 3 (R1 failed on two tests pinning the old columns)
- Review rounds: 2 (spec 1 + close-out check, schema 1, audit 2)
- First-pass AC FAILs: 0 (AC-5 PARTIAL at audit R1: two report branches untested)
- Plan revisions after approval: 0 (outside the plan's file list, `etl/test_calibre.py` and `test/load-scripts.test.ts` follow from steps 5 and 6)
