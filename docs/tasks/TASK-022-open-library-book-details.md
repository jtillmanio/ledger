---
id: TASK-022
title: 1.14 Open Library details for the workbook's books
status: In progress
depends_on: [TASK-021]
size: M
model: opus
autonomy: attended
ui: false
plan_status: approved
planned_at_commit: 6b1ccfe
---

# TASK-022 — 1.14 Open Library details for the workbook's books

## Goal

The workbook's books arrive at cutover with covers, page counts and Open Library ids where Open Library can match them for certain. Near misses are left for the owner to confirm, not guessed.

## Context

- Roadmap: `docs/05-roadmap.md` § 1.14 Open Library details for the workbook's books (sitting 8, after 1.13). The Open Library half of 4.2, moved before cutover by D-44, the way 0.6 and 0.7 moved Metron. The roadmap entry and its **Check:** are the contract.
- Pattern to copy: `etl/enrich_comics.py` and `etl/test_enrich_comics.py`: `--dry-run`, a resumable SQLite cache, pacing, recorded responses in tests, no network in `npm run test:etl`.
- What's new:
  - `etl/enrich_books.py` with `npm run enrich:books`, a cache at `etl/.openlibrary-cache.sqlite` (gitignored, and added to `.claude/rules/git.md`'s never-commit list), Open Library's courtesy rate, and a real `User-Agent` naming the app (architecture § Metadata sources).
  - Matching by title and author: matched only when exactly one work has both after `clean()` / `key()`. A near spelling by the same author (≥ 0.4) is appended to TASK-021's `book_review.csv` as `kind = book`, `reason = open library`, never matched. Everything else is listed as unmatched with its candidates.
  - `etl/data/book_details.csv`, keyed by title and author: `open_library_id` (the work key), `page_count` (`number_of_pages_median`), `cover_url`, `published_year`, and `source` (`openlibrary` | `hand`). A `hand` row is never overwritten. Extract folds it into `books`, and `published_year` fills only where the workbook has none.
  - No word count is stored from pages (2.1 estimates it). There are no ISBNs, because `books` has no column for one. Covers are URLs only (4.3 decides on caching).
- Data model: `src/db/schema.ts` `books` (`open_library_id`, `page_count`, `cover_url`, `published_year`), unchanged.
- Decisions: D-44, D-25a, D-51 (Open Library for books), D-41. `.claude/rules/schema.md`: enrichment never overwrites a hand value. Standing rule 4 applies to extract's fold-in.
- *From TASK-021 (1.13, PR #97):* the Stephen King tab's *11/22/63* is stored as a date, so extract loads its title as `1963-11-22 00:00:00` (it did before 1.13 too). Matching on title and author will never find it on Open Library; extract should read a date-typed title cell back as the title the owner typed, or the owner fixes the cell.
- *From the 2026-10-20 backlog intake (1.18, D-73):* 1.18 reuses this task's Open Library cache to check Calibre's series and ISBN against Open Library. Nothing in this task's scope changes, but cache each whole response rather than trimming it to the four columns stored here, so 1.18 needs no second request per book.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): a dry run over 100 books reports the match rate and writes nothing. `npm run test:etl`, with recorded responses and no network, covers: an exact match fills `page_count`, `cover_url` and `open_library_id`; a `hand` row survives a rerun; a near spelling writes a review row and no details; two candidate works match nothing; an accepted rename rekeys the details row; a workbook `published_year` is not replaced. Then a real run over the catalog with the cache warm. The PR reports how many were matched, proposed and unmatched, and `npm run rebuild` (development) loads the details.
- [ ] AC-2: A second run with the cache warm makes zero network requests for books already looked up (the test counts requests against a stub). An interrupted run resumes from the cache without repeating completed lookups. Every request carries the `User-Agent` naming the app.
- [ ] AC-3: Extract folds `book_details.csv` into `seed/books.csv` without changing any other output: re-running against both workbooks shows only the new columns' values filled (standing rule 4, with the diff summary in the PR). No `word_count` is written from `page_count`.
- [ ] AC-4: `etl/.openlibrary-cache.sqlite` is gitignored (`git check-ignore` confirms it) and named in `.claude/rules/git.md`'s never-commit list. `npm run enrich:books` and its `--dry-run` are in `CLAUDE.md`'s command list, and `.claude/kit.json` `largeFiles` gains a hint for the cache.

## Out of scope

- Hardcover, series position and the cover art tone (4.2, 4.3).
- The after-cutover Open Library backfill (4.2) and live search in the add flow (1.4c).
- ISBNs and word counts.
- Applying a merge. The owner decides in `book_review.csv`, and TASK-021's extract applies it.

## Files likely touched

- `etl/enrich_books.py` (new), `etl/test_enrich_books.py` (new) with recorded responses.
- `etl/extract.py`, `etl/test_extract.py`: fold in `book_details.csv`.
- `etl/data/book_details.csv` (new sidecar).
- `package.json`: `enrich:books`. `.gitignore`: the cache.
- `.claude/rules/git.md`, `CLAUDE.md`, `.claude/kit.json`: the cache in never-commit, the command, the large-file hint.

## Verification

- Automated: `npm run test:etl` covers the six cases in AC-1 and the cache and `User-Agent` cases in AC-2, with no network.
- Manual: `npm run enrich:books -- --dry-run` over 100 books → expected: a match rate and no files written. A real run, then `npm run extract` and `npm run rebuild` on the development database → expected: books with covers and page counts, and the report's matched, proposed and unmatched counts quoted in the PR.

## Follow-ups

_None yet._

## Plan

Approved 2026-10-25 at the plan gate, with the owner's change to 11/22/63 (step 3).

Findings that shape it: extract rebuilds `book_review.csv` each run and drops
undecided rows it did not propose, so an `open library` proposal would vanish;
Open Library's default search response has no `number_of_pages_median` and no
ISBN, so the request asks for `fields=*` (the whole record, cached for 1.18);
`load.ps1` / `load.sh` copy only today's `books` columns.

**Steps**

1. `etl/enrich_books.py` (new), modelled on `enrich_comics.py`. Reads
   `seed/books.csv` + `seed/authors.csv`; one `search.json?title=&author=&limit=10&fields=*`
   per book with an author (an authorless book is not looked up). SQLite cache
   `etl/.openlibrary-cache.sqlite` keyed by URL, 1 s between requests,
   `User-Agent: ledger-backfill/1.0 (personal media ledger; book metadata; https://github.com/jtillmanio/ledger)`,
   `--max-requests`, `--offline`, `--limit`, `--dry-run` (default 100 books,
   writes no CSV). Outcomes: **matched** = exactly one returned work whose
   `key(clean(title))` and one `key(clean(author_name))` equal the book's;
   **ambiguous** = two or more; **proposed** = no exact work, the top result is by
   the same author at trigram similarity ≥ 0.4 and the titles don't differ only by
   a number: appended once to `book_review.csv` (`kind = book`,
   `reason = open library`, `b_tabs = Open Library`, `keep` pre-filled with Open
   Library's spelling, `decision` blank), no details; **unmatched** = the rest,
   printed with candidates. `book_details.csv` (title, author, open_library_id,
   page_count, cover_url, published_year, source): a `hand` row is never looked
   up or overwritten; a failed lookup never erases a row. Before looking up,
   every row is rekeyed through extract's `BookIndex(review).book_identity` so an
   accepted merge or rename moves it (hand wins a collision). Report: counts,
   match rate, requests vs cache hits.
2. `etl/extract.py`: `--book-details`; after `finish()` fill `open_library_id`,
   `page_count`, `cover_url` on the book with that (title, author) key, and
   `published_year` only where the workbook has none; never `word_count` from
   pages. A details row matching no book → `unresolved.csv` (`book_details`,
   `no such book`). `review_book_pairs` keeps undecided `open library` rows while
   their workbook side is still seen, and checks only that side for `stale review`.
3. (Owner, plan gate) Extract reads every book title cell as text: a cell Excel
   stored as a date comes back as typed (`m/d/yy`, Excel's US short date, so
   *11/22/63*), an integral number without `.0`. Applied to the master list, author
   tabs, To-Read tabs, Read tabs, Top Books, Coming Out, the wishlist and the
   Booktube lists. Expected AC-3 exception: that book's title and id change.
4. `etl/load.ps1`, `etl/load.sh`: copy `page_count, cover_url, open_library_id`.
   `package.json`: `enrich:books`; `extract` passes `--book-details`.
5. `.gitignore`, `.claude/rules/git.md` never-commit list, `CLAUDE.md` +
   `docs/COMMANDS.md` commands, `.claude/kit.json` `largeFiles` hint,
   `.claude/rules/schema.md` (book_details sidecar, open library review rows).
6. Real run: dry run over 100; full run in the background; warm rerun must show 0
   requests; extract on `main` and on the branch into temp dirs and diff every
   CSV (AC-3); `npm run rebuild` on development (owner approved at the gate).

**Files**: new `etl/enrich_books.py`, `etl/test_enrich_books.py`,
`etl/data/book_details.csv`; changed `etl/extract.py`, `etl/test_extract.py`,
`etl/load.ps1`*, `etl/load.sh`*, `etl/data/book_review.csv`* (proposals the run
appends), `package.json`, `.gitignore`, `.claude/rules/git.md`, `CLAUDE.md`,
`.claude/kit.json`, `docs/COMMANDS.md`*, `.claude/rules/schema.md`*
(* not in Files likely touched). 15 files; `splitPolicy` is `never-split`, so it
stays whole and attended.

**Test strategy**

- AC-1 (`etl/test_enrich_books.py`, recorded responses, no network):
  `test_exact_match_fills_page_count_cover_and_id`, `test_hand_row_survives_a_rerun`,
  `test_near_spelling_writes_a_review_row_and_no_details`,
  `test_two_candidate_works_match_nothing`, `test_accepted_rename_rekeys_the_details_row`,
  `test_dry_run_reports_match_rate_and_writes_nothing`. (`etl/test_extract.py`
  `BookDetails`): `test_workbook_published_year_is_not_replaced`,
  `test_details_fold_into_books`, `test_open_library_row_survives_extract`,
  `test_accepted_open_library_row_renames_the_book_and_details_follow`.
  Manual: the dry run, the real run, rebuild, counts quoted in the PR.
- AC-2: `test_warm_cache_makes_no_requests`, `test_interrupted_run_resumes_from_the_cache`,
  `test_every_request_carries_the_user_agent` (stubbed at `urlopen`).
- AC-3: `test_no_word_count_from_page_count`, plus
  `test_date_typed_title_reads_as_typed` (step 3); manual CSV diff main vs branch.
- AC-4: manual `git check-ignore etl/.openlibrary-cache.sqlite`; grep CLAUDE.md,
  git.md, kit.json.

**Revisions after approval**

1. (Found in the dry run) Open Library's `author=` search finds nothing for
   `S.A. Chakraborty` and the work for `S. A. Chakraborty`, so the query spaces
   initials; matching still compares `key()`s. Test:
   `test_initials_are_spaced_in_the_query_and_still_match`.
2. (Found in the real run) The report crashed on a title a redirected cp1252
   console can't print (U+02BB) before any CSV was written; stdout now replaces
   what it can't encode. Test: `test_a_title_the_console_cannot_print_does_not_stop_the_run`.
3. (Owner, 2026-10-25, after the AC-3 diff) Each To-Read genre column ends in
   a count of its titles and then a series and author summary: extract loaded the
   count `10`, and 18 summary names, as books. A column now stops at a number
   equal to the titles above it (a title stored as a number, *1984*, is not the
   count). Test: `test_a_to_read_column_stops_at_its_count_row`. Books 1,380 →
   1,361, so the count in `CLAUDE.md` and `docs/HANDOFF.md` is corrected.

**Risks**: Open Library returns at most 10 works per search, so a title with more
same-author works than that could miss its exact work (reported as unmatched,
never guessed). A 1,381-request run takes ~25 min at 1 req/s.

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
