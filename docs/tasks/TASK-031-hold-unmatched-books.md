---
id: TASK-031
title: 1.20 Hold books with no Open Library match for review
status: Draft
depends_on: [TASK-022]
size: M
model: opus
autonomy: attended
ui: false
plan_status: none
planned_at_commit:
---

# TASK-031 — 1.20 Hold books with no Open Library match for review

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
