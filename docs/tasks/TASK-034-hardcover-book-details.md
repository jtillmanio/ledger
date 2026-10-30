---
id: TASK-034
title: 1.14b Hardcover details for the books, by ISBN
status: Review
depends_on: [TASK-033]
size: L
model: opus
autonomy: attended
ui: false
plan_status: approved
planned_at_commit: 5a9d306
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

- [x] AC-1 (roadmap **Check:**, verbatim): `npm run test:etl`, with recorded Hardcover answers, shows: two fixture books with ISBNs match in one request and write `hardcover_id`, `page_count`, `cover_url` and `published_year` with `source = hardcover`; a book with no ISBN matches by title and author; a near spelling is a `book_review.csv` row with `reason = hardcover` and no details row; a `compilation` result never matches; a `hand` row is unchanged; a book with Calibre `#pages` keeps them over Hardcover's; a 429 waits its `Retry-After` and the run resumes; an `--offline` re-run leaves every sidecar byte-identical; without `HARDCOVER_API_TOKEN` only `--offline` runs. Then a dry run over the real books, with the counts matched by ISBN, matched by title, proposed and unmatched in the PR.
- [x] AC-2: Given a fixture book with an ISBN whose edition Hardcover doesn't have, the run makes the ISBN request and then exactly one title search for it (the faked fetch records both); a book matched by ISBN makes no search request. A matched row's `page_count` and `cover_url` are the edition's, falling back to the book's when the edition has none (one fixture each way).
- [x] AC-3: Given a fake response whose `RateLimit` headers say none remain, the next request waits until the reset (a patched clock records the wait). Every request carries the token and a `User-Agent` naming the app. Without `HARDCOVER_API_TOKEN`, a run that isn't `--offline` exits non-zero with a message naming the variable, sends nothing, and leaves `book_details.csv` and `book_review.csv` byte-identical; `--dry-run` with the token leaves them byte-identical too.
- [x] AC-4: Given a `book_details.csv` with a `source = openlibrary` row, a `hand` row, an undecided `open library` review row and a decided one, a run leaves no `openlibrary` row, the `hand` row and the decided review row unchanged, and the undecided `open library` row gone. Extract writes `hardcover_id` to `seed/books.csv`, and `etl/load.ps1` and `etl/load.sh` both copy it into `books.hardcover_id` (`test/load-scripts.test.ts`).
- [x] AC-5: Given a Calibre fixture book whose series or position Hardcover has differently, `seed/calibre_changes.csv` has one row saying so with Hardcover's series and position; a book where they agree has none; `calibre.py` makes no Open Library request (the Open Library fetch is patched to fail the test).
- [x] AC-6: `git check-ignore etl/.hardcover-cache.sqlite` names the file; `.claude/rules/git.md`'s never-commit list names it; `.env.example` names `HARDCOVER_API_TOKEN`; `docs/COMMANDS.md`'s `enrich:books` and `calibre` lines say Hardcover.

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

