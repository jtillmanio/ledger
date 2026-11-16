---
id: TASK-078
title: 3.5 Detail sheets (1 of 3) — a book's summary and subjects, an issue's story arc
status: Done
depends_on: [TASK-081, TASK-082]
size: M
model: opus
autonomy: attended
ui: false
plan_status: approved
planned_at_commit: 87f1423
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
- *From TASK-084 (4.2, PR #255):* 4.2 did not add `books.isbn`. The backfill takes ISBNs from its caller (4.4's sync, from Calibre; owner, 2026-11-13), so the column is still unasked-for if this task or 4.4 wants it.

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
- [x] AC-2: After the migration, `books.summary`, `books.subjects` and `issues.story_arc` exist with the types approved at the plan gate, each nullable; `npm run test:db:reset` builds the schema; no column is added without that approval.
- [x] AC-3: `npm run test:etl`, with a recorded Metron detail page that names a story arc, writes the arc to `issue_details.csv` without a request, keeps a `hand` arc on a rerun, and extract carries it into the seed `issues` rows that `load.ps1`, `load.sh` and `load-comics.ps1` / `.sh` load.
- [x] AC-4: With the fixture Calibre library 4.4's tests use, a book with comments and two tags syncs its summary and subjects into `books`; a book Calibre gives neither keeps both NULL; a second sync changes nothing.
- [x] AC-5: If the owner approves `issues.store_date` at the plan gate, a recorded Metron `store_date` fills it with `store_date_source = 'metron'` through `cover_dates.csv`, and the CHECK refuses a date without a source; if not, no such column exists and the PR's Follow-ups say so.

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

- `docs/04-design.md` § 13 *What this changes* says Open Library returns the summary and subjects; Calibre's comments and tags do since D-94 → docs/04-design.md § What this changes (approved at plan)
- `.claude/rules/schema.md`: the sidecar list gains the story arc and the store date → .claude/rules/schema.md § Issue metadata and whys come from sidecar files (approved at plan)
- `.claude/rules/schema.md`: "tags, comments … load nothing until approved" becomes "the sync stores them" → .claude/rules/schema.md § Calibre is the source of truth for a book's data and its reads (approved at plan)
- `docs/03-data-model.md` § 4.1: the 3.5 row becomes *Built (migration 0030)* with the approved types → docs/03-data-model.md § 4.1 By task (approved at plan)
- Schema review R1: a hand store date typed without its day (`1987-03`) loaded as a guessed 1st; it is now reported and loads nothing (extract, `check_sidecars.py`) → not tracked: done in this PR (plan revision, owner 2026-11-16)
- Schema review R1: extract's report of sidecar rows for labels gone from the sheet ignored the store date (a row with only a hand store date was missed or not marked hand-entered) → not tracked: done in this PR (plan revision, owner 2026-11-16)
- Schema review R1: a Metron store date under a pre-rename label is passed over for the new label's row until `enrich_comics.py` rekeys → not tracked: transient and the same as every other sidecar; the next enrich run rekeys it
- Test audit R1: `load.ps1` and `load.sh` are checked by their `\copy issues(...)` column list, not by a run; `load-comics.ps1` runs for real in `test/comics-load.test.ts` → not tracked: accepted as is; the four lists are pinned to extract's column order by one test
- Data model § 2.19 says tags and comments "load nothing until their columns are approved" → not tracked: the clause is conditional, and § 4.1's 3.5 row now records the approval

## Plan

**Decisions at the plan gate (owner, 2026-11-16).** `books.summary text` is
Calibre's comments as plain text (HTML turned into paragraphs, `\n\n` between
them), `books.subjects text[]` is Calibre's tags (cleaned, once whatever the
case, sorted); neither has a source column (Calibre is the only writer). Both
ride the sync only: extract still loads books (1.26 not done), and a full
`load`/`rebuild` leaves them NULL until the next `calibre:sync`.
`issues.story_arc text` (Metron's arc names joined `; `, like `story_title`)
with `story_arc_source` (`metron | hand`, the CHECK pair). `issues.store_date
date` with `store_date_source` (`metron | hand`, the CHECK pair) is approved,
filled from Metron's issue-list `store_date` into `cover_dates.csv`. One PR,
not split (13 code files, the four loader edits a column list each).

**Steps**
1. Schema: `src/db/schema.ts` gains the five columns and two CHECKs; `npm run
   db:generate` writes `drizzle/0030_*.sql` and its meta. Adds only, so no down file.
2. Store date: `enrich_comics.py`'s date pass writes `store_date` and
   `store_date_source` into `cover_dates.csv` from the issue-list entry; a `hand`
   store date survives, independently of the cover date's source.
3. Story arc: `enrich_comics.py --details` writes `story_arc` and
   `story_arc_source` into `issue_details.csv`; a `hand` arc survives a rerun and
   a rename (rekey). `check_sidecars.py` makes an unsourced arc or store date
   `hand`, as it does a story title.
4. `extract.py` carries both into `seed/issues.csv`; `load.ps1`, `load.sh`,
   `load-comics.ps1` and `load-comics.sh` name the four columns in `\copy issues(...)`.
5. Books: `calibre.py`'s `records()` reads `comments` (a library without the
   table reads none) as plain text in `summary`, never written to
   `calibre_books.csv`; `calibre_sync.py` sends it. `calibre-sync.ts` accepts
   `summary`, stores it and the tags as `subjects` on created books (`BookRow`
   in `writes.ts` gains both) and on matched books when the record carries the
   field; empty is NULL; an unchanged value changes nothing. The log names the
   field without copying the summary's text.
