---
id: TASK-032
title: 1.18b Calibre: universes, subseries, page counts and the Calibre id
status: Review
depends_on: [TASK-030]
size: L
model: opus
autonomy: attended
ui: false
plan_status: approved
planned_at_commit: 2bc9121
---

# TASK-032 — 1.18b Calibre: universes, subseries, page counts and the Calibre id

## Goal

Every book takes its universe (Calibre's superseries) with its reading order, its subseries and its page count from Calibre, and remembers which Calibre book it is, so a rename in Calibre keeps the link. Books the workbook lists but Calibre doesn't have stay in the Ledger and are listed, so the owner can keep each or add it to Calibre.

## Context

- Roadmap: `docs/05-roadmap.md` § 1.18b (after 1.18). The roadmap entry and its **Check:** are the contract.
- **Why this is one large task** (`workflow.splitPolicy: never-split`): a migration, three new reads in `etl/calibre.py`, extract's fold-in for universes, subseries, pages and the Calibre id, a new review sidecar, and both loaders. The **Check:** exercises them as one run.
- Pattern to copy: 1.18 itself (TASK-030, `docs/tasks/archive/TASK-030-calibre-import.md`): `etl/calibre.py`'s `custom_column()` lookup by name with a `--…-column` flag per column, `etl/test_calibre.py`'s fixture `metadata.db` built with `sqlite3`, and `fold_calibre()` in `etl/extract.py`, which runs after every workbook value.
- The owner's library (read 2026-10-27): `#superseries` and `#subseries` are Calibre *series*-type columns, so each value has an index (`books_custom_column_N_link.extra`). `#superseries` holds 23 values, Cosmere and the Riordanverse among them, with an order across series (Malazan 1–18 over three series). `#subseries` holds 25, inside a series (Discworld's City Watch, Mistborn's eras, the Black Company's Books of the North). `#pages` is an int column. Numbers here are the owner's data, not fixtures.
- Today universes come from the workbook only: the Cosmere and Riordanverse tabs (D-43) and the Series tab's universe groups (`etl/extract.py` `UNIVERSE_TABS`, `series_groups`, `BookIndex.set_universe`). After this task those set `universe_follows` only.
- Today `fold_book_details()` resets and fills `page_count` from Open Library after `fold_calibre()` runs; Calibre's `#pages` must win, so the order or the fill changes.
  *From docs/hardcover-replaces-open-library (D-94, owner, 2026-10-28):* 1.14b, after this task, rewrites `book_details.csv` from Hardcover. Make `#pages` win over the details sidecar's page count whatever its `source`, so 1.14b inherits the rule; the roadmap's amendment reads the Check's *Open Library page count* that way.
- Today a workbook book Calibre doesn't have is created silently, with nothing marking it (D-87: books exist because they are in Calibre or on the workbook's lists).
- Data model: `docs/03-data-model.md` § 2. Decisions 2.1 (amended by D-91), § 4.1 By task (1.18b). `src/db/schema.ts` `books`, `bookSeries`, `bookUniverses`. `etl/views.sql` `universe_progress`. `.claude/rules/schema.md`: the sidecar rules for `calibre_books.csv`, and every new table joins `src/db/export-tables.ts`.
- **Schema approved by the owner, 2026-10-27** (D-90, D-91): `books.calibre_id` (unique where set), `books.universe_position`, `book_subseries(id, name, series_id)`, `books.subseries_id`, `books.subseries_position`. No `user_id` on any of them (D-91). Nothing is dropped or retyped, so no down migration is required.
- 1.22 will read `books.calibre_id` for its *Calibre* source tag; 4.4 will carry these fields after cutover (both noted in their roadmap entries).
- Decisions: D-90 (this task), D-91 (single user), D-87 (Calibre is the source of truth), D-88, D-89 (near-spelling threshold for Calibre's pairs), D-42 (a universe is a fact, not a shelf), D-43, D-83, D-86.

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim): `npm run test:etl`, with 1.18's fixture `metadata.db` given `#superseries`, `#subseries` and `#pages` columns, shows:
  - a book with a superseries loads that universe and its position, and a workbook universe membership Calibre doesn't share is in `unresolved.csv`;
  - a book with a subseries loads it under its series, with its position;
  - `#pages` replaces an Open Library page count, and Open Library still fills a book with no `#pages`;
  - every Calibre book loads its `calibre_id`, and a fixture book renamed between two runs is still one book, with the new title;
  - a workbook book Calibre doesn't have is one `calibre_missing.csv` row and still one `books.csv` row; `keep` survives a re-run; adding the book to the fixture library removes its row;
  - a second run over the same fixture leaves every sidecar byte-identical.

  `npm run test:db:reset` applies the migration. Then a dry run over the real library, with the superseries, subseries and page counts filled and the `calibre_missing.csv` count in the PR.
