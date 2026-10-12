---
id: TASK-021
title: 1.13 Book extract — one book per title and author, a merge review, no workbook reads
status: Ready
depends_on: []
size: M
model: opus
autonomy: attended
ui: false
plan_status: none
planned_at_commit:
---

# TASK-021 — 1.13 Book extract — one book per title and author, a merge review, no workbook reads

## Goal

The workbook's books load as one row per real book. Two books that share a title stay separate, a misspelling waits for the owner's merge decision, and nothing arrives already marked read.

## Context

- Roadmap: `docs/TASKS.md` § 1.13 (sitting 8, first). It doesn't depend on sittings 3–7 and **can be built earlier**, which gives the owner time to answer the review before Step 14's final load. That is why `depends_on` is empty. The roadmap entry and its **Check:** are the contract.
- The problem (2026-10-08 review): `extract_books` dedupes on title alone, so different books sharing a title merge under the first author seen (*Animal Farm*, *Red Queen*, *The Truth*, two `Untitled`). Misspellings split one book in two (*The Lightning Theif*, *Pet Semetary*, *J.R.R. Tolkein*, *The Dreden Files*). Each Read tab's count row and summary block load as 32 books marked `read`. None of this reached `unresolved.csv`.
- What changes, all in `etl/extract.py`:
  - The same book means the same title and author, compared after `clean()` and `key()`. An authorless sighting joins the one authored book with that title, or is reported when there are several. Ids become `slug(title, author)`.
  - A merge review in `etl/data/book_review.csv` (columns `kind`, `a`, `b`, authors, source tabs, `reason`, `similarity`, `keep`, `decision`), modelled on `label_review.csv`. Extract proposes; the owner decides; extract applies only `merge`, rewrites the file keeping every decision, reports `stale review` rows and prints `N book pairs await review`. Names that differ only by a number are never proposed, and cross-author pairs only on an identical title. An undecided or `separate` pair stays two rows.
  - No read state from the workbook (D-41): the Read tabs, Top Books, `Completed` ticks and To-Read bold load nothing. `book_status.csv` holds only `to_read`. `seed/workbook_reads.csv` lists reads for hand entry and is not loaded.
  - The Stephen King tab's `Word Count` loads as `stated`.
  - Year tabs are found by name (`^Read \d{4}$`, `^To-Read \d{4}$`), not by `GENRE_TABS`' fixed list.
  - `npm run extract` passes `--book-review`.
- Decisions: D-25a (≥ 0.4 similarity; only title plus author is the same book), D-41, D-15 (the parallel for issue labels), D-13. Standing rule 4: re-run against both workbooks and diff `seed/`. The CLAUDE.md AI-label rule's spirit applies: nothing merges without an explicit decision.
- Interacts with TASK-010 (1.5's extract change sees only `to_read` rows, so `finished_on` is blank and `none`).
- *From TASK-007 (1.4, task/1.4-books-bulk-entry):* extract's book id rule (`slug(title, author)[:100]`, `-x` while taken) now has an app twin, `bookId()` in `src/lib/issue-slug.ts`, held to one answer by `test/fixtures/book-ids.json` (vitest and `etl/test_extract.py`, D-61). A change to the rule here changes both, and adds a case there. The app matches a pasted book on title and author among live books and never revives a removed one, so a merged-away duplicate stays merged.
- *From TASK-007 (1.4, task/1.4-books-bulk-entry), open question for the plan:* Add books' confirm (`addBooks()`) checks a book it reuses is live under the advisory lock `hashtext('ledger:add-books')`. A merge that soft-deletes a book in the app (rather than through extract and a reload) should take the same lock, or a paste confirming at that moment can give the removed book a `to_read` row.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): `npm run test:etl` covers a fixture workbook in which: two books share a title under different authors and load as two rows, with one `same title` review row; an authorless To-Read sighting joins its one authored match; a one-letter typo by the same author is proposed and not merged, and after `decision = merge` it loads as one book under the `keep` spelling with its status; `Vol 1` / `Vol 2` is not proposed; a decision survives a second extract; a Read tab with a count row and a summary block, a Top Books tab and a `Completed` tick create no book and no `read` row, and `workbook_reads.csv` lists the title block and nothing below the count row; the King tab's word count loads; a `Read 2031` tab is discovered. Then re-run against both workbooks and diff `seed/` (standing rule 4). The PR reports the counts of books, `book_status` rows and review rows by `kind` and `reason`, and `npm run rebuild` (development) loads with no `read` row in `book_status`.
- [ ] AC-2: On `merge`, every reference follows the `keep` spelling: `books.author_id`, `series_id`, `book_status`, `releases` and the Series tab's totals. A fixture merge of two author spellings leaves one `authors` row, with both authors' books pointing at it.
- [ ] AC-3: A decided row whose names no longer appear in the workbook stays in `book_review.csv` and is reported as `stale review`. An authorless sighting whose title matches two authored books joins neither and is reported in `unresolved.csv`.
- [ ] AC-4: `npm run sidecars` (or the plan's equivalent check) validates `book_review.csv`'s columns and `decision` values (`merge`, `separate`, blank), and rejects a `merge` row with no `keep`.

## Out of scope

- Open Library details (1.14) and follows and universes (1.15).
- Entering the workbook's reads in the app (the owner, through 1.4c and 1.5).
- Any change to the database schema or the app.
- Promoting the `wishlist` lines (1.4d).

## Files likely touched

- `etl/extract.py`: title-plus-author identity, the review proposals and application, no read state, the King word count, year tabs by name, `workbook_reads.csv`.
- `etl/test_extract.py` and a fixture workbook under `etl/` test data.
- `etl/data/book_review.csv` (new sidecar, written by extract).
- `etl/check_sidecars.py`, `etl/test_check_sidecars.py`: validate the new sidecar.
- `package.json`: `npm run extract` passes `--book-review`.
- `CLAUDE.md`: the command list and the sidecar description.

## Verification

- Automated: `npm run test:etl` covers every fixture case in AC-1, plus the reference-following merge, stale review and the ambiguous authorless sighting (AC-1 to AC-3). `etl/test_check_sidecars.py` covers AC-4.
- Manual: `npm run extract` on both workbooks, then diff `seed/` → expected: book counts and review rows reported in the PR, and no `read` rows in `book_status.csv`. `npm run rebuild` on the development database → expected: it loads.

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
