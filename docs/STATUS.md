# Status

**Last regenerated:** 2026-11-23

This is a rollup of `docs/05-roadmap.md`, not a second source of truth. Every
count here comes from counting ☑ vs ☐ entries in that file, and the milestones
are `docs/06-tasklist.md`'s. If this page and the roadmap disagree, the roadmap
wins (D-1): recount and fix this page, don't argue from it.

## Where we are

**100 of 195 roadmap entries done (51%).** Every entry the books cutover
depends on is done except one, 1.31 (settle the Owner checklist,
TASK-115). After it comes 1.26 itself (TASK-061), which the owner runs.
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

- **1.31**, the Owner checklist settled (TASK-115, Ready);
- **every box in START-HERE Step 14 *Before the switch***, ticked by the
  owner.

Not in 1.26's **Depends on**, but it should land before the switch:
**4.4b** (TASK-128, added 2026-11-23). The owner sets `CALIBRE_SYNC_READS=true`
at the switch. From then on, a Calibre date-read column that shows only a
year would make the sync rewrite every such book's date on every run.
Whether it joins **Depends on** is the owner's call.

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
| M9 Captured from cutover on | 15 / 21 | 1.31 (TASK-115), then 1.26 (TASK-061). Phase 0's 0.13 (TASK-133), 0.14c (TASK-114, PR #319), 0.14d (no task file) and 0.15 (TASK-134–136) are listed here and are not cutover gates |
| M10 Capacity: is the year overcommitted? | 15 / 16 | 2.1b, after the books cutover; no task file |
| M11 Editing the plan | 5 / 5 | Done (pulled ahead of 1.26, D-139) |
| M12 The comics dashboard and the telescope | 0 / 7 | Not started† |
| M13 Editing the catalog | 0 / 7 | Not started; ends in 1.28, the comics cutover |
| M14 The run detail and the detail sheets | 4 / 9 | 3.5 (TASK-080 left), 3.5c, 3.6 → 3.6b → 3.6c |
| M15 Adding at scale | 0 / 3 | Not started |
| M16 Enrichment and covers | 5 / 8 | 4.4b (TASK-128), 4.6 (TASK-129), 4.1 |
| M17 Book surfaces | 10 / 12 | 5.9 (TASK-125 left), 5.18 (TASK-130) |
| M18 Comic surfaces | 0 / 7 | Not started; 5.6 → 5.10 are pulled ahead of 1.28 |
| M19 Find and look back | 0 / 6 | Not started |
| M20 Devices and input | 0 / 6 | Not started |
| M21 Hardening and the last pass | 0 / 9 | 6.19 (TASK-131, TASK-132), 6.21 (TASK-137, after TASK-126), 6.23 (TASK-126) have task files |
| M22 AI-assisted curation | 0 / 8 | Not started |
| M23–M24 Watchlist | 0 / 10 | Not started |
| M25 Music | 0 / 8 | Not started |
| M26 Games | 0 / 7 | Not started |

† M12 lists 6.2b, a scope note the roadmap ticks (its work was absorbed
into 2.4 and 2.6), so the tasklist counts it open and the roadmap done.

### By phase

| Phase | Done / total | Status |
|---|---|---|
| 0 — Foundation | 15 / 19 | Open: 0.13, 0.14c, 0.14d, 0.15 (measurement and CI cost; none gates a cutover) |
| 1 — Daily use | 44 / 47 | Open: 1.31, then 1.26 (books cutover); 1.28 (comics cutover) later |
| 2 — The pace engine | 21 / 28 | Open: 2.1b; the comics dashboard and telescope (2.4, 2.5, 2.5b, 2.6, 2.9, 2.12) |
| 3 — Editing | 4 / 18 | 3.4, 3.4b, 3.4c, 3.5b done; 3.1–3.3 before 1.28 |
| 4 — Enrichment | 5 / 8 | Open: 4.1, 4.4b, 4.6 |
| 5 — Remaining surfaces | 10 / 19 | The books surfaces done but 5.9 and 5.18; 5.6 and 5.10 before 1.28 |
| 6 — Polish | 1 / 23 | 6.19, 6.21 and 6.23 have task files |
| 7 — AI-assisted curation | 0 / 8 | Not started |
| 8 — Watchlist (film/TV) | 0 / 10 | Not started |
| 9 — Music | 0 / 8 | Not started |
| 10 — Games | 0 / 7 | Not started |

