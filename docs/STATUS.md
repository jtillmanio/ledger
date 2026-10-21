# Status

**Last regenerated:** 2026-10-21

This is a rollup of `docs/05-roadmap.md`, not a second source of truth. Every
count here comes from counting ☑ vs ☐ entries in that file, and the milestones
are `docs/06-tasklist.md`'s. If this page and the roadmap disagree, the roadmap
wins (D-1): recount and fix this page, don't argue from it.

## Where we are

**29 of 129 roadmap entries done (22%).** Phase 1 is more than half built:
undo, range marking, the resume pointer, bulk issue entry with Metron search,
adding books by search, paste or hand, the inbox, the dated reading log, the
period column, design tokens, the app shell and its routes, the book extract
and Eastern dates have all shipped. What remains in Phase 1 is the rest of
the shell (1.8e, 1.8d, 1.8b), the Up next queue and status screens, the book
enrichment, and the two pre-cutover tasks the 2026-10-20 intake added.
`LEDGER_LIVE` is `false`, so the database is still disposable: `npm run
rebuild` can reload it.

### By milestone

M1–M9 are the MVP, cutover from the Sheets; they are START-HERE's sittings
under the same numbers (M7 is sitting 7).

| Milestone | Done / total | Status |
|---|---|---|
| M1 Foundation: tests, CI and the schema | 7 / 7 | Done |
| M2 Read state per run, and a measured app | 4 / 5 | Done but 0.12 |
| M3 Pleasant to use | 3 / 3 | Done |
| M4 Adding a run beats the sheet | 3 / 3 | Done |
| M5 Books end to end | 5 / 6 | Done but 1.4d (Ready) |
| M6 The real navigation | 5 / 8 | In progress: 1.8e, 1.8d and 1.8b left |
| M7 Phase 1 complete | 0 / 5 | Ready: every task has a file |
| M8 Books load clean | 1 / 4 | 1.13 done; 1.14 and 1.15 Ready; 1.18 has no task file yet |
| M9 Captured from cutover on | 0 / 2 | Not started |
| M10–M15 Next | 1 / 30 | Not started† |
| M16–M25 Later | 0 / 56 | Not started |

### By phase

| Phase | Done / total | Status |
|---|---|---|
| 0 — Foundation | 12 / 13 | Done but 0.12 |
| 1 — Daily use | 16 / 29 | In progress: M3–M5 done but 1.4d; M6 more than half; 1.13 and 1.16 done |
| 2 — The pace engine | 0 / 16 | Not started (2.11a is built in M7) |
| 3 — Editing | 0 / 14 | Not started |
| 4 — Enrichment | 0 / 3 | Not started |
| 5 — Remaining surfaces | 0 / 12 | Not started |
| 6 — Polish | 1 / 17 | Not started† |
| 7 — AI-assisted curation | 0 / 8 | Not started |
| 8 — Watchlist (film/TV) | 0 / 10 | Not started |
| 9 — Music | 0 / 7 | Not started; added 2026-10-20 (D-75) |

† The one Phase 6 entry checked (6.2b) is a scope note, not a shipped
feature: its work was absorbed into 2.4 and 2.6 (M12); what's left of it is a
sort order that doesn't exist until those tasks do. It is listed in M12.

The roadmap's *Later* section (L-1…L-3) holds ideas with no **Check:** and
is not counted.

## What's next

The rest of M6, in order: **1.8e → 1.8d → 1.8b**. Then M7 (1.10 → 1.9 →
2.11a → 1.12 → 1.11), the rest of M8 (1.14 → 1.15 → 1.18), and M9 (1.4e →
1.17). 1.4d (wishlist promotion) is also Ready. Cutover (START-HERE Step 14)
waits for M1–M9: all of Phase 1, plus 2.11a and 1.11.

**Backlog intake (2026-10-20).** The owner's 25 additions are in the roadmap,
`docs/01-product.md` § Owner additions (each verdict and its reasoning) and
data model 2.18–2.21:
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

**Book ingest (2026-10-08)**, M8, before cutover: 1.13 (done: one book per
title and author, a merge review in `etl/data/book_review.csv`, no read state
from the workbook, D-41), 1.14 (Open Library details, D-44), 1.15 (follows for
series, authors and universes, D-42, D-43), and 1.18 (Calibre).

**Every preview measures itself** (0.10). When Vercel reports a preview ready,
`.github/workflows/lighthouse.yml` signs in, runs Lighthouse and 0.9's tap
runner, and answers the PR with one comment. It fails only on what holds
still: a route handler requested during a load or prefetch, bytes or requests
over `scripts/perf/budget.json`, CLS of 0.1 or more, accessibility under the
recorded 100. A new top-level screen adds its route to
`scripts/perf/routes.mjs` and its budget in the same PR.
`docs/02-architecture.md` § 7 holds the budget and the tests that guard it.

