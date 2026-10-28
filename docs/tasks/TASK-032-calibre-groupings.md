---
id: TASK-032
title: 1.18b Calibre: universes, subseries, page counts and the Calibre id
status: Ready
depends_on: [TASK-030]
size: L
model: opus
autonomy: attended
ui: false
plan_status: none
planned_at_commit:
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

- [ ] AC-1 (roadmap **Check:**, verbatim): `npm run test:etl`, with 1.18's fixture `metadata.db` given `#superseries`, `#subseries` and `#pages` columns, shows:
  - a book with a superseries loads that universe and its position, and a workbook universe membership Calibre doesn't share is in `unresolved.csv`;
  - a book with a subseries loads it under its series, with its position;
  - `#pages` replaces an Open Library page count, and Open Library still fills a book with no `#pages`;
  - every Calibre book loads its `calibre_id`, and a fixture book renamed between two runs is still one book, with the new title;
  - a workbook book Calibre doesn't have is one `calibre_missing.csv` row and still one `books.csv` row; `keep` survives a re-run; adding the book to the fixture library removes its row;
  - a second run over the same fixture leaves every sidecar byte-identical.

  `npm run test:db:reset` applies the migration. Then a dry run over the real library, with the superseries, subseries and page counts filled and the `calibre_missing.csv` count in the PR.
- [ ] AC-2: Given a fixture whose superseries column has the lookup name `#universe` at a different `custom_column_N`, `--superseries-column '#universe'` loads the same universes and positions as `#superseries` did; likewise `--subseries-column` and `--pages-column`. A library with none of the three columns runs, fills none of them, and reports each missing column once.
- [ ] AC-3: A workbook universe tab or Series-tab universe group still writes its `universe_follows` row, and a followed universe Calibre gives no book is one `unresolved.csv` row. One subseries name under two different series is one `unresolved.csv` row, and the book keeps its series.
- [ ] AC-4: The migration adds exactly the five approved columns and one table; `book_subseries` is in `src/db/export-tables.ts` (`test/export-tables.test.ts` passes); `etl/load.ps1` and `etl/load.sh` both copy `book_subseries` before `books` and truncate it, and `test/load-scripts.test.ts` covers both. Two books given the same `calibre_id` fail the unique constraint on the TEST database.
- [ ] AC-5: Re-running extract against both workbooks on `main` and on the branch, the `seed/` CSV diff shows only: the new `books` columns filled, `book_subseries.csv`, universe memberships Calibre changed, Calibre page counts over Open Library's, and the universes no book belongs to any longer, dropped unless followed (standing rule 4; summary in the PR). `calibre_missing.csv`, its columns and its `keep` rule are in `.claude/rules/schema.md`.

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
