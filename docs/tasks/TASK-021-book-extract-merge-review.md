---
id: TASK-021
title: 1.13 Book extract — one book per title and author, a merge review, no workbook reads
status: Review
depends_on: []
size: M
model: opus
autonomy: attended
ui: false
plan_status: approved
planned_at_commit: 503da4e
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
- *From TASK-007 (1.4, PR #76):* extract's book id rule (`slug(title, author)[:100]`, `-x` while taken) now has an app twin, `bookId()` in `src/lib/issue-slug.ts`, held to one answer by `test/fixtures/book-ids.json` (vitest and `etl/test_extract.py`, D-61). A change to the rule here changes both, and adds a case there. The app matches a pasted book on title and author among live books and never revives a removed one, so a merged-away duplicate stays merged.
- *From TASK-007 (1.4, PR #76), open question for the plan:* Add books' confirm (`addBooks()`) checks a book it reuses is live under the advisory lock `hashtext('ledger:add-books')`. A merge that soft-deletes a book in the app (rather than through extract and a reload) should take the same lock, or a paste confirming at that moment can give the removed book a `to_read` row.
- *From TASK-011 (1.7, PR #93):* 1.13 rewrites the same `--with-plan` block in `extract_books` that 1.7 moves to `period` / `ordinal`. Whichever lands second keeps the other's change: if 1.7 is in, the year tabs found by name write `period` (`str(year)`, blank ordinal), not `planned_year`. Both approved plans name this; it is not a stale-plan note.

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim): `npm run test:etl` covers a fixture workbook in which: two books share a title under different authors and load as two rows, with one `same title` review row; an authorless To-Read sighting joins its one authored match; a one-letter typo by the same author is proposed and not merged, and after `decision = merge` it loads as one book under the `keep` spelling with its status; `Vol 1` / `Vol 2` is not proposed; a decision survives a second extract; a Read tab with a count row and a summary block, a Top Books tab and a `Completed` tick create no book and no `read` row, and `workbook_reads.csv` lists the title block and nothing below the count row; the King tab's word count loads; a `Read 2031` tab is discovered. Then re-run against both workbooks and diff `seed/` (standing rule 4). The PR reports the counts of books, `book_status` rows and review rows by `kind` and `reason`, and `npm run rebuild` (development) loads with no `read` row in `book_status`.
- [x] AC-2: On `merge`, every reference follows the `keep` spelling: `books.author_id`, `series_id`, `book_status`, `releases` and the Series tab's totals. A fixture merge of two author spellings leaves one `authors` row, with both authors' books pointing at it.
- [x] AC-3: A decided row whose names no longer appear in the workbook stays in `book_review.csv` and is reported as `stale review`. An authorless sighting whose title matches two authored books joins neither and is reported in `unresolved.csv`.
- [x] AC-4: `npm run sidecars` (or the plan's equivalent check) validates `book_review.csv`'s columns and `decision` values (`merge`, `separate`, blank), and rejects a `merge` row with no `keep`.

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

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- Candidate decision, amending D-61: a merge is applied by extract before the load, so the merged-away spelling is never written as a `books` row. Nothing is soft-deleted, and no app-side merge (so no `ledger:add-books` lock) exists; D-61's "1.13's merge review soft-deletes the duplicate it merges away" no longer holds → docs/review/decisions.md § D-68 (approved at plan; written with the plans PR #93)
- If 1.13 lands before 1.7, 1.7's `--with-plan` change starts from the year tabs found by name (`^To-Read \d{4}$`) and the authorless-sighting fold, not `GENRE_TABS["plan"]` → not tracked: 1.7 landed first (PR #96), and this task builds on its `add_plan`
- Files likely touched says `CLAUDE.md` for the command list and sidecar description; the sidecar descriptions live in `.claude/rules/schema.md` and the flags in `docs/COMMANDS.md` (CLAUDE.md's `npm run extract` line stays true) → not tracked: the plan names the real files
- The Stephen King tab's *11/22/63* is a date cell, so its title loads as `1963-11-22 00:00:00` (before 1.13 too); 1.14's title-and-author match will never find it → docs/tasks/TASK-022-open-library-book-details.md § Context
- `authors` and `book_series` are keyed by `slug()` while names compare by `key()`, so two spellings with one key (`J.R.R.` / `JRR`) would load as two rows that are never proposed; none in today's workbook, and 1.15 seeds follows from these names → docs/tasks/TASK-023-follow-series-authors-universes.md § Context
- `BookIndex.taken` keeps the id of an authorless book `finish()` folds away, so a later book whose slug equals it gets `-x` in extract but not in the app's `bookId()` (schema review, minor) → not tracked: needs a title that ends in its own author's name; none in the workbook
- A folded or dropped authorless sighting keeps any `book_series` row it created (schema review, minor) → not tracked: only a `Coming Out` row with a series and no author can do it; none orphaned in the real output
- `npm run sidecars` reports `book_review.csv` problems with exit code 0 (schema review, minor) → not tracked: accepted as is; every sidecar problem it reports exits 0
- Candidate decision, amending D-41: a To-Read tab for 2028 or later is speculative and loads nothing (no book, status or plan row, even with `--with-plan`); its titles go to `seed/workbook_plans.csv`, not loaded; the cutoff is a fixed year → docs/review/decisions.md § D-70 (approved at close-out)
- The 1.13 roadmap prose said `to_read` comes from "the master list and the To-Read year tabs" (not the **Check:** line) → docs/TASKS.md § 1.13 (fixed in this PR)
- `docs/ARCHITECTURE.md` § 2 (the workbook-to-schema table) and `docs/HANDOFF.md` map every `To-Read 20XX` tab to `reading_plan.period` with `--with-plan`; now only tabs before 2028 → docs/OWNER-CHECKLIST.md § Approvals from follow-ups (queued: no answer at close-out)

## Plan

The open question from TASK-007 is answered by follow-up 1: merges happen in extract, so no app code takes the lock (Out of scope: the app).

Steps (all `etl/extract.py` unless named):
1. `--book-review PATH` and `load_book_review()`: `BOOK_REVIEW_COLUMNS = kind, a, b, a_author, b_author, a_tabs, b_tabs, reason, similarity, keep, decision`. A `merge` row builds canonical maps by `key()`: book `(title, author)` → the `keep` side, author → `keep`, series → `keep`. A `merge` with a missing or unknown `keep` is flagged and not applied. `keep` equals `a` or `b`. On a `same title` row the titles are equal, so `keep` names the surviving side's author (`a_author` or `b_author`).
2. `trgm_similarity(a, b)`: a port of pg_trgm `similarity()` as `trigramSimilarity` in `src/lib/bulk-parse.ts` has it (lowercase, non-alphanumerics to spaces, each word padded, shared over all). `differs_only_by_number(a, b)`: equal once digit runs and standalone roman numerals I–XX become `#`, and different before.
3. `BookIndex`: identity is `(key(title), key(author))` after the canonical maps. The id rule is unchanged (`slug(title, author)[:100]`, `-x`), so `test/fixtures/book-ids.json` and D-61 hold with no new case. Every raw sighting is recorded with its tab. An authorless upsert gets a provisional book, and `finish()` folds it: into the one authored book with its `key(title)`, which takes its status and plan rows; nowhere when there is none; and with two or more it is dropped and flagged `authorless title matches several books` (AC-3). `finish()` returns an id remap that status, plan and releases go through.
4. `extract_books`: tabs found by name (`^Read \d{4}$`, `^To-Read \d{4}$`); `GENRE_TABS` goes. Read tabs, Top Books and `Completed` ticks create no book and no status. They go to `seed/workbook_reads.csv` (`title, year, genre, tab, rank`; each Read-tab column read down to its first numeric cell; a `Completed` tick listed with its tab and no year). To-Read year tabs set `to_read` (D-41: the master list plus those tabs). With `--with-plan`, a To-Read year tab records `(id, year, title)` sightings; after `finish()` they go through 1.7's `add_plan` with the remapped id (`period = str(year)`, blank ordinal), so its `duplicate book/period` check runs on the final id. The King tab passes `word_count=r.get("Word Count")`. Series-tab totals look up the canonical series.
5. `review_book_pairs()`: over raw names, never canonical ones. Books: the same `key(title)` under two authors → `same title`; one author, or one side authorless, at ≥ 0.4 → `similar`. Authors and series: any pair at ≥ 0.4 → `similar`. `differs_only_by_number` pairs are skipped. The pair key is the kind plus the unordered `(key(name), key(author))` sides; existing rows keep their decisions and new pairs are added. A decided row whose names aren't seen is kept and flagged `stale review`. It prints `N book pairs await review` and rewrites the file in place.
6. `etl/check_sidecars.py` `check_book_review(path, report)`: the exact columns, `decision` in `merge | separate | blank`, and a `merge` needs a valid `keep`. It runs from `main` before the seed-dependent checks.
7. `package.json` `extract` adds `--book-review etl/data/book_review.csv`. `docs/COMMANDS.md` gets the flag, and the `.claude/rules/schema.md` sidecar bullet gets `book_review.csv`. The PR commits the first `etl/data/book_review.csv` from the real workbook. Tick 1.13 in `docs/TASKS.md`.

8. *Plan revision, owner 2026-10-19 (after review):* a To-Read tab for 2028 or later is speculative and loads nothing: no book, no status, no plan row (`SPECULATIVE_FROM = 2028`, fixed, not relative to today). A title also on the master list still loads from there, with no plan. Those tabs' titles go to `seed/workbook_plans.csv` (`title, year, genre, tab`), which is not loaded. Test: `BookReview.test_a_to_read_tab_from_2028_on_loads_nothing_and_is_listed`; `test_year_tabs_are_found_by_name` shows `To-Read 2025` loading and `To-Read 2031` listed.

Files: `etl/extract.py`, `etl/test_extract.py`, `etl/check_sidecars.py`, `etl/test_check_sidecars.py`, `etl/data/book_review.csv` (new), `package.json`, `docs/COMMANDS.md`, `.claude/rules/schema.md`, `docs/TASKS.md`.

Test strategy (`etl/test_extract.py`, workbooks built in the test with `pd.ExcelWriter` as `BookStatusFinishDate` does; no binary fixture):
- AC-1 → `BookReview`, one test per Check bullet: two *Red Queen*s load as two rows with one `same title` row; an authorless To-Read sighting joins its one match; *The Lightning Theif* / *Thief* is proposed and not merged, then after `merge` is one book under `keep` with its status; `Vol 1` / `Vol 2` isn't proposed; a decision survives a second extract; a Read tab (count row and summary), a Top Books tab and a `Completed` tick give no book and no `read` row, and `workbook_reads.csv` lists the title block and nothing below the count; the King word count loads `stated`; `Read 2031` is discovered. `trgm_similarity` is checked against pg_trgm's values for two pairs.
- AC-2 → `BookReviewMerge`: merging *J.R.R. Tolkein* into *Tolkien* leaves one `authors` row; both books, the series, `book_status`, `releases` and the Series total follow.
- AC-3 → a decided row whose names are gone stays in the file and is flagged `stale review`; an authorless title matching two authored books joins neither and is in `unresolved.csv`.
- AC-4 → `etl/test_check_sidecars.py` `BookReviewFile`: a wrong column, `decision = maybe`, and `merge` with no `keep` are each reported; a valid file isn't.
- With `--with-plan`, an authored and an authorless sighting of one book in the same To-Read tab give one `reading_plan` row and a `duplicate book/period` flag. `ReadingPlanPeriod` (1.7) stays unchanged as the regression guard.
- Updated: `BookStatusFinishDate` now expects Piranesi `to_read` and listed in `workbook_reads.csv`, not `read`.
- Manual (attended): `npm run extract` before and after, then diff `seed/`. The PR reports books, `book_status` and review rows by `kind` and `reason`. Then `npm run rebuild` (development; ask first) and `SELECT count(*) FROM book_status WHERE status = 'read'` = 0.

Risks / open questions:
- An authorless sighting dropped for matching several books loses its `to_read` status until the owner fixes the workbook. It is in `unresolved.csv`; confirm that's acceptable.
- `Completed` ticks in `workbook_reads.csv` (not in D-41's list, but they are reads to enter by hand). Strike at the gate if unwanted.
- Pairing ~1,500 books is O(n²) on trigram sets. Bucketing `similar` books by author keeps it to seconds.
- TASK-011 (1.7) landed first and owns `add_plan`; this task defers its calls until after the authorless fold (re-planned at `503da4e`, owner approved 2026-10-19).

Size check: M, about 9 files, ETL only, no schema or app change, attended.

## Review log

_Filled by /implement-task. One line per round._

Plan stale at preflight (1.7 landed, PR #96) → re-planned at 503da4e, owner approved 2026-10-19 | Verify R1 PASS | Audit R1 PASS | Spec R1 APPROVE (recommended a release-dedupe test: added) | Schema R1 APPROVE (5 MINOR: rule text completed, rest tracked or accepted) | Verify R2 (ETL suite) PASS, 151 | Manual: real-workbook diff and dev `npm run rebuild` done, 0 `read` rows | Plan revision (2028+ To-Read tabs load nothing) → Verify R3 PASS, Audit R2 PASS, Spec R2 CHANGES (D-41 amendment, stale help text and docs) → D-70 approved and recorded, fixed | Manual: dev `npm run rebuild` again, 1148 `to_read`, 0 `read`

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 1 (plus an ETL re-run after the review fix)
- Review rounds: 1
- First-pass AC FAILs: 0
- Plan revisions after approval: 2 (re-plan at 503da4e for 1.7's `add_plan`, before any code; 2028+ To-Read tabs load nothing, owner after review)