- [x] AC-2: Given a fixture whose superseries column has the lookup name `#universe` at a different `custom_column_N`, `--superseries-column '#universe'` loads the same universes and positions as `#superseries` did; likewise `--subseries-column` and `--pages-column`. A library with none of the three columns runs, fills none of them, and reports each missing column once.
- [x] AC-3: A workbook universe tab or Series-tab universe group still writes its `universe_follows` row, and a followed universe Calibre gives no book is one `unresolved.csv` row. One subseries name under two different series is one `unresolved.csv` row, and the book keeps its series.
- [x] AC-4: The migration adds exactly the five approved columns and one table; `book_subseries` is in `src/db/export-tables.ts` (`test/export-tables.test.ts` passes); `etl/load.ps1` and `etl/load.sh` both copy `book_subseries` before `books` and truncate it, and `test/load-scripts.test.ts` covers both. Two books given the same `calibre_id` fail the unique constraint on the TEST database.
- [x] AC-5: Re-running extract against both workbooks on `main` and on the branch, the `seed/` CSV diff shows only: the new `books` columns filled, `book_subseries.csv`, universe memberships Calibre changed, Calibre page counts over Open Library's, and the universes no book belongs to any longer, dropped unless followed (standing rule 4; summary in the PR). `calibre_missing.csv`, its columns and its `keep` rule are in `.claude/rules/schema.md`.

## Out of scope

- Calibre genres (1.18c, TASK-033) and `#editor`, `#illustrator`, `#translator` (L-5).
- Any screen: the *Calibre* source tag (1.22), a *Not in Calibre* filter (4.4), showing a universe's order or a subseries in the app.
- Dropping `user_id` from existing tables (6.18).
- The in-app sync after cutover (4.4), and writing anything to Calibre.
- Renaming `book_universes` or `universe_id` to *superseries* (D-90 keeps the name).

## Files likely touched

