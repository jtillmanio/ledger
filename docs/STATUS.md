# Status

**Last regenerated:** 2026-11-08

This is a rollup of `docs/05-roadmap.md`, not a second source of truth. Every
count here comes from counting ☑ vs ☐ entries in that file, and the milestones
are `docs/06-tasklist.md`'s. If this page and the roadmap disagree, the roadmap
wins (D-1): recount and fix this page, don't argue from it.

## Where we are

**64 of 174 roadmap entries done (37%).** Phase 0 is done. Phase 1 is done
except five entries: the two cutovers and the three entries the 2026-11-08
intake added to it. M1–M8 are done, and so is M9 apart from those. `LEDGER_LIVE`
is `false`, so the database is still disposable: `npm run rebuild` can
reload it.

**The cutover is split, books first (D-128, D-129).** 1.26 is now the
**books** cutover: the last full load, `LEDGER_LIVE=true`, and `Books.xlsx`
archived. `Comics.xlsx` stays the comics record after it, and 1.29's
comics-only load keeps production's comics in step with it until 1.28, the
**comics** cutover. After 1.26 come the books entries of Next; comics work
resumes after them.

The books cutover (1.26) waits for (`docs/cutover-parity.md` § What each
cutover waits for, and the owner's 2026-11-08 additions):

- **2.2b and 2.3**, the rest of the year and quarter word-count budget (2.0,
  2.1 and 2.2 are built);
- **3.4**, top books; **5.7**, books coming out;
- **1.14c**, page counts from Hardcover, words from Calibre (D-130);
- **1.17b**, dates asked at Reading and Read, and any read re-datable (D-131);
- **5.17**, what you own: on paper, as an audiobook, both or neither (D-132);
- **4.4**, the two-way Calibre sync, one command run by hand or weekly
  (D-133): from 1.26 extract no longer loads books;
- **1.29**, the comics-only load.

The comics cutover (1.28) waits for 3.1 → 3.2 → 3.3 and 5.6 → 5.10.

### By milestone

M1–M9 are the MVP, the books cutover; they are START-HERE's sittings under
the same numbers (M7 is sitting 7). The milestone numbers are no longer the
build order: the tasklist's *Build order* is (D-129).

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
| M9 Captured from cutover on | 9 / 13 | 1.14c, 1.17b and 1.29 have no task file; 1.26 waits for them and the entries above |
| M10 Capacity: is the year overcommitted? | 9 / 14 | 2.2b (TASK-051) gates 1.26; 2.2d (TASK-050) and 2.2g (TASK-056) are Ready; 2.1b and 2.2j have no task file |
| M11–M15 Next | 1 / 28 | Not started†; 1.28, the comics cutover, is in M13 |
| M16–M26 Later | 0 / 75 | Not started; 4.4 (M16), 5.7 and 5.17 (M17) are pulled ahead of 1.26 |

### By phase

| Phase | Done / total | Status |
|---|---|---|
| 0 — Foundation | 13 / 13 | Done |
| 1 — Daily use | 40 / 45 | Open: 1.14c, 1.17b, 1.29, then 1.26 (books cutover); 1.28 (comics cutover) later |
| 2 — The pace engine | 10 / 26 | M10 in progress; 2.11a built in M7 |
| 3 — Editing | 0 / 15 | Not started; 3.4 before 1.26, 3.1–3.3 before 1.28 |
| 4 — Enrichment | 0 / 6 | Not started; 4.4 before 1.26 |
| 5 — Remaining surfaces | 0 / 16 | Not started; 5.7 and 5.17 before 1.26, 5.6 and 5.10 before 1.28 |
| 6 — Polish | 1 / 21 | Not started† |
| 7 — AI-assisted curation | 0 / 8 | Not started |
| 8 — Watchlist (film/TV) | 0 / 10 | Not started |
| 9 — Music | 0 / 8 | Not started |
| 10 — Games | 0 / 7 | Not started |

† The one Phase 6 entry checked (6.2b) is a scope note, not a shipped
feature: its work was absorbed into 2.4 and 2.6 (M12); what's left of it is a
sort order that doesn't exist until those tasks do. It is listed in M12.

The roadmap's *Later* section (L-1…L-11) holds ideas with no **Check:** and
is not counted.

## What's next

**To the books cutover**, in the tasklist's proposed order: 2.2b (TASK-051,
Ready) → 2.3 (M11) → 3.4 (M14) → 5.7 (M17) → 1.14c → 1.17b → 5.17 → 4.4 → 1.29
→ 1.26. 2.2d and 2.2g (TASK-050, TASK-056) are Ready and may go in between;
they don't gate 1.26. 1.14c, 1.17b, 1.29, 4.4 and 5.17 have proposed
**Check:** lines (the owner agrees them by merging the 2026-11-08 plans PR)
and no task file yet: `/new-task` converts them.

