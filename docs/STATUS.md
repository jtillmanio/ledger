# Status

**Last regenerated:** 2026-10-08

This is a rollup of `docs/TASKS.md`, not a second source of truth. Every count
here comes from counting ☑ vs ☐ task markers in that file. If this page and
TASKS.md disagree, TASKS.md wins (D-1) — recount and fix this page, don't
argue from it.

## Where we are

**12 of 101 tasks done (12%).** Phase 0 is done but for 0.11, a browser test
harness added by the 2026-10-08 coverage check and built in sitting 6 —
nothing in Phase 1 or later has started. The private GitHub repo exists and CI runs on every PR, and is proven
to go red on a broken view (task 0.2, done 2026-09-30). The Release
workflow has deployed `main` to Vercel (last run 2026-10-02). `LEDGER_LIVE` is
`false`, so the database is still disposable: `npm run rebuild` can reload it.

| Phase | Done / total | Status |
|---|---|---|
| 0 — Foundation | 11 / 12 | Done but 0.11 (built in sitting 6) |
| 1 — Daily use | 0 / 22 | Not started |
| 2 — The pace engine | 0 / 16 | Not started |
| 3 — Editing | 0 / 11 | Not started |
| 4 — Enrichment | 0 / 3 | Not started |
| 5 — Remaining surfaces | 0 / 9 | Not started |
| 6 — Polish | 1 / 14 | Not started† |
| 7 — AI-assisted curation | 0 / 6 | Not started |
| 8 — Watchlist (film/TV) | 0 / 8 | Not started |

† The one Phase 6 item checked (6.2b) is a scope note, not a shipped feature —
its work was absorbed into 2.4/2.6; what's left of it is a sort order that
doesn't exist until those tasks do.

## What's next

Phase 1, in the build order of TASKS.md's sitting table (START-HERE Step 12):
**1.2 Undo → 1.1 → 1.6** first.

**Coverage check (2026-10-08).** `/milestones` ran as a coverage check of
TASKS.md against FEATURES, the screen inventory and the schema. It added
0.11 (browser test harness, before 1.8), 1.12 (load the volume map, before
cutover), 3.8 (blocks), 3.9 (volume map editor), 5.9 (series page) and 5.10
(editions), removed 6.7 (a duplicate of 7.6), and amended 1.4b, 2.4, 2.6,
2.9, 5.1, 6.10, 8.3 and 8.4.

**Book ingest (2026-10-08).** A review of how `Books.xlsx` loads added
sitting 8, before cutover:
- **1.13:** one book per title and author, a merge review in
  `etl/data/book_review.csv`, and no read state from the workbook (D-41). Reads
  are entered in the app.
- **1.14:** Open Library details for the workbook's books, moved here from 4.2 (D-44).
- **1.15:** follows for series, authors and the new `book_universes`, with
  progress views (D-42, D-43).

**0.10 (2026-10-07): every preview measures itself.** When Vercel reports a
preview ready, `.github/workflows/lighthouse.yml` signs in, runs Lighthouse
(mobile, Slow 4G, 4× CPU, three runs per route) and 0.9's tap runner, and
answers the PR with one comment. It fails only on what holds still: a route
handler requested during a load or prefetch, bytes or requests over
`scripts/perf/budget.json`, CLS of 0.1 or more, accessibility under the
recorded 100. A new top-level screen adds its route to
`scripts/perf/routes.mjs` and its budget in the same PR. The GitHub
`APP_PASSCODE` secret is the Preview and Development passcode, never
production's (START-HERE 10e).

0.9 (2026-10-04) found the slowness in the database and the app, not the
hosting. Two views computed the whole catalog to describe one run, the nav
prefetched the 20 MB export on every page view, and no route had a loading
boundary, so a tap froze the screen until every query answered. On the
throttled preview, tap → page went from 7.2 s to 1.2 s warm on `/comics`, and
a tap now paints its skeleton within about 100 ms. ARCHITECTURE §5 holds the
budget and the tests that guard it.

0.8b (2026-10-02) draws the grey `↺ read in …` hint on the spine from
`issue_read_runs`, on the mockup's row markup. If the live database has not
been rebuilt since 0.8a (migration 0007), `npm run rebuild -- -EnvFile .env.live`
on `main` puts
the per-run reads there, then Release promotes the build (START-HERE Step 13:
before cutover Release refuses to migrate).

Build order and the cutover gates are in START-HERE Steps 11–14 (rewritten
2026-09-23 after the S audit). **2.11a**, though numbered in Phase 2, is built at
the end of Phase 1, before cutover (D-20). Decisions D-18…D-23 (2026-09-23):
cut over by loading first, then run both for a month; no rereads inside a run;
prerequisite audit before cutover; finish year derived from the finish date;
unlock cost counts unread issues; passphrase login until task 6.13. D-36
(2026-10-02) amends D-23: new task 1.11 makes a failed sign-in wait one second,
built with 2.11a before cutover.

