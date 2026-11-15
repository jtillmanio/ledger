---
id: TASK-082
title: 4.4 Sync with Calibre (2 of 3) — npm run calibre:sync, both ways, by hand or weekly
status: In progress
depends_on: [TASK-081]
size: M
model: opus
autonomy: attended
ui: false
plan_status: approved
planned_at_commit: 7957946
---

# TASK-082 — 4.4 Sync with Calibre (2 of 3) — npm run calibre:sync, both ways, by hand or weekly

## Goal

One command on the owner's PC, run from a desktop shortcut or once a week, sends Calibre's changes to the Ledger and writes the Ledger's reads, status and owned formats back into Calibre.

## Context

- Roadmap: `docs/05-roadmap.md` § 4.4 Sync with Calibre, both ways: one command, by hand or weekly (M16). Its *Rewritten 2026-11-08 (D-133)* half and its **Check:** are the contract (agreed by the owner 2026-11-13). Pulled ahead of 1.26.
- **Split, 2 of 3.** TASK-081 built the route, the matching, the writes and the log. This part is the command and the write-back; TASK-083 the page and the dashboard line.
- **One command, both ways.** `npm run calibre:sync` reads a temp copy of `metadata.db`, reusing `etl/calibre.py`'s reading (custom columns by lookup name; `--date-column "#read_date"` in today's `npm run calibre`), sends what changed since the last sync to TASK-081's route signed in with the passcode, takes back what the Ledger holds for each Calibre book, and writes what differs with `calibredb`. While the Calibre window is open it writes through Calibre's content server on localhost (an Owner checklist item turns it on), otherwise to the library folder. The language (Python beside `calibre.py`, or Node) is the plan's.
- **Ledger → Calibre:** `#read` (the book has a read), `#date_read` (the latest read's finish; how an `approximate` or `none` finish is written is the plan's), the status in a new `#ledger_status`, and 5.17's owned formats in a new `#owned`. Not the start date. The owner creates the two columns; a missing one is named and skipped. **Before 1.26** extract still loads Calibre's reads (D-87), and the plan says what the write-back may touch until then.
- **When.** A desktop shortcut runs it on demand; a script registers a weekly Windows Task Scheduler run, which the owner runs once. Nothing else runs in the background, and nothing is exposed to the internet (D-133).
- **Which database.** The command talks to the app's URL, never to a database directly. Which app it targets (local `npm run dev`, a preview, production) comes from a setting; a new key or setting goes in `.env.example` and `docs/SERVICES.md` (names only, the repo is public) in the same PR. Never run it against production or the owner's real library from a session (CLAUDE.md).
- **Never the owner's real library in a test.** Tests use a fixture library copied to a temp folder and the test database (`TEST_DATABASE_URL`).
- **Docs in the same PR** (the entry): rewrite `.claude/rules/schema.md`'s *Calibre is the source of truth for a book's data and its reads* (which says nothing writes to Calibre) and `docs/03-data-model.md` 2.19 to match; add the command to `docs/COMMANDS.md` (and keep `.claude/kit.json` in step if a verify command changes); an Owner checklist item (`docs/OWNER-CHECKLIST.md`) for the content server, the two columns and registering the weekly run.
- Decisions: D-18, D-83, D-87, D-90, D-130, D-132, D-133. Hard rule 5.
- *From TASK-084 (4.2, PR #255), open question for the plan:* the owner chose to have the sync call the Hardcover backfill rather than run it on a schedule (2026-11-13). After a sync, the command sends `POST /api/books/backfill { dryRun: false, isbns: { bookId: ISBN } }`, with Calibre's ISBNs, since `books` has none. It sends the request again with `after: next` while `next` is set, and waits `retryIn` seconds when `status` is `stopped`. It's up to 100 books a call, about one Hardcover request a second. The plan says whether the backfill is part of the sync's log entry.
- *From TASK-081 (4.4, PR #265), open question for the plan:* the route (`POST /api/calibre/sync`, `src/db/calibre-sync.ts`) returns `holdings` for every Calibre book the Ledger has, but builds the log's `report.out` (what goes back to Calibre) only for the `records` sent. If the command sends only what changed in Calibre since the last sync, a Ledger-side change (a read logged, a format owned) on an unchanged Calibre book is in `holdings` and written back, but missing from the log's *what went out*. The plan picks: send every record each run (the payload allows up to the route's `MAX_RECORDS`), or have the command report what it wrote and log that. A book new to the Ledger that Calibre marks read is created at Read with that one read (D-153).

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves the run end to end with the fixture library in a temp folder: everything up to *A missing `#owned` column is named and skipped*, including the values written into the fixture's `metadata.db` and the second run changing nothing on either side. TASK-083 proves the browser clauses): with a
fixture library in a temp folder and the test database: four books, one
matching a Ledger book with a changed title and word count, one the Ledger
lacks and marked read, one whose `#date_read` was changed in Calibre after the
Ledger logged a different read, and one the Ledger has read and owns on paper.
One run creates one Unlisted book with one `read_events` row; renames the
matched book and replaces its `stated` word count; overwrites the changed
`#date_read` with the Ledger's and lists it; writes `#read`, `#date_read`,
`#ledger_status` and `#owned` for the book read in the Ledger; and is one log
entry listing each change. A second run changes nothing on either side and
logs that nothing changed. A missing `#owned` column is named and skipped. In
the browser (0.11), the *Calibre* page lists the run, and the dashboard's line
shows when the last run is 8 days old and not when it is 6.
- [ ] AC-2: The command copies `metadata.db` to a temp folder before reading it and never opens the library's own file for reading; with the content server unreachable it writes with `calibredb --library-path` against the (fixture) library folder, and with it reachable through the server.
- [ ] AC-3: With `#ledger_status` missing from the fixture library, the run names it, skips that column, writes the others and exits 0; with the app unreachable or the passcode wrong it exits non-zero, writes nothing to Calibre, and says why.
- [ ] AC-4: The scheduler script registers one weekly task that runs the command and nothing else, and a second registration replaces it rather than adding another (checked with `-WhatIf` or against a fake `schtasks`, never the real scheduler in a test).
- [ ] AC-5: `.claude/rules/schema.md` and `docs/03-data-model.md` 2.19 no longer say nothing writes to Calibre; `docs/COMMANDS.md` lists `npm run calibre:sync`; every new key is in `.env.example` and `docs/SERVICES.md` by name only.

## Out of scope

- The route and the matching (TASK-081).
- The *Calibre* page and the dashboard line (TASK-083).
- An always-on agent, exposing Calibre's server, or writing `metadata.db` directly (D-133, not chosen).
- Writing the start date to Calibre.

## Files likely touched

- `etl/calibre_sync.py` (new) or `scripts/calibre-sync.mjs` (new) — the command; `etl/calibre.py` — its reading, reused.
- `package.json` — `calibre:sync`.
- `scripts/calibre-sync-schedule.ps1` (new) — the weekly task and the shortcut.
- `etl/test_calibre_sync.py` (new) or `test/calibre-sync-command.test.ts` (new), with a fixture library under `etl/fixtures/` or `test/fixtures/`.
- `.env.example`, `docs/SERVICES.md`, `docs/COMMANDS.md`, `docs/OWNER-CHECKLIST.md`.
- `.claude/rules/schema.md`, `docs/03-data-model.md` — the write-back is now real.

## Verification

- Automated: the command's test over the fixture library and `TEST_DATABASE_URL` (AC-1's run clauses, AC-2, AC-3), the scheduler script's test (AC-4), `npm run verify:docs` for the doc changes.
- Manual (the owner, after merge, per the Owner checklist): run it once by hand against the dev app with Calibre closed, then open → the run is listed on the *Calibre* page and `#read` / `#date_read` in Calibre match the Ledger.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- TASK-083's *Calibre* page labels the log's `skippedColumns` as "missing, or held until the books cutover": before 1.26 the command sends `#read` and `#date_read` as skipped while `CALIBRE_SYNC_READS` is off (approved at plan).
- From schema-reviewer: the write-back loses a finish's precision. If the owner's date-read column displays a year alone, Calibre's value reads back as July 1st `approximate` and the route (`src/db/calibre-sync.ts`, `out("#date_read", …)`) compares days, so an exact Ledger finish differs and is rewritten every run. Compare by the column's display precision, or say so on the *Calibre* page.

## Plan

Approved by the owner 2026-11-15, with these answers: (1) reads held until 1.26 behind `CALIBRE_SYNC_READS`; (2) the settings below; (3) the Check's "one Unlisted book with one `read_events` row" is tested as D-153 reads it (created at Read with that one read); (4) the merged worktrees removed, this one on `ledger_test_2`.

**Steps**

1. `etl/calibre.py`: split `read_library` so one temp copy of `metadata.db` can be read by a caller's function (`with_copy(source, fn)`); `read_library` keeps its behaviour.
2. `etl/calibre_sync.py` (new), `py etl/calibre_sync.py`:
   - settings from `--env` (default `.env`): `CALIBRE_LIBRARY`, `APP_PASSCODE`, and the new `CALIBRE_SYNC_URL` (default `http://localhost:3000`), `CALIBRE_SERVER_URL` (default `http://localhost:8080`), `CALIBREDB` (default `calibredb` on PATH, else `C:\Program Files\Calibre2\calibredb.exe`), `CALIBRE_SYNC_READS` (default off); column lookup names as calibre.py's flags (`--date-column`, `--read-column`, …) plus `--status-column #ledger_status`, `--owned-column #owned`.
   - reads the copy: calibre.py's `records()` plus `#ledger_status` and `#owned`, and which write-back columns the library lacks.
   - signs in (`POST /api/login`, the passcode form, keeping `rt_session` from the 303), sends every record each run to `POST /api/calibre/sync` (the route applies only what changed, and the log's *what went out* stays complete), with `missingColumns` = the columns the library lacks, plus `#read` and `#date_read` while `CALIBRE_SYNC_READS` is off (printed as held until the books cutover, 1.26).
   - writes `report.out` with one `calibredb set_metadata <id> --field "#col:value" …` per book: through `--with-library <server>#<library id>` when `CALIBRE_SERVER_URL` answers, else `--library-path <folder>`. `#date_read` is the `--date-column` (the owner's `#read_date`); an exact or approximate finish is written as its stored day at noon Eastern (it reads back as the same day), a `none` finish clears it; `#owned` is the formats comma-joined.
   - then the backfill: `POST /api/books/backfill { dryRun: false, isbns: { bookId: ISBN } }` from the holdings and Calibre's ISBNs, again with `after: next` while `next` is set, waiting `retryIn` on `stopped`; a 503 (no token) is printed, not fatal. The backfill isn't part of the sync's log entry.
   - exits non-zero, writing nothing to Calibre, when the app is unreachable, the passcode is refused or the sync answers non-200; a failed `calibredb` call is listed and exits non-zero; a missing column is named and skipped, exit 0.
3. `scripts/calibre-sync-schedule.ps1` (new): `schtasks /Create /TN "Ledger Calibre sync" /SC WEEKLY … /TR <npm run calibre:sync in the repo> /F` (a second registration replaces it); `-Schtasks <path>` for a fake, `-WhatIf`; `-Shortcut` writes the desktop shortcut. *Revised in Phase 2:* the task's `/TR` runs this script with `-Run`, which runs `npm run calibre:sync` in the repo appended to `%LOCALAPPDATA%\Ledger\calibre-sync.log` (no nested quoting inside `/TR`, and no extra file).
4. `package.json`: `calibre:sync` = `py etl/calibre_sync.py --date-column "#read_date"`.
5. Docs: `.claude/rules/schema.md` and `docs/03-data-model.md` 2.19 (the write-back is real), `docs/COMMANDS.md`, `.env.example` and `docs/SERVICES.md` (the four new settings, names only), `docs/OWNER-CHECKLIST.md` (content server with unauthenticated local writes, the two columns, the weekly registration and shortcut, `CALIBRE_SYNC_READS=true` at 1.26).

**Files**: `etl/calibre_sync.py`, `etl/test_calibre_sync.py`, `test/calibre-sync-command.test.ts`, `test/fixtures/fake-calibredb.mjs`, `scripts/calibre-sync-schedule.ps1`, `test/calibre-sync-schedule.test.ts`, `test/fixtures/fake-schtasks.ps1` (new); `etl/calibre.py`, `package.json`, `.env.example`, `docs/SERVICES.md`, `docs/COMMANDS.md`, `docs/OWNER-CHECKLIST.md`, `.claude/rules/schema.md`, `docs/03-data-model.md`. Not in *Files likely touched*: the two fakes and the scheduler test. 15 files, kept whole (owner): most are tests, fixtures and docs the entry puts in the same PR; no schema.

**Test strategy**

- AC-1, AC-2, AC-3: `test/calibre-sync-command.test.ts` (TEST database): builds the four-book fixture library in a temp folder (`node:sqlite`), serves the real login, sync and backfill route handlers on 127.0.0.1, runs the Python command twice with `CALIBRE_SYNC_READS=true` and the fake `calibredb` (which writes the fixture's `metadata.db`); asserts the Ledger rows, the values written into `metadata.db`, one log row per run (the second empty, nothing written), a missing `#owned` and a missing `#ledger_status` named and skipped with exit 0, the server flag when a fake content server answers and `--library-path` when not, and a refused passcode or unreachable app exiting non-zero with no write.
- AC-2's "never opens the library's own file": `etl/test_calibre_sync.py` patches `sqlite3.connect`; plus the date and field formatting and the held-reads columns.
- AC-4: `test/calibre-sync-schedule.test.ts` runs the script under pwsh / powershell.exe against `test/fixtures/fake-schtasks.ps1` twice: one task, running `npm run calibre:sync` only; `-WhatIf` calls nothing.
- AC-5: `npm run verify:docs` and a grep.

**Risks**: real `calibredb` and the content server are never run in a test (fakes); the first real run writes `#ledger_status` and `#owned` for every book, one `calibredb` call each (minutes); `node:sqlite` needs Node 22.13+.

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