The roadmap's *Later* section (L-1…L-11) holds ideas with no **Check:** and
is not counted.

## What's next

**To the books cutover:** 1.31 (TASK-115), with 4.4b (TASK-128) before the
switch, then 1.26 (TASK-061): the owner runs START-HERE Step 14, and Claude
confirms every **Depends on** entry is ticked and `py -m unittest
etl.test_cutover_parity` passes on `main` first. 4.6 (TASK-129) is not a gate,
but from 1.26 the sync is the only way Calibre's changes arrive, and a held
near spelling can't be decided in the app until it lands.

**Ready or Draft, any time:** 3.5's issue sheet (TASK-080), 5.9's series links
(TASK-125), 0.14c (TASK-114, PR #319, which finishes only once
`LIGHTHOUSE_MODE` is back on), 6.23's design review (TASK-126, run by the owner
in Claude Design), and the Drafts converted 2026-11-23: TASK-128–TASK-137
(4.4b, 4.6, 5.18, 6.19, 0.13, 0.15, 6.21). TASK-120 (3.5b, part 3) merged as
PR #320 and waits for the owner's accept.

**After 1.26, books first (D-129):** 2.1b, 3.5's last part and 3.5c, 5.9's
last part, and Phase 6. **Then comics:**
M12, M13 with 5.6 → 5.10 pulled ahead and 1.28 at its end, then 3.6 → 3.6b →
3.6c (M14) and M15.

Questions the new task files leave for their plan gates:

- **4.4b** (TASK-128): whether it joins 1.26's **Depends on**.
- **4.6** (TASK-129): which waiting kinds get the two buttons (`two calibre
  books` may need a different answer), and whether anything is left of the
  new-author note.
- **5.18** (TASK-130): for each of the four undos, take the book off or
  refuse.
- **6.19** (TASK-131, TASK-132): how many books have an Open Library id and no
  Hardcover id, which would turn *metadata pending*; whether the decided
  `open library` reason survives the Check's grep.
- **0.13** (TASK-133): whether 0.14d is converted first; how the
  `perf-growth` label re-reports without a new measured run.
- **0.15** (TASK-134–136): folders or tags for a spec's area; which components
  are a medium's; how D-145's docs-only reuse treats a run that covered only
  some areas.
- **6.21** (TASK-137): which drawing, from 6.23 or a session of its own.
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
holds the budget; 0.13 (TASK-133) turns it into a gate on growth over main.

**The browser suite** runs whole only in CI (D-141): every width, light and
dark, in ten balanced shards (D-143, D-167), with a per-shard ceiling and a
growth limit (D-161). 0.15 (TASK-134–136) makes a PR run only the areas its
paths can break, plus a critical set.

**The feel pass is adopted (D-40, palette 1c After hours)** and its tokens
shipped with 1.8a: `globals.css` carries the measured palette, the
self-hosted fonts (IBM Plex Sans, Plex Mono, Newsreader) and D-71's control
outlines, and `test:tokens` checks them. It beats `mockups.html` on layout and
copy where it draws. Screens drawn since, straight into `mockups.html`, go back
to the design tool in 6.23 (TASK-126), which also draws watch, music and games
for the first time (8.7, 9.0, 10.0 wait on it).

## What's actually built

- `etl/extract.py`, `etl/enrich_comics.py`, `etl/enrich_books.py`
  (Hardcover), `etl/calibre.py`, `etl/calibre_sync.py` (the two-way sync,
  4.4), `etl/volumes.py`, `etl/fandom_titles.py`, `etl/check_sidecars.py`,
  `etl/check_role_outliers.py`, `etl/rebuild.ps1`/`.sh`, `etl/load.ps1`/`.sh`,
  the comics-only `etl/load-comics.ps1`/`.sh` (1.29), and `etl/views.sql`
- `src/db/schema.ts` (46 tables, migrations through `0034_parked_review`),
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