6. Manual: `py etl/enrich_comics.py --offline` and `--details --offline` over the
   warm cache (no requests), commit the refreshed `cover_dates.csv` and
   `issue_details.csv`, report the arc and store-date counts, run `npm run extract:comics`.

**Files**: `src/db/schema.ts`, `drizzle/0030_*.sql`, `drizzle/meta/*`,
`etl/enrich_comics.py`, `etl/check_sidecars.py` (not listed), `etl/extract.py`,
the four loaders, `etl/calibre.py` (not listed), `etl/calibre_sync.py`,
`src/db/calibre-sync.ts`, `src/db/writes.ts` (not listed: `BookRow`),
`etl/data/cover_dates.csv` and `etl/data/issue_details.csv` (not listed: the
manual refresh); the three follow-up docs at close-out.

**Test strategy**
- AC-2, AC-5 (CHECK): `test/schema-additions.test.ts` — the columns and types;
  an unsourced arc or store date, and a source with no value, are refused.
- AC-3: `etl/test_enrich_comics.py` (a recorded detail page with two arcs →
  `issue_details.csv`, no network; a `hand` arc kept on rerun and rekey);
  `etl/test_extract.py` (arc and store date in `seed/issues.csv`);
  `test/comics-load.test.ts` (both loaders' column lists); `etl/test_check_sidecars.py`.
- AC-4: `test/calibre-sync-command.test.ts` (the fixture library gains a
  `comments` table: comments and two tags fill both; neither leaves both NULL;
  a second run changes nothing); `test/calibre-sync.test.ts` (cleared, kept,
  not logged as text); `etl/test_calibre.py` (HTML to text; not in the CSV).
- AC-5 (fill): `etl/test_enrich_comics.py` (a recorded issue list's `store_date`
  → `cover_dates.csv` with `metron`; a hand one kept).

**Risks**: `load:comics` against production after merge and before Release
fails in its transaction (no column yet): Release first, said in the PR.

**Plan revision 1 (owner, 2026-11-16, after schema review R1).** A hand
store date must be a full day: `1987` or `1987-03` is reported (extract's
`store date is not a full day`, and the same problem from `check_sidecars.py`)
and loads nothing. Extract's report of sidecar rows for labels gone from the
sheet reads the store dates too, and a hand one marks the row hand-entered.
Files: `etl/extract.py`, `etl/check_sidecars.py` and their tests.

## Review log

_Filled by /implement-task. One line per round._

- Verify R1 PASS (tsc, lint, test:no-e2e: 109 vitest files, test_views.sql, 410 ETL tests; the first vitest launch ran from `c:\` and found no runner, so it was rerun from `C:\`; no browser spec touched)
- Spec R1 APPROVE (advisory: name the schema.md section in the follow-up, done) | Schema R1 APPROVE (3 minor: 2 fixed by plan revision 1, 1 not tracked) | Audit R1 PASS (AC-2–AC-5 proven, restoration OK) | CI R1 PASS (5e3c705, every project) | UI n/a (no UI)
- Plan revision 1 → Verify R2 PASS (109 vitest files, test_views.sql, 411 ETL tests) | Spec R2 APPROVE (and the close-out follow-ups check APPROVE) | Schema R2 APPROVE | Audit not re-run (the revision's tests fail on 5e3c705, as spec R2 checked) | CI R2 on the close-out head

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 2
- Review rounds: 2
- First-pass AC FAILs: 0
- Plan revisions after approval: 1
