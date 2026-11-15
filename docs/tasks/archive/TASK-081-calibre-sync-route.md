---
id: TASK-081
title: 4.4 Sync with Calibre (1 of 3) — the sync route: Calibre's changes in, the Ledger's back, each run logged
status: Done
depends_on: [TASK-030, TASK-032, TASK-033, TASK-029, TASK-057, TASK-092]
size: M
model: opus
autonomy: attended
ui: false
plan_status: approved
planned_at_commit: 1b37cad
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
- **5.17 is TASK-092, TASK-093, TASK-094** (D-132 proposes `owned_copies(book_id, format)`). The owned formats this route returns are 5.17's; TASK-092, which builds the table, is in `depends_on`, and is built before this one (the tasklist's order: 5.17 → 4.4).
- Data model: `docs/03-data-model.md` § 2. Decisions, 2.19; § 4.1. Architecture: `docs/02-architecture.md` § 5. Routes and data access, § 10. Metadata sources → Books.
- Decisions: D-59, D-61, D-83, D-87, D-89, D-90, D-91, D-93, D-98, D-130, D-132, D-133. Hard rules 2, 3, 4, 5 and 7.
- *From TASK-084 (4.2, PR #255):* the Hardcover backfill (`POST /api/books/backfill`, `src/db/backfill.ts`) fills `page_count`, `cover_url` and `published_year` only where they are NULL, because `books` has no column saying a count was typed (owner, 2026-11-13). So a book this route creates should get D-130's page order when it is created: a Calibre `#pages` estimate written here is never replaced by Hardcover's count later.

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim; this part proves the Ledger side of one run on the test database, driven by recorded payloads in place of the command: the Unlisted book with one `read_events` row, the rename and `stated` count, the Ledger's read returned for the changed `#date_read` and listed, the four values returned for the book read in the Ledger, one log entry, and a second run that changes nothing and logs it. TASK-082 proves the run end to end with the fixture library; TASK-083 the browser clauses): with a
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
- [x] AC-2: The TypeScript matcher, run over `etl/test_calibre.py`'s fixtures, matches exactly the pairs `etl/calibre.py` matches: on `calibre_id` first, then title and author; a near spelling is held, never matched.
- [x] AC-3: A request without the passcode cookie gets the gate's redirect or 401 and writes nothing; `/api/health` is still the only route outside the gate (`test/health.test.ts` / the proxy test).
- [x] AC-4: A Calibre book whose title is a near spelling of a Ledger book creates nothing and is listed as waiting; after a merge decision is stored, the next run applies it and does not ask again. A Ledger book whose `calibre_id` is gone from Calibre stays live and is listed.
- [x] AC-5: The log and decision tables have no `user_id`, are in `src/db/export-tables.ts`, and `GET /api/export` returns them (`test/export-tables.test.ts`).

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

- The app keeps no author merges, so a Calibre author spelled a new way creates a new author (approved at plan) → docs/tasks/TASK-083-calibre-page-and-stale-line.md § Context
- Candidate decision: a book new to the Ledger that Calibre marks read gets status `read` with its first read, as 1.18 loads it; the 4.4 Check's "Unlisted book" means a book new to the Ledger, and the Check keeps its wording (approved at plan; recorded with the owner's yes at close-out) → docs/review/decisions.md § D-153
- The log's `report.out` covers only the records sent, so a command that sends only Calibre's changes would log no write-back for a Ledger-side change on an unchanged Calibre book (spec review R1) → docs/tasks/TASK-082-calibre-sync-command.md § Context
- A new book Hardcover answers only with a proposal, or with two matches, takes Calibre's `#pages`, which 4.2's backfill (fills only NULL) never replaces (spec review R1) → not tracked: the same as extract's undecided Hardcover row (D-130) under the owner's fill-only-empty rule for the backfill (2026-11-13)
- No index on `calibre_decisions.book_id` (schema review R1) → not tracked: a table of a few rows, cascaded only by a load's truncate
- `test/health.test.ts`'s gate assertion for `/api/calibre/sync` passes before the task too, since the gate's matcher is generic (test audit) → not tracked: a standing guard; the route's own 401 test proves AC-3

## Plan

