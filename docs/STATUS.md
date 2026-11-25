# Status

**Last regenerated:** 2026-11-25

This is a rollup of `docs/05-roadmap.md`, not a second source of truth. Every
count here comes from counting ☑ vs ☐ entries in that file, and the milestones
are `docs/06-tasklist.md`'s. If this page and the roadmap disagree, the roadmap
wins (D-1): recount and fix this page, don't argue from it.

## Where we are

**112 of 213 roadmap entries done (53%).** The books cutover (1.26,
TASK-061, which the owner runs) waits on one open entry, 1.31 (TASK-115,
Ready), and on the owner's boxes in START-HERE Step 14. The nine entries the
owner pulled ahead on 2026-11-23 (D-172) are all built. The owner's
2026-11-24 intake added eleven entries, none of them a gate (D-184 to D-186).
`LEDGER_LIVE` is `false` (the repo variable and `.env.live`), so production
is still disposable: `npm run rebuild` can reload it.

**The cutover is split, books first (D-128, D-129).** 1.26 is the **books**
cutover: the last full load, `LEDGER_LIVE=true`, and `Books.xlsx` archived.
`Comics.xlsx` stays the comics record after it, and 1.29's comics-only load
(done) keeps production's comics in step with it until 1.28, the **comics**
cutover. Since 2026-11-10 nearly all the books work comes before 1.26
(D-139), and it is built: the year and quarter budget (2.2b, 2.3), editing
and planning the year (2.7, 2.8, 2.10, 2.10b), top books and ranking (3.4,
3.4b, 3.4c), the two-way Calibre sync (4.4), the Hardcover backfill and
Calibre's genres (4.2, 4.5, 4.5b), shelves (5.1, 5.1b), books coming out
(5.7), DNF with a reason (5.5), the listen queue (5.14), Parked (5.15) and
what you own (5.17, 5.17b).

The books cutover (1.26) waits for (`docs/cutover-parity.md` § What each
cutover waits for; 1.26's **Depends on**):

- **1.31**, the Owner checklist settled (TASK-115);
- **every box in START-HERE Step 14 *Before the switch***, ticked by the
  owner. Since 2026-11-25 that includes a rehearsal (D-186): *The switch*
  run against development, then Step 14's *In the app, after the load*,
  which rebuilds what the final load starts empty (the plan, shelves, owned
  copies, the listen queue, Parked and DNF statuses, the inbox) and holds the
  minimum test of the books screens.

The comics cutover (1.28) waits for 3.1 → 3.2 → 3.3 and 5.6 → 5.10, none of
which has a task file yet.

### By milestone

M1–M9 are the MVP, the books cutover; they are START-HERE's sittings under
the same numbers. The milestone numbers are no longer the build order: the
tasklist's *Build order* is (D-129, D-139).

| Milestone | Done / total | Status |
|---|---|---|
| M1 Foundation: tests, CI and the schema | 7 / 7 | Done |
| M2 Read state per run, and a measured app | 5 / 5 | Done |
| M3 Pleasant to use | 3 / 3 | Done |
| M4 Adding a run beats the sheet | 3 / 3 | Done |
| M5 Books end to end | 6 / 6 | Done |
| M6 The real navigation | 8 / 8 | Done |
| M7 Phase 1 complete | 5 / 5 | Done |
| M8 Books load clean | 9 / 9 | Done |
| M9 Captured from cutover on | 18 / 23 | 1.31 (TASK-115), then 1.26 (TASK-061). Phase 0's 0.14e (TASK-138), 0.14f and 0.16 are listed here and are not gates |
| M10 Capacity: is the year overcommitted? | 15 / 17 | 2.1b, after the books cutover; 2.0c (2026-11-24 intake); no task files |
| M11 Editing the plan | 5 / 6 | 2.10c (2026-11-24 intake), no task file |
| M12 The comics dashboard and the telescope | 1 / 7 | Not started† |
| M13 Editing the catalog | 0 / 7 | Not started; ends in 1.28, the comics cutover |
| M14 The run detail and the detail sheets | 5 / 10 | 3.5c, 3.5d, 3.6 → 3.6b → 3.6c |
| M15 Adding at scale | 0 / 3 | Not started |
| M16 Enrichment and covers | 7 / 11 | 4.6b (TASK-139); 4.1; 4.3b and 4.4c (2026-11-24 intake) |
| M17 Book surfaces | 12 / 17 | 5.9b (TASK-141, TASK-142 left); 1.17c, 5.7b, 5.9c and 5.11b (2026-11-24 intake) |
| M18 Comic surfaces | 0 / 7 | Not started; 5.6 → 5.10 are pulled ahead of 1.28 |
| M19 Find and look back | 0 / 6 | Not started |
| M20 Devices and input | 0 / 6 | Not started |
| M21 Hardening and the last pass | 3 / 14 | 6.24 (TASK-144–146 left), 6.25 (TASK-147–149); 6.26 and 6.27 (2026-11-24 intake); the rest not started |
| M22 AI-assisted curation | 0 / 8 | Not started |
| M23–M24 Watchlist | 0 / 10 | Not started |
| M25 Music | 0 / 8 | Not started |
| M26 Games | 0 / 7 | Not started |

† M12's one done row is 6.2b, a scope note the roadmap ticks (its work was
absorbed into 2.4 and 2.6).

