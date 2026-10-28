---
id: TASK-034
title: 1.14b Hardcover details for the books, by ISBN
status: Ready
depends_on: [TASK-033]
size: L
model: opus
autonomy: attended
ui: false
plan_status: none
planned_at_commit:
---

# TASK-034 — 1.14b Hardcover details for the books, by ISBN

## Goal

The books arrive at cutover with Hardcover's page counts, covers, release years and ids, found by each book's Calibre ISBN where it has one, so graphic novels and omnibuses stop being picked for a novel. Near misses still wait for the owner in `book_review.csv`, never guessed.

## Context

- Roadmap: `docs/05-roadmap.md` § 1.14b Hardcover details for the books, by ISBN (sitting 8, after 1.18c, before 1.20). The roadmap entry and its **Check:** are the contract.
- Why it is large (`workflow.splitPolicy` is `never-split`): one ETL change crosses the client (`etl/enrich_books.py`), the series check (`etl/calibre.py`), the fold-in (`etl/extract.py`), both load scripts for the new `books.csv` column, and the ignore, env and command docs: more than eight files, all in the ETL layer. The plan says so again.
- Pattern to copy: 1.14 (TASK-022, archived): `etl/enrich_books.py` and `etl/test_enrich_books.py`. Keep `--dry-run` (100 books, writes nothing), `--offline`, the resumable SQLite cache, the `rekey()` move through `book_review.csv` merges, the `matched / proposed / ambiguous / unmatched / no_author / hand` report, and the faked `_fetch` in tests (no network in `npm run test:etl`).
- What's new:
  - Hardcover's GraphQL API with `HARDCOVER_API_TOKEN` from `.env`, named in `.env.example` (it isn't today). Without it the script stops and says so, except `--offline`. A `User-Agent` naming the app; keeps to the `RateLimit` headers and waits out a 429's `Retry-After`. Hardcover's limits (D-94): 60 requests a minute, bursts of 10, 5,000 a day, each top-level query one request.
  - Cache `etl/.hardcover-cache.sqlite`: gitignored, and added to `.claude/rules/git.md`'s never-commit list (both name only the Open Library, Metron and Fandom caches today).
  - The ISBN is the book's `etl/data/calibre_books.csv` row's `isbn`. Today `enrich_books.py` reads only `seed/books.csv` and `seed/authors.csv`, so the plan says how a book reaches its Calibre row (both are keyed by title and author).
  - ISBNs are asked many to a request, by `isbn_13` or `isbn_10`; a book with no ISBN, or no edition for one, gets one title-and-author search. A search result matches only with the book's title and one of its authors after `clean()` / `key()`, and not a `compilation`. A near spelling by the same author (`SIMILAR_AT` 0.5 or a `: subtitle`, D-92) is a `book_review.csv` row with `reason = hardcover`, never matched. Extract keeps `open library` rows undecided while the workbook still has `a` (`OPEN_LIBRARY` in `etl/extract.py`); `hardcover` rows need the same.
  - `book_details.csv` gains `hardcover_id` (`BOOK_DETAILS_COLUMNS`); `open_library_id` is no longer filled. Extract writes `hardcover_id` into `seed/books.csv` and `books.hardcover_id` (the column exists in `src/db/schema.ts`), so `etl/load.ps1` and `etl/load.sh` copy it. Calibre's `#pages` still wins over a details row (D-90); the year fills only where the workbook has none.
  - The series check `etl/calibre.py` makes through `eb.OpenLibrary` (`check()`, the `open_library` column, extract's `open library series differs` note in `calibre_changes.csv`, D-93) compares Hardcover's series and position instead.
- **For the plan gate** (roadmap): whether a near spelling whose titles are the same words reordered is never proposed (*Of Darkness and Dawn* / *Of Dawn and Darkness* score 1.00 and are two books); whether `calibre.py` asks Hardcover through this client or extract compares the two sidecars; what decides between two title-search results that both match (1.14 left them `ambiguous`; Hardcover offers a reader count).
- The owner's part (`docs/OWNER-CHECKLIST.md`): create the token and set it in `.env`; fill the missing ISBNs in Calibre (*Download metadata*, then `npm run calibre`) before the real run.
- Data model: `src/db/schema.ts` `books` (`hardcover_id`, `page_count`, `cover_url`, `published_year`, `open_library_id`), unchanged. No migration.
- Decisions: D-94 (amends D-44, D-51), D-44, D-90, D-92, D-93, D-91. `.claude/rules/schema.md`: enrichment never overwrites a hand value. Architecture: `docs/02-architecture.md` § 10. Metadata sources.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): `npm run test:etl`, with recorded Hardcover answers, shows: two fixture books with ISBNs match in one request and write `hardcover_id`, `page_count`, `cover_url` and `published_year` with `source = hardcover`; a book with no ISBN matches by title and author; a near spelling is a `book_review.csv` row with `reason = hardcover` and no details row; a `compilation` result never matches; a `hand` row is unchanged; a book with Calibre `#pages` keeps them over Hardcover's; a 429 waits its `Retry-After` and the run resumes; an `--offline` re-run leaves every sidecar byte-identical; without `HARDCOVER_API_TOKEN` only `--offline` runs. Then a dry run over the real books, with the counts matched by ISBN, matched by title, proposed and unmatched in the PR.
- [ ] AC-2: Given a fixture book with an ISBN whose edition Hardcover doesn't have, the run makes the ISBN request and then exactly one title search for it (the faked fetch records both); a book matched by ISBN makes no search request. A matched row's `page_count` and `cover_url` are the edition's, falling back to the book's when the edition has none (one fixture each way).
- [ ] AC-3: Given a fake response whose `RateLimit` headers say none remain, the next request waits until the reset (a patched clock records the wait). Every request carries the token and a `User-Agent` naming the app. Without `HARDCOVER_API_TOKEN`, a run that isn't `--offline` exits non-zero with a message naming the variable, sends nothing, and leaves `book_details.csv` and `book_review.csv` byte-identical; `--dry-run` with the token leaves them byte-identical too.
- [ ] AC-4: Given a `book_details.csv` with a `source = openlibrary` row, a `hand` row, an undecided `open library` review row and a decided one, a run leaves no `openlibrary` row, the `hand` row and the decided review row unchanged, and the undecided `open library` row gone. Extract writes `hardcover_id` to `seed/books.csv`, and `etl/load.ps1` and `etl/load.sh` both copy it into `books.hardcover_id` (`test/load-scripts.test.ts`).
- [ ] AC-5: Given a Calibre fixture book whose series or position Hardcover has differently, `seed/calibre_changes.csv` has one row saying so with Hardcover's series and position; a book where they agree has none; `calibre.py` makes no Open Library request (the Open Library fetch is patched to fail the test).
- [ ] AC-6: `git check-ignore etl/.hardcover-cache.sqlite` names the file; `.claude/rules/git.md`'s never-commit list names it; `.env.example` names `HARDCOVER_API_TOKEN`; `docs/COMMANDS.md`'s `enrich:books` and `calibre` lines say Hardcover.

