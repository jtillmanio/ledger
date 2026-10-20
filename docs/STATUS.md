# Status

**Last regenerated:** 2026-10-20

This is a rollup of `docs/TASKS.md`, not a second source of truth. Every count
here comes from counting ☑ vs ☐ task markers in that file. If this page and
TASKS.md disagree, TASKS.md wins (D-1) — recount and fix this page, don't
argue from it.

## Where we are

**26 of 128 tasks done (20%).** Phase 1 is half built: undo, range marking,
the resume pointer, bulk issue entry with Metron search, adding books by
search, paste or hand, the inbox, the dated reading log, the period column,
design tokens, the book extract and Eastern dates have all shipped. What
remains in Phase 1 is the app shell and its routes, the Up next queue and
status screens, the book enrichment, and the two pre-cutover tasks the
2026-10-20 intake added. `LEDGER_LIVE` is `false`, so the database is still
disposable: `npm run rebuild` can reload it.

| Phase | Done / total | Status |
|---|---|---|
| 0 — Foundation | 11 / 13 | Done but 0.11 (plan approved, built in sitting 6) and 0.12 |
| 1 — Daily use | 14 / 28 | In progress: sittings 3–5 done; 6 is half done (1.7, 1.8a); 1.13 and 1.16 done |
| 2 — The pace engine | 0 / 16 | Not started (2.11a is built in sitting 7) |
| 3 — Editing | 0 / 14 | Not started |
| 4 — Enrichment | 0 / 3 | Not started |
| 5 — Remaining surfaces | 0 / 12 | Not started |
| 6 — Polish | 1 / 17 | Not started† |
| 7 — AI-assisted curation | 0 / 8 | Not started |
| 8 — Watchlist (film/TV) | 0 / 10 | Not started |
| 9 — Music | 0 / 7 | Not started; added 2026-10-20 (D-75) |

† The one Phase 6 item checked (6.2b) is a scope note, not a shipped feature —
its work was absorbed into 2.4/2.6; what's left of it is a sort order that
doesn't exist until those tasks do.

The *Later* section of TASKS.md (L-1…L-3) holds ideas with no **Check:** and
is not counted.

## What's next

The rest of sitting 6, in order: **0.11 → 1.8c → 1.8 → 1.8d → 1.8b**. 0.11,
1.8c, 1.8 and 1.8d have approved plans (#98). Then sitting 7 (1.10 → 1.9 →
2.11a → 1.12 → 1.11), the rest of sitting 8 (1.14 → 1.15 → 1.18), and
sitting 9 (1.4e → 1.17). 1.4d (wishlist promotion) is also Ready. Cutover
(START-HERE Step 14) waits for all of Phase 1.