**After 1.26, books first (D-129):** 2.1b, 2.2d, 2.2g, 2.2j (M10), 2.7 → 2.8 → 2.10
→ 2.10b (M11), 3.5 → 3.4b (M14). **Then comics:** M12, M13 with 5.6 → 5.10
pulled ahead and 1.28 at its end, then 3.6 → 3.6b → 3.6c (M14) and M15.

Questions the task files and entries leave for their plan gates:

- **2.2b** (TASK-051): what tapping a block does before 2.3's picker sheet
  exists.
- **2.2d** (TASK-050) and **2.2g** (TASK-056): their mockup frames first.
- **1.29**: every table that references a run, an issue or a placement and
  what the comics-only load does to it; the second flag's name.
- **4.4**: the sync's route and sign-in, where the run log and a decided near
  spelling live (new tables: stop and ask), how an approximate finish is
  written to `#date_read`, and what the write-back may touch before 1.26.
- **5.17**: `owned_copies` (a new table).
- **1.17b**: its mockup frames first; stop and ask if a date's writing
  changes.
- **2.1b**: `sessions` (a new table), when it is converted.

START-HERE Step 14 is the books cutover, and Step 14b the comics cutover.

**Intakes since 2026-10-26.** The 2026-11-01 intake added 3.4b, 5.14, 9.7,
Phase 10 (games) and L-6–L-7 (D-101–D-103). The first 2026-11-02 intake added
2.10b, 5.15, 5.16, 10.6 and L-8 (D-104–D-106). The second added 2.2c, 2.2d,
2.2e, L-9 and L-10, and rewrote 5.12 as one page for every medium
(D-108–D-110): only a follow you set to *Reading* counts as reading. The same
day, the wishlist moved into extract (1.27, D-111). The 2026-11-05 intake
added 2.0b, 2.2f–2.2i, 4.5b, 5.17, 6.21 and L-11 and amended 2.2c, 2.2d, 3.4b
and 5.12 (D-117–D-125): a finish follows a book's series, subseries and
universe, the phone gets a tab row, and Top books replaces the Library's year
chips. None of these is a cutover gate except where 1.25 names one. The 2026-11-08 intake split the cutover, books first, and added 1.14c, 1.17b, 1.28 and 1.29, widened 5.17 to audiobooks and made 4.4 a two-way sync (D-128–D-133); all but 1.28 gate the books cutover. The 2026-11-09 intake added 2.2j: a book's row names its universe, then its series, on On deck, Up next, the status tabs, the Library and the plan sheet (D-134); not a gate.

**Every preview measures itself** (0.10). When Vercel reports a preview ready,
`.github/workflows/lighthouse.yml` signs in, runs Lighthouse and 0.9's tap
runner, and answers the PR with one comment. It fails only on what holds
still: a route handler requested during a load or prefetch, bytes or requests
over `scripts/perf/budget.json`, CLS of 0.1 or more, accessibility under the
recorded 100. A new top-level screen adds its route to
`scripts/perf/routes.mjs` and its budget in the same PR (`/settings` and
`/books` in M10). `docs/02-architecture.md` § 7 holds the budget and the
tests that guard it.

**The feel pass is adopted (D-40, palette 1c After hours)** and its tokens
shipped with 1.8a: `globals.css` carries the measured palette, the
self-hosted fonts (IBM Plex Sans, Plex Mono, Newsreader) and D-71's control
outlines, and `test:tokens` checks them. Every screen it draws is folded into
the task that builds it, and it beats `mockups.html` on layout and copy where
it draws: the books dashboard is 2.2's, which redraws `bdash`.
`docs/04-design.md` §9 maps each step to its task. Music (Phase 9) and games
(Phase 10) are not drawn anywhere yet; 9.0 and 10.0 design them first.

