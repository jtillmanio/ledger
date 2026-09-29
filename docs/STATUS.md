# Status

**Last regenerated:** 2026-09-23

This is a rollup of `docs/TASKS.md`, not a second source of truth. Every count
here comes from counting ☑ vs ☐ task markers in that file. If this page and
TASKS.md disagree, TASKS.md wins (D-1) — recount and fix this page, don't
argue from it.

## Where we are

**4 of 82 tasks done (5%).** Still in Phase 0 — nothing in Phase 1 or later has
started. No git repo exists yet, nothing is deployed, and `LEDGER_LIVE` is
`false`.

| Phase | Done / total | Status |
|---|---|---|
| 0 — Foundation | 3 / 9 | **In progress** |
| 1 — Daily use | 0 / 15 | Not started |
| 2 — The pace engine | 0 / 15 | Not started |
| 3 — Editing | 0 / 6 | Not started |
| 4 — Enrichment | 0 / 3 | Not started |
| 5 — Remaining surfaces | 0 / 6 | Not started |
| 6 — Polish | 1 / 14 | Not started† |
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
3. **0.2 CI, 0.3 schema additions, 0.4 soft-delete, 0.5 volume-year
   normalization** — smaller, no ordering dependency on each other, but all
   still open in Phase 0.

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
| Human runbook — setup, migration, deploy steps | `docs/START-HERE.md` |