### By phase

| Phase | Done / total | Status |
|---|---|---|
| 0 — Foundation | 19 / 22 | Open: 0.14e, 0.14f, 0.16; none a gate |
| 1 — Daily use | 44 / 48 | Open: 1.31, then 1.26 (books cutover); 1.17c; 1.28 (comics cutover) later |
| 2 — The pace engine | 21 / 30 | Open: 2.0c, 2.1b, 2.10c; the comics dashboard and telescope (2.4, 2.5, 2.5b, 2.6, 2.9, 2.12) |
| 3 — Editing | 5 / 19 | 3.4, 3.4b, 3.4c, 3.5, 3.5b done; 3.1–3.3 before 1.28 |
| 4 — Enrichment | 7 / 11 | Open: 4.1, 4.3b, 4.4c, 4.6b |
| 5 — Remaining surfaces | 12 / 23 | Open for books: 5.7b, 5.9b, 5.9c, 5.11b; 5.6 and 5.10 before 1.28 |
| 6 — Polish | 4 / 27 | 6.19, 6.21, 6.23 done; 6.24, 6.25 in progress |
| 7 — AI-assisted curation | 0 / 8 | Not started |
| 8 — Watchlist (film/TV) | 0 / 10 | Not started |
| 9 — Music | 0 / 8 | Not started |
| 10 — Games | 0 / 7 | Not started |

The roadmap's *Later* section (L-1…L-13) holds ideas with no **Check:** and
is not counted.

## What's next

**To the books cutover:** 1.31 (TASK-115, Ready). Then 1.26 (TASK-061): the
owner rehearses Step 14 on development (D-186), then runs it on production;
Claude confirms every **Depends on** entry is ticked and `py -m unittest
etl.test_cutover_parity` passes on `main` first.

**Ready, and not a gate:** 0.14e (TASK-138), 4.6b (TASK-139), 5.9b's last
two parts (TASK-141, TASK-142), 6.24's last three (TASK-144, TASK-145,
TASK-146) and 6.25 (TASK-147 → TASK-148 → TASK-149).

**The 2026-11-24 intake, no task files yet:** the suggestions' series order
and a search on the plan sheet (2.10c), a pace change reaching the plan
without a reload (2.0c), covers that load small behind their placeholder
(4.3b), the books screens timed against development (0.14f), Coming out's
*Remove* and Calibre's arrival (5.7b), `#listened_date` and two-way read dates
(4.4c, D-184), the Series list on what you've started (5.9c), a Universes list
(5.11b), a past read logged on a read book (1.17c), the Library's genre row
scrolling smoothly (6.26), and a plainer-words pass (6.27). Automatic shelves
(L-13) and star ratings (L-6) wait in *Later*.

**After 1.26, books first (D-129):** 2.1b, 3.5c, the intake above, and Phase
6. **Then comics:** M12, M13 with 5.6 → 5.10 pulled ahead and 1.28 at its end,
then 3.6 → 3.6b → 3.6c (M14) and M15.

Questions the intake leaves for its plan gates:

- **4.4c**: where the sync reads the value Calibre held at the end of the
  last run (the run log, or a new record, which asks first).
- **1.17c**: how `reread_of` chains a read logged before others.
- **4.3b**: what makes the small image (the CDN's resize, Next's optimizer and
  its cost, or a stored thumbnail).
- **5.11b**: the Universes tab on the Series page rather than a nav item.
- **2.1b**: `sessions` (a new table), when it is converted.

START-HERE Step 14 is the books cutover, and Step 14b the comics cutover.

