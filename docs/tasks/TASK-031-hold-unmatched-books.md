---
id: TASK-031
title: 1.20 Hold books with no Hardcover match for review
status: In progress
depends_on: [TASK-034]
size: M
model: opus
autonomy: attended
ui: false
plan_status: approved
planned_at_commit: 7ab6236
---

# TASK-031 — 1.20 Hold books with no Hardcover match for review

## Goal

A book Open Library has never heard of doesn't reach the Ledger until the owner has looked at it. Extract holds it back and lists it for review, and the books the owner keeps load on the next extract with everything that belongs to them.

## Context

- Roadmap: `docs/05-roadmap.md` § 1.20 Hold books with no Open Library match for review (sitting 8, last: 1.13 → 1.14 → 1.15 → 1.21 → 1.18 → 1.20). It depends only on 1.14, but it is built after 1.18 so that it can say how Calibre's books count. The roadmap entry and its **Check:** are the contract. The roadmap marks the Check as **proposed** (owner, 2026-10-26).
- *From fix/skip-placeholder-books (owner, 2026-10-26):* the owner doesn't want a book loaded that Open Library has never heard of until they have looked at it. On 2026-10-26, 804 of the 1,352 books extract loads had no `book_details.csv` row (678 of them on the to-read lists, 126 only on the author tabs or Coming Out). Re-count from a fresh extract.
- Pattern to copy: `book_review.csv` (TASK-021, `etl/extract.py` `review_book_pairs` / `write_book_review`): a committed sidecar that extract rewrites each run, keeping every decided row, with only the decision changing what loads. Placeholder titles (`workbook_placeholders.csv`, `PLACEHOLDER_RE`) are already skipped before this step.
- What "a match" means today: a row in `etl/data/book_details.csv` (TASK-022), keyed by title and author, `source` `openlibrary` or `hand`, folded in by `fold_book_details`.
- What a held book takes with it: its `book_status` row, its `reading_plan` rows (only with `--with-plan`, D-13), its `releases` row (Coming Out), and its universe (`books.universe_id`, TASK-023). `external_lists` and `wishlist` also carry a `book_id` (`etl/load.ps1`). After the hold, no seed CSV may name a held book's id, or the load's foreign keys fail.
- Data model: `.claude/rules/schema.md` (a book is its title and author; `book_details.csv`; placeholders), `docs/03-data-model.md` § 2. Decisions 2.7.
- For the plan gate (from the roadmap):
  - What is a held to-read book in the meantime? The roadmap proposes out of Someday until kept.
  - Does a `hand` row in `book_details.csv` count as a match?
  - How do 1.18's Calibre matches count, and does the hold apply to a Calibre-created Unlisted book? TASK-030 proposes no.
  - The review file's name and columns. The roadmap gives title, author, tabs, the Open Library search tried and `decision`.
