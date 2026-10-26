---
id: TASK-030
title: 1.18 Calibre: word counts, series, tags and reads for the books
status: Draft
depends_on: [TASK-022, TASK-023, TASK-029]
size: L
model: opus
autonomy: attended
ui: false
plan_status: none
planned_at_commit:
---

# TASK-030 — 1.18 Calibre: word counts, series, tags and reads for the books

## Goal

Every book in the owner's Calibre library comes into the Ledger before cutover. Books it shares with the workbook gain real word counts, and series that Open Library confirms. Books only Calibre has arrive at *Owned*. Calibre's reads load only once the owner has accepted them. The command can be re-run whenever the library changes, and it never touches Calibre.

## Context

- Roadmap: `docs/05-roadmap.md` § 1.18 Calibre (sitting 8, after 1.14, 1.15 and 1.21; amended 2026-10-26 by D-83). The roadmap entry and its **Check:** are the contract.
- **Why this is one large task** (`workflow.splitPolicy: never-split`): a new reader script, three sidecars, extract's fold-in, owned-book creation, reads into `read_events`, and both loaders. The **Check:** exercises them as one run.
- Pattern to copy: `etl/enrich_books.py` and `etl/test_enrich_books.py` (TASK-022): `--dry-run`, recorded API answers, no network in `npm run test:etl`, a `hand` row never overwritten, a near spelling appended to `book_review.csv`. The series and ISBN check reuses 1.14's Open Library cache (`etl/.openlibrary-cache.sqlite`), which caches whole responses (`fields=*`) for this task.
- Matching is 1.13's (`etl/extract.py` `clean()`, `key()`, `trigrams()` and `BookIndex`, TASK-021). A near spelling (≥ 0.4) is a `book_review.csv` row with `reason = calibre`.
- Data model: `docs/03-data-model.md` § 2. Decisions 2.19 (Calibre is read the way the workbook is), 2.17 (a date and its precision), § 4.1 By task (1.18). `src/db/schema.ts` `books` (`word_count`, `word_count_source` `stated` | `estimated`, `series_id`, `series_position`), `book_status`, `read_events`. `.claude/rules/schema.md`: reads are a log, and `book_status` is their projection (task 1.5). A year-only date is `approximate` on its July 1st, and dates are Eastern (D-67).
- Today `etl/load.ps1` and `etl/load.sh` copy no `read_events`, and extract writes none (the workbook loads no reads, D-41). An accepted Calibre read is the first.
- Architecture: `docs/02-architecture.md` § Metadata sources (Calibre row, *Word counts*).
- Hardcover has no client yet (4.2). Until it does, "Open Library or Hardcover agree" means Open Library agrees. With no Open Library answer, the value goes to `calibre_review.csv`.
- **Stop and ask** (roadmap, CLAUDE.md): before adding `books.subjects`, `books.summary` or `books.isbn`. Until the owner approves, tags, comments and ISBN stay in `calibre_books.csv` and load nothing.
- For the plan gate: does 1.20's hold apply to a Calibre-created book that Open Library doesn't know? The roadmap proposes no, since owning it is the owner's say-so. TASK-031 asks the same thing from its side.
- Decisions: D-73 (Calibre is a metadata source; reads load only through a review), D-83 (every Calibre book comes in at Owned; re-runnable until cutover; 4.4 after), D-41 (the workbook loads no reads), D-44, D-18 (nothing local writes the live database), D-67. Standing rule 4 applies to extract's fold-in.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): `npm run test:etl`, with a fixture `metadata.db` built by the test (two books, `#words` and `#date_read` custom columns) and recorded API answers, shows:
  - an exact match fills a `stated` word count where the workbook had none, and leaves a workbook count alone;
  - a series Open Library agrees with fills; one it contradicts writes a `calibre_review.csv` row and fills nothing;
  - a near spelling writes a `book_review.csv` row;
  - a Calibre book matching nothing becomes one `books.csv` row with an `owned` status, and a second run over the same fixture leaves every sidecar byte-identical;
  - an undecided `calibre_reads.csv` row loads nothing, an `accept` row loads one `read_events` row with its date and precision, and a `reject` row loads nothing;
  - the fixture file's bytes and modified time are unchanged after the run.

  Then a dry run over the real library, with the matched, proposed and unmatched counts reported in the PR.