Approved 2026-11-15 with the owner's answers at the gate: tags and ISBN are
accepted and **not stored** (no `books.isbn` / `books.subjects` yet); the two
tables **as proposed**; a book new to the Ledger that Calibre marks read gets
status **`read`** with its one `read_events` row, as 1.18 loads it (the
Check's "Unlisted book" read as "a book new to the Ledger"; a candidate
decision at close-out). Kept whole (already the split's 1 of 3).

**Steps**

1. `test/fixtures/calibre-match.json`: cases from `etl/test_calibre.py`
   (exact, two authors, near spelling, under 0.5, subtitle, differs only by a
   number, same title under another author, rename by `calibre_id`, id beats
   title, a stored separate). A Python test in `etl/test_calibre.py` runs
   `Seed.match` over it; the TS test runs the twin over the same file
   (as `issue-slugs.json`).
2. `src/lib/calibre-match.ts`: `Seed.match` ported against the Ledger's live
   books (`id, title, author, calibre_id`): `calibre_id` first (renamed when the
   title or author differs), then title and author on any of the record's
   authors, then a near spelling by the same author (≥ 0.5 or a `: subtitle`,
   not differing only by a number) or the same title under another author,
   held unless a separate is stored. Header lists the differences: no author
   merges (`book_review.csv`), no `created` flag.
3. `src/db/schema.ts` + migration (adds tables only, no down file):
   `calibre_syncs(id serial, ran_at timestamptz not null default now(),
   report jsonb not null)`; `calibre_decisions(calibre_id integer primary key,
   decision text check in ('merge','separate'), book_id text → books.id
   cascade, decided_at timestamptz not null default now())`, CHECK
   `(decision = 'merge') = (book_id IS NOT NULL)`. No `user_id`; both in
   `CATALOG_TABLES`. A `decideCalibrePair` write in `src/db/writes.ts` stores a
   decision (TASK-083's page will call it).
4. `src/db/calibre-sync.ts` `syncCalibre(userId, payload, opts)`: payload
   `records[]` (changed or all), `calibreIds[]` (the whole library, for gone
   books), `missingColumns[]`. One transaction under an advisory lock.
   Matched: Calibre's title, author, series + index, subseries + index,
   universe + position, genre set, and `stated` word count where Calibre has
   one replace the Ledger's (D-87); page count and reads untouched. New:
   `createBooks` at `unlisted`, or `read` with one `read_events` row
   (`format = 'text'`) when Calibre marks it read or dates it; a comic is
   skipped and listed; Fan Fiction keeps its type. Near spelling waits; a
   stored merge renames the Ledger book to Calibre's spelling and takes the id;
   a stored separate creates the book. Two Calibre ids on one book wait. A
   soft-deleted book is skipped and listed. Gone from Calibre: stays live,
   listed. Returns, per Calibre book, `{ calibreId, bookId, read, finishedOn,
   precision, status, owned }` and the writes that differ from Calibre's
   values (a missing column named and skipped). Same before and after 1.26:
   what reaches Calibre is TASK-082's. One `calibre_syncs` row per run.
5. D-130 for a new book: before the transaction, Hardcover by ISBN, else a
   title search decided by `decideMatch`, at most 20 a run, through a lookup
   moved out of `src/db/backfill.ts` and shared. A match sets `hardcover_id`,
   cover, year and the page count (book's, else edition's); Hardcover
   answering with none → Calibre's `#pages`; a failure or the cap → NULL and
   listed, for the backfill.
6. `src/app/api/calibre/sync/route.ts`: `POST`, inside the gate; 401 without a
   session, 400 for a malformed payload, writing nothing.
7. `docs/03-data-model.md` § 4.1 row 4.4 marked Built.

**Files**: `test/fixtures/calibre-match.json` (new), `etl/test_calibre.py`,
`src/lib/calibre-match.ts` (new), `src/db/schema.ts`, `drizzle/0029_*.sql` +
`drizzle/meta/*`, `src/db/export-tables.ts`, `src/db/writes.ts`
(`createBooks` exported, `decideCalibrePair`), `src/db/backfill.ts` (shared
lookup; not in Files likely touched), `src/db/calibre-sync.ts` (new),
`src/app/api/calibre/sync/route.ts` (new), `test/calibre-match.test.ts`
(new), `test/calibre-sync.test.ts` (new), `test/export-tables.test.ts`,
`test/health.test.ts` (gate assertion), `docs/03-data-model.md`.

**Test strategy**: AC-1 → `test/calibre-sync.test.ts` "the Check's Ledger
side" (recorded payloads); AC-2 → `test/calibre-match.test.ts` + the Python
parity test; AC-3 → `test/calibre-sync.test.ts` "without the session" +
`test/health.test.ts`; AC-4 → `test/calibre-sync.test.ts` near spelling,
merge, separate, gone; AC-5 → `test/export-tables.test.ts`.

**Revision 1 (during Phase 2)**: three files outside the list, each to keep
one home for a rule rather than copy it: `src/lib/book-match.ts` exports its
`key`, `cleanKey`, `differsOnlyByNumber` and `subtitled` for the matcher;
`test/db.ts`'s `truncateAll` empties `calibre_syncs` (it references nothing,
so `CASCADE` never reaches it); `test/comics-load.test.ts` counts both new
tables on the books side (its every-table check fails otherwise).

**Risks**: Hardcover pacing inside a request (capped at 20 lookups, about 40 s
at worst; `maxDuration` set). The matcher's two documented differences.

## Review log

_Filled by /implement-task. One line per round._

- Verify R1 PASS (00323a8) | CI R1 PASS (every project) | Claude PR review: no issues | Lighthouse within budget
- Fixes found before the reviews (a second session): one Calibre id sent twice and a day off the calendar answer 400; a book removed in the Ledger is skipped and listed (test); the data model's load note corrected (a full load empties `calibre_decisions` whole) | Verify R2 PASS (ae9c7ca) | CI R2 PASS
- Spec R1 CHANGES (spec gap: the Check's "Unlisted book" vs `read` → D-153, the owner's yes at close-out; Follow-ups destinations) | Schema R1 APPROVE (3 minor: two merges into one book, the year 0000, no index) → fixed 2 | Verify R3 PASS (10e34e8) | Schema R2 APPROVE
- Audit R1 PASS (health.test.ts gate assertion a guard that passes at base)
- Close-out: D-153 recorded (owner's yes; the Check keeps its wording), follow-ups placed | Spec R2 (follow-ups check) APPROVE

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 3 (all PASS)
- Review rounds: 2 (spec R1 CHANGES on wording only; schema R1 APPROVE with minors, R2 APPROVE)
- First-pass AC FAILs: 0
- Plan revisions after approval: 1 (three supporting files, see Plan)