- *From TASK-030 (1.18, PR #150):* the owner answered at TASK-030's plan gate that 1.20's hold does **not** apply to a book Calibre created: having it in Calibre is the owner's say-so, so it loads at Unlisted whether Open Library knows it or not. Calibre-created books are listed in `seed/calibre_created.csv`. TASK-030 suggests, for this task's plan gate (proposed): a workbook book Calibre matched (its row is in `etl/data/calibre_books.csv`) counts like a `book_details.csv` match for the hold, since D-87 makes Calibre the source of truth for its data.
- Decisions: D-44 (Open Library before cutover), D-68 (extract applies review decisions before the load), D-82 (titles read as typed), D-83. Standing rule 4 applies.
- *From docs/hardcover-replaces-open-library (D-94, owner, 2026-10-28):* Hardcover replaces Open Library. This task now follows 1.14b, which rewrites `book_details.csv` from Hardcover (by Calibre's ISBN, then title and author) with `source = hardcover`. Read *Open Library* in this file as Hardcover: a match is a `book_details.csv` row from Hardcover (or `hand`), and the review file lists the Hardcover lookup tried (the ISBN, or the search). The roadmap entry carries the same amendment.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): `npm run test:etl`: a fixture book with no `book_details.csv` row is not in `books.csv` and is listed in the review file with an empty decision, and none of its status, plan or release rows load; `decision = keep` loads it on the next extract with its status; a book with a `book_details.csv` row loads unchanged; extract prints how many books are held.
- [ ] AC-2: After an extract that holds a book, no file in `seed/` names the held book's id: `books`, `book_status`, `reading_plan` (with `--with-plan`), `releases`, `external_lists`, `wishlist`, and any other CSV with a `book_id` column. The plan settles whether an `external_lists` or `wishlist` row keeps its line with a null `book_id` or waits too.
- [ ] AC-3: The review file keeps every decided row across runs, as `book_review.csv` does. An undecided row is rebuilt each run, so a book that has since gained a `book_details.csv` row drops off the list and loads. Each row names the title, author, the tabs it was seen on and the Open Library search it tried.
- [ ] AC-4: Each plan-gate answer has a test with its own fixture: a book whose only details row is `hand`; a book Calibre matched (TASK-030); a Calibre-created Unlisted book; and a held to-read book, which appears in no `to_read_level` row after the load.
- [ ] AC-5: Re-running extract against both workbooks on `main` and on the branch, the CSV diff shows only held books and their dependent rows leaving `seed/`, and their count equals the number extract prints (standing rule 4, summary in the PR). The review file is a committed sidecar in `etl/data/`, passed by `npm run extract`, and `.claude/rules/schema.md` states the hold rule.

## Out of scope

- Looking held books up on Open Library. A book gains a `book_details.csv` row through `npm run enrich:books` (1.14), not through this task.
- A screen for the review. It is a CSV, like `book_review.csv`.
- Deciding the held books. That is the owner's, and it goes in the Owner checklist at close-out.
- Books added in the app (1.4c). The hold is extract's, before cutover.
- Placeholder titles, which are already skipped.

## Files likely touched

- `etl/extract.py`: the hold, the review file, and dependent rows held with their book.
- `etl/test_extract.py`: AC-1 to AC-4.
- `etl/data/<hold review>.csv` (new sidecar; name settled at the plan gate).
- `package.json`: `extract` passes the review file.
- `.claude/rules/schema.md`: the hold rule. `docs/COMMANDS.md` if extract's arguments are listed there.
- `etl/check_sidecars.py` if `npm run sidecars` should validate the new file.

## Verification

- Automated: `npm run test:etl` covers AC-1's four cases, AC-2's no-dangling-id check over every seed CSV, AC-3's rebuild and keep cases, and AC-4's fixtures, with no network.
- Manual: `npm run extract` on `main` and on the branch into temp folders, then a CSV diff → expected: only held books and their rows gone, and the held count quoted in the PR. Mark one review row `keep` and re-extract → expected: that book and its status are back in `seed/`.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

## Plan

Plan-gate answers (owner, 2026-10-30): a match is a `hardcover` or `hand` row in `book_details.csv` or a Calibre id (1.14's `openlibrary` rows don't count, D-94); a Calibre-created book is never held (TASK-030); the review file is `etl/data/book_hold.csv`; enrich:books and calibre read the held list so a held book is still looked up and matched; AC-4's held to-read book is proven on the seed rows `to_read_level` reads (`books`, `book_status`, `reading_plan`), not by a database load.

### Steps

1. **The hold** (`etl/extract.py`, `hold_books`): after `fold_calibre` and `fold_book_details`, a workbook book with no `hardcover`/`hand` details row, no Calibre id and no `keep` row in `book_hold.csv` is held. Calibre-created books never are. Extract prints `N books held, awaiting review`.
2. **What waits with it**: its `books`, `book_status`, `reading_plan`, `releases`, `read_events` and `book_genres` rows are not written. An author or series that only held books use waits too, unless a follow names it (an author also stays while a series that stays names them). `wishlist` and `external_lists` keep their lines: extract never sets their `book_id`, so nothing points at a book.
3. **The review file** `etl/data/book_hold.csv` (`title, author, tabs, lookup, decision`; `--book-hold`): `decision` is `keep` or blank (anything else is reported and counts as blank); `lookup` is what enrich tries, `title search: "<title> <author>"` or `not looked up: no author`. Decided rows stay for good (a book gone from the workbook is reported `stale`); undecided rows are rebuilt each run, so a book that gains a details row drops off and loads. Rows are keyed by the book's identity after merges.
4. **The held list** `seed/held_books.csv` (`title, author, series`; not loaded): `enrich_books.read_books` reads it beside `seed/books.csv`, so a held book is still searched; `calibre.Seed` reads it as workbook books, so a held book later added to Calibre under a near spelling is a `calibre` pair, not a duplicate Unlisted book.
5. **No double listing**: `calibre_missing.csv` leaves held books out, as it leaves a book waiting on a `calibre` pair.
6. **Wiring and docs**: `package.json` `extract` and `etl/rebuild.sh` pass `--book-hold etl/data/book_hold.csv`; `.claude/rules/schema.md` states the hold rule; `docs/COMMANDS.md` gets the argument in the command list and, in § Refreshing the data (PR #166's runbook; owner, 2026-10-30: update it in this task), Books steps 12–14 say what the hold writes and when a held book comes back (after enrich:books finds it, or on `keep`), "Review" names `book_hold.csv`, and the review table gets a `book_hold.csv` row. The rest of #166 needs no edit: START-HERE only links to the runbook, SERVICES names no extract file, and the Owner checklist items it touched (the 1.14b real run, the 181 `calibre_missing.csv` rows, which the hold shrinks) are updated at close-out as follow-up placements.

### Files

- `etl/extract.py`: the hold, `book_hold.csv`, `seed/held_books.csv`, dependent rows, calibre_missing exclusion.
- `etl/test_extract.py`: AC-1 to AC-4 (`BookHold`).
- `etl/enrich_books.py` + `etl/test_enrich_books.py` (**not in Files likely touched**): read `seed/held_books.csv`.
- `etl/calibre.py` + `etl/test_calibre.py` (**not in Files likely touched**): `Seed` reads `seed/held_books.csv`.
- `etl/data/book_hold.csv` (new sidecar, from the real extract).
- `package.json`, `etl/rebuild.sh`, `test/load-scripts.test.ts`: `--book-hold`.
- `.claude/rules/schema.md`, `docs/COMMANDS.md`: the rule and the argument.

12 files, over the size check; `splitPolicy` is `never-split`, so the task stays whole and attended: steps 4 and 5 exist only because the hold would otherwise strand a held book outside enrich and calibre.

### Test strategy

- AC-1: `BookHold.test_a_book_with_no_details_row_is_held_and_listed_undecided` (not in `books.csv`, a blank-decision row, no status, plan or release row), `test_keep_loads_it_on_the_next_extract_with_its_status`, `test_a_book_with_a_hardcover_row_loads_unchanged`, `test_extract_prints_how_many_are_held`.
- AC-2: `test_no_seed_csv_names_a_held_book` (every seed CSV with a `book_id` column, `--with-plan` on; `wishlist`/`external_lists` keep their lines), plus `test_an_author_and_series_only_held_books_use_wait_unless_followed`.
- AC-3: `test_a_decision_survives_a_second_extract`, `test_an_undecided_book_that_gains_a_details_row_drops_off_and_loads`, `test_each_row_names_title_author_tabs_and_lookup`, `test_a_kept_book_gone_from_the_workbook_stays_and_is_reported_stale`.
- AC-4: `test_a_hand_row_is_a_match`, `test_a_book_calibre_matched_is_not_held`, `test_a_calibre_created_book_is_not_held`, `test_a_held_to_read_book_has_no_status_or_plan_row` (no `to_read_level` row can exist); `test_calibre_missing_leaves_held_books_out`.
- Step 4: `test_enrich_books.py` `test_held_books_are_looked_up`; `test_calibre.py` `test_a_held_book_is_matched_as_a_workbook_book`.
- AC-5 / wiring: `test/load-scripts.test.ts` (`npm run extract` and `rebuild.sh` pass `--book-hold`); `rebuild-extract-args.test.ts` already pins rebuild.sh to package.json. Manual: extract on `main` and on the branch into temp folders, CSV diff, held count in the PR; one `keep` and re-extract.

### Risks

- Before the full `enrich:books` run, about 150–180 books are held (181 workbook books lack a Calibre id; 33 have only an `openlibrary` row). The real `book_hold.csv` is committed as extract writes it.
- `report_universes` must skip held books, and the universe/series clean-ups must count only loaded books.

### Follow-ups

- The owner decides the held books in `book_hold.csv` → `docs/OWNER-CHECKLIST.md` (approved at plan).
- The Owner checklist's 1.14b real-run item names `book_hold.csv` among what to review after the last extract, and its 181-row `calibre_missing.csv` item notes that held books moved to `book_hold.csv` → `docs/OWNER-CHECKLIST.md` § Actions from follow-ups (approved at plan).
- Candidate decision: what counts as a match for the hold (Hardcover, `hand` or a Calibre id; Calibre-created exempt; `openlibrary` no) → `docs/review/decisions.md`, proposed at close-out (approved at plan).

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