- [ ] AC-2: The library comes from `--library <folder>` or `CALIBRE_LIBRARY` in `.env`, and neither set is an error naming both. Given a fixture whose word-count column has the lookup name `#wc` at a different `custom_column_N`, `--words-column '#wc'` fills the same counts as `#words` did. `--dry-run` prints the match rate and leaves every sidecar and `seed/` file byte-identical.
- [ ] AC-3: A `hand` row in `calibre_books.csv`, and a decided row in `calibre_review.csv` or `calibre_reads.csv`, are never rewritten by a run. A Calibre book added between two runs appends exactly its own rows. A workbook word count that differs from Calibre's by more than 10% is reported and kept. With `decision = calibre` on a review row, the next extract fills that series (or index) from Calibre.
- [ ] AC-4: Given a book already `read` in the seed, an accepted Calibre read for it loads no second `read_events` row, and the run reports it. A year-only Calibre date loads as `approximate` on July 1st of that year. A Calibre-created book with an accepted read loads `book_status = read` with that finish date. Calibre-created books with no accepted read load `owned`.
- [ ] AC-5: Unless the owner approved `books.subjects`, `books.summary` or `books.isbn` at the plan gate, no migration is in the PR and `seed/books.csv`'s header is unchanged. Re-running extract against both workbooks on `main` and on the branch, the CSV diff shows only Calibre-sourced values: stated word counts, filled series, the new Owned books and their status rows, and accepted reads (standing rule 4, summary in the PR).
- [ ] AC-6: `metadata.db` and its temp copy are never in the repo: the copy is written outside it and removed after the run, and `git status` is clean of both. `npm run calibre` and its `--dry-run` are in `CLAUDE.md`'s commands and `docs/COMMANDS.md`. `npm run extract` passes the Calibre sidecars. `CALIBRE_LIBRARY` is in `.env.example`. `.claude/rules/schema.md` names the three sidecars and their rules. `etl/load.ps1` and `etl/load.sh` both copy `read_events`.

## Out of scope

- The in-app sync after cutover (4.4) and fetching `metadata.db` from Google Drive (L-4).
- Hardcover lookups (4.2), and any Open Library request beyond what 1.14's cache and client already make.
- Holding books Open Library doesn't know (1.20, TASK-031), beyond answering the plan-gate question above.
- Calibre as a source label on search results, and `books.calibre_id` (1.22).
- Start dates from Calibre (1.17).
- Writing to Calibre in any way.

## Files likely touched

- `etl/calibre.py` (new), `etl/test_calibre.py` (new; builds the fixture `metadata.db` with `sqlite3`, recorded Open Library answers).
- `etl/extract.py`, `etl/test_extract.py`: fold in `calibre_books.csv`, `calibre_review.csv` decisions and accepted `calibre_reads.csv` rows; create Owned books; write `seed/read_events.csv`.
- `etl/data/calibre_books.csv`, `etl/data/calibre_review.csv`, `etl/data/calibre_reads.csv` (new sidecars); `etl/data/book_review.csv` (the run's `calibre` proposals).
- `etl/load.ps1`, `etl/load.sh`, `test/load-scripts.test.ts`: copy `read_events`.
- `package.json`: `calibre`, and `extract`'s new arguments.
- `.env.example`, `CLAUDE.md`, `docs/COMMANDS.md`, `.claude/rules/schema.md`; `.claude/kit.json` `largeFiles` if a sidecar is large.

## Verification

- Automated: `npm run test:etl` covers every AC-1 bullet, the flag and environment cases in AC-2, the rerun cases in AC-3 and the read cases in AC-4, with no network. `test/load-scripts.test.ts` covers the `read_events` copy in both loaders.
- Manual: `npm run calibre -- --dry-run` over the real library → expected: the matched, proposed and unmatched counts, quoted in the PR, and nothing written. A real run, then `npm run extract` on `main` and on the branch into temp folders, then a CSV diff → expected: only the changes listed in AC-5. `npm run rebuild` on development only with the owner's go-ahead at the plan gate.

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