- `.claude/rules/schema.md`, the book bullets: `book_details.csv` holds `hardcover_id` with `source` hardcover|hand; a Hardcover near spelling is `reason = hardcover`; `hardcover_review.csv` holds the ambiguous books' candidates; `calibre_books.csv`'s `open_library` column is `hardcover` → .claude/rules/schema.md § Schema and data-model rules (approved at plan)
- `docs/02-architecture.md` § Metadata sources: the Layer and Books tables still make Open Library the spine; D-94 makes it Hardcover (Open Library goes in 6.19) → docs/02-architecture.md § 10. Metadata sources (approved at plan)
- Candidate decision: reordered-word titles are never proposed (Q1); `calibre.py` asks Hardcover through 1.14b's client and cache (Q2); two matching Hardcover books are the owner's pick in `hardcover_review.csv`, never ranked (Q3); a `compilation` never matches, by ISBN or title (Q4) → docs/review/decisions.md § D-99 (approved at plan)
- The owner asked for one runbook of every data-refresh step (extract, calibre, enrich:books, enrich comics, sidecars …) and what to review after (unresolved, book_review, hardcover_review, cover dates …): wider than 1.14b → not tracked: requested by the owner in this session; it follows on its own `docs/` branch as soon as this PR is open, as a "Refreshing the data" section in `docs/COMMANDS.md`
- The real run, in order, and what to decide after it (the `hardcover` proposals, the `hardcover_review.csv` picks, compilations given a `hand` row if wanted) → docs/OWNER-CHECKLIST.md § Actions from follow-ups
- Schema review R1: a stopped run dropped every Open Library row; `hardcover_review.csv` could double a row after a rekey; no test fed extract the pre-Hardcover sidecars → not tracked: done in this PR (plan revision 1)
- Spec review R1: `.claude/kit.json`'s cache hints, CLAUDE.md's `enrich:books` line and `docs/START-HERE.md`'s sitting 8 still said Open Library → not tracked: done in this PR (plan revision 1)
- Schema review R2: two decided rows with different decisions for one book and Hardcover id keep the first read → not tracked: a rare hand edit, accepted as is (the reviewer asked for no action)
- Schema review R2: no test of a hand row on a stopped run → not tracked: optional; the hand rule is tested, and the stopped-run path never replaces a row already held
- 6.19 has less to remove: the Python Open Library client went with this task → not tracked: 6.19's Check (no `Open Library` in `etl/*.py`) still finds what is left (`OPEN_LIBRARY`, `OLD_SOURCE`, the cache entries)
- AC-5's parenthetical names an Open Library fetch that no longer exists; the tests patch `urllib.request.urlopen` to fail on any real request instead → not tracked: meets its intent (spec review), said in the PR

## Plan

_Approved by the owner 2026-10-30 at 5a9d306, with Q3 changed to the owner's pick._

