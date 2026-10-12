---
id: TASK-006
title: 1.3b Add issues from a Metron search
status: In progress
depends_on: [TASK-005]
size: L
model: opus
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: b34f36b
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
- *From TASK-005 (1.3c, PR #74):* The Search half shares 1.3c's review table (`src/components/ReviewTable.tsx`, `src/lib/bulk-review.ts`), `InsertPreview`, `RunChip` and the insert (`POST /api/runs/[runId]/issues`, `insertIssuesIntoRun`). 1.3c draws *Search · Type it* with Search `aria-disabled` (*Metron search is coming.*) and opens on *Type it* (owner, 2026-10-12): make Search the default half. The Check column reads *unverified* for typed lines and *new volume* for a year the series has never used (`Captain America (1969) #1`, owner, 2026-10-12): fill both from Metron's answer.
- *From TASK-005 (1.3c, PR #74):* Open question for the plan: a new label whose slug another label already holds gets extract's `-2` silently (D-59). D-15 makes such a clash a cutover blocker in extract; should the Check column flag it?

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

## Follow-ups

- Owner action: `METRON_API_TOKEN` (or `METRON_USERNAME` and `METRON_PASSWORD`) set in Vercel preview and production before the preview can search (approved at plan)
- The mockup's credits line on result rows isn't built (credits from search results are Out of scope) → not tracked: the task's Out of scope covers it (enrichment, 4.1); listed under *Not shown* in `design/mockups-index.md`
- The TMDB error line in the watch add mockup also draws `⚠`, where the UX floor says a grey `×`
- Schema review R1 (minor, accepted): the pace count is read before the requests, not reserved, so two simultaneous searches can pass 20 by a few; Metron's 429 and the hold row catch it (comment in `src/lib/metron.ts`)
- Schema review R1 (minor): `metron_cache` is never pruned; one row per distinct search request
- Spec review R1 (non-blocking): the insert trusts the browser's pairing of a label with a Metron id; the facts come from the cache, so a mispaired id gives a label another issue's cover

## Plan

Approved by the owner, 2026-10-12. Answers at the gate: the API error is a grey `×` (AC-4 and the UX floor over the mockup's `⚠`); the Check column fills from Metron's answer for rows staged from Search (*on Metron*, *new volume*), and typed lines stay *unverified*, since nothing calls Metron while you type (from PR #74's follow-up); the fixture is real Metron responses from `etl/.metron-cache.sqlite` (fetched 2026-09-21, issue ids 14525–14528) reshaped into `issue/?…` responses; a new label whose slug another label already holds is flagged in the Check column (`id taken`, D-15, D-59), and the insert still gives it `-2`; at most 10 numbers per search.

**Steps**

1. `metron_cache(key text PK, body jsonb NOT NULL, fetched_at timestamptz NOT NULL DEFAULT now())` in `src/db/schema.ts`; `npm run db:generate` writes migration 0008 (forward-only, no down file, D-53); `NOT_EXPORTED` gets it; `test/db.ts` `truncateAll` truncates it.
2. `src/lib/metron.ts` (new, server-only): auth header from `METRON_API_TOKEN` or `METRON_USERNAME`/`METRON_PASSWORD`. Metron has no number-range filter, so a search is one `issue/?series_name=<title>&number=<n>[&series_year_began=<y>]` request per number (one series-only request when no number is given), each its own cache key. A row younger than 7 days is served without a call. Pacing: when the rows fetched in the last 60 s plus the calls this search needs exceed 20, nothing is called and the answer is rate-limited until enough of those rows turn 60 s old. A 429 writes a `hold` row carrying `Retry-After`, read first by every instance, so nothing calls before it ends. A failure writes nothing. More than 10 numbers is `too_many`, with no call.
3. `src/lib/issue-search.ts` (new, pure): parse `thor 337-340`, `thor (1966) #337`, `balder the brave` into title, year and numbers; normalise each Metron result's label through `parseBulk` (an unparseable one keeps its flag, AC-3); order results by the numbers asked.
4. `src/db/queries.ts`: catalog search by title, year and number, plus any issue whose `metron_id` matches a result, each with its live run count and whether it is live in this run; and which new labels' base slug is already taken (for `id taken`).
5. `src/app/api/metron/search/route.ts` (new): `POST {q, runId}`: catalog first, then Metron; a Metron result the catalog holds moves to the catalog group. Status `ok`, `rate_limited` (with `retryAt`), `error` or `too_many`.
6. `src/db/writes.ts`: `insertIssuesIntoRun` takes optional Metron metadata, applied only to issues it creates (`metron_id`, `cover_date`, `cover_url`, `cover_date_source = 'metron'`); a reused row is never touched. `src/app/api/runs/[runId]/issues/route.ts` takes `metronIds` and reads the metadata from the cached Metron answer, never from the client; an expired answer is a 409 (*search again*). Its dry run also answers which labels' ids are taken.
7. `src/lib/bulk-review.ts`: rows staged from Search read *on Metron* in the Check column instead of *unverified*; *new volume* as before; `id taken` for a slug clash.
8. `src/components/IssueSearch.tsx` (new) and `src/components/AddIssues.tsx`: a real segmented control with Search the default; search on submit only; *In your catalog* then *From Metron*, each row a decorative cover (`alt=""`) beside its label and cover date, *in N runs* / *already in this run*, and an **Add** toggle (`aria-pressed`); staged rows go through the shared review table, insert preview and **Add N issues**. States, each `role="status"`: empty slate, loading with skeletons, rate-limited (amber, mono countdown, *Type it instead*), error (grey `×`, *Try again*, *Type it instead*), no results. *Type it instead* switches to *Type it* with the query in the textarea. Styles in `src/app/globals.css`.

**Files**: `src/db/schema.ts`, `drizzle/0008_*.sql` + `drizzle/meta/*` (generated), `src/db/export-tables.ts`, `src/lib/metron.ts` (new), `src/lib/issue-search.ts` (new, not in the likely list), `src/app/api/metron/search/route.ts` (new), `src/db/queries.ts`, `src/db/writes.ts`, `src/app/api/runs/[runId]/issues/route.ts` (not in the list: takes `metronIds`, answers `id taken`), `src/lib/bulk-review.ts` (not in the list: the Check column), `src/components/IssueSearch.tsx` (new), `src/components/AddIssues.tsx` (not in the list: the segmented control lives here, not in `page.tsx`), `src/app/globals.css`, `test/metron-search.test.ts` (new), `test/fixtures/metron-thor-337-340.json` (new), `test/issue-search.test.tsx` (new), `test/review-table.test.tsx` (opens on Search now), `test/db.ts` (truncate), `docs/TASKS.md` (tick). Added in Phase 2 and review round 1 (plan revision 1): `.env.example` (its Metron comment said "read by the script only, never by the app", which this task makes false); `design/mockups.html` (the `apistates` Metron error frame redrawn with the grey `×`, owner's answer 1) and `design/mockups-index.md` (*Not shown*: the credits line on result rows). About 16 files, schema and UI together: kept whole under `never-split`, attended.

**Test strategy**

- AC-1: `test/metron-search.test.ts` with `fetch` stubbed, counting Metron calls and replaying the fixture: 4 results in order; the insert writes 4 `issues` with `metron_id` and `cover_date_source = 'metron'` and 4 placements; re-search shows all 4 *already in this run*; an issue in another run is reused; a failure answers `error` and writes nothing; `renderToString` of the Add issues page makes 0 calls; a 429 with `Retry-After: 40` answers rate-limited with `retryAt` 40 s out, and a second search before then makes no call.
- AC-2: `test/issue-search.test.tsx` (happy-dom): ten keystrokes, 0 fetches; catalog group before Metron; *in N runs* from live placements (DB side in `metron-search.test.ts`); adding a catalog hit creates only a placement; Search is the default tab.
- AC-3: `metron-search.test.ts`: an unparseable Metron label is staged with its flag; the insert goes through `insertIssuesIntoRun` with *Insert after*.
- AC-4: `issue-search.test.tsx`: each state is `role="status"`; rate-limited is amber with a mono countdown that reaches 0 and re-enables search; the error line resolves to no `--danger`; *Type it instead* lands on *Type it* with the query.
- AC-5: `metron-search.test.ts`: a repeat within 7 days makes no call; one older than 7 days calls and refreshes `fetched_at`; 20 rows in the last 60 s gives no call and a countdown to the oldest row's 60 s; `test/export-tables.test.ts` passes.
- AC-6: `issue-search.test.tsx` for the states, the decorative covers and the button names; ui-verifier screenshots at every `ui.viewports` width, light and dark; Add and Add N sizes measured there.

**Risks**: Metron's `series_name` matches words (`thor` also matches *Thor Annual*, *Mighty Thor*), so a number another volume shares shows both, which is the point (the cover resolves it). The fixture is reshaped from cached responses, not a live recording.

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
