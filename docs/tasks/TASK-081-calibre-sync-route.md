---
id: TASK-081
title: 4.4 Sync with Calibre (1 of 3) — the sync route: Calibre's changes in, the Ledger's back, each run logged
status: Ready
depends_on: [TASK-030, TASK-032, TASK-033, TASK-029, TASK-057]
size: M
model: opus
autonomy: attended
ui: false
plan_status: none
planned_at_commit:
---

# TASK-081 — 4.4 Sync with Calibre (1 of 3) — the sync route: Calibre's changes in, the Ledger's back, each run logged

## Goal

The app can take what changed in Calibre since the last sync, apply it the way the Calibre import does, hand back what the Ledger holds for each Calibre book, and keep a log of every run.

## Context

- Roadmap: `docs/05-roadmap.md` § 4.4 Sync with Calibre, both ways: one command, by hand or weekly (M16; tasklist depends on 1.18, 1.21, 1.14c, 5.17). The entry's *Rewritten 2026-11-08 (D-133)* half wins where the older text disagrees; its **Check:** is the contract (the owner agreed it on 2026-11-13 and its *proposed* note went). Pulled ahead of 1.26 (D-133): from the books cutover extract no longer loads books, so this is the only way Calibre's changes come in.
- **Split, 1 of 3** (`workflow.splitPolicy: split`: new tables, an API, a command and a page). This part is the app side: the route, the matching, the writes, the tables. TASK-082 is `npm run calibre:sync` and the write-back into Calibre; TASK-083 the *Calibre* page and the dashboard line, whose merge ticks the entry.
- **The route** sits inside the passcode gate (`src/proxy.ts`), signed in with the passcode like a browser (`/api/login`, `src/lib/auth.ts`); `/api/health` stays the one open route (CLAUDE.md). It takes the changed Calibre rows and returns, for each Calibre book, what the Ledger holds: whether it has a read, the latest read's finish and precision, the status, and 5.17's owned formats.
- **Calibre → Ledger** (Calibre wins, D-87): new books at Unlisted (D-83, 1.21's `unlisted`); title, author, series and index, subseries, universe, genres (`book_genres`, D-98), tags, word count (`stated`), ISBN and Calibre id of the books it has, matched on `books.calibre_id` first, then title and author by 1.18's rules, **twinned in TypeScript** and tested against the same fixtures as `etl/calibre.py` (`etl/test_calibre.py`), as `src/lib/issue-slug.ts` twins extract's ids (D-59, D-61). A new book's page count follows D-130 (1.14c): Hardcover through the app's client (`src/lib/hardcover.ts`), book-level count before the edition's, Calibre's `#pages` last. A near spelling (≥ 0.5 trigram similarity, or a `: subtitle`, D-89) waits for a merge or separate decision. A book gone from Calibre stays a book and is listed.
- **Tags and ISBN need columns `books` doesn't have** (`books.subjects`, `books.isbn`; 3.5 and 4.2 also ask for them). Whichever task comes first asks; **stop and ask at plan time** whether this one adds them or carries tags and ISBN as listed-not-stored until then.
- **Reads.** From the books cutover on, the Ledger wins: a Calibre change to `#read` or `#date_read` since the last sync is overwritten (TASK-082 writes it) and listed. A book new to the Ledger takes Calibre's read as its first read, as 1.18 loads one (`read_events`, `format = 'text'`). Before 1.26 extract still loads Calibre's reads (D-87): the plan says what the sync may touch until then.
- **Two new tables, and a stop-and-ask** (CLAUDE.md; `docs/03-data-model.md` § 4.1, row 4.4): where each sync run's log is kept (when it ran, what came in, what went out, what waits) and where a decided near-spelling is remembered between syncs. Each joins `src/db/export-tables.ts` with no `user_id` (hard rules 3 and 7, D-91).
- **5.17 has no task file yet** (D-132 proposes `owned_copies(book_id, format)`). The owned formats this route returns are 5.17's; its task joins `depends_on` when created, and is built before this one (the tasklist's order: 5.17 → 4.4).
- Data model: `docs/03-data-model.md` § 2. Decisions, 2.19; § 4.1. Architecture: `docs/02-architecture.md` § 5. Routes and data access, § 10. Metadata sources → Books.
- Decisions: D-59, D-61, D-83, D-87, D-89, D-90, D-91, D-93, D-98, D-130, D-132, D-133. Hard rules 2, 3, 4, 5 and 7.
- *From TASK-084 (4.2, PR #255):* the Hardcover backfill (`POST /api/books/backfill`, `src/db/backfill.ts`) fills `page_count`, `cover_url` and `published_year` only where they are NULL, because `books` has no column saying a count was typed (owner, 2026-11-13). So a book this route creates should get D-130's page order when it is created: a Calibre `#pages` estimate written here is never replaced by Hardcover's count later.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves the Ledger side of one run on the test database, driven by recorded payloads in place of the command: the Unlisted book with one `read_events` row, the rename and `stated` count, the Ledger's read returned for the changed `#date_read` and listed, the four values returned for the book read in the Ledger, one log entry, and a second run that changes nothing and logs it. TASK-082 proves the run end to end with the fixture library; TASK-083 the browser clauses): with a
fixture library in a temp folder and the test database: four books, one
matching a Ledger book with a changed title and word count, one the Ledger
lacks and marked read, one whose `#date_read` was changed in Calibre after the
Ledger logged a different read, and one the Ledger has read and owns on paper.
One run creates one Unlisted book with one `read_events` row; renames the
matched book and replaces its `stated` word count; overwrites the changed
`#date_read` with the Ledger's and lists it; writes `#read`, `#date_read`,
`#ledger_status` and `#owned` for the book read in the Ledger; and is one log
entry listing each change. A second run changes nothing on either side and
logs that nothing changed. A missing `#owned` column is named and skipped. In
the browser (0.11), the *Calibre* page lists the run, and the dashboard's line
shows when the last run is 8 days old and not when it is 6.
- [ ] AC-2: The TypeScript matcher, run over `etl/test_calibre.py`'s fixtures, matches exactly the pairs `etl/calibre.py` matches: on `calibre_id` first, then title and author; a near spelling is held, never matched.
- [ ] AC-3: A request without the passcode cookie gets the gate's redirect or 401 and writes nothing; `/api/health` is still the only route outside the gate (`test/health.test.ts` / the proxy test).
- [ ] AC-4: A Calibre book whose title is a near spelling of a Ledger book creates nothing and is listed as waiting; after a merge decision is stored, the next run applies it and does not ask again. A Ledger book whose `calibre_id` is gone from Calibre stays live and is listed.
- [ ] AC-5: The log and decision tables have no `user_id`, are in `src/db/export-tables.ts`, and `GET /api/export` returns them (`test/export-tables.test.ts`).

## Out of scope

- Reading `metadata.db`, calling the route, `calibredb`, the shortcut and the weekly run (TASK-082).
- The *Calibre* page and the dashboard line (TASK-083).
- Fetching `metadata.db` from Google Drive (*Later* § L-4).
- 4.2's Hardcover backfill of books the sync didn't create.

## Files likely touched

- `src/db/schema.ts`, `drizzle/<new migration>.sql`, `drizzle/meta/*` — the log and decisions tables (as approved).
- `src/db/export-tables.ts` — both tables.
- `src/lib/calibre-match.ts` (new) — the TypeScript twin of 1.18's matching.
- `src/db/calibre-sync.ts` (new) or `src/db/writes.ts` — applying a run in one transaction, and the log.
- `src/app/api/calibre/sync/route.ts` (new) — the route.
- `test/calibre-match.test.ts` (new), `test/calibre-sync.test.ts` (new), `test/export-tables.test.ts`.

## Verification

- Automated: `test/calibre-match.test.ts` (AC-2), `test/calibre-sync.test.ts` (AC-1's Ledger-side clauses, AC-3, AC-4 on `TEST_DATABASE_URL`), `test/export-tables.test.ts` (AC-5), `npm run check:migrations`.
- Manual: none (TASK-082 runs it against a fixture library).

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