**Answers at the gate:** Q1 a pair whose titles are the same words reordered is never proposed. Q2 `calibre.py` asks Hardcover through this client and cache. Q3 two matching Hardcover books (two title results, or one ISBN's editions under two books, compilations dropped first) are written to `etl/data/hardcover_review.csv`, one row per candidate (`title, author, hardcover_id, hardcover_title, hardcover_authors, year, readers, url, decision`); the owner writes `pick` on one and the next run matches it. Q4 a `compilation` never matches, by ISBN or by title. `HARDCOVER_API_TOKEN` is in `.env` (written `NAME =`; `load_env` takes the space).

**Steps**

1. Tests first in `etl/test_enrich_books.py`: a recorded Hardcover fake (editions by ISBN, search by query, response headers) and one test per Check clause and AC-2–AC-4; confirm each fails.
2. `etl/enrich_books.py`: `Hardcover` replaces `OpenLibrary`: POST GraphQL to `https://api.hardcover.app/v1/graphql`, `authorization: Bearer <token>`, the `User-Agent`; waits to the reset when a `RateLimit` bucket has `r=0`, waits out a 429's `Retry-After`, 1 request a second; stops on 401/403 and on GraphQL errors (uncached). Cache `etl/.hardcover-cache.sqlite`, a row per ISBN and per search. `HARDCOVER_API_TOKEN` from `.env` (`load_env` moves here from `calibre.py`); without it a run that isn't `--offline` exits 1 and sends nothing.
3. The flow: a seed book reaches its Calibre row by `calibre_id`, else by title and author through the merges; ISBNs 100 to a request (`isbn_13` / `isbn_10` `_in`); no ISBN or no edition → one title-and-author search. `book_details.csv` gains `hardcover_id`; `source = hardcover`; pages and cover the edition's, else the book's; the year the book's. `openlibrary` rows and undecided `open library` review rows go; hand rows and decided rows stay. A near spelling is `reason = hardcover` (not when only the word order differs). Ambiguous books go to `hardcover_review.csv` (undecided rows of the books looked up are rebuilt, decided ones kept and rekeyed). The report gives matched by ISBN, by title and picked.
4. `etl/calibre.py`: the series check asks Hardcover through the same client and cache, ISBN batches first; `calibre_books.csv`'s `open_library` column is `hardcover`; without the token the check is cache-only and says so.
5. `etl/extract.py`: `hardcover_id` in `BOOK_DETAILS_COLUMNS` and `BOOK_COLUMNS` (after `open_library_id`), the fold fills `books.hardcover_id`; `HARDCOVER` review rows kept like `OPEN_LIBRARY`'s; the note is `hardcover series differs`.
6. `etl/load.ps1`, `etl/load.sh`: `hardcover_id` in `\copy books(...)`; `test/load-scripts.test.ts` checks each list equals extract's `BOOK_COLUMNS`.
7. `.gitignore` and `.claude/rules/git.md` (both lists) name the cache; `.env.example` names the token; `docs/COMMANDS.md`'s `enrich:books` and `calibre` lines say Hardcover; `docs/SERVICES.md` (CLAUDE.md: a key added updates it) its key row, § Hardcover and § Loose ends.
8. Dry run over the real books with the token; the counts go in the PR.

**Files:** `etl/enrich_books.py`, `etl/test_enrich_books.py`, `etl/calibre.py`, `etl/test_calibre.py`, `etl/extract.py`, `etl/test_extract.py`, `etl/load.ps1`, `etl/load.sh`, `test/load-scripts.test.ts`, `.gitignore`, `.claude/rules/git.md`, `.env.example`, `docs/COMMANDS.md`, `docs/SERVICES.md` (not in Files likely touched: CLAUDE.md requires it with a new key), this task file. Sixteen files: `never-split` keeps it whole and attended. No schema change.

**Test strategy**

- AC-1: `etl/test_enrich_books.py` `Check.*` — one test per clause (two ISBNs in one request, title match, near spelling, compilation, hand row, Calibre `#pages` through `test_extract`-style fold, 429, offline byte-identical, no token).
- AC-2: `Lookup.test_an_isbn_with_no_edition_makes_one_search`, `test_an_isbn_match_makes_no_search`, `test_pages_and_cover_fall_back_to_the_book`.
- AC-3: `Requests.test_ratelimit_none_remaining_waits_for_the_reset`, `test_every_request_carries_the_token_and_user_agent`, `test_no_token_exits_and_writes_nothing`, `test_dry_run_writes_nothing`.
- AC-4: `Replace.test_open_library_rows_go_hand_and_decided_stay`; `etl/test_extract.py` header and fold tests; `test/load-scripts.test.ts` 1.14b block.
- AC-5: `etl/test_calibre.py`, the series tests on the Hardcover fake, Open Library's `_fetch` patched to fail.
- AC-6: manual `git check-ignore` and a grep, recorded in the PR.
- Q3: `Ambiguous.test_two_matches_write_candidates_and_no_details`, `test_a_pick_matches_on_the_next_run`.

**Revision 1 (owner, 2026-10-30, after review round 1):** a run that stops early or takes `--limit` keeps the `openlibrary` rows of the books it didn't reach (a complete run leaves none); `hardcover_review.csv` keeps one row per book and Hardcover id, a decided one first; `etl/test_extract.py` loads sidecars written before Hardcover (no `hardcover_id`, the old `open_library` column). Plus three doc lines: `.claude/kit.json`'s `largeFiles` hints for both caches, CLAUDE.md's `enrich:books` command line, `docs/START-HERE.md`'s sitting 8. Files added: `.claude/kit.json`, `CLAUDE.md`, `docs/START-HERE.md`.

**Risks:** fixtures follow Hardcover's docs (`hardcoverapp/hardcover-docs`); the search document's `featured_series` shape is the docs' reading, so the dry run is the real check of the queries.

## Review log

_Filled by /implement-task. One line per round._

- Verify R1 round PASS → full PASS (574 browser tests) | Audit R1 PASS | Spec R1 APPROVE | Schema R1 APPROVE (3 MINOR, fixed as plan revision 1) | UI not run (`ui: false`, no UI files)
- Verify R2 round PASS | Spec R2 APPROVE | Schema R2 APPROVE | Audit not re-run (two new tests fail on the checkpoint, checked by hand)

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 2 (R1 round and full, R2 round)
- Review rounds: 2
- First-pass AC FAILs: 0
- Plan revisions after approval: 1 (owner, after review round 1)