Build order is `docs/06-tasklist.md`; the cutover gates are START-HERE Steps
11–14. **2.11a**, though numbered in Phase 2, is built at the end of Phase 1,
before cutover (D-20), and so is 1.11 (D-36). Phase 1 must finish before
cutover, per the HANDOFF §10 warning: cutting over from Sheets before then
defeats the migration.

**The feel pass is adopted (D-40, palette 1c After hours)** and its tokens
shipped with 1.8a: `globals.css` carries the measured palette, the
self-hosted fonts (IBM Plex Sans, Plex Mono, Newsreader) and D-71's control
outlines, and `test:tokens` checks them. Every screen it draws is folded into
the task that builds it, and it beats `mockups.html` on layout and copy where
it draws. `docs/04-design.md` §9 maps each step to its task. Music (Phase 9) is
not drawn anywhere yet; 9.0 designs it first.

## What's actually built

- `etl/extract.py`, `etl/enrich_comics.py`, `etl/volumes.py`,
  `etl/rebuild.ps1`/`.sh`, `etl/load.ps1`/`.sh`, `etl/views.sql`; the book
  merge review (1.13)
- `src/db/schema.ts` (32 tables, migrations through `0013_plan_period`),
  `src/db/queries.ts`, `src/db/writes.ts`
- App routes: `/` (a route handler redirecting to the last medium touched),
  `/comics`, `/comics/runs`, `/comics/[runId]`, `/comics/[runId]/add`,
  `/books` (a redirect to `/books/list` until 2.2), `/books/list`,
  `/books/add`, `/watch` (the shell and an empty slate), `/inbox`, `/login`
- Route handlers: `/api/progress/{issue,range,book}`, `/api/runs/[runId]/issues`,
  `/api/metron/search`, `/api/books`, `/api/books/bulk`, `/api/books/search`,
  `/api/shelves`, `/api/inbox`, `/api/export`, `/api/login`, `/api/health`
- Phase 1 so far: undo (1.2), range marking (1.1), the resume pointer (1.6),
  bulk issue entry with its review and Metron search (1.3, 1.3c, 1.3b), books
  by paste, search or hand to a destination (1.4, 1.4c), the quick-capture
  inbox (1.4b), the dated reading log and `read_events` (1.5), the plan's one
  period column (1.7), design tokens and control states (1.8a), the app shell
  (1.8) and its routes (1.8c), and dates in `America/New_York` (1.16)
- Placement-keyed read state (0.8a), the spine's read-elsewhere hint (0.8b),
  and the browser test harness (0.11)
- `.github/workflows/` — CI, nightly backup to Cloudflare R2 (D-66), Release,
  Lighthouse on every preview, Neon preview-branch cleanup
- `volume_map.csv` — 67 approved rules, fully reviewed (1.12 loads it)
- Claude Code starter kit 2.7.0, customized: `.claude/kit.json`, the skills,
  the test-runner, test-auditor, spec-reviewer, ui-verifier and
  `schema-reviewer` agents, and the protected-path and post-edit hooks; the
  planning docs in the kit's layout (`docs/01`–`06`) since 2026-10-21

## Open (non-blocking) decisions

Settled 2026-09-20 (`docs/review/decisions.md` D-3) — every default below is
already accepted and in effect; nothing here blocks work. Revisit only if you
want to reconsider the default:

- Rating scale — default: top-10 ranking only, no star scale
- Collapse finished eras on runs over 100 issues — default: yes, with a count
- Top-books list cap — default: capped at 10
- Franchise ordering — default: release order

Asked at a plan gate when the task arrives (2026-10-20 intake): the schema
columns 1.17, 1.18, 4.1, 5.1, 7.8 and 8.1 propose; where 8.3's saved views
keep their hand-added and removed titles; 5.13's series key; 9.0's media bar
with a fourth medium.

## Where the detail lives

| Question | Document |
|---|---|
| What exactly does task N.N require to pass? | `docs/05-roadmap.md` (print one entry with `scripts/task.ps1 <id>`) |
| Which tasks make up a milestone, and in what order? | `docs/06-tasklist.md` |
| Why does the schema look like this? | `docs/03-data-model.md` |
| How is the system built and run? | `docs/02-architecture.md` |
| What's in scope / out of scope? | `docs/01-product.md` |
| Full project narrative, decisions, migration findings | `docs/HANDOFF.md` |
| Layout and copy for every screen | `design/mockups.html` |
| Tokens, type, telescope and plan-rail geometry, component states, the UX floor | `docs/04-design.md` → `design/STYLE_GUIDE.md`, `design/tokens.css` |
| Human runbook — setup, migration, deploy steps | `docs/START-HERE.md` |