With 0.8b in, Phase 1 (bulk entry, range marking, the app shell) is
unblocked. Cutover still waits for Phase 1 to finish, per the HANDOFF §10
warning: cutting over from Sheets before then defeats the migration. Reading data recorded before
0.8a reached the live database could not say which run it was read in; that
is why 0.8a reaches live through a rebuild, which reloads every read from the
workbook.

**The feel pass is adopted (D-40, 2026-10-05), palette 1c After hours.** Its
token values and the self-hosted fonts (IBM Plex Sans, Plex Mono, Newsreader)
are in `globals.css` now, and `test:tokens` checks the shipped hex against the
measured palette and the `--art` clamp. Every screen it draws — the cover-led
dashboards, the mark that answers back, *All caught up*, *Between books*, run
and block completion, the tablet — is folded into the task that builds it (new
task **2.12** for completion), and it beats `mockups.html` on layout and copy
where it draws. `docs/DESIGN.md` §9 maps each step to its task and lists the
open questions (watch episodes, where the books capacity decisions go, a run's
key art). The `--art` columns wait for 4.3 and 4.2, where the owner is asked
again.

**Design blueprint adopted (D-31, 2026-09-30).** The Step 3 style guide and
Review N are folded into the backlog: a new **1.8a — Design tokens and control
states** comes before 1.8 (the first UI task), the telescope in 2.5/2.5b is now
horizontal, and new tasks 3.7 (archive and restore), 5.7 and 5.8 (books and
comic issues coming out) and 6.14 (sidebar toggle) were added. `docs/DESIGN.md` is the index;
`docs/review/LEDGER.md` *N* maps every audit item to its task. Decided the same
day: counts stay mono (D-32); tablets get a navigation rail and keep the bottom
thumb bar, with header verbs from 1024px (D-33); one sheet at a time (D-34);
upcoming releases are in scope for books and comics (D-35).

## What's actually built

- `etl/extract.py`, `etl/enrich_comics.py`, `etl/volumes.py`,
  `etl/rebuild.ps1`/`.sh`, `etl/load.ps1`/`.sh`, `etl/views.sql`
- `src/db/schema.ts` (23 tables), `src/db/queries.ts`
- v1 app routes: `/` (page.tsx), `/comics`, `/comics/[runId]`, `/books`,
  `/login`, `/api/export`, `/api/login`, `/api/progress`
- Test harness (task 0.1): `test/db.ts`, `test/global-setup.ts`,
  `test/queries.test.ts`, `test/run-readiness.test.ts`,
  `test/testdb-guard.test.ts`
- Placement-keyed read state (task 0.8a): migration 0007 and its down file,
  `issue_read_runs`, `test/placement-progress.test.ts` and
  `test/placement-progress-migration.test.ts`
- The spine's read-elsewhere hint (task 0.8b): `src/components/IssueRow.tsx`
  on the mockup's `.iss`/`.chk`/`.seen` markup, `test/spine.test.tsx`
- The feel pass's tokens (palette 1c, D-40) in `src/app/globals.css`, the fonts
  self-hosted in `src/app/fonts/`, `test:tokens`' palette and `--art` checks, and
  `test/self-hosted-fonts.test.ts`
- `.claude/` — `/verify` skill, `schema-reviewer` subagent
- `.github/workflows/` — CI config, nightly backup, Release, and Lighthouse on
  every preview (task 0.10: `scripts/perf/`, `test/perf.test.ts`)
- `volume_map.csv` — 67 approved rules, fully reviewed
- Claude Code starter kit 2.3.1 (PR #53, adopted 2026-10-08,
  `docs/kit-adoption.md`): skills, the test-runner, test-auditor,
  spec-reviewer and ui-verifier agents beside `schema-reviewer`, and the
  protected-path and post-edit hooks; `.claude/kit.json` waits for
  `/customize-kit`

## Open (non-blocking) decisions

Settled 2026-09-20 (`docs/review/decisions.md` D-3) — every default below is
already accepted and in effect; nothing here blocks work. Revisit only if you
want to reconsider the default:

- Rating scale — default: top-10 ranking only, no star scale
- Collapse finished eras on runs over 100 issues — default: yes, with a count
- Top-books list cap — default: capped at 10
- Franchise ordering — default: release order

## Where the detail lives

| Question | Document |
|---|---|
| What exactly does task N.N require to pass? | `docs/TASKS.md` |
| Why does the schema look like this? | `docs/ARCHITECTURE.md` |
| What's in scope / out of scope? | `docs/FEATURES.md` |
| Full project narrative, decisions, migration findings | `docs/HANDOFF.md` |
| Layout and copy for every screen | `design/mockups.html` |
| Tokens, type, telescope and plan-rail geometry, component states | `docs/DESIGN.md` → `design/STYLE_GUIDE.md`, `design/tokens.css` |
| Human runbook — setup, migration, deploy steps | `docs/START-HERE.md` |
