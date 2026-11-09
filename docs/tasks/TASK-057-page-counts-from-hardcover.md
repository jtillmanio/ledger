---
id: TASK-057
title: 1.14c Page counts from Hardcover, word counts from Calibre
status: Draft
depends_on: [TASK-034]
size: M
model: opus
autonomy: attended
ui: false
plan_status: none
planned_at_commit:
---

# TASK-057 — 1.14c Page counts from Hardcover, word counts from Calibre

## Goal

A book's page count is Hardcover's print count, not Calibre's inflated ebook estimate, so a book with no word count gets an honest estimate. Word counts stay Calibre's.

## Context

- Roadmap: `docs/05-roadmap.md` § 1.14c Page counts from Hardcover, word counts from Calibre (M9; owner, 2026-11-08, D-130; amends 1.14b and 1.18b). The entry and its **Check:** are the contract; the Check is marked *proposed; the owner agrees it by merging or edits it first*. **Before 1.26:** it is in 1.26's **Depends on**, and M9's proposed order for the pulled-ahead entries is 1.14c → 1.17b → 5.17 → 4.4 → 1.29 → 1.26. Feature F-19. Depends on 1.14b (TASK-034).
- **Today, Calibre comes first.** `etl/extract.py` sets `b["page_count"] = b.get("calibre_pages") or as_int(row["page_count"])` (around line 1584, under the comment *Calibre's #pages, which fold_calibre() kept, replaces the sidecar's*). `etl/enrich_books.py` writes one `page_count` per book: the matched edition's pages, else the book's (`edition.get("pages") or book.get("pages")`, around line 142). Add books (1.4f, TASK-040) does the same in `src/lib/hardcover.ts`: `pages: whole(e.pages) ?? whole(b.pages)`.
- **The new order (D-130):** a `hand` row; else Hardcover's book-level count (its default edition, usually print); else the matched edition's; else Calibre's `#pages`. Calibre's ISBN is often an ebook edition's, which is why the book-level count comes before the edition's.
- **Word counts don't change.** Calibre's `stated` count wins (D-87), and an estimate still comes only from a page count of 50 or more. The entry calls that estimate `book_words`; in `etl/views.sql` it is `plan_book_words` (`WHEN b.page_count >= 50 THEN 'estimated'`, `page_count * COALESCE(rs.words_per_page, 275)`).
- **The sidecar keeps both counts**, each in its own column of `etl/data/book_details.csv` (names are the plan's). Where `etl/.hardcover-cache.sqlite` already holds the answer it is reused; the plan says what a re-fetch of the rest costs against Hardcover's 5,000 requests a day (D-94).
- **No schema change.** `books.page_count` stays one column; both Hardcover counts live in the sidecar. If the plan finds it needs a column, stop and ask (CLAUDE.md).
- 4.4's Calibre sync (D-133) applies the same order to a book Calibre creates, when 4.4 is built. Not this task.
- The PR reports the real dry run: how many books' page counts changed, and how many estimated word counts moved with them.
- The same PR rewrites `.claude/rules/schema.md`'s *Calibre owns a book's groupings, its page count and its id* (around line 112) to this order.
- Architecture: `docs/02-architecture.md` § 10. Metadata sources → Books, and → Word counts — the honest answer. Data model: `docs/03-data-model.md` § 2. Decisions, 2.19 (Calibre is a metadata source).
- Decisions: D-130, D-90, D-87, D-94.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): `npm run test:etl`, with recorded Hardcover answers: a fixture book with a
Hardcover book-level count, a different edition count and a Calibre `#pages`
loads the book-level count; one with only an edition count loads that; one
Hardcover gives none loads `#pages`; a `hand` row is unchanged; every word
count is still Calibre's; an `--offline` re-run leaves every sidecar
byte-identical. `etl/test_views.sql`: a book with no word count estimates from
the loaded page count. A vitest test: a book added from a Hardcover result
stores the book-level count. Then a dry run over the real books, with the
counts in the PR.
- [ ] AC-2: Given a recorded Hardcover answer whose book has 320 pages and whose matched edition has 410, `enrich_books.py` writes a `book_details.csv` row carrying 320 and 410 in their two columns; given an answer with no matched edition, the edition column is empty and the book-level column is filled.
- [ ] AC-3: Given a book with no Calibre word count, Calibre `#pages` 600 and a Hardcover book-level count of 320, the loaded `page_count` is 320 and `plan_book_words` gives `320 × words_per_page` with `word_source = 'estimated'`; given a Hardcover count of 40, no estimate is made. A book with a Calibre `stated` count keeps it whatever its page count.
- [ ] AC-4: Adding a book from a Hardcover result whose book has 320 pages and whose edition has 410 stores `page_count = 320`; one whose book has none and whose edition has 410 stores 410.
- [ ] AC-5: `.claude/rules/schema.md` states the order *hand → Hardcover's book-level count → the matched edition's → Calibre's `#pages`*, and the PR body gives the dry run's two counts (page counts changed, estimated word counts moved).

## Out of scope

- 4.4's Calibre sync, which applies this order when it is built.
- Any change to word counts, `stated` precedence or the 50-page floor for an estimate.
- A schema column for either count.
- Removing Open Library's paths (6.19).
- Running enrichment or a load against production.

## Files likely touched

- `etl/enrich_books.py` — both counts into `book_details.csv`; the search mapping.
- `etl/extract.py` — the page-count order when building `books.csv`.
- `src/lib/hardcover.ts` — Add books maps the book-level count first.
- `.claude/rules/schema.md` — the rule's new order.
- `etl/test_enrich_books.py`, `etl/test_extract.py`, `etl/test_views.sql`, `test/hardcover-search.test.ts` (or `test/add-book.test.ts`), `test/fixtures/hardcover-*.json` — recorded answers with both counts.

## Verification

- Automated: `npm run test:etl` (AC-1's fixture cases, AC-2, the `--offline` byte-identical re-run); `npm run test:views` (`etl/test_views.sql`, AC-3); `test/hardcover-search.test.ts` or `test/add-book.test.ts` (AC-4).
- Manual: `npm run enrich:books -- --dry-run`, then `npm run extract` → expected: the run reports how many page counts changed; the PR quotes both counts. Spot-check a book whose Calibre `#pages` was far above print → its `page_count` is now Hardcover's.

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
