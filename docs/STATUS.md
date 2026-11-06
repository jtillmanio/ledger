# Status

**Last regenerated:** 2026-11-06

This is a rollup of `docs/05-roadmap.md`, not a second source of truth. Every
count here comes from counting ☑ vs ☐ entries in that file, and the milestones
are `docs/06-tasklist.md`'s. If this page and the roadmap disagree, the roadmap
wins (D-1): recount and fix this page, don't argue from it.

## Where we are

**59 of 170 roadmap entries done (35%).** Phases 0 and 1 are done except
1.26, the cutover itself. M1–M8 are done, and so is M9 apart from 1.26.
Since 2026-10-26 these shipped: Calibre (1.18, 1.18b, 1.18c), Hardcover
details by ISBN (1.14b), holding unmatched books (1.20), *Unlisted* (1.21),
the Sheets parity audit (1.25), title and author cells in *Paste a list*
(1.4e), Hardcover search in Add books (1.4f), comics Add remembering the run
(1.19), search as you type (1.22), start dates (1.17), audiobooks (1.23), the
wishlist settled in extract (1.27, D-111, which removed 1.24) and the skipped
preview's redeploy (0.12). `LEDGER_LIVE` is `false`, so the database is still
disposable: `npm run rebuild` can reload it.

Cutover (1.26) now waits only for the entries 1.25 pulled ahead
(`docs/cutover-parity.md` § What cutover waits for): **2.0, 2.1, 2.2, 2.2b and
2.3**, the word-count budget; 3.1–3.3, catalog and prerequisite edits; 3.4,
top books; 5.7, books coming out; and 5.6 → 5.10, recording a trade bought.
2.2 needs 2.2e (the Library keeps a nav item once `/books` is the dashboard,
D-110), so 2.2e lands before cutover too.

### By milestone

M1–M9 are the MVP, cutover from the Sheets; they are START-HERE's sittings
under the same numbers (M7 is sitting 7).

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
| M9 Captured from cutover on | 9 / 10 | Done but 1.26, which waits for the entries 1.25 pulled ahead |
| M10 Capacity: is the year overcommitted? | 4 / 13 | In progress: 2.0, 2.1, 2.2e and 2.2c built; TASK-049–051 Ready (2.2, 2.2d, 2.2b); 2.1b and the 2026-11-05 entries have no task file |
| M11–M15 Next | 1 / 27 | Not started† |
| M16–M26 Later | 0 / 75 | Not started |

### By phase

| Phase | Done / total | Status |
|---|---|---|
| 0 — Foundation | 13 / 13 | Done |
| 1 — Daily use | 40 / 41 | Done but 1.26, cutover |
| 2 — The pace engine | 5 / 24 | M10 in progress; 2.11a built in M7 |
| 3 — Editing | 0 / 15 | Not started; 3.1–3.4 before cutover |
| 4 — Enrichment | 0 / 6 | Not started; 4.4 right after cutover |
| 5 — Remaining surfaces | 0 / 16 | Not started; 5.6, 5.7 and 5.10 before cutover |
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

**M10, in its order** (`docs/06-tasklist.md`): 2.0 ✅ → 2.1 ✅ → (2.1b) → 2.2e ✅ →
2.2c ✅ → 2.2i → 2.0b → 2.2f → 2.2h → 2.2 → 2.2d → 2.2g → 2.2b. TASK-049 to TASK-051
are Ready; each plan still answers its questions below. TASK-052 to TASK-056
(2.2i, 2.0b, 2.2f, 2.2h, 2.2g) are Draft. 2.2c, 2.2d and 2.2e had proposed Checks,
which became their **Check:** lines on 2026-11-04, and 2.0b and 2.2f–2.2i's did
on 2026-11-06. 2.1b is not pulled ahead and has no task file
yet. 2.2c and 2.2d aren't cutover gates either, so 2.0 → 2.1 → 2.2e → 2.2 →
2.2b → 2.3 is the shortest path to 1.26.

Questions the task files leave for their plan gates:

- **2.0** (TASK-045): its Check asks that 2.1's capacity view reflect an
  edit, but 2.1 is built after it. Either 2.1 proves that half, or the two
  are built together. Also open: whether *Words per page*, *Theme* and
  *Show covers* ship now.
- **2.1** (TASK-046): how an implausible page count is treated; whether a
  book already read still counts against its period.
- **2.2** (TASK-049): where the capacity decisions surface (an amber card,
  the strip's badge, or `/books/plan` only; the entry says stop and ask
  before building), and what Now shows for *p. 212 of 468* and its meter,
  since nothing stores a reading position until 2.1b's sessions.
- **2.2b** (TASK-051): what tapping a block does before 2.3's picker sheet
  exists.
- **2.2c** (TASK-048): the `shelf_follows` table (a new table).
- **2.2e** (TASK-047): the Library's route name, and *Recently added*
  (`books.added_at`, which 2.10b also proposes).
- **2.0b** (TASK-053): what a typed value may be (a number off the step, a
  fraction).
- **2.2h** (TASK-055): raising a `tracking` follow at a finish, *Not following*
  as a stored `off`, the `subseries_follows` table, what *To read* → *Read*
  follows, and whether a DNF counts as a book left.
- **2.2i** (TASK-052): the last medium's hand-off, which items prefetch, and how
  the browser test reaches *every books item enabled*.
- 2.2c, 2.2d, 2.2e, 2.2f, 2.2g, 2.2h and 2.2i draw their mockup frames first,
  before they are built.

After M10: 2.3 (M11), then 3.1 → 3.2 → 3.3 (M13), 3.4 (M14), 5.7 (M17) and
5.6 → 5.10 (M18), then 1.26. START-HERE Step 14 sets `LEDGER_LIVE=true` at
cutover, and from then on `load` and `rebuild` refuse production.

**Intakes since 2026-10-26.** The 2026-11-01 intake added 3.4b, 5.14, 9.7,
Phase 10 (games) and L-6–L-7 (D-101–D-103). The first 2026-11-02 intake added
2.10b, 5.15, 5.16, 10.6 and L-8 (D-104–D-106). The second added 2.2c, 2.2d,
2.2e, L-9 and L-10, and rewrote 5.12 as one page for every medium
(D-108–D-110): only a follow you set to *Reading* counts as reading. The same
day, the wishlist moved into extract (1.27, D-111). The 2026-11-05 intake
added 2.0b, 2.2f–2.2i, 4.5b, 5.17, 6.21 and L-11 and amended 2.2c, 2.2d, 3.4b
and 5.12 (D-117–D-125): a finish follows a book's series, subseries and
universe, the phone gets a tab row, and Top books replaces the Library's year
chips. None of these is a cutover gate except where 1.25 names one.

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
