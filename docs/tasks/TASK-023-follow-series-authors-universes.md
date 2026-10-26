---
id: TASK-023
title: 1.15 Track series, authors and universes
status: Review
depends_on: [TASK-022]
size: L
model: opus
autonomy: attended
ui: false
plan_status: approved
planned_at_commit: ce5356d
---

# TASK-023 — 1.15 Track series, authors and universes

## Goal

The series, authors and universes (Cosmere, the Riordanverse) the owner follows come across from the workbook as follows with their own progress: how many of each are listed and how many are read, without a hand-kept *Completed* column.

## Context

- Roadmap: `docs/05-roadmap.md` § 1.15 Track series, authors and universes (sitting 8, after 1.13 and 1.14; schema, built attended). product B6. The roadmap entry and its **Check:** are the contract.
- **Why this is one large task** (`workflow.splitPolicy: never-split`): four tables, two new views plus a column on a third, extract seeding, both loaders, and the export list. They are only testable together.
- **Schema change, stop and ask at plan time** (CLAUDE.md), though D-42 and D-43 specify it: `book_universes(id, name)`, a nullable `books.universe_id`, and `series_follows`, `author_follows`, `universe_follows`, each keyed `(user_id, <entity>_id)` with `state IN ('tracking', 'reading')`. No column is dropped or retyped, so there is no down file. All four go in `src/db/export-tables.ts` (the follows in `USER_TABLES`), and both loaders truncate and copy them.
- Architecture: `docs/03-data-model.md` § 2. Decisions — 2.5e (narrow tables, not a polymorphic one). `.claude/rules/schema.md` (per-user facts live in progress tables, never a column on a catalog table; derived data in views).
- Views (`etl/views.sql`): `author_progress` and `universe_progress` in the shape of `series_progress` (live books only; a book with no status counts as unread). All three gain `follow_state`, NULL when not followed. Done is derived (read = listed), never stored.
- Seed (`etl/extract.py`): the Cosmere and Riordanverse tabs become universes with every row a member. A Series-tab group naming neither a series nor an author (after TASK-021's review) becomes a universe with its listed books as members. Every Series-tab group and the four author tabs become a follow at `tracking`. The tab's `Completed` column is not read. A group matching nothing goes to `unresolved.csv`.
- Decisions: D-42 (a universe is a fact about the work, not a shelf; amends product #9), D-43 (following is a stored choice; `reading` stays set until changed), D-41, D-17. Standing rule 4 applies to extract.
- **Not here** (follow-ups from PR #58): the control that changes a follow's state, and the author and universe pages, are task 5.11 in `docs/05-roadmap.md`.
- **Open question for the plan** (follow-up from PR #58): the Series tab lists a word count for each member book, and nothing reads it. This task already reads the tab. Should extract fill a book's missing `word_count` from it, with source `stated`? Ask the owner at plan time; if the answer is no, record that here.
- *From TASK-021 (1.13, PR #97):* extract keys `authors` and `book_series` rows on `slug()` but compares names with `key()`, and `book_review.csv` never pairs two names with one `key()`. So spellings like `J.R.R. Tolkien` / `JRR Tolkien` (different slugs, one key) would load as two author rows that are never proposed for review, and a follow seeded from either would see only half the books. Today's workbook has no such pair (376 authors, 215 series); this task seeds follows from those names, so it should key them one way.
- **Owner, at plan (2026-10-26):** (1) A Series-tab group that names no series, author or tab universe becomes a universe only when it is on a hand list in extract, `UNIVERSE_GROUPS` (today Grishaverse); every other one goes to `unresolved.csv`, and its name is offered in `book_review.csv` so a near spelling can be merged. The real tab's other five (Kingkiller Chronicles, His Dark Material, Robert Langdom, The Themis Files, Realm of the Elderlings) are series, not universes. (2) The word-count question: **yes**. Extract fills a book's missing `word_count` from the Series tab, source `stated`, never overwriting one; AC-5 is amended to allow it (owner).

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim): `etl/test_views.sql`: `author_progress` and `universe_progress` count read and listed books and exclude a soft-deleted book; a book with no status counts as unread; the `state` CHECK rejects any other value; `follow_state` is NULL for an entity nobody follows. `npm run test:etl`: a fixture Series tab with one series, one author, one universe group and one unmatched name seeds exactly three follows at `tracking` and one `unresolved` row, and the Cosmere tab's books carry `universe_id = 'cosmere'`. `test/export-tables.test.ts` passes with the four tables. `npm run test:db:reset` migrates from zero.
- [x] AC-2: `series_progress` keeps every column and row it had before and gains only `follow_state`. A test compares its output on a fixture before and after the change.
- [x] AC-3: `etl/load.ps1` and `etl/load.sh` truncate and copy the four tables, in foreign-key order (`book_universes` before `books`, the follows after their targets), and still refuse when `LEDGER_LIVE=true`. `rebuild`'s row counts list them.
- [x] AC-4: No catalog table gains a per-user column: `books`, `authors`, `book_series` and `book_universes` have no `user_id`, `state` or completion column. A `follow_state` change requires no change to any catalog row.
- [x] AC-5: Re-running extract against both workbooks changes only the new seed files, `books.csv`'s `universe_id` column, `books.csv`'s `word_count` and `word_count_source` where they were empty (amended by the owner at plan, 2026-10-26) and `unresolved.csv`'s new rows. The diff summary is in the PR (standing rule 4).

## Out of scope

- The control that changes a follow's state, and author and universe pages (a follow-up task). The series page is 5.9.
- Shelves (Phase 5). Universes are not shelves.
- Reading the workbook's `Completed` column, or any read state (D-41).
- Open Library series data (4.2).

## Files likely touched

- `src/db/schema.ts`: `book_universes`, `books.universe_id`, the three follow tables. `drizzle/<tag>.sql` and `drizzle/meta/*` are generated.
- `src/db/export-tables.ts`: the four tables.
- `etl/views.sql`: `author_progress`, `universe_progress`, `follow_state` on all three. `etl/test_views.sql`.
- `etl/extract.py`, `etl/test_extract.py`: seed universes, members and follows.
- `etl/load.ps1`, `etl/load.sh`, `etl/rebuild.ps1`, `etl/rebuild.sh`: copy and count.
- `test/export-tables.test.ts`: passes as is once the list is updated.

## Verification

- Automated: `npm run test:views` (`etl/test_views.sql`) covers the views, the CHECK and `follow_state` (AC-1, AC-2). `npm run test:etl` covers the seed (AC-1). `test/export-tables.test.ts` and `npm run test:db:reset` (AC-1). `npm run check:migrations` passes with no down file needed.
- Manual: `npm run extract`, then `npm run rebuild` on the development database → expected: the Cosmere books carry `universe_id = 'cosmere'`, the follows are at `tracking`, and `unresolved.csv` names any group that matched nothing.

## Follow-ups

- The roadmap entry's seed rule says any unmatched group becomes a universe; the owner chose a hand list, and the word-count fill (plan gate) → `docs/05-roadmap.md` § 1.15 (approved at plan)
- `docs/03-data-model.md` § 4.1 still lists 1.15 (and 1.10, built earlier) as not built → `docs/03-data-model.md` § 4.1 (approved at plan)
- The schema rules have no line for universes and follows → `.claude/rules/schema.md` § Schema and data-model rules (approved at plan)
- The plan's two open questions answered → `docs/tasks/TASK-023-follow-series-authors-universes.md` § Context (approved at plan)
- Nothing sets a book's `universe_id` after the load, and Grishaverse loads with no member books (its Series-tab books are reads, which D-41 never loads), so `universe_progress` shows it 0/0 (spec review) → `docs/05-roadmap.md` § 5.11
- `truncateAll` in `test/db.ts` clears `book_universes` only through `books`' CASCADE; add it when a vitest suite first writes one (schema review) → `docs/05-roadmap.md` § 5.11
- `books.universe_id` and the follows' entity columns have no index of their own (schema review) → not tracked: about 1,400 books, the same as `author_id` and `series_id`; add one only if the universe views show in the performance budget
- A `reading` follow set in the app is lost on a load or rebuild, since extract writes `tracking` (schema review) → not tracked: true of every progress table before cutover; `LEDGER_LIVE` blocks both after it

## Plan

Approved 2026-10-26 at `ce5356d`.

**Steps**

1. **Schema** (`src/db/schema.ts`): `book_universes(id, name)`; nullable `books.universe_id` → `book_universes.id`; `series_follows`, `author_follows`, `universe_follows`, each PK `(user_id, <entity>_id)`, both FKs `ON DELETE CASCADE`, `state text NOT NULL DEFAULT 'tracking'` with a CHECK `IN ('tracking', 'reading')`. `npm run db:generate -- --name book_follows` → `drizzle/0015_book_follows.sql` and meta. No down file (nothing dropped or retyped).
2. **Export** (`src/db/export-tables.ts`): `book_universes` in `CATALOG_TABLES`; the three follows in `USER_TABLES`.
3. **Views** (`etl/views.sql`): `author_progress` and `universe_progress` in `series_progress`'s shape (`books_listed`, `books_read`, `pct`; live books only; no status = unread) plus `follow_state`; `series_progress` gains only `follow_state`, appended last.
4. **Extract** (`etl/extract.py`):
   - The Cosmere and Riordanverse tabs set `universe_id` on every row's book; `book_universes` rows `cosmere`, `riordanverse`.
   - `UNIVERSE_GROUPS = {"Grishaverse"}` beside `AUTHOR_TABS` (owner).
   - Each Series-tab group matches, in order: a series by `key()` after merges, an author by `key()` after merges, a tab universe or a `UNIVERSE_GROUPS` name. A match is a follow at `tracking`; no match is an `unresolved.csv` row, and the name is sighted as a series so `book_review.csv` proposes a near spelling.
   - The tabs follow what they are: Stephen King (author), Dresden (series *The Dresden Files*), Cosmere and Riordanverse (universes). Follows are deduplicated.
   - A group's member rows resolve to a book by title and the group's author (else the one authored book with that title); an unmatched member is flagged. A resolved member fills a missing `word_count` (`stated`, never overwriting) and, in a universe group, sets `universe_id`. `Completed` is never read.
   - `author_id` and `series_id` reuse the id of a name with the same `key()` before minting a `slug()` (TASK-021's note).
   - Writes `book_universes.csv`, `series_follows.csv`, `author_follows.csv`, `universe_follows.csv` (`$OWNER` user), and `books.csv` gains `universe_id`.
5. **Loaders**: `etl/load.ps1` and `etl/load.sh` truncate the four tables, bind `$OWNER` in the follow CSVs, copy `book_universes` before `books` and each follow after its target; `etl/rebuild.ps1` and `etl/rebuild.sh` count the four.
6. **AC-5**: extract on `main` and on the branch into two scratch folders (never `seed/`); the diff summary goes in the PR.

**Files**: `src/db/schema.ts`; `drizzle/0015_book_follows.sql`, `drizzle/meta/*` (generated); `src/db/export-tables.ts`; `etl/views.sql`; `etl/test_views.sql`; `etl/extract.py`; `etl/test_extract.py`; `etl/load.ps1`; `etl/load.sh`; `etl/rebuild.ps1`; `etl/rebuild.sh`; `test/load-scripts.test.ts` (not in Files likely touched: AC-3's test); `etl/data/book_review.csv` (not listed: extract rewrites it with the unmatched groups' proposals). Close-out: the follow-up placements above.

**Test strategy**

- AC-1: `etl/test_views.sql` (author/universe progress counts, soft-deleted book excluded, no status = unread, state CHECK rejects `'done'`, `follow_state` NULL unfollowed); `etl/test_extract.py` `SeriesFollows.test_roadmap_fixture_seeds_three_follows_and_one_unresolved` (one series, one author, a Cosmere group, one unmatched name; Cosmere books `universe_id = 'cosmere'`), plus a hand-list universe, the word-count fill and the one-key author; `test/export-tables.test.ts`; `npm run test:db:reset`.
- AC-2: `etl/test_views.sql`: the pre-change `series_progress` SELECT inline, EXCEPT both ways against the view's old columns on a fixture; the column list is the old one plus `follow_state`.
- AC-3: `test/load-scripts.test.ts`: truncate list, copy order, `$OWNER` binding, the LEDGER_LIVE guard before psql, rebuild counts.
- AC-4: `etl/test_views.sql`: `information_schema` has no `user_id`, `state` or completion column on `books`, `authors`, `book_series`, `book_universes`; changing a follow's state changes `follow_state` with no catalog row changed.
- AC-5: manual, the two-folder extract diff in the PR.

**Risks**: the hand list departs from the roadmap's literal seed rule (owner's choice, follow-up 1). Size: schema + ETL + views together; `never-split`, so kept whole, attended.

## Review log

- Verify R1 FAIL (environment: a stale `.next` looped HMR reloads on `/login`, so the e2e sign-in setup timed out; every other step passed) → R2 PASS after clearing `.next` (browser suite 548 passed, 1 skipped; no code change between rounds)
- Audit R1 CHANGES (AC-4: a column denylist and a tautological md5 check; AC-2 not reached at base) → AC-4 block pins the four catalog tables' exact columns; three mutations shown to fail (total_books ignored, follow_state not last, `books.following`) → R2 PASS
- Spec R1 APPROVE (noted: unmatched listed books are reported one row per Series-tab group, every title named, not one row per book as the plan said; 49 rows became 19 on the real workbook) | Schema R1 APPROVE (three minors, placed in Follow-ups)

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 2 (R1 FAIL on a stale `.next`, R2 PASS)
- Review rounds: 1 (spec and schema both APPROVE); test audit 2
- First-pass AC FAILs: 0 (audit R1 found AC-4's test weak, not the code)
- Plan revisions after approval: 0 (the per-group unresolved row is within "an unmatched member is flagged")
