# Status

**Last regenerated:** 2026-09-30

This is a rollup of `docs/TASKS.md`, not a second source of truth. Every count
here comes from counting ☑ vs ☐ task markers in that file. If this page and
TASKS.md disagree, TASKS.md wins (D-1) — recount and fix this page, don't
argue from it.

## Where we are

**5 of 87 tasks done (6%).** Still in Phase 0 — nothing in Phase 1 or later has
started. The private GitHub repo exists and CI runs on every PR, and is proven
to go red on a broken view (task 0.2, done 2026-09-30). The Release
workflow has deployed `main` to Vercel (last run 2026-09-30). `LEDGER_LIVE` is
`false`, so the database is still disposable: `npm run rebuild` can reload it.

| Phase | Done / total | Status |
|---|---|---|
| 0 — Foundation | 4 / 10 | **In progress** |
| 1 — Daily use | 0 / 16 | Not started |
| 2 — The pace engine | 0 / 15 | Not started |
| 3 — Editing | 0 / 7 | Not started |
| 4 — Enrichment | 0 / 3 | Not started |
| 5 — Remaining surfaces | 0 / 7 | Not started |
| 6 — Polish | 1 / 15 | Not started† |
| 7 — AI-assisted curation | 0 / 6 | Not started |
| 8 — Watchlist (film/TV) | 0 / 8 | Not started |

† The one Phase 6 item checked (6.2b) is a scope note, not a shipped feature —
its work was absorbed into 2.4/2.6; what's left of it is a sort order that
doesn't exist until those tasks do.

## What's next

Phase 0 isn't finished, and three of its remaining tasks gate everything
downstream:

1. **0.8a — Read state per run (schema, ETL, views).** The critical-path item.
   `read_events` (1.5) and the resume pointer (1.6) both key comics on the
   placement, not the issue, so this has to land first. Cutover cannot happen
   without it either — reading an issue in one run must not silently mark it
   read in another.
2. **0.8b — Read state per run, the spine.** Follows directly from 0.8a.
3. **0.5 volume-year normalization** — smaller, no ordering dependency, still
   open in Phase 0 (0.3 and 0.4 are done). **0.9 — Page performance** is also open: the deployed
   app feels slow, and it is cheaper to find the cause before more screens sit on
   the same data path.

Build order and the cutover gates are in START-HERE Steps 11–14 (rewritten
2026-09-23 after the S audit). **2.11a**, though numbered in Phase 2, is built at
the end of Phase 1, before cutover (D-20). Decisions D-18…D-23 (2026-09-23):
cut over by loading first, then run both for a month; no rereads inside a run;
prerequisite audit before cutover; finish year derived from the finish date;
unlock cost counts unread issues; passphrase login until task 6.13.

Nothing in Phase 1 (bulk entry, range marking, the app shell) should start
until 0.8a/0.8b are in, per the HANDOFF §10 warning: cutting over from Sheets
before Phase 1 finishes defeats the migration, and accumulating real reading
data before 0.8a lands means that history can't be reconstructed later.

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
- `.claude/` — `/verify` skill, `schema-reviewer` subagent
- `.github/workflows/` — CI config and nightly backup
- `volume_map.csv` — 67 approved rules, fully reviewed

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
