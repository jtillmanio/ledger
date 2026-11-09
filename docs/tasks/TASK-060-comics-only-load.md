---
id: TASK-060
title: 1.29 Refresh production's comics from Comics.xlsx, books untouched
status: Ready
depends_on: []
size: M
model: opus
autonomy: attended
ui: false
plan_status: none
planned_at_commit:
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

- [ ] AC-1 (roadmap **Check:**, verbatim): on the
test database, loaded from fixtures, with a book read, a plan row, a follow and
a shelf written: the comics-only load replaces a changed run, issue, placement
and read mark, and every books table has the same rows before and after; it
runs with `LEDGER_LIVE=true`, and with `LEDGER_COMICS_LIVE=true` it refuses,
naming the flag, and changes nothing; the comics-only extract writes no books
seed file; `npm run test:etl` passes.
- [ ] AC-2: "Every books table has the same rows" is checked table by table, for every table the plan lists as books-side (at least `books`, `book_status`, `read_events`' book rows, `reading_plan`, the four follow tables, `shelves`, `shelf_books`, `book_genres`), by comparing every row's content before and after, not only the counts.
- [ ] AC-3: Both twins behave the same: with `LEDGER_COMICS_LIVE=true` each exits non-zero with a message naming `LEDGER_COMICS_LIVE` before it connects or writes; with only `LEDGER_LIVE=true` each runs.
- [ ] AC-4: A comics-only load that fails part way (a fixture seed row that breaks a constraint) leaves every comics table as it was before the run.
- [ ] AC-5: The comics-only extract runs without `--books`, and after it the `--out` folder holds no books seed file that it created or changed (each books seed file's bytes and timestamp unchanged, or absent).
- [ ] AC-6: `.claude/kit.json`'s `destructiveGuard` asks before the new command and denies it when aimed at `.env.live`, and CLAUDE.md, `docs/COMMANDS.md` and START-HERE Step 14 name the command.

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
