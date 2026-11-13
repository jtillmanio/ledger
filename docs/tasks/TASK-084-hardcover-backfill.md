---
id: TASK-084
title: 4.2 Open Library and Hardcover backfill
status: Ready
depends_on: [TASK-034, TASK-040, TASK-057]
size: M
model: opus
autonomy: attended
ui: false
plan_status: none
planned_at_commit:
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

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
