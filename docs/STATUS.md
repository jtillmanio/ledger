# Status

**Last regenerated:** 2026-10-26

This is a rollup of `docs/05-roadmap.md`, not a second source of truth. Every
count here comes from counting ☑ vs ☐ entries in that file, and the milestones
are `docs/06-tasklist.md`'s. If this page and the roadmap disagree, the roadmap
wins (D-1): recount and fix this page, don't argue from it.

## Where we are

**40 of 135 roadmap entries done (30%).** M1 and M3–M7 are done, and M2
lacks only 0.12. Phase 1 is 26 of 34: the shell, the Up next queue, the status
screens, the volume map, slowed sign-ins, the wishlist promotion, Open Library
details and series, author and universe follows have all shipped since
2026-10-21, along with 2.11a's cycle check. What remains before cutover is the
rest of M8 (1.21, 1.18, 1.20: every task has a file) and M9 (1.4e, 1.19, 1.22,
1.17, 1.23), most of it from the 2026-10-26 books intake. `LEDGER_LIVE` is
`false`, so the database is still disposable: `npm run rebuild` can reload it.

### By milestone

M1–M9 are the MVP, cutover from the Sheets; they are START-HERE's sittings
under the same numbers (M7 is sitting 7).

| Milestone | Done / total | Status |
|---|---|---|
| M1 Foundation: tests, CI and the schema | 7 / 7 | Done |
| M2 Read state per run, and a measured app | 4 / 5 | Done but 0.12 |
| M3 Pleasant to use | 3 / 3 | Done |
| M4 Adding a run beats the sheet | 3 / 3 | Done |
| M5 Books end to end | 6 / 6 | Done |
| M6 The real navigation | 8 / 8 | Done |
| M7 Phase 1 complete | 5 / 5 | Done |
| M8 Books load clean | 3 / 6 | 1.13, 1.14 and 1.15 done; 1.21, 1.18 and 1.20 Draft (TASK-029–031) |
| M9 Captured from cutover on | 0 / 5 | Not started: no task files yet |
| M10–M15 Next | 1 / 30 | Not started† |
| M16–M25 Later | 0 / 57 | Not started |

### By phase

| Phase | Done / total | Status |
|---|---|---|
| 0 — Foundation | 12 / 13 | Done but 0.12 |
| 1 — Daily use | 26 / 34 | In progress: M3–M7 done; the rest of M8, and M9 |
| 2 — The pace engine | 1 / 16 | Not started but 2.11a, built in M7‡ |
| 3 — Editing | 0 / 14 | Not started |
| 4 — Enrichment | 0 / 4 | Not started; 4.4 added 2026-10-26 (D-83) |
| 5 — Remaining surfaces | 0 / 12 | Not started |
| 6 — Polish | 1 / 17 | Not started† |
| 7 — AI-assisted curation | 0 / 8 | Not started |
| 8 — Watchlist (film/TV) | 0 / 10 | Not started |
| 9 — Music | 0 / 7 | Not started; added 2026-10-20 (D-75) |

† The one Phase 6 entry checked (6.2b) is a scope note, not a shipped
feature: its work was absorbed into 2.4 and 2.6 (M12); what's left of it is a
sort order that doesn't exist until those tasks do. It is listed in M12.

‡ The roadmap's *Phases* table still says 0 / 16 for Phase 2; its checkboxes
tick 2.11a, so the count here is 1.

The roadmap's *Later* section (L-1…L-4) holds ideas with no **Check:** and
is not counted.

## What's next

The rest of M8, in order: **1.21 → 1.18 → 1.20** (TASK-029, TASK-030,
TASK-031, all Draft: review them, then set Ready). Answer `book_review.csv`
now, and `calibre_review.csv` and `calibre_reads.csv` after 1.18. Then M9
(1.4e → 1.19 → 1.22 → 1.17 → 1.23), which has no task files yet: `/new-task
docs/06-tasklist.md M9`. Cutover (START-HERE Step 14) waits for M1–M9: all of
Phase 1, plus 2.11a and 1.11. 0.12 (a redeploy of a skipped preview) is in no
sitting and can go on a `chore/` branch any time.