**Every preview can measure itself** (0.10), while the repo variable
`LIGHTHOUSE_MODE` is `on` (D-158). It is unset today, so only a hand run
(`gh workflow run lighthouse.yml --ref <branch>`, the owner's call)
measures. When on, an automatic run waits 300 seconds and measures only if its
commit is still the PR's head and the month's automatic runs are under the cap
(0.14b, D-170). A load blocks the RSC prefetches and measures each route once
(0.14, D-160). It fails only on what holds still: a route handler requested
during a load, bytes or requests over `scripts/perf/budget.json`, CLS of 0.1 or
more, accessibility under 100. `docs/02-architecture.md` § Performance budget
holds the budget; 0.13 (TASK-133) made it a gate on growth over main.

**The browser suite** runs whole only in CI (D-141): every width, light and
dark, in ten balanced shards (D-143, D-167), with a per-shard ceiling and a
growth limit (D-161). Since 0.15 (TASK-134–136) a PR runs only the areas its
paths can break, plus a critical set (D-173).

**The feel pass is adopted (D-40, palette 1c After hours)** and its tokens
shipped with 1.8a: `globals.css` carries the measured palette, the
self-hosted fonts (IBM Plex Sans, Plex Mono, Newsreader) and D-71's control
outlines, and `test:tokens` checks them. It beats `mockups.html` on layout and
copy where it draws. 6.23 (TASK-126) took the screens drawn since back to the
design tool and drew watch, music and games for the first time; 6.24 and 6.25
bring the built screens and the navigation in line with it (D-177, D-178).

## What's actually built

- `etl/extract.py`, `etl/enrich_comics.py`, `etl/enrich_books.py`
  (Hardcover), `etl/calibre.py`, `etl/calibre_sync.py` (the two-way sync,
  4.4), `etl/volumes.py`, `etl/fandom_titles.py`, `etl/check_sidecars.py`,
  `etl/check_role_outliers.py`, `etl/rebuild.ps1`/`.sh`, `etl/load.ps1`/`.sh`,
  the comics-only `etl/load-comics.ps1`/`.sh` (1.29), and `etl/views.sql`
- `src/db/schema.ts` (45 tables, migrations through `0035_drop_open_library`),
  `src/db/queries.ts`, `src/db/writes.ts`, `src/db/calibre-sync.ts`,
  `src/db/backfill.ts`
- Pages: `/comics`, `/comics/runs`, `/comics/status`, `/comics/[runId]`,
  `/comics/[runId]/add`; `/books`, `/books/list`, `/books/status`,
  `/books/add`, `/books/plan`, `/books/top`, `/books/releases`,
  `/books/shelves`, `/books/shelves/[id]`, `/books/series`,
  `/books/series/[id]`, `/books/authors/[id]`, `/books/universes/[id]`;
  `/book/[id]` (and the book sheet over any list); `/progress`, `/parked`,
  `/inbox`, `/settings`, `/settings/calibre`, `/watch` (the shell and an empty
  slate), `/login`; `/` is a route handler that redirects to the last medium
  touched
- Route handlers: `/api/progress/{issue,range,book}` and
  `/api/progress/book/{note,rank,read}`, `/api/runs/[runId]/issues`,
  `/api/metron/search`, `/api/books`, `/api/books/{bulk,search,owned,backfill}`,
  `/api/plan`, `/api/plan/{rebalance,suggestions}`, `/api/queue`,
  `/api/listen-queue`, `/api/parked/review`, `/api/shelves`,
  `/api/shelves/[id]`, `/api/follows`, `/api/calibre/sync`, `/api/settings`,
  `/api/inbox`, `/api/export`, `/api/login`, `/api/health`
- `.github/workflows/`: CI, nightly backup to Cloudflare R2 (D-66), Release,
  Lighthouse on previews (D-158, D-170), Neon preview-branch cleanup, the
  preview link, and the `@claude` and PR-review runs
- Claude Code starter kit 2.9.0, customized: `.claude/kit.json`, the skills,
  the test-runner, test-auditor, spec-reviewer, ui-verifier and
  `schema-reviewer` agents, and the protected-path and post-edit hooks

## Open (non-blocking) decisions

Settled 2026-09-20 (`docs/review/decisions.md` D-3). Every default below is
already accepted and in effect, and nothing here blocks work. Revisit one
only if you want to reconsider it:

- Rating scale — default: top-10 ranking only, no star scale
- Collapse finished eras on runs over 100 issues — default: yes, with a count
- Top-books list cap — default: capped at 10
- Franchise ordering — default: release order

Asked at a plan gate when the task arrives (data model § 4.1): the schema
additions 2.1b (`sessions`), 4.1, 5.6 (`edition_issues`), 7.8 and 8.1
propose; where 8.3's saved views keep their hand-added and removed titles;
5.13's series key; 9.0's media bar with a fourth medium.

## Where the detail lives

| Question | Document |
|---|---|
| What exactly does task N.N require to pass? | `docs/05-roadmap.md` (print one entry with `scripts/task.ps1 <id>`) |
| Which tasks make up a milestone, and in what order? | `docs/06-tasklist.md` |
| What does cutover wait for? | `docs/cutover-parity.md` |
| Why does the schema look like this? | `docs/03-data-model.md` |
| How is the system built and run? | `docs/02-architecture.md` |
| What's in scope / out of scope? | `docs/01-product.md` |
| Full project narrative, decisions, migration findings | `docs/HANDOFF.md` |
| Layout and copy for every screen | `design/mockups.html` |
| Tokens, type, telescope and plan-rail geometry, component states, the UX floor | `docs/04-design.md` → `design/STYLE_GUIDE.md`, `design/tokens.css` |
| Human runbook — setup, migration, deploy steps | `docs/START-HERE.md` |