## Out of scope

- The real run and committing its `book_details.csv`: the owner runs it after filling the missing ISBNs in Calibre. This PR carries the dry run's counts.
- Removing Open Library: `src/lib/openlibrary.ts`, `open_library_cache`, `books.open_library_id`, `etl/.openlibrary-cache.sqlite` and the code paths that read them (6.19).
- Add books searching Hardcover live, and the `hardcover_cache` table (1.4f).
- Holding books Hardcover doesn't know for review (1.20); covers moved to R2 or cached (4.3).
- Any schema change: `books.hardcover_id` exists, and there is no ISBN column.
- A word count from pages (2.1 estimates one).

## Files likely touched

- `etl/enrich_books.py`, `etl/test_enrich_books.py`: the Hardcover client, ISBN batches, title search, `reason = hardcover`, recorded answers.
- `etl/calibre.py`, `etl/test_calibre.py`: the series check against Hardcover (or extract compares the sidecars, the plan's choice).
- `etl/extract.py`, `etl/test_extract.py`: `hardcover_id` in `BOOK_DETAILS_COLUMNS`, the fold and `seed/books.csv`; `hardcover` review rows kept like `open library`; the series-differs note.
- `etl/load.ps1`, `etl/load.sh`, `test/load-scripts.test.ts`: copy `hardcover_id`.
- `.gitignore`, `.claude/rules/git.md`, `.env.example`, `docs/COMMANDS.md`.
- `package.json`: only if `calibre`'s or `enrich:books`'s flags change.

## Verification

- Automated: `npm run test:etl` (`etl/test_enrich_books.py`, `etl/test_calibre.py`, `etl/test_extract.py`) covers AC-1 to AC-5 with no network; `test/load-scripts.test.ts` covers the load half of AC-4.
- Manual: with `HARDCOVER_API_TOKEN` set, `npm run enrich:books -- --dry-run` → expected: the counts matched by ISBN, matched by title, proposed and unmatched, quoted in the PR, and `git status` shows no sidecar changed. `npm run enrich:books -- --offline` twice → expected: the sidecars byte-identical between runs. `git check-ignore etl/.hardcover-cache.sqlite` → expected: the path printed.

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
