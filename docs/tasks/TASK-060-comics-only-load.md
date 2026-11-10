---
id: TASK-060
title: 1.29 Refresh production's comics from Comics.xlsx, books untouched
status: Review
depends_on: []
size: M
model: opus
autonomy: attended
ui: false
plan_status: approved
planned_at_commit: b9b7397
---

# TASK-060 — 1.29 Refresh production's comics from Comics.xlsx, books untouched

## Goal

After the books cutover, the owner can refresh production's comics catalog and comics progress from a fresh `Comics.xlsx`, and no books row changes.

## Context

- Roadmap: `docs/05-roadmap.md` § 1.29 Refresh production's comics from `Comics.xlsx`, books untouched (M9; owner, 2026-11-08, D-128). The entry and its **Check:** are the contract; the Check is marked *proposed; the owner agrees it by merging or edits it first*. **Before 1.26** (in its **Depends on**: the comics must still be refreshable after the switch). Feature F-02.
- **Why.** From the books cutover on, `LEDGER_LIVE=true` makes `rebuild` and the full `load` refuse (`etl/load.ps1` around line 46: *LEDGER_LIVE is true in …*), and both would truncate every progress table, the books' included (`TRUNCATE issue_progress, edition_progress, book_status, reading_plan, read_events, …`, around line 89). `Comics.xlsx` stays the record for comics until 1.28, so production's comics need a load of their own.
- **Extract, comics only.** A flag on `npm run extract` (its name is the plan's) reads `Comics.xlsx` and the comics sidecars and writes only the comics seed files; the books seed is neither read nor written. Today `etl/extract.py`'s parser requires `--books` (around line 2423).
- **A comics-only load** (its own script with `.ps1` and `.sh` twins, or a switch on `load`: the plan's) truncates and reloads the comics catalog and comics progress in one transaction: runs, tracks, blocks, prerequisites, events, issues, placements, credits, `issue_progress`, `edition_progress`, the queue, the volume map and eras. It never truncates, cascades into or writes a books table. **The plan lists every table that references a run, an issue or a placement** (the inbox's links, comic `read_events` rows) and what happens to each; `TRUNCATE … CASCADE` is what `load` uses today and is exactly what must not reach a books table.
- **It runs while `LEDGER_LIVE` is true,** and refuses once a second flag (proposed: `LEDGER_COMICS_LIVE`) is true in the env file, naming it and changing nothing; 1.28 sets it. It asks before running, as `rebuild` does, and only the owner runs it against `.env.live` (CLAUDE.md). Claude never runs it there.
- Marks made in the app's comics screens between 1.26 and 1.28 are replaced by the next comics load, as before cutover: the sheet is the comics record until 1.28 (D-128).
- **The same PR teaches the new command to** `.claude/kit.json`'s `destructiveGuard` (an *ask* pattern for the command, and the `.env.live` *deny* pattern matching it), CLAUDE.md's *Production is disposable until cutover*, `docs/COMMANDS.md` and START-HERE Step 14 (its *Until Step 14b: comics from the sheet* says the commands arrive with 1.29). `docs/SERVICES.md` lists keys, not flags: the plan says whether `LEDGER_COMICS_LIVE` belongs there.
- Tests touch `TEST_DATABASE_URL` only (Hard rule 5); `test/load-scripts.test.ts` already checks both twins of `load` with `describe.each`.
- Architecture: `docs/02-architecture.md` § 9. Environments. Data model: `docs/03-data-model.md` § 2. Decisions, 2.14 (read state belongs to the placement) and 2.11.
- Decisions: D-128, D-18, D-95, D-129.

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim): on the
test database, loaded from fixtures, with a book read, a plan row, a follow and
a shelf written: the comics-only load replaces a changed run, issue, placement
and read mark, and every books table has the same rows before and after; it
runs with `LEDGER_LIVE=true`, and with `LEDGER_COMICS_LIVE=true` it refuses,
naming the flag, and changes nothing; the comics-only extract writes no books
seed file; `npm run test:etl` passes.
- [x] AC-2: "Every books table has the same rows" is checked table by table, for every table the plan lists as books-side (at least `books`, `book_status`, `read_events`' book rows, `reading_plan`, the four follow tables, `shelves`, `shelf_books`, `book_genres`), by comparing every row's content before and after, not only the counts.
- [x] AC-3: Both twins behave the same: with `LEDGER_COMICS_LIVE=true` each exits non-zero with a message naming `LEDGER_COMICS_LIVE` before it connects or writes; with only `LEDGER_LIVE=true` each runs.
- [x] AC-4: A comics-only load that fails part way (a fixture seed row that breaks a constraint) leaves every comics table as it was before the run.
- [x] AC-5: The comics-only extract runs without `--books`, and after it the `--out` folder holds no books seed file that it created or changed (each books seed file's bytes and timestamp unchanged, or absent).
- [x] AC-6: `.claude/kit.json`'s `destructiveGuard` asks before the new command and denies it when aimed at `.env.live`, and CLAUDE.md, `docs/COMMANDS.md` and START-HERE Step 14 name the command.

## Out of scope

- 1.28, the comics cutover, and setting `LEDGER_COMICS_LIVE`.
- Running anything against `.env.live` (the owner's).
- Carrying marks made in the app's comics screens across a comics load (D-128: the sheet is the record).
- Any change to `rebuild` or the full `load`'s behaviour.

## Files likely touched

- `etl/extract.py` — the comics-only flag.
- `etl/load-comics.ps1`, `etl/load-comics.sh` (new), or a switch in `etl/load.ps1` and `etl/load.sh` — the plan's.
- `package.json` — the command, if it gets one.
- `.claude/kit.json` — `destructiveGuard`.
- `CLAUDE.md`, `docs/COMMANDS.md`, `docs/START-HERE.md` — the command and its guard.
- `etl/test_extract.py`, `test/load-scripts.test.ts`, `test/comics-load.test.ts` (new) — AC-1 to AC-5.

## Verification

- Automated: `test/comics-load.test.ts` (AC-1's load clauses, AC-2, AC-3, AC-4 on `TEST_DATABASE_URL`); `test/load-scripts.test.ts` (both twins' guards and their table lists); `etl/test_extract.py` (AC-5); `npm run test:etl`.
- Manual (owner, before 1.26, START-HERE Step 14 *Before the switch*): run the comics-only extract and load against development → expected: a comics change from the sheet arrives, and the Library and the plan are unchanged.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- The production row names the comics-only load and `LEDGER_COMICS_LIVE` beside `LEDGER_LIVE` (approved at plan) → docs/02-architecture.md § 9. Environments
- A seed folder whose path holds a single quote breaks the `\copy` lines of `load-comics.ps1` (schema-reviewer, minor) → not tracked: the same as `load.ps1`, and it fails safe (the transaction rolls back)
- The load holds ACCESS EXCLUSIVE locks on the comics tables for its ~3 s transaction, blocking comics reads meanwhile (schema-reviewer, minor) → not tracked: single user, a load the owner starts by hand
- `load-comics.sh`'s runtime tests skip on Windows (a bare `bash` may be WSL) → not tracked: CI's Linux runner runs them, and `test/load-scripts.test.ts` holds the twins to identical statements

## Plan

Approved 2026-11-10 (owner: "approve with all recommendations": the queue empties on each comics load as the roadmap lists; the task stays whole).

**Why not `TRUNCATE … CASCADE`.** Two mixed tables point at comics tables:
`inbox.run_id` (ON DELETE SET NULL) and `read_events.placement_id` (ON DELETE
CASCADE). A `TRUNCATE runs, run_issues` fails without `CASCADE` and, with it,
empties `inbox` and `read_events` entirely, book rows included.

**Steps**
1. Extract: `--comics-only` on `etl/extract.py`. `--books` is required only without it; `--books` or any books flag with it is an error. It clears only `COMICS_SEED` (the 16 names `extract_comics` writes), runs `extract_comics` only, and writes its flags to `comics_unresolved.csv` (`unresolved.csv` and `calibre_changes.csv` untouched); `--fail-on-cycle` still applies. npm `extract:comics`: the comics sidecars only.
2. Load: new twins `etl/load-comics.ps1` / `etl/load-comics.sh` (`load`, `rebuild` unchanged). Env file read; refuses on `LEDGER_COMICS_LIVE` true before the required-vars check, the prompt and psql; ignores `LEDGER_LIVE`; checks the 15 comics seed files exist; asks `Type COMICS to continue` (`-Yes` / `--yes` skip). One transaction, no `CASCADE`: save inbox `(id, run_id)` links to a temp table; `DELETE FROM read_events WHERE placement_id IS NOT NULL`; `TRUNCATE issue_progress, edition_progress, run_queue, run_tracks, event_runs, prereqs, issue_credits, creators, events, editions, volume_rules RESTART IDENTITY` (without `CASCADE` Postgres refuses if anything else references them); `DELETE` run_issues, eras, issues, runs, blocks, tracks; `\copy` the comics seed, `$OWNER` bound in the two progress CSVs; restore inbox links whose run still exists; reset the `run_issues` and `eras` sequences. No `views.sql`. npm `load:comics`, `load:comics:bash`.
3. Every table referencing a run, issue or placement, and what happens: replaced — tracks, blocks, runs, run_tracks, eras (empty: nothing extracts them), issues, run_issues, creators, issue_credits, prereqs, events, event_runs, editions, volume_rules, issue_progress, edition_progress; emptied — run_queue (no seed); mixed — `read_events` comic rows deleted (none written yet), book rows untouched; `inbox` book and open notes untouched, comics notes keep their run link (lose only the link if the run is gone).
4. `.claude/kit.json` `destructiveGuard`: the *ask* pattern gains `npm run load:comics` and `load-comics.(ps1|sh)`; the `.env.live` *deny* pattern gains `load-comics`.
5. Docs: CLAUDE.md (Commands, *Production is disposable*); `docs/COMMANDS.md` (commands + a comics-only section); START-HERE *Until Step 14b* gets the commands, 14b step 2 loses "wherever else"; `docs/SERVICES.md` gets a `LEDGER_COMICS_LIVE` row (an env-file flag like `LEDGER_LIVE`; `.env.live` only, no GitHub variable).

**Files** (12): `etl/extract.py`, `etl/load-comics.ps1` (new), `etl/load-comics.sh` (new), `package.json`, `.claude/kit.json`, `CLAUDE.md`, `docs/COMMANDS.md`, `docs/START-HERE.md`, `docs/SERVICES.md` (not in likely touched: it lists `LEDGER_LIVE`), `etl/test_extract.py`, `test/load-scripts.test.ts`, `test/comics-load.test.ts` (new). Over 8, kept whole: 5 are doc/config lines the roadmap requires in this PR; no schema, no UI.

**Test strategy**
- `test/comics-load.test.ts` runs both real twins on `TEST_DATABASE_URL` through a temp env file, spawned with `DATABASE_URL` and `LEDGER_*` stripped (ps1 via pwsh/powershell; sh skipped on win32, CI's Linux runner covers it). AC-1/AC-2: load fixture seed v1, write the books-side rows (book read + reread, plan, every follow table, shelf + book + follow, genres, release, external list, inbox notes, settings), load v2 (changed run title, issue story title, placement type, read mark) with `LEDGER_LIVE=true` → new values, every books table equal row for row (`to_jsonb`, sorted). AC-3: `LEDGER_COMICS_LIVE=true` → non-zero, names the flag, nothing changed; also with an unreachable `DATABASE_URL` (refuses before connecting). AC-4: v3 seed whose last progress row breaks a foreign key → every comics and books table unchanged. No `-Yes` and nothing typed → refuses, nothing changed. Catalog: every foreign key into a comics table is from the script's tables or `read_events`/`inbox`.
- `test/load-scripts.test.ts`: twins have no `CASCADE`, name the same tables in the same order, guard before psql; AC-6: kit.json's ask and deny regexes match the new commands; CLAUDE.md, COMMANDS.md, START-HERE name the command.
- `etl/test_extract.py` (AC-5): runs without `--books`; planted books seed files keep bytes and mtime, none created when absent; `--books` with `--comics-only` errors; `extract_comics` writes exactly `COMICS_SEED`.

**Risks**: the queue empties every comics load (roadmap); psql must be on PATH (it is locally and in CI).

## Review log

_Filled by /implement-task. One line per round._

- Verify R1 round FAIL(1: `books-dashboard.test.ts` 5 s timeout, outside this task; 42/42 alone) → full PASS (vitest 1518, Python 381, test_views, e2e 1008) | Audit R1 PASS (nit: a dropped space in package.json, fixed in a90a94f) | Spec R1 CHANGES (Follow-ups bullet format only; rewritten at close-out) | Schema R1 APPROVE (3 minors, not tracked) | Close-out check R1 APPROVE

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 1 (round chain, then the full chain once)
- Review rounds: 1 (spec, schema), plus the close-out check
- First-pass AC FAILs: 0
- Plan revisions after approval: 0
