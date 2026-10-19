---
id: TASK-022
title: 1.14 Open Library details for the workbook's books
status: Ready
depends_on: [TASK-021]
size: M
model: opus
autonomy: attended
ui: false
plan_status: none
planned_at_commit:
---

# TASK-022 — 1.14 Open Library details for the workbook's books

## Goal

The workbook's books arrive at cutover with covers, page counts and Open Library ids where Open Library can match them for certain. Near misses are left for the owner to confirm, not guessed.

## Context

- Roadmap: `docs/TASKS.md` § 1.14 Open Library details for the workbook's books (sitting 8, after 1.13). The Open Library half of 4.2, moved before cutover by D-44, the way 0.6 and 0.7 moved Metron. The roadmap entry and its **Check:** are the contract.
- Pattern to copy: `etl/enrich_comics.py` and `etl/test_enrich_comics.py`: `--dry-run`, a resumable SQLite cache, pacing, recorded responses in tests, no network in `npm run test:etl`.
- What's new:
  - `etl/enrich_books.py` with `npm run enrich:books`, a cache at `etl/.openlibrary-cache.sqlite` (gitignored, and added to `.claude/rules/git.md`'s never-commit list), Open Library's courtesy rate, and a real `User-Agent` naming the app (FEATURES Part 4).
  - Matching by title and author: matched only when exactly one work has both after `clean()` / `key()`. A near spelling by the same author (≥ 0.4) is appended to TASK-021's `book_review.csv` as `kind = book`, `reason = open library`, never matched. Everything else is listed as unmatched with its candidates.
  - `etl/data/book_details.csv`, keyed by title and author: `open_library_id` (the work key), `page_count` (`number_of_pages_median`), `cover_url`, `published_year`, and `source` (`openlibrary` | `hand`). A `hand` row is never overwritten. Extract folds it into `books`, and `published_year` fills only where the workbook has none.
  - No word count is stored from pages (2.1 estimates it). There are no ISBNs, because `books` has no column for one. Covers are URLs only (4.3 decides on caching).
- Data model: `src/db/schema.ts` `books` (`open_library_id`, `page_count`, `cover_url`, `published_year`), unchanged.
- Decisions: D-44, D-25a, D-51 (Open Library for books), D-41. `.claude/rules/schema.md`: enrichment never overwrites a hand value. Standing rule 4 applies to extract's fold-in.
- *From TASK-021 (1.13, task/1.13-book-extract-merge-review):* the Stephen King tab's *11/22/63* is stored as a date, so extract loads its title as `1963-11-22 00:00:00` (it did before 1.13 too). Matching on title and author will never find it on Open Library; extract should read a date-typed title cell back as the title the owner typed, or the owner fixes the cell.

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
