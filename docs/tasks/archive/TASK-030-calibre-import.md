---
id: TASK-030
title: 1.18 Calibre: word counts, series, tags and reads for the books
status: Done
depends_on: [TASK-022, TASK-023, TASK-029]
size: L
model: opus
autonomy: attended
ui: false
plan_status: approved
planned_at_commit: 932d3c7
---

# TASK-030 — 1.18 Calibre: word counts, series, tags and reads for the books

## Goal

Every book in the owner's Calibre library comes into the Ledger before cutover. Calibre is the source of truth for a book's data and its reads (D-87, amended 2026-10-27): books it shares with the workbook take its real word counts and series, and every disagreement (with the workbook or Open Library) is reported. Books only Calibre has arrive at *Unlisted*. Calibre's reads load as Calibre has them. The command can be re-run whenever the library changes, and it never touches Calibre.

## Context

- Roadmap: `docs/05-roadmap.md` § 1.18 Calibre (sitting 8, after 1.14, 1.15 and 1.21; amended 2026-10-26 by D-83). The roadmap entry and its **Check:** are the contract.
- **Why this is one large task** (`workflow.splitPolicy: never-split`): a new reader script, three sidecars, extract's fold-in, unlisted-book creation, reads into `read_events`, and both loaders. The **Check:** exercises them as one run.
- Pattern to copy: `etl/enrich_books.py` and `etl/test_enrich_books.py` (TASK-022): `--dry-run`, recorded API answers, no network in `npm run test:etl`, a `hand` row never overwritten, a near spelling appended to `book_review.csv`. The series and ISBN check reuses 1.14's Open Library cache (`etl/.openlibrary-cache.sqlite`), which caches whole responses (`fields=*`) for this task.
- Matching is 1.13's (`etl/extract.py` `clean()`, `key()`, `trigrams()` and `BookIndex`, TASK-021). A near spelling (≥ 0.4) is a `book_review.csv` row with `reason = calibre`.
- Data model: `docs/03-data-model.md` § 2. Decisions 2.19 (Calibre is read the way the workbook is), 2.17 (a date and its precision), § 4.1 By task (1.18). `src/db/schema.ts` `books` (`word_count`, `word_count_source` `stated` | `estimated`, `series_id`, `series_position`), `book_status`, `read_events`. `.claude/rules/schema.md`: reads are a log, and `book_status` is their projection (task 1.5). A year-only date is `approximate` on its July 1st, and dates are Eastern (D-67).
- Today `etl/load.ps1` and `etl/load.sh` copy no `read_events`, and extract writes none (the workbook loads no reads, D-41). An accepted Calibre read is the first.
- Architecture: `docs/02-architecture.md` § Metadata sources (Calibre row, *Word counts*).
- Hardcover has no client yet (4.2). Until it does, "Open Library or Hardcover agree" means Open Library agrees. With no Open Library answer, the value goes to `calibre_review.csv`. *Amended by D-87: Calibre is the source of truth; an Open Library disagreement is reported in `unresolved.csv`, and there is no review file.*
- **Stop and ask** (roadmap, CLAUDE.md): before adding `books.subjects`, `books.summary` or `books.isbn`. Until the owner approves, tags, comments and ISBN stay in `calibre_books.csv` and load nothing.
- For the plan gate: does 1.20's hold apply to a Calibre-created book that Open Library doesn't know? The roadmap proposes no, since owning it is the owner's say-so. TASK-031 asks the same thing from its side.
- *From TASK-029 (1.21, PR #143), open question for the plan:* wishlist accept (`acceptLine` → `toRead` in `src/db/writes.ts`) leaves an Unlisted book Unlisted, and `src/lib/wishlist-review.ts` tells the owner "your status stays". Once this task creates Unlisted books, should a wishlist line that names one promote it to Someday, as *Add books* does since 1.21?
- Decisions: D-73 (Calibre is a metadata source; reads load only through a review; *amended by D-87: Calibre is the source of truth, its series fill without an API check and its reads load without a review*), D-88 (the plan gate's answers), D-83 (every Calibre book comes in at Unlisted (D-86); re-runnable until cutover; 4.4 after), D-41 (the workbook loads no reads), D-44, D-18 (nothing local writes the live database), D-67. Standing rule 4 applies to extract's fold-in.

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim): `npm run test:etl`, with a fixture `metadata.db` built by the test (two books, `#words` and `#date_read` custom columns) and recorded API answers, shows:
  - an exact match fills a `stated` word count where the workbook had none, and replaces a workbook count that differs, reporting it when it is more than 10% off;
  - a series Open Library agrees with fills; one it contradicts also fills, and the disagreement is in `unresolved.csv`;
  - a near spelling writes a `book_review.csv` row;
  - a Calibre book matching nothing becomes one `books.csv` row with an `unlisted` status, and a second run over the same fixture leaves every sidecar byte-identical;
  - a book Calibre has read loads one `read_events` row with its date and precision and a `read` status, and a book it hasn't read loads none;
  - the fixture file's bytes and modified time are unchanged after the run.

  Then a dry run over the real library, with the matched, proposed and unmatched counts reported in the PR.
- [x] AC-2: The library comes from `--library <folder>` or `CALIBRE_LIBRARY` in `.env`, and neither set is an error naming both. Given a fixture whose word-count column has the lookup name `#wc` at a different `custom_column_N`, `--words-column '#wc'` fills the same counts as `#words` did. `--dry-run` prints the match rate and leaves every sidecar and `seed/` file byte-identical.
- [x] AC-3: A Calibre book added between two runs appends exactly its own row to `calibre_books.csv`; a book changed in Calibre is rewritten in place, and a book removed from Calibre loses its row; the run prints each of the three. Calibre's word count and series load over the workbook's, and a workbook count more than 10% off, a different workbook series, and an Open Library series that differs are each a row in `unresolved.csv` (D-87, amended 2026-10-27).
- [x] AC-4: Given a book already `read` in the seed, a second Calibre read for it loads no second `read_events` row, and the run reports it. A year-only Calibre date loads as `approximate` on July 1st of that year. A Calibre-created book Calibre has read loads `book_status = read` with that finish date. Calibre-created books it hasn't read load `unlisted` (D-87, amended 2026-10-27).
- [x] AC-5: Unless the owner approved `books.subjects`, `books.summary` or `books.isbn` at the plan gate, no migration is in the PR and `seed/books.csv`'s header is unchanged. Re-running extract against both workbooks on `main` and on the branch, the CSV diff shows only Calibre-sourced values: stated word counts, filled series, the new Unlisted books and their status rows, Calibre's reads (`seed/read_events.csv`) with the `read` status rows they set, and the workbook series Calibre emptied, dropped (standing rule 4, summary in the PR; D-87, amended 2026-10-27).
- [x] AC-6: `metadata.db` and its temp copy are never in the repo: the copy is written outside it and removed after the run, and `git status` is clean of both. `npm run calibre` and its `--dry-run` are in `CLAUDE.md`'s commands and `docs/COMMANDS.md`. `npm run extract` passes the Calibre sidecars. `CALIBRE_LIBRARY` is in `.env.example`. `.claude/rules/schema.md` names `calibre_books.csv` and its rules (one sidecar since D-87). `etl/load.ps1` and `etl/load.sh` both copy `read_events`.

## Out of scope

- The in-app sync after cutover (4.4) and fetching `metadata.db` from Google Drive (L-4).
- Hardcover lookups (4.2), and any Open Library request beyond what 1.14's cache and client already make.
- Holding books Open Library doesn't know (1.20, TASK-031), beyond answering the plan-gate question above.
- Calibre as a source label on search results, and `books.calibre_id` (1.22).
- Start dates from Calibre (1.17).
- Writing to Calibre in any way.

## Files likely touched

- `etl/calibre.py` (new), `etl/test_calibre.py` (new; builds the fixture `metadata.db` with `sqlite3`, recorded Open Library answers).
- `etl/extract.py`, `etl/test_extract.py`: fold in `calibre_books.csv` (its reads included, D-87); create Unlisted books; write `seed/read_events.csv`.
- `etl/data/calibre_books.csv` (new sidecar; `calibre_review.csv` and `calibre_reads.csv` were dropped by D-87); `etl/data/book_review.csv` (the run's `calibre` proposals).
- `etl/load.ps1`, `etl/load.sh`, `test/load-scripts.test.ts`: copy `read_events`.
- `package.json`: `calibre`, and `extract`'s new arguments.
- `.env.example`, `CLAUDE.md`, `docs/COMMANDS.md`, `.claude/rules/schema.md`; `.claude/kit.json` `largeFiles` if a sidecar is large.

## Verification

- Automated: `npm run test:etl` covers every AC-1 bullet, the flag and environment cases in AC-2, the rerun cases in AC-3 and the read cases in AC-4, with no network. `test/load-scripts.test.ts` covers the `read_events` copy in both loaders.
- Manual: `npm run calibre -- --dry-run` over the real library → expected: the matched, proposed and unmatched counts, quoted in the PR, and nothing written. A real run, then `npm run extract` on `main` and on the branch into temp folders, then a CSV diff → expected: only the changes listed in AC-5. `npm run rebuild` on development only with the owner's go-ahead at the plan gate.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- 1.20's hold does not apply to a Calibre-created book Open Library doesn't know: having it is the owner's say-so (approved at plan); and, as a proposal for TASK-031's plan gate, a Calibre-matched workbook book counts like a `book_details.csv` match (proposed) → docs/tasks/TASK-031-hold-unmatched-books.md § Context
- Wishlist accept should promote an Unlisted book to Someday, as *Add books* does since 1.21 (TASK-029's open question; app code, out of this ETL task) (approved at plan) → docs/05-roadmap.md § 1.24 (new; its Check is proposed), and docs/06-tasklist.md § M9
- Candidate decisions from the plan gate: which Calibre types come in (Book and Fan Fiction, Comic skipped), a no-day date format loads the stored Eastern day `approximate` and a year-only one July 1st, and no comments in the public CSV (approved at plan) → docs/review/decisions.md § D-88. The ISBN half (ISBN review rows wait for `books.isbn`) became moot: D-87 removed the review file.
- Calibre is the source of truth for a book's data and its reads (owner, at TASK-030's review, 2026-10-27): it amends D-73, 1.18's entry and **Check:**, TASK-030's ACs 1, 3–6, data model 2.19 and § 4.1, 4.4, and the architecture, product, task-list and runbook prose (owner-directed; `docs/1.18-calibre-source-of-truth`, merged into this branch) (approved at review) → docs/review/decisions.md § D-87
- The first real run's leftovers for the owner: 246 `calibre` near spellings to decide, the `calibre_books` rows in `unresolved.csv` to read, 1,898 series Open Library hasn't answered yet, and `enrich:books` for the 3,210 new books → docs/OWNER-CHECKLIST.md § Actions from follow-ups
- `docs/STATUS.md` still names `calibre_review.csv` and `calibre_reads.csv` → not tracked: it is `workflow.statusDoc`, regenerated from the roadmap, which carries D-87
- Open Library knows few series (661 of the first run's 679 had no answer); Hardcover would → not tracked: since D-87 the API only reports, and Hardcover is 4.2's already
- The test fixtures' temp folders aren't removed after each test → not tracked: the same as `etl/test_extract.py` and `etl/test_enrich_books.py`; nothing reads them

## Plan

_Approved 2026-10-27 at 932d3c7. Owner's answers at the gate: Book + Fan Fiction come in, Comic is skipped; a no-day date format loads the stored day `approximate`; `calibre_books.csv` holds tags and ISBN, no comments. Owner's question: books get their Open Library id and metadata from Open Library, not Calibre. Answer: yes. Calibre-created books are in `seed/books.csv`, so `npm run enrich:books` gives them id, cover, page count and published year like any other; Calibre's publisher and pubdate are never read. Run order in `docs/COMMANDS.md`: extract → calibre → extract → enrich:books → extract._

**Steps**

1. `etl/calibre.py` (`npm run calibre`): `--library` or `CALIBRE_LIBRARY` (`.env`), neither is an error naming both. Copies `metadata.db` to a temp folder outside the repo, opens it `mode=ro`, removes it in `finally`. Columns by lookup name: `--words-column` (`#words`), `--read-column` (`#read`), `--date-column` (`#date_read`); `npm run calibre` passes `--date-column "#read_date"` (this library). `--type-column` (`#type`): Comic is skipped and reported, Fan Fiction gets `book_type` `Fan Fiction`.
2. Matching against `seed/books.csv` with 1.13's `key()`: a multi-author Calibre book matches on any of its authors (created under the first). A near spelling (≥ 0.4, same author, not differing only by a number) or the same title under another author appends a `book_review.csv` row, `reason = calibre` (`a` the workbook's spelling, `b` Calibre's). Books Calibre created on an earlier run are never matched, so a rerun is stable: extract lists them in `seed/calibre_created.csv` (title, author, book_id; not loaded). *(Revision 1, approved 2026-10-27: the plan first inferred them from a seed status of `unlisted` or `read`, which a workbook book with an accepted Calibre read also has.)*
3. Sidecars, existing rows in place and new rows appended; a `hand` row and a decided row are never rewritten; a `calibre` row whose book left Calibre is dropped. `calibre_books.csv`: title, author, words, series, series_index, isbn, tags, book_type, confirmed, source. `calibre_review.csv`: title, author, field, calibre, api, decision (calibre|api|neither). `calibre_reads.csv`: title, author, read, date_read (Eastern day, or `YYYY`), precision, decision (accept|reject).
4. Open Library check with 1.14's `OpenLibrary` client and cache (same search; a matched book searches under the seed's spelling): only where the seed book has no series or Calibre's. Series and index agreement → `confirmed`; contradiction or no answer → review row. ISBN compared only against an answer in hand, recorded in `confirmed`; no ISBN review rows until `books.isbn`. `--offline` cache only; `--dry-run` no lookups, writes nothing, prints matched / proposed / unmatched and the match rate.
5. `etl/extract.py` (`--calibre-books`, `--calibre-review`, `--calibre-reads`; `npm run extract` passes them): word count `stated` only where the book has none, a > 10% difference reported in `unresolved.csv`; series fills where confirmed, hand, or decided calibre/api; unmatched books created `unlisted` (held and reported while their `calibre` review row is undecided); an accepted read writes `seed/read_events.csv` and sets `book_status` `read` with its date (a book already `read` is reported, no second read); `review_book_pairs` keeps `calibre` rows as it keeps `open library` ones.
6. `etl/load.ps1`, `etl/load.sh`: truncate `read_events`, bind `$OWNER`, copy it after books. `etl/rebuild.ps1`, `etl/rebuild.sh`: count it.
7. `.env.example`, `CLAUDE.md`, `docs/COMMANDS.md` (with the run order), `.claude/rules/schema.md` (the three sidecars), `.claude/kit.json` `largeFiles` for `calibre_books.csv`.

**Files**: `etl/calibre.py` (new), `etl/test_calibre.py` (new), `etl/extract.py`, `etl/data/calibre_books.csv`, `calibre_review.csv`, `calibre_reads.csv` (new), `etl/data/book_review.csv`, `etl/load.ps1`, `etl/load.sh`, `etl/rebuild.ps1` and `etl/rebuild.sh` (not in Files likely touched: they count each table against the seed), `test/load-scripts.test.ts`, `package.json`, `.env.example`, `CLAUDE.md`, `docs/COMMANDS.md`, `.claude/rules/schema.md`, `.claude/kit.json`. 18 files: `never-split`, attended.

**Test strategy** (`etl/test_calibre.py`, a fixture `metadata.db` of two books per case, recorded Open Library answers, no network)

- AC-1: one test per Check bullet: stated count fills / workbook count kept; agreed series fills, contradicted series is a review row and fills nothing; near spelling → `book_review.csv`; unmatched → one `unlisted` book, second run byte-identical; reads undecided / accept / reject; fixture bytes and `st_mtime_ns` unchanged.
- AC-2: library from flag, from env, neither → error naming both; `#wc` at another `custom_column_N`; `--dry-run` rate printed, sidecars and seed byte-identical.
- AC-3: hand row, decided review and read rows kept; a new Calibre book appends only its rows; > 10% reported and kept; `decision = calibre` fills the series.
- AC-4: already-read book → no second `read_events` row, reported; year-only → July 1st `approximate`; created book with accepted read → `read` with the date; without → `unlisted`.
- AC-5: `books.csv` header unchanged (test); extract on `main` and on the branch, CSV diff (manual, summary in the PR).
- AC-6: temp copy outside the repo and removed (test); `test/load-scripts.test.ts` read_events copy, truncate and bind in both loaders; docs by inspection.

**Risks**: ~3,000 Unlisted books (4,462 in Calibre, 1,361 in the workbook); the first real run asks Open Library about each Calibre-only series book (~1 a second, cached after); the repo is public (no comments committed).

**Revision 2** (owner, 2026-10-27, during review; D-87, D-88, on `docs/1.18-calibre-source-of-truth` merged into this branch): Calibre is the source of truth for a book's data and its reads. Steps 3–5 change: one sidecar, `calibre_books.csv`, with the read flag, date and precision and Open Library's differing series (`open_library`); no `calibre_review.csv`, `calibre_reads.csv` or `hand` rows. Calibre's word count and series replace the workbook's, every Calibre read loads, and each disagreement (workbook count more than 10% off, workbook series, Open Library's series, a second read) is a row in `unresolved.csv`; a workbook series Calibre emptied is dropped unless followed. Each run prints what changed in Calibre since the last (added, removed, renamed, changed fields). A `calibre` near-spelling row pre-fills `keep` with Calibre's spelling. ACs 1, 3, 4 and 6 and the roadmap **Check:** were amended to match, with the owner's go-ahead.

## Review log

_Filled by /implement-task. One line per round._

- Verify R1 FAIL(1: rebuild.sh lacked the extract arguments) → R2 PASS → R3 PASS (after revision 2, at 0bdd8cd)
- Audit R1 CHANGES (one AC-6 item untested) → fixed in 3fca1c4 | Audit R2 PASS (Opus, at 84cac3b, after revision 2)
- Spec R1 CHANGES (stale text after D-87) → R2 APPROVE → R3 APPROVE (84cac3b)
- Schema R1 CHANGES (MAJOR: a Calibre-only book under a merged-away spelling; 3 MINOR) → R2 APPROVE (Opus, 84cac3b)
- Real-library run: Open Library dropped most connections; the client's failure handling was added (1 drop skips a book, 3 in a row stop the lookups), and the sidecar was written from the cache

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 3 (R1 FAIL, R2 and R3 PASS)
- Review rounds: 3 spec, 2 schema, 2 test audit (the Sonnet reviewers ran on Opus at the owner's word: weekly limit)
- First-pass AC FAILs: 1 (AC-6: the `npm run extract` arguments were untested)
- Plan revisions after approval: 2 (1: `seed/calibre_created.csv`; 2: D-87, Calibre the source of truth)