- `src/db/schema.ts`, `drizzle/<tag>.sql` and its snapshot (`npm run db:generate`): the five columns and `book_subseries`.
- `src/db/export-tables.ts`, `test/export-tables.test.ts`: `book_subseries`.
- `etl/calibre.py`, `etl/test_calibre.py`: read `#superseries`, `#subseries`, `#pages` and Calibre's book id; flags; fixture columns.
- `etl/extract.py`, `etl/test_extract.py`: universes and subseries from Calibre, workbook universes as follows only, `#pages` over Open Library, `calibre_id` matching, `calibre_missing.csv`.
- `etl/data/calibre_books.csv` (new columns), `etl/data/calibre_missing.csv` (new).
- `etl/load.ps1`, `etl/load.sh`, `test/load-scripts.test.ts`: copy `book_subseries`.
- `package.json` (`extract`'s new argument), `.claude/rules/schema.md`, `docs/COMMANDS.md`.

## Verification

- Automated: `npm run test:etl` covers every AC-1 bullet, the flag and missing-column cases in AC-2 and the reports in AC-3, with no network. `test/export-tables.test.ts` and `test/load-scripts.test.ts` cover AC-4; a vitest on the TEST database covers the `calibre_id` unique constraint.
- Manual: `npm run calibre -- --dry-run` over the real library → expected: the superseries, subseries and page counts it would fill, quoted in the PR, and nothing written. A real run, then `npm run extract` on `main` and on the branch into temp folders, then a CSV diff → expected: only the changes in AC-5. `npm run rebuild` on development only with the owner's go-ahead at the plan gate.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- Candidate decision: a Calibre rename found by the Calibre id is written to `book_review.csv` as a pre-decided `merge` row (reason `calibre rename`, keep Calibre's), so the workbook's spelling folds into the new title through the existing merges, not through a new column (approved at plan) → docs/review/decisions.md § D-96
- What the real library showed, for the owner: 181 `calibre_missing.csv` rows to decide, seven workbook universe memberships Calibre doesn't share, two pairs of Calibre books merged into one Ledger book, one series spelled two ways in Calibre, and one subseries with no series → docs/OWNER-CHECKLIST.md § Actions from follow-ups
- AC-4 counts "the five approved columns and one table", but the approved schema (Context, data model § 4.1) is four `books` columns plus `book_subseries`, which is what the migration adds (spec review R1) → not tracked: an AC is the owner's to reword; proposed in the PR
- No index on the new foreign keys (`book_subseries.series_id`, `books.subseries_id`) (schema review R1, MINOR) → not tracked: matches current practice (`books.universe_id` has none either) and the tables hold about 4,600 rows; one belongs with the first query that filters by them
- calibre.py lists the second of two Calibre books merged into one Ledger book as unmatched on every run (schema review R1, MINOR) → not tracked: console output only; it clears when the owner settles the pair (Owner checklist above)
- The roadmap's 1.15 **Check:** still says the Cosmere tab's books carry `universe_id` → not tracked: a done item's Check is its history, and D-90 supersedes it
- The "subseries lost its series" guard in `extract_books` has no test (spec review R2) → not tracked: unreachable since a second Calibre book on one book loads nothing; kept as a guard for the load's foreign key

## Plan

_Approved 2026-10-29 at 2bc9121. Owner's answers at the gate: the rename design (step 3) is fine; `npm run rebuild` on development at the end, yes._

**Steps**