**Backlog intake (2026-10-20).** The owner's 25 additions are in TASKS.md,
FEATURES Part 2j (each verdict and its reasoning) and ARCHITECTURE 2.18–2.21:
- **Before cutover:** 1.17 (book start dates; a run's span derived) and 1.18
  (Calibre word counts, series, tags and reads, D-73), plus 1.4e (Paste a list
  as two fields).
- **Later phases:** 3.10–3.12 (add a series' issues, arrange them, preview
  them), 5.12 (in the middle of), 5.13 (comic series page), 6.17 (activity
  log), 7.7 (*Catch me up*), 7.8 (drafted issue context), 8.9 (new seasons,
  where to watch, D-74), 8.10 (person pages), and Phase 9, music (D-75).
- **Amended:** 3.2 (a track with a publisher), 4.1 (`issues.summary`), 5.1
  (shelf notes), 5.9 (every series a link), 5.10 (*Collected in*), 8.1 (the
  watch schema draft corrected), 8.3 (metadata filters and saved views), 8.6
  (shelves from a filter), 8.8 (*Waiting for a new season*).
- The year chip's spacing was a plain bug, fixed outside the task list on
  `fix/year-chip-count`.

**Book ingest (2026-10-08)**, sitting 8, before cutover: 1.13 (done: one book
per title and author, a merge review in `etl/data/book_review.csv`, no read
state from the workbook, D-41), 1.14 (Open Library details, D-44), 1.15
(follows for series, authors and universes, D-42, D-43), and now 1.18
(Calibre).

**Every preview measures itself** (0.10). When Vercel reports a preview ready,
`.github/workflows/lighthouse.yml` signs in, runs Lighthouse and 0.9's tap
runner, and answers the PR with one comment. It fails only on what holds
still: a route handler requested during a load or prefetch, bytes or requests
over `scripts/perf/budget.json`, CLS of 0.1 or more, accessibility under the
recorded 100. A new top-level screen adds its route to
`scripts/perf/routes.mjs` and its budget in the same PR. ARCHITECTURE §5 holds
the budget and the tests that guard it.

Build order and the cutover gates are in START-HERE Steps 11–14. **2.11a**,
though numbered in Phase 2, is built at the end of Phase 1, before cutover
(D-20), and so is 1.11 (D-36). Phase 1 must finish before cutover, per the
HANDOFF §10 warning: cutting over from Sheets before then defeats the
migration.

**The feel pass is adopted (D-40, palette 1c After hours)** and its tokens
shipped with 1.8a: `globals.css` carries the measured palette, the
self-hosted fonts (IBM Plex Sans, Plex Mono, Newsreader) and D-71's control
outlines, and `test:tokens` checks them. Every screen it draws is folded into
the task that builds it, and it beats `mockups.html` on layout and copy where
it draws. `docs/DESIGN.md` §9 maps each step to its task. Music (Phase 9) is
not drawn anywhere yet; 9.0 designs it first.

## What's actually built

- `etl/extract.py`, `etl/enrich_comics.py`, `etl/volumes.py`,
  `etl/rebuild.ps1`/`.sh`, `etl/load.ps1`/`.sh`, `etl/views.sql`; the book
  merge review (1.13)
- `src/db/schema.ts` (32 tables, migrations through `0013_plan_period`),
  `src/db/queries.ts`, `src/db/writes.ts`
- App routes: `/` (page.tsx), `/comics`, `/comics/[runId]`,
  `/comics/[runId]/add`, `/books`, `/books/add`, `/inbox`, `/login`
- Route handlers: `/api/progress/{issue,range,book}`, `/api/runs/[runId]/issues`,
  `/api/metron/search`, `/api/books`, `/api/books/bulk`, `/api/books/search`,
  `/api/shelves`, `/api/inbox`, `/api/export`, `/api/login`, `/api/health`
- Phase 1 so far: undo (1.2), range marking (1.1), the resume pointer (1.6),
  bulk issue entry with its review and Metron search (1.3, 1.3c, 1.3b), books
  by paste, search or hand to a destination (1.4, 1.4c), the quick-capture
  inbox (1.4b), the dated reading log and `read_events` (1.5), the plan's one
  period column (1.7), design tokens and control states (1.8a), and dates in
  `America/New_York` (1.16)
- Placement-keyed read state (0.8a) and the spine's read-elsewhere hint (0.8b)
- `.github/workflows/` — CI, nightly backup to Cloudflare R2 (D-66), Release,
  Lighthouse on every preview, Neon preview-branch cleanup
- `volume_map.csv` — 67 approved rules, fully reviewed (1.12 loads it)
- Claude Code starter kit 2.7.0, customized: `.claude/kit.json`, the skills,
  the test-runner, test-auditor, spec-reviewer, ui-verifier and
  `schema-reviewer` agents, and the protected-path and post-edit hooks

## Open (non-blocking) decisions

Settled 2026-09-20 (`docs/review/decisions.md` D-3) — every default below is
already accepted and in effect; nothing here blocks work. Revisit only if you
want to reconsider the default:

- Rating scale — default: top-10 ranking only, no star scale
- Collapse finished eras on runs over 100 issues — default: yes, with a count
- Top-books list cap — default: capped at 10
- Franchise ordering — default: release order

Asked at a plan gate when the task arrives (2026-10-20 intake): the schema
columns 1.17, 1.18, 4.1, 5.1, 7.8 and 8.1 propose; 5.13's series key; 9.0's
media bar with a fourth medium.

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
