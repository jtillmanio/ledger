---
id: TASK-084
title: 4.2 Open Library and Hardcover backfill
status: In progress
depends_on: [TASK-034, TASK-040, TASK-057]
size: M
model: opus
autonomy: attended
ui: false
plan_status: approved
planned_at_commit: b688fed
---

# TASK-084 — 4.2 Open Library and Hardcover backfill

## Goal

A book that arrives in the Ledger without Hardcover's details (typed by hand, pasted, or added during an outage) gets its page count, cover and Hardcover id filled in later, and nothing the owner typed is ever replaced.

## Context

- Roadmap: `docs/05-roadmap.md` § 4.2 Open Library and Hardcover backfill (M16; no dependency in the tasklist). The entry and its **Check:** are the contract, read with its *Amended 2026-10-28 (D-94)*: **Hardcover replaces Open Library here**, so the backfill fills a book with no `hardcover_id` from Hardcover, by ISBN where one is known, else 1.14b's title-and-author matching, and Open Library is gone (6.19). Feature F-33. Pulled ahead of 1.26 (D-139): built before the switch, so a book added in the app after it is backfilled from the first day; it runs against production from 1.26 on.
- **The shape** is the after-cutover one, like 4.1's: once the database is the source of truth there is no re-extract, so the backfill writes straight into `books`, with the rule that a `hand` value is never replaced (`.claude/rules/schema.md`: *Enrichment scripts never overwrite a hand-entered value*). Page counts follow D-130: Hardcover's book-level count, then the matched edition's, then Calibre's `#pages`. Hardcover's series and position fill nothing over Calibre's (D-87); a disagreement with an existing `series_position` is reported (the Check). The backfill never fills a book from Calibre: that is 4.4's sync (D-83).
- **What exists to reuse.** `src/lib/hardcover.ts` (1.4f's live, server-side client, cached in `hardcover_cache`, D-94) and `etl/enrich_books.py` (1.14b's batch matching by ISBN, a `compilation` never matches, a near spelling proposed, never matched, D-92, D-99; two candidates never ranked, `hardcover_review.csv`'s `pick`). The rate limits are Hardcover's free plan: 60 requests a minute, bursts of 10, 5,000 a day; the token is `HARDCOVER_API_TOKEN`, server-side (`docs/SERVICES.md`).
- **Stop and ask at plan time:**
  - *How it reaches the live database.* From 1.26 nothing local may write production (`LEDGER_LIVE`, D-18; CLAUDE.md). The plan proposes where the backfill runs: in the app (a route inside the gate, or a step of 4.4's sync, TASK-081/082), on a schedule, or another path, and how a dry run is made there.
  - *ISBNs need a column `books` doesn't have* (`books.isbn`); 4.4 (TASK-081) and 3.5 may ask first. Without it the backfill matches by title and author only.
  - *Ambiguous matches.* 1.14's Open Library run left 314 books ambiguous between duplicate works; Hardcover's one record per book should mostly remove that, and D-99 already lists two candidates for the owner's `pick`. The plan rechecks against 1.14b's run (`npm run enrich:books -- --offline`) and asks before reusing or changing the rule.
  - *Book cover art tone* (D-40, FP-D6): `books.art_d` / `art_l`, the same extraction and clamp as 4.3's, is a schema change the owner deferred on 2026-10-05. Ask with 4.3's answer in hand so books and comics match. If deferred again, the Check's second sentence is carried as a follow-up and the PR says so.
- Architecture: `docs/02-architecture.md` § 10. Metadata sources → Books. Data model: `docs/03-data-model.md` § 2. Decisions, 2.15 and 2.19.
- Decisions: D-18, D-40, D-44, D-73, D-83, D-87, D-92, D-94, D-99, D-130, D-139. Hard rules 2 and 5.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): dry run over 100 books; report match rate and conflicts against
existing `series_position`. Once the columns are approved: every book with a
cover has both tone strings or neither, and 4.3's clamp tests cover the
shared extractor.
- [ ] AC-2: A dry run over 100 books with no `hardcover_id`, with recorded Hardcover answers and no network, reports how many matched by ISBN, matched by title and author, were proposed (a near spelling) and matched nothing, lists each match whose series position differs from the stored `series_position`, and writes no row (the database is byte-identical before and after).
- [ ] AC-3: A real run with the same answers fills `hardcover_id`, `page_count` (D-130's order) and `cover_url` for the matched books only; a book whose page count came from a `hand` source keeps it; a book with a Calibre series keeps its series and position; a `compilation` result fills nothing.
- [ ] AC-4: A 429 waits its `Retry-After` and resumes; a run interrupted halfway and started again skips the books already filled; without `HARDCOVER_API_TOKEN` it refuses to run and says why.
- [ ] AC-5: Tests touch `TEST_DATABASE_URL` only, and no test or command in this task names `.env.live` or production.

## Out of scope

- Metron's backfill for issues (4.1).
- Covers in the UI (4.3).
- Removing Open Library's code, cache and column (6.19).
- Filling anything from Calibre (4.4).

## Files likely touched

- `src/lib/hardcover.ts` — batch lookup by ISBN, reusing the client and its cache.
- `src/db/backfill.ts` (new) or `src/db/writes.ts` — the fill, never over a `hand` value, and the report.
- Where it runs (a route under `src/app/api/`, a step of the sync, or a script), as the plan gate settles.
- `test/hardcover-backfill.test.ts` (new), `test/fixtures/hardcover-*.json` — recorded answers.

## Verification

- Automated: `test/hardcover-backfill.test.ts` (AC-2 to AC-5) on `TEST_DATABASE_URL` with recorded answers.
- Manual: a dry run over 100 development books → the PR reports the match rate and the series-position conflicts (the Check's first sentence).

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

## Plan

_Written by /plan-batch or /implement-task Phase 1. Approved by the user (plan_status: approved) before any code is written._

**Owner's answers at the plan gate (2026-11-13):**
- *Where it runs:* `POST /api/books/backfill` inside the passcode gate; `{ dryRun: true }` is the dry run. 4.4's `calibre:sync` calls it after each sync (follow-up). No schedule, no command of its own.
- *ISBNs:* no `books.isbn`. The caller may pass `{ bookId: isbn }` (4.4 fills it from Calibre); otherwise title and author.
- *Page counts:* the backfill fills `page_count`, `cover_url` and `published_year` only where NULL; any existing count is kept (no source column tells a `hand` count from Calibre's estimate).
- *Art tone:* deferred again; the Check's second sentence stays open and goes to TASK-085.
- *Ambiguous:* D-99 unchanged (1.14b's run left no `hardcover_review.csv`): two matches fill nothing, and both are listed in the report.

**Found at planning:** 1.14b's real run hasn't happened: `book_details.csv` holds 98 `hardcover` rows and 2,000 `openlibrary` ones, so 4,292 of 4,390 seed books have no `hardcover_id`.

**Steps**
1. `src/lib/book-match.ts` (new): `decideMatch(title, author, books)` ports `enrich_books.decide` (matched / ambiguous / proposed / unmatched), with extract's `clean` and `key`, `subtitled`, `differs_only_by_number` and the reordered-words rule, reusing `trigramSimilarity`. A compilation is never a candidate.
2. `src/lib/hardcover.ts`: a `cached` flag on the `ok` answer, so the backfill paces only real requests (about one a second).
3. `src/db/backfill.ts` (new): `backfillBooks({ dryRun, limit ≤ 100, isbns?, sleep, deadline })`. It reads live books with no `hardcover_id` and an author; looks each one up by ISBN when given, else by title and author; reports counts (ISBN, title, proposed, ambiguous, unmatched) and every series position Hardcover gives that differs from the stored `series_position`. A real run makes one UPDATE per match, guarded by `hardcover_id IS NULL`, and never writes series or position. A 429 waits out its `Retry-After`, then retries the same book; past the deadline it stops with `retryIn`. Without the token it refuses and says why.
4. `src/app/api/books/backfill/route.ts` (new): `POST { dryRun, limit, isbns? }`, signed in, `maxDuration` 300; returns the report, or 503 with the reason.
5. `.claude/rules/schema.md`: a rule for the backfill.

**Files:** the four above, `test/hardcover-backfill.test.ts`, `test/fixtures/hardcover-backfill.json`, `.claude/rules/schema.md`. The route and `book-match.ts` are not in *Files likely touched*.

**Test strategy:** recorded answers are seeded into `hardcover_cache`, and `fetch` is stubbed to throw.
- AC-2: `test/hardcover-backfill.test.ts` › dry run over 100 seeded books: every count and conflict, and a database dump identical before and after.
- AC-3: › real run: only matched books filled; a hand page count kept; a Calibre series kept; a compilation result fills nothing.
- AC-4: › a stubbed 429 then 200 waits `Retry-After` and fills; a run stopped at `limit` and run again skips the filled books; no token refuses.
- AC-5: › the file and the route name only `TEST_DATABASE_URL` and the test helpers.
- AC-1 (manual): a dry run over 100 development books through `npm run dev` (it adds cache rows only); the PR reports the match rate and conflicts.

**Risks:** a dry run that has to ask Hardcover writes `hardcover_cache` rows (rebuildable, never `books`); AC-2's byte-identical check runs with every answer recorded. The first production run covers almost the whole library unless the full `enrich:books` run comes first.

**Follow-ups (planned):** a note in TASK-081/082 (call the route after the sync and pass Calibre's ISBNs; apply D-130 when creating a book); a note in TASK-085 (art tone deferred again); a note in TASK-078 (`books.isbn` still not added).

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