1. **Schema.** `books.calibre_id` integer, unique (NULLs allowed); `books.universe_position` real; `books.subseries_id` → `book_subseries`; `books.subseries_position` real; `book_subseries(id, name, series_id NOT NULL → book_series)`. `npm run db:generate` → migration 0016 (nothing dropped or retyped: no down file). `book_subseries` joins `src/db/export-tables.ts`.
2. **`etl/calibre.py`.** Reads `#superseries` and `#subseries` (Calibre series-type columns: value, and the link's `extra` as the index) and `#pages`, by lookup name, each with a flag (`--superseries-column`, `--subseries-column`, `--pages-column`); a missing one prints one line and stays blank. Reads Calibre's `books.id`. Six new columns at the end of `calibre_books.csv`: `calibre_id`, `pages`, `superseries`, `superseries_index`, `subseries`, `subseries_index`.
3. **Matching by id.** calibre.py matches a seed book on its `calibre_id` first. The changes report pairs renames by id (`renamed Old -> New`, certain). A rename of a workbook book also appends a `book_review.csv` row, reason `calibre rename`, `decision` `merge`, `keep` Calibre's spelling, so extract folds the workbook's spelling into the new title; a renamed Calibre-only book just takes the new title. A first run over a sidecar without the new columns doesn't report every book as changed.
4. **Universes (extract).** `#superseries` sets `universe_id` and `universe_position`. Calibre's superseries names are registered before the follows pass, so a Series-tab group naming one is a follow. Workbook tabs and universe groups only write `universe_follows`. With a Calibre sidecar given: a workbook membership Calibre doesn't share (one row per book) and a followed universe with no Calibre book go to `unresolved.csv`. A universe with no book that isn't followed is dropped.
5. **Subseries (extract).** A subseries attaches to the book's series. One name under two series is one `unresolved.csv` row (the first series keeps it; the other books keep their series, no subseries). A subseries on a book with no series is reported.
6. **Pages and ids (extract).** `#pages` replaces the details sidecar's page count whatever its `source`; the details still fill a book Calibre gives none; not reported. Each book takes its `calibre_id`; two Calibre books on one Ledger book is reported.
7. **`calibre_missing.csv`** (extract, `--calibre-missing`, written only when Calibre data is given): one row per workbook book with no Calibre id — `title, author, tabs, decision` (`keep` or blank). Existing rows keep their place, new ones append, a row whose book has an id now or left the workbook goes. Books awaiting a `calibre` pair in `book_review.csv` are left out. The run prints how many are undecided.
8. **Loaders and docs.** `etl/load.ps1`, `etl/load.sh`: truncate `book_subseries`, copy it before `books`, `books` with the new columns. `etl/rebuild.ps1`, `etl/rebuild.sh` count it. `package.json` `extract` (and `rebuild.sh`) pass `--calibre-missing`. `.claude/rules/schema.md`, `docs/COMMANDS.md`.
9. **Real runs.** `npm run calibre -- --dry-run`, then `npm run calibre -- --offline`; extract on `main` and on the branch into temp folders; CSV diff summarised in the PR; `npm run rebuild` on development (approved).

**Files** (19 with `etl/test_views.sql`; `never-split`, attended): `src/db/schema.ts`, `drizzle/0016_*` + meta, `src/db/export-tables.ts`, `etl/calibre.py`, `etl/extract.py`, `etl/test_calibre.py`, `etl/test_extract.py`, `test/schema-additions.test.ts`, `test/load-scripts.test.ts`, `etl/data/calibre_books.csv`, `etl/data/calibre_missing.csv` (new), `etl/data/book_review.csv`, `etl/load.ps1`, `etl/load.sh`, `etl/rebuild.ps1` and `etl/rebuild.sh` (not in Files likely touched: they count each table against the seed), `package.json`, `.claude/rules/schema.md`, `docs/COMMANDS.md`. Also `etl/test_views.sql` (found in verify R1: it pins the catalog tables' columns, so the four new `books` columns join its list).

**Test strategy**

- AC-1: `etl/test_calibre.py`, one test per Check bullet; the fixture gains series-type custom columns; renames of a workbook book and of a Calibre-only book.
- AC-2: `etl/test_calibre.py`: each flag at another lookup name and `custom_column_N`; a library with none of the three.
- AC-3: `etl/test_calibre.py`: tab and group follows, followed universe with no Calibre book, subseries under two series.
- AC-4: `test/schema-additions.test.ts` (columns, types, `calibre_id` 23505 on the TEST database), `test/export-tables.test.ts`, `test/load-scripts.test.ts`.
- AC-5: manual diff, summary in the PR.
- Changed on purpose (D-90): `test_extract.py`'s 1.15 tests asserting a tab or group sets `universe_id` assert the follow and the kept universe row instead; `test_calibre.py`'s header test asserts the new header.

**Risks**: Calibre's superseries names may not match the workbook's spelling; that shows as `unresolved.csv` rows, which is the report working.

## Review log

_Filled by /implement-task. One line per round._

- Verify R1 FAIL(1: `etl/test_views.sql`'s catalog column list lacked the new `books` columns) → R2 PASS → R3 PASS (after the review fixes, 01790f4)
- Audit R1 CHANGES (the Calibre tests errored on base in the shared helper, so none reached an assertion) → R2 PASS (a503c2a)
- Spec R1 APPROVE → R2 APPROVE (01790f4)
- Schema R1 CHANGES (MAJOR: a second Calibre book on one book overwrote the first, leaving a possible dangling subseries; 3 MINOR) → R2 APPROVE (01790f4)
- Real library: dry run 4,486 records (1,165 matched, 3,227 unmatched; 393 books in 23 universes, 92 in 24 subseries, 4,385 page counts); 181 `calibre_missing.csv` rows; a second run byte-identical; `npm run rebuild` on development, every table's count matching its seed

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 3 (R1 FAIL, R2 and R3 PASS)
- Review rounds: 2 spec, 2 schema, 2 test audit
- First-pass AC FAILs: 0 (audit R1 found AC-1–3 unproven, not failing)
- Plan revisions after approval: 0 (`etl/test_views.sql` joined the Files list, found in verify R1)
