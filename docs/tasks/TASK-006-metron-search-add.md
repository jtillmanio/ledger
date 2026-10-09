---
id: TASK-006
title: 1.3b Add issues from a Metron search
status: Draft
depends_on: [TASK-005]
size: L
model: opus
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-006 — 1.3b Add issues from a Metron search

## Goal

Issues can be added to a run by searching (`thor 337-340`). Results come from your own catalog first, then Metron, with covers and cover dates so the right volume is obvious. When Metron is busy or down, typing the label is always one tap away.

## Context

- Roadmap: `docs/TASKS.md` § 1.3b Add issues from a Metron search (sitting 4, last). The roadmap entry and its **Check:** are the contract.
- Architecture: `docs/ARCHITECTURE.md` § 2. Decisions — 2.15 (your catalog first, then Metron live, called only from an add flow on submit and never from a page render; a Metron result writes `metron_id`, `cover_date` and `cover_url` with source `metron`, and its label is normalised to the bulk-entry grammar). § 6. Metadata sources. § 4. Interface *Review tables*.
- Data model: `src/db/schema.ts` `issues` (`metron_id`, `cover_date` / `cover_date_source`, `cover_url`). The insert is TASK-005's, and staged rows go through its review table.
- Design: mockup `addsearch` (results on the left and staged on the right on desktop; your catalog's rows show *in N runs* or *already in this run*) and `apistates` (loading, rate-limited with a mono countdown and *Type it instead*, error as a neutral line with a grey `×`, never red). `docs/TASKS.md` UX floor: rate-limited is amber (held).
- Decisions: D-53 (the cache table, its pacing and expiry, and its absence from the export), D-51 (Metron for comics; Comic Vine is fallback only), the CLAUDE.md AI-label rule (tapping **Add** on a Metron result is the explicit accept of a label Metron says exists), D-15.
- Credentials: `METRON_API_TOKEN`, or `METRON_USERNAME` and `METRON_PASSWORD`, as in `.env.example`. They must also be set in Vercel (preview and production) by the owner before the preview can search.
- **Cache and pacing, settled by the owner, 2026-10-09 (D-53):** a Postgres table, `metron_cache(key text PRIMARY KEY, body jsonb NOT NULL, fetched_at timestamptz NOT NULL DEFAULT now())`, with no `user_id`. It is a schema change the owner has approved, and it is forward-only, so there is no down file. Every network call writes or refreshes its row. The 20-per-minute pace counts rows whose `fetched_at` is within the last 60 seconds, across all instances, and Metron's 429 with `Retry-After` stays the real guard (the limit is shared with `enrich_comics.py`). Search responses expire after 7 days. The table goes in `NOT_EXPORTED` in `src/db/export-tables.ts` (D-53 amends D-17). The ETL's `etl/.metron-cache.sqlite` is not shared.
- **Why this is now L** (`workflow.splitPolicy: never-split`): D-53 adds a table and its migration to the API and UI work.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): with a recorded Metron fixture: a search for `thor 337-340` returns 4 results in order; adding them creates 4 `issues` rows carrying `metron_id` and `cover_date_source = 'metron'`, plus 4 placements; re-searching shows all 4 as "already in this run"; an issue already in another run is reused, not duplicated. A Metron failure renders the freeform fallback and writes nothing. No page render calls Metron (assert through a mocked client that counts calls). A mocked 429 with `Retry-After: 40` renders the rate-limited status line with the countdown and a working *Type it instead*, and makes no second request before it elapses.
- [ ] AC-2: Search runs on submit, never per keystroke: typing ten characters without submitting makes zero client calls. Matches from your catalog are listed before Metron results. A catalog hit shows *in N runs* with N equal to its live placements, and adding it creates only a placement. Search is the default tab of Add issues, and *Type it* is the other half of the segmented control.
- [ ] AC-3: A Metron result's label is normalised through TASK-004's parser before it is staged. A result whose normalised label parses as *unparseable* is staged with that flag, never inserted silently. Every staged row goes through TASK-005's review table and its one-transaction insert, *Insert after* included.
- [ ] AC-4: The loading, rate-limited and error states each render as a `role="status"` line. Rate-limited is amber, with a mono countdown that reaches 0 and then re-enables search. Error is a neutral line with a grey `×`, and no element in it resolves to `--danger`. *Type it instead* switches to the *Type it* tab with the query in the textarea.
- [ ] AC-5 (D-53): a second identical search within 7 days makes no Metron call and is served from `metron_cache`. One older than 7 days calls Metron and refreshes `fetched_at`. With 20 rows fetched in the last 60 seconds, a new uncached search makes no Metron call and shows the rate-limited state, counting down to when the oldest of those rows turns 60 seconds old. `metron_cache` is in `NOT_EXPORTED`, and `test/export-tables.test.ts` passes.
- [ ] AC-6: The Add issues *Search* screen meets the UX floor (`docs/TASKS.md` § *The UX floor, for every UI task*): empty (no search yet), loading, rate-limited and error states drawn; result covers carry alt text or are marked decorative beside a text label; **Add** and **Add N** are real buttons at least 24px; screenshots at every `ui.viewports` width, light and dark.

## Out of scope

- Comic Vine as a fallback source (D-51 keeps it a fallback, not built here).
- Backfilling Metron data onto existing issues (4.1, and the ETL's `enrich_comics.py`).
- Credits and story titles from search results (enrichment owns them, 0.7, 4.1).
- The comics releases screen (5.8), which reuses this flow later.
- Cover art tone (`--art`) (4.3).

## Files likely touched

- `src/db/schema.ts`: `metron_cache`. `drizzle/<tag>.sql` and `drizzle/meta/*` are generated by `npm run db:generate`.
- `src/db/export-tables.ts`: `metron_cache` in `NOT_EXPORTED`.
- `src/lib/metron.ts` (new): server-only client with auth, `Retry-After`, and the `metron_cache` read, write and pacing count.
- `src/app/api/metron/search/route.ts` (new): catalog-first search, then Metron.
- `src/components/IssueSearch.tsx` (new): the Search tab, its results and its states.
- `src/app/comics/[runId]/add/page.tsx`: the segmented control, with Search as the default.
- `src/db/queries.ts`: catalog search by series and number, with *in N runs*.
- `src/db/writes.ts`: create a Metron issue (with `metron_id`, `cover_date`, `cover_url` and source `metron`) inside TASK-005's insert.
- `src/app/globals.css`: result rows and API states.
- `test/metron-search.test.ts` (new, DB, with the mocked client) and `test/fixtures/metron-thor-337-340.json` (new, recorded).

## Verification

- Automated: `test/metron-search.test.ts` with a mocked Metron client that counts calls and replays the recorded fixture: the 4 results in order, the 4 rows with `metron_id` and `cover_date_source = 'metron'`, the re-search showing *already in this run*, reuse across runs, the failure fallback writing nothing, zero calls from page renders, and the 429 path with `Retry-After: 40` (AC-1 to AC-4). The same file covers the cache hit, the 7-day refresh and the 60-second pacing count against `TEST_DATABASE_URL` (AC-5), and `test/export-tables.test.ts` covers the export list. The component states are rendered in happy-dom (AC-4, AC-6). `npm run check:migrations` passes.
- Manual: with Metron credentials in `.env`, search `thor 337-340` on a run's Add issues → expected: four results with covers, staged into the review, and inserted. Search again → expected: *already in this run* on all four.

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
