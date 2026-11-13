---
id: TASK-078
title: 3.5 Detail sheets (1 of 3) — a book's summary and subjects, an issue's story arc
status: Ready
depends_on: [TASK-081, TASK-082]
size: M
model: opus
autonomy: attended
ui: false
plan_status: none
planned_at_commit:
---

# TASK-078 — 3.5 Detail sheets (1 of 3) — a book's summary and subjects, an issue's story arc

## Goal

The facts the detail sheets show and the app throws away today are kept: a book's summary and subjects from Calibre, and an issue's story arc from Metron.

## Context

- Roadmap: `docs/05-roadmap.md` § 3.5 Detail sheets — books and issues (M14; order 3.4 → 3.4b → 3.5; no dependency in the tasklist). The entry and its **Check:** are the contract. Feature F-29. Built after the books cutover, before the comics (D-129, D-139).
- **Split, 1 of 3** (`workflow.splitPolicy: split`: schema, ETL and two sheets). This part: the columns and how they fill. TASK-079 is the book sheet; TASK-080 the issue sheet, whose merge ticks the entry.
- **The columns, and a stop-and-ask** (CLAUDE.md). The entry adds `books.summary`, `books.subjects` and `issues.story_arc` (design § 13 → *What this changes*; data model § 4.1). Neither 1.18 nor 1.18b added the books pair, so this task does, unless 4.4 (TASK-081) has added a column for Calibre's tags by then, which this task then reads. **Stop and ask at plan time** for each column's type (`subjects` as text, a `text[]`, or rows), and whether a value travels with a provenance pair like `cover_date` / `cover_date_source`.
- **`issues.store_date`, the on-sale date, is a separate stop-and-ask** (the entry: *Stop and ask the owner before adding it*): `issues.store_date` plus `store_date_source` (`metron | hand`, the same CHECK pair as `cover_date`), filled from Metron's `store_date` by `enrich_comics.py` into `cover_dates.csv`. Until it is approved, the issue sheet renders only *Cover date* (TASK-080).
- **Where each value comes from.**
  - *Story arc*: Metron's issue detail, already cached by `enrich_comics.py --details` (`etl/.metron-cache.sqlite`), so it costs no requests. It goes through `etl/data/issue_details.csv` (the label's sidecar, beside story title and cover URL; `.claude/rules/schema.md` → sidecars), never overwriting a `hand` value, then extract and the comics loaders (`etl/load.ps1` / `load.sh` and 1.29's `etl/load-comics.ps1` / `.sh`, which keep production's comics in step until 1.28).
  - *Summary and subjects*: Calibre's comments and tags (`.claude/rules/schema.md`: *tags, comments and ISBN load nothing until `books.subjects`, `books.summary` and `books.isbn` are approved, and comments stay out of the CSV*). This task is built **after** 1.26, when extract no longer loads books and the only way Calibre's data comes in is 4.4's sync (D-133). So the books pair rides `npm run calibre:sync` (TASK-082) and its route (TASK-081). **Stop and ask at plan time** if that turns out not to be the path, for example if extract still loads books when this is built.
- Data model: `docs/03-data-model.md` § 2. Decisions, 2.19; § 4.1 By task (3.5's rows). Architecture: `docs/02-architecture.md` § 10. Metadata sources.
- Decisions: D-87, D-90, D-94, D-128, D-129, D-133. Hard rules 2 and 7.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves none of its clauses itself: it stores the values TASK-079 and TASK-080 render, and TASK-080's merge ticks the entry): test that the back button dismisses the sheet and restores list
scroll position; that a direct visit to `/books/{id}` renders the full page;
that a book with no summary renders without a layout shift; and that the sheet
and the master list's inline editor write status through the same code path.
Test that an issue placed in three runs, read in one, lists three runs with one
read, and that marking a second from the sheet writes exactly one
`issue_progress` row. Opening *Why blocked?* from inside an issue sheet leaves
exactly one sheet in the DOM, and Back returns to the issue sheet. An issue
with a `cover_date` renders *Cover date* in `Mon YYYY`. An undated issue
renders no *Dates* group and no `—`.
- [ ] AC-2: After the migration, `books.summary`, `books.subjects` and `issues.story_arc` exist with the types approved at the plan gate, each nullable; `npm run test:db:reset` builds the schema; no column is added without that approval.
- [ ] AC-3: `npm run test:etl`, with a recorded Metron detail page that names a story arc, writes the arc to `issue_details.csv` without a request, keeps a `hand` arc on a rerun, and extract carries it into the seed `issues` rows that `load.ps1`, `load.sh` and `load-comics.ps1` / `.sh` load.
- [ ] AC-4: With the fixture Calibre library 4.4's tests use, a book with comments and two tags syncs its summary and subjects into `books`; a book Calibre gives neither keeps both NULL; a second sync changes nothing.
- [ ] AC-5: If the owner approves `issues.store_date` at the plan gate, a recorded Metron `store_date` fills it with `store_date_source = 'metron'` through `cover_dates.csv`, and the CHECK refuses a date without a source; if not, no such column exists and the PR's Follow-ups say so.

## Out of scope

- Rendering any of it (TASK-079, TASK-080).
- `issues.summary` (4.1, Metron's summary).
- `books.isbn` (asked by 4.2 or 4.4, whichever comes first).
- Backfilling live data by hand: the values arrive through extract (comics) and the sync (books).

## Files likely touched

- `src/db/schema.ts`, `drizzle/<new migration>.sql`, `drizzle/meta/*` — the columns.
- `etl/enrich_comics.py`, `etl/extract.py`, `etl/load.ps1`, `etl/load.sh`, `etl/load-comics.ps1`, `etl/load-comics.sh` — the story arc (and the store date, if approved).
- `etl/test_enrich_comics.py`, `etl/test_extract.py` — AC-3, AC-5.
- The sync's route and command (TASK-081, TASK-082) — the summary and subjects.
- `test/schema-additions.test.ts` — AC-2.

## Verification

- Automated: `test/schema-additions.test.ts`, `npm run test:etl`, the sync's test with the fixture library (AC-4), `npm run check:migrations`.
- Manual: an `enrich_comics.py --details` run over the warm Metron cache, making no requests (the plan names the flag) → the PR reports how many issues gained a story arc, and `npm run extract:comics` carries them into `seed/`.

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