**Books intake (2026-10-26).** 1.21 (*Owned*, below Someday, D-83), 1.22
(search as you type, D-84) and 1.23 (audiobooks, D-85) are new before
cutover; 1.18 now creates Calibre's other books at Owned and can be re-run
until cutover; 4.4 moves the Calibre sync into the app after it, and L-4
fetches it from Google Drive. 1.20 (hold books Open Library doesn't know) came
from the owner the same day.

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
from the workbook, D-41), 1.14 (done: Open Library details in
`etl/data/book_details.csv`, D-44), 1.15 (done: follows for series, authors
and universes, D-42, D-43), and 1.18 (Calibre, D-73).

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

- `etl/extract.py`, `etl/enrich_comics.py`, `etl/enrich_books.py`,
  `etl/volumes.py`, `etl/rebuild.ps1`/`.sh`, `etl/load.ps1`/`.sh`,
  `etl/views.sql`; the book merge review (1.13), Open Library details (1.14),
  placeholder titles skipped, and the prerequisite cycle report
  (`--fail-on-cycle`, 2.11a)
- `src/db/schema.ts` (37 tables, migrations through `0015_book_follows`),
  `src/db/queries.ts`, `src/db/writes.ts`
- App routes: `/` (a route handler redirecting to the last medium touched),
  `/comics`, `/comics/runs`, `/comics/status`, `/comics/[runId]`,
  `/comics/[runId]/add`, `/books` (a redirect to `/books/list` until 2.2),
  `/books/list`, `/books/status`, `/books/add` (with `?from=wishlist`),
  `/watch` (the shell and an empty slate), `/inbox`, `/login`
- Route handlers: `/api/progress/{issue,range,book}`, `/api/runs/[runId]/issues`,
  `/api/metron/search`, `/api/books`, `/api/books/bulk`, `/api/books/search`,
  `/api/books/wishlist`, `/api/plan`, `/api/queue`, `/api/shelves`,
  `/api/inbox`, `/api/export`, `/api/login`, `/api/health`
- Phase 1 so far: undo (1.2), range marking (1.1), the resume pointer (1.6),
  bulk issue entry with its review and Metron search (1.3, 1.3c, 1.3b), books
  by paste, search or hand to a destination (1.4, 1.4c), the quick-capture
  inbox (1.4b), the wishlist promotion (1.4d), the dated reading log and
  `read_events` (1.5), the plan's one period column (1.7), design tokens and
  control states (1.8a), the app shell (1.8), its routes (1.8c), failed-write
  retry, skeletons and row markup (1.8d), the 834px frames (1.8e), the thumb
  bar (1.8b), the comics Up next queue (1.10), the status screens (1.9),
  slowed failed sign-ins (1.11), the volume map in `volume_rules` (1.12),
  series, author and universe follows (1.15), and dates in `America/New_York`
  (1.16)
- Placement-keyed read state (0.8a), the spine's read-elsewhere hint (0.8b),
  and the browser test harness (0.11), with a core scope locally and the full
  suite sharded four ways in CI (D-80)
- `.github/workflows/` — CI, nightly backup to Cloudflare R2 (D-66), Release,
  Lighthouse on every preview, Neon preview-branch cleanup, and the `@claude`
  and PR-review runs
- Claude Code starter kit 2.8, customized: `.claude/kit.json`, the skills,
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

Asked at a plan gate when the task arrives (2026-10-20 and 2026-10-26
intakes; data model § 4.1): the schema columns 1.17, 1.18, 4.1, 5.1, 7.8 and
8.1 propose; the `owned` status (1.21) and `listening` with
`read_events.format` (1.23); `books.calibre_id` (1.22); where 4.4 remembers a
decided Calibre review row; where 8.3's saved views keep their hand-added and
removed titles; 5.13's series key; 9.0's media bar with a fourth medium.

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