## What's actually built

- `etl/extract.py`, `etl/enrich_comics.py`, `etl/enrich_books.py`
  (Hardcover), `etl/calibre.py`, `etl/volumes.py`, `etl/fandom_titles.py`,
  `etl/check_sidecars.py`, `etl/rebuild.ps1`/`.sh`, `etl/load.ps1`/`.sh`,
  `etl/views.sql`. Also the book merge review (1.13), Calibre's words,
  series, groupings, genres and reads (1.18–1.18c), Hardcover details by
  ISBN (1.14b), held books (1.20), the wishlist review (1.27), placeholder
  titles skipped, and the prerequisite cycle report (`--fail-on-cycle`,
  2.11a)
- `src/db/schema.ts` (39 tables, migrations through
  `0021_audiobook_format`), `src/db/queries.ts`, `src/db/writes.ts`
- App routes: `/` (a route handler redirecting to the last medium touched),
  `/comics`, `/comics/runs`, `/comics/status`, `/comics/[runId]`,
  `/comics/[runId]/add`, `/books` (a redirect to `/books/list` until 2.2),
  `/books/list`, `/books/status`, `/books/add`, `/watch` (the shell and an
  empty slate), `/inbox`, `/login`
- Route handlers: `/api/progress/{issue,range,book}`, `/api/runs/[runId]/issues`,
  `/api/metron/search`, `/api/books`, `/api/books/bulk`, `/api/books/search`,
  `/api/plan`, `/api/queue`, `/api/shelves`, `/api/inbox`, `/api/export`,
  `/api/login`, `/api/health`
- Phase 1: undo (1.2), range marking (1.1), the resume pointer (1.6),
  bulk issue entry with its review and Metron search (1.3, 1.3c, 1.3b), books
  by paste, search or hand to a destination (1.4, 1.4c, 1.4e), Hardcover
  search with source tags, as you type (1.4f, 1.22), the quick-capture inbox
  (1.4b), the dated reading log and `read_events` (1.5), start dates and a
  run's derived span (1.17), audiobooks as reads (1.23), the plan's one period
  column (1.7), design tokens and control states (1.8a), the app shell (1.8),
  its routes (1.8c), failed-write retry, skeletons and row markup (1.8d), the
  834px frames (1.8e), the thumb bar (1.8b), the comics Up next queue (1.10),
  comics Add on the last run (1.19), the status screens (1.9), slowed failed
  sign-ins (1.11), the volume map in `volume_rules` (1.12), series, author
  and universe follows (1.15), *Unlisted* (1.21) and dates in
  `America/New_York` (1.16)
- Placement-keyed read state (0.8a), the spine's read-elsewhere hint (0.8b),
  and the browser test harness (0.11), with a core scope locally and the full
  suite sharded four ways in CI (D-80, D-97)
- `.github/workflows/`: CI, nightly backup to Cloudflare R2 (D-66), Release,
  Lighthouse on every preview, Neon preview-branch cleanup, and the `@claude`
  and PR-review runs
- Claude Code starter kit 2.9, customized: `.claude/kit.json`, the skills,
  the test-runner, test-auditor, spec-reviewer, ui-verifier and
  `schema-reviewer` agents, and the protected-path and post-edit hooks; the
  planning docs in the kit's layout (`docs/01`–`06`) since 2026-10-21

## Open (non-blocking) decisions

Settled 2026-09-20 (`docs/review/decisions.md` D-3). Every default below is
already accepted and in effect, and nothing here blocks work. Revisit one
only if you want to reconsider it:

- Rating scale — default: top-10 ranking only, no star scale
- Collapse finished eras on runs over 100 issues — default: yes, with a count
- Top-books list cap — default: capped at 10
- Franchise ordering — default: release order

Asked at a plan gate when the task arrives (data model § 4.1): the schema
additions 2.1b (`sessions`), 2.2c (`shelf_follows`), 2.10b or 2.2e
(`books.added_at`), 3.5, 4.1, 5.1, 5.6, 7.8 and 8.1 propose; where 4.4
remembers a decided Calibre review row; where 8.3's saved views keep their
hand-added and removed titles; 5.13's series key; 9.0's media bar with a
fourth medium.

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
