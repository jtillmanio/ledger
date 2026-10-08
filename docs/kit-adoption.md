# Kit adoption: Claude Code starter kit 2.3.1

Written by `/adopt` on 2026-10-08 against `main` at `69c5e8d` (PR #53, the kit
install). `/customize-kit` and `/milestones` read this file first and treat it
as confirmed facts. It is a snapshot: where it disagrees with
`src/db/schema.ts`, `etl/views.sql` or `docs/TASKS.md`, those win (D-1).

Owner answers at the first gate (2026-10-08):

- **Task list.** `docs/TASKS.md` stays both the roadmap and the task list, and
  outranks the kit's task files. `/new-task` converts one sitting at a time
  into `docs/tasks/TASK-###-*.md`, copying each **Check:** verbatim into the
  acceptance criteria. `/milestones` runs only as a coverage check and writes
  nothing.
- **Decisions.** `docs/review/decisions.md` (D-n) stays the log of record.
  `docs/decisions.md` points there and holds only stack and hosting rows (K-n)
  the D-log never recorded.
- **Precedence.** `CLAUDE.md` § Which document wins (D-1, amended by D-31 and
  D-40) replaces the kit's "the design wins" default.
- **Product brief.** `README.md` + `docs/HANDOFF.md` § 1; no new file.

Assumed and stated at the gate, not objected to: mockup `data-id`s are the
S-IDs, and `.claude/rules/git.md` beats the kit's flow on branch names, commit
and PR format, and when a PR is ready. `DEPLOY.md` does not exist; deploy maps
to `docs/START-HERE.md` Steps 13–14, `release.yml` and `git.md` § Merging.

## Role map

| Role | Path | Confidence |
|---|---|---|
| Product brief | `README.md` + `docs/HANDOFF.md` § 1. Who and what | confirmed |
| Features | `docs/FEATURES.md`: scope, tiers, per-screen copy (Part 2c). No feature IDs; `docs/TASKS.md` numbers are the IDs | high |
| Screen inventory | `design/mockups-index.md` (40 `data-id`s, superseded-frame table) + `design/screenshots/README.md` | high |
| Design brief / intent | `design/STYLE_GUIDE.md` § 14–§ 16 (the feel pass, D-40) | medium |
| Design source of truth | `design/mockups.html` (layout, copy); `design/Ledger Feel Review.dc.html` + `design/LedgerDesktop.dc.html` (what the feel pass draws, D-40); the `design/*.dc.html` spec pages (tokens, geometry, states, D-31) | high |
| Design tokens | `design/tokens.css` → `src/app/globals.css` (`npm run test:tokens` checks parity) | high |
| Reference screenshots | `design/screenshots/{phone,tablet,desktop}/` (38 PNGs, palette 1c) | high |
| Design process notes | `docs/DESIGN.md` (index), `design/handoff/`, `docs/review/NEW_UI_AUDIT_REPORT.md`, `docs/review/UI_AUDIT_REPORT.md` | medium |
| Architecture | `docs/ARCHITECTURE.md` (in `docs/`, not the root as the hint said) | high |
| Data model | `src/db/schema.ts` (28 tables) + `etl/views.sql` (17 views, 1 function); narrative in ARCHITECTURE § 2, ER diagrams in `docs/DIAGRAMS.md` § 1 | high |
| Domain specs | ARCHITECTURE § 4 (readiness states), § 5 (performance budget, `scripts/perf/budget.json`); `design/Telescope Spec.dc.html`; `design/Plan Rail Spec.dc.html`; FEATURES Part 2d (unlock cost, pace) | medium |
| Deploy (not a kit role) | `docs/START-HERE.md` Steps 13–14, `.github/workflows/release.yml`, `.claude/rules/git.md` § Merging | high |
| Roadmap (source) | `docs/TASKS.md`, phases 0–8 | high |
| Task list | `docs/TASKS.md`; kit task files in `docs/tasks/`, one sitting at a time | confirmed |
| Decisions | `docs/review/decisions.md` (D-1…D-40); `docs/decisions.md` (K-1…K-8 + pointer) | confirmed |

Other documents, and what they are:

| File | One line |
|---|---|
| `docs/STATUS.md` | Rollup of TASKS.md: 12 of 93 done, Phase 0 complete, what's next (1.2 → 1.1 → 1.6) |
| `docs/HANDOFF.md` | Full project narrative for a new conversation: who, why, migration findings, open questions |
| `docs/START-HERE.md` | The owner's runbook, setup to cutover (Steps 1–14). Don't run its commands unless asked |
| `docs/OWNER-CHECKLIST.md` | Owner-only actions and decisions, ticked |
| `docs/CLAUDE-CODE.md` | Technique: the four-phase Explore → Plan → Implement → Review loop, session hygiene |
| `docs/CLAUDE-CODE-PROMPTS.md` | Per-task model, effort and paste-in prompts (ranks below TASKS.md) |
| `docs/DIAGRAMS.md` | Mermaid: data model, readiness, flows |
| `docs/review/LEDGER.md` | Every review finding (R0–R3, S, M, N) with status and owner note |
| `docs/review/PROTOCOL.md` | How an independent review is run |
| `docs/review/{R0,R1,R2,R3,S,M}-findings.md` | Each review round's findings |
| `docs/claude-kit/*` | The kit's own guides (README, USER-GUIDE, ADOPTING, WORKFLOW, KICKOFF, CHANGELOG) |
| `design/mockups-index.md` | Screen-id table and the audit passes; `scripts/screen.ps1 <id>` prints one screen |
| `design/handoff/` | Feel-pass handoff: D-40 text, implementation checklist, contrast report, palette swaps |

## Design inventory

Widths: `design/mockups.html` draws every screen at phone (360–412px class) and
desktop, with a light/dark toggle on the page. Feel-pass PNGs are phone 390,
tablet 768 and desktop 1280 (plus 1024 for `/comics`), dark and light. States:
by D-27 (accepted risk) the mockup draws populated states for most screens;
empty, loading, offline and error are drawn for the comics dashboard, spine,
status, queue, add flows and books *Reading now*, and specified in text for the
rest (TASKS *UX floor*, FEATURES Part 2c → Everywhere). "Use the UX floor" in
the States column means that.

| S-ID | Screen | Design file | Screenshots | States shown | Frames (phone / desk) | Tasks |
|---|---|---|---|---|---|---|
| S-home | Comics dashboard | mockups `home` (superseded by Feel Review § 2, § 3, § 10c, § 11) | phone/01–08, 19–20; tablet/01–02; desktop/01–06 | populated, mark sequence, all caught up | 1 / 1 | 2.4, 1.10, 1.8b, 1.8 |
| S-runs | Run list | mockups `runs` | — | populated, saved views | 1 / 1 | 2.9 |
| S-spine | Run detail | mockups `spine` (hero superseded by Feel Review § 6) | phone/15–16 | populated, hint, Hide read, covers | 1 / 1 | 0.8b (built), 1.6, 2.5b, 3.6, 3.6b, 3.6c, 4.3 |
| S-range | Range marking | mockups `range` | — | populated | 1 / 1 | 1.1 |
| S-addsearch | Add issues: search | mockups `addsearch` | — | populated, insertion preview | 1 / 1 | 1.3b |
| S-bulk | Add issues: type it | mockups `bulk` | — | populated, insertion preview | 1 / 1 | 1.3, 1.3c |
| S-newrun | New run | mockups `newrun` | — | populated | 1 / 1 | 3.2 |
| S-ai | AI review | mockups `ai` | — | populated | 1 / 1 | 7.3, 7.4, 7.5 |
| S-bdash | Books dashboard | mockups `bdash` (superseded by Feel Review § 4, § 11) | phone/09–12; desktop/07–10 | reading, between books, unquartered | 2 / 1 | 2.2, 2.2b, 2.8 |
| S-status | Status: In flight · Up next · Done | mockups `status` | — | populated, comics empty | 1 / 1 | 1.9, 8.8 |
| S-plan | Plan by quarter | mockups `plan` | — | populated | 1 / 1 | 2.3, 2.10 |
| S-moveplan | Move / add to a quarter | mockups `moveplan` | — | populated, over capacity | 1 / 1 | 1.7, 1.4c, 2.3 |
| S-blist | Master list | mockups `blist` | — | populated, finish-date picker | 2 / 1 | 1.5, 6.10 |
| S-add | Add books | mockups `add` | — | populated | 1 / 1 | 1.4, 1.4c |
| S-shelves | Shelves | mockups `shelves` | — | populated | 1 / 1 | 5.1 |
| S-top | Top books | mockups `top` | — | populated | 1 / 1 | 3.4 |
| S-search | Search | mockups `search` | — | populated | 1 / 1 | 6.1 |
| S-stats | Stats | mockups `stats` | — | populated | 1 / 1 | 6.2 |
| S-capture | Quick capture | mockups `capture` | — | populated | 1 / 1 | 1.4b |
| S-watchlist | Watch dashboard | mockups `watchlist` (superseded by Feel Review § 5) | phone/13–14 | populated | 1 / 1 | 8.7 |
| S-franchise | Franchises | mockups `franchise` | — | populated | 1 / 1 | 8.5 |
| S-watchadd | Watch: search and add | mockups `watchadd` | — | populated, TMDB error → Save to inbox | 2 / 1 | 8.2 |
| S-bookdetail | Book detail sheet | mockups `bookdetail` | — | populated | 1 / 1 | 3.5 |
| S-titledetail | Show detail: seasons | mockups `titledetail` | — | populated | 1 / 1 | 8.4 |
| S-settings | Settings | mockups `settings` | — | populated | 1 / 1 | 2.0, 6.11 |
| S-telescope | Telescope variants | mockups `telescope`; `design/Telescope Spec.dc.html` | — | floor, overflow, two-rail, empty, dense | 4 / 1 | 2.5, 2.5b |
| S-tracks | Tracks | mockups `tracks` | — | populated | 1 / 1 | 5.2 |
| S-queue | Comics Up next queue | mockups `queue` | — | populated, lifted row, Stopped, empty | 4 / 1 | 1.10 |
| S-path | Why blocked? / unlock preview | mockups `path` | — | populated | 2 / 1 | 2.6 |
| S-issuedetail | Issue detail sheet | mockups `issuedetail` | — | populated | 1 / 1 | 3.5 |
| S-krakoa | Run detail, 641 issues | mockups `krakoa` | — | populated, minimap, copy menu | 1 / 1 | 2.5b, 3.6, 3.6b, 3.6c |
| S-batch | Batch sheet | mockups `batch` | — | populated | 1 / 1 | 1.8b |
| S-session | Reading sessions | mockups `session` | — | populated | 2 / 1 | 2.1b |
| S-dashextras | Dashboard extras | mockups `dashextras` (*Since Tuesday* superseded by Feel Review § 2) | — | tonight, since, inbox chip, timer chip | 1 / 1 | 2.4, 1.4b, 6.12 |
| S-states | Shared states | mockups `states` (empty dashboard superseded by Feel Review § 10a) | phone/19–20 | offline, loading, empty, metadata pending, all read here, covers | 8 / 1 | UX floor; 2.4, 3.6c, 4.3 |
| S-apistates | Live-API states | mockups `apistates` | — | loading, rate-limited, error | 3 / 1 | 1.3b, 1.4c, 8.2 |
| S-rebalance | Rebalance sheet | mockups `rebalance` | — | populated, settled year | 2 / 1 | 2.7 |
| S-planmonth | Plan rail details | mockups `planmonth` (month view retired, D-38) | — | estimates, stacks, drag | 1 / 1 | 2.2b |
| S-watchempty | Watch: first run | mockups `watchempty` | — | empty | 1 / 1 | 8.7 |
| S-palette | Ctrl K palette | mockups `palette` | — | populated | 2 / 1 | 6.1 |
| S-runcomplete | Run complete | Feel Review § 7, § 11 (not in mockups) | phone/17–18; desktop/11–12 | completion | — | 2.12 |
| S-blockcomplete | Block complete | Feel Review § 10b, § 11 (not in mockups) | phone/21–22; desktop/13–14 | completion | — | 2.12 |
| S-login | Sign in | none (v1 page exists) | — | — | — | 1.11, 6.13 |

### Design vs. docs and code: mismatches

| # | Where | Mismatch | Resolution |
|---|---|---|---|
| 1 | `src/app/page.tsx:11` | v1 `/` draws issue progress against the whole catalog (`catalogTotals`); CLAUDE.md and D-40 forbid it, and `/` must redirect to the last-touched medium | Scheduled: 1.8 (shell, redirect), 2.4 (dashboard) |
| 2 | `src/app/comics/(list)/page.tsx` | `/comics` is the run list; the design puts the dashboard there and the list at `/comics/runs` | Scheduled: 1.8, 2.4, 2.9 |
| 3 | `src/app/books/page.tsx:85` | Reads `finished_year` and `planned_year`; D-21 and D-37 derive both | Scheduled: 1.5, 1.7 |
| 4 | mockups `home`, `bdash`, `watchlist`, `spine` hero, `states` empty, `dashextras` | Superseded by the feel pass on layout and copy | Each task redraws its frame (standing rule 6); table in `design/mockups-index.md` |
| 5 | Feel Review run/block complete | No `data-id` in `mockups.html` | 2.12 adds them (proposed S-IDs above) |
| 6 | Watch on desktop | Not drawn by the feel pass | Open in TASKS 8.7 |
| 7 | Sign-in screen | Not drawn anywhere | Use the UX floor; 1.11 changes behaviour only |

## Toolchain inventory

All scripts are in `package.json`. None was run by `/adopt` (read-only). "cmd"
means the script has no Bash-only syntax and should run under `cmd.exe /c`;
`/customize-kit` runs each once to confirm.

| Purpose | Command | Exists | cmd | Notes |
|---|---|---|---|---|
| Install | `npm ci` | yes | yes | Node 22 (`.nvmrc`); Python 3.12 + pandas, openpyxl for ETL |
| Dev server | `npm run dev` | yes | yes | Needs `.env`; port via `npm run dev -- --port <n>` |
| Typecheck | `npx tsc --noEmit` | yes (no npm alias) | yes | |
| Lint | `npm run lint` | yes | yes | `eslint . --max-warnings 0`; single file `npx eslint <file> --max-warnings 0` |
| Unit/integration | `npm test` | yes | yes | Vitest, 154 cases in 23 files under `test/`; refuses without `TEST_DATABASE_URL` |
| Single test file | `npx vitest run test/<name>.test.ts` | yes | yes | Python: `py -m unittest discover -s etl -p test_<name>.py` |
| SQL view tests | `npm run test:views` | yes | yes | `etl/test_views.sql` against the test DB, rolls back |
| ETL tests | `npm run test:etl` | yes | yes | 125 `unittest` cases in 5 files, no network; CI calls `python` instead of `py` |
| Token checks | `npm run test:tokens` | yes | yes | No DB |
| Migration checks | `npm run check:migrations` | yes | yes | Diffs `drizzle/` against `main`; needs main's history |
| Full gate | `npm run test:all`, `/verify` | yes | yes | tokens → migrations → test-db reset → vitest → views → etl; `/verify` adds tsc, lint, build |
| E2E | — | **no** | — | No Playwright or axe suite; Lighthouse + tap runner in `scripts/perf/` run in CI only |
| Build | `npm run build` | yes | yes | CI passes a dummy `DATABASE_URL` |
| Migrate (test DB) | `npm run test:db:reset` | yes | yes | `drizzle-kit migrate` then `etl/views.sql` |
| Migrate (dev DB) | `npm run db:migrate`, `npm run db:views` | yes | yes | `.env` only; never production once `LEDGER_LIVE=true` |
| Seed / load | `npm run extract`, `npm run seed` (`etl/load.ps1`), `npm run rebuild` | yes | yes (call PowerShell) | `seed:bash`, `rebuild:bash` need Bash |

**CI** (`.github/workflows/`):

| Workflow | Job | Trigger | Runs |
|---|---|---|---|
| `ci.yml` CI | `check` | pull_request, push to main | tsc, lint, test:tokens, check:migrations, test:db:reset, vitest, test:views, ETL unittests, build; `postgres:18` service. Green on main's last 3 runs |
| `lighthouse.yml` | `plan`, `measure`, `report` | deployment_status (Vercel preview), dispatch | Lighthouse budgets + tap runner, PR comment |
| `release.yml` | `release` | dispatch only | CI check, Neon snapshot, migrate, views, promote, smoke `/api/health` |
| `backup.yml` | `dump` | nightly, dispatch | `pg_dump`, restore drill, commit dump |
| `claude-pr-review.yml` (kit) | `review` | PR ready_for_review, reopened | Claude code review. **Secret `CLAUDE_CODE_OAUTH_TOKEN` is not set** |
| `claude.yml` (kit) | `claude` | `@claude` comments | Same missing secret |

The kit's placeholder `ci.yml` was not installed (the installer skipped it);
nothing to delete.

**Database.** Postgres 18 on Neon; Drizzle ORM + drizzle-kit; `drizzle/0000`–`0007`
(8 migrations), `drizzle/down/0004_date_precision.sql` and
`0007_placement_progress.sql`; `etl/views.sql` re-applied after every migrate.
Four databases (CLAUDE.md): production (GitHub `DATABASE_URL` secret, local
`.env.live` only), a Neon branch per PR preview, test (`TEST_DATABASE_URL`),
development (`.env`). No real connection string is in a tracked file; the Neon
hosts in `.env.example` and `test/*.test.ts` are fake fixtures.

**Hosting.** Vercel (`vercel.json`: `scripts/vercel-build.mjs` migrates only the
preview's own Neon branch and refuses the live host; `scripts/vercel-ignore.mjs`).
Env var names: `DATABASE_URL`, `TEST_DATABASE_URL`, `OWNER_ID`, `OWNER_NAME`,
`APP_PASSCODE`, `SESSION_SECRET`, `TMDB_API_KEY`, `METRON_API_TOKEN`,
`METRON_USERNAME`, `METRON_PASSWORD`, `LEDGER_LIVE`. GitHub secrets:
`APP_PASSCODE`, `DATABASE_URL`, `NEON_API_KEY`, `SESSION_SECRET`,
`VERCEL_AUTOMATION_BYPASS_SECRET`, `VERCEL_TOKEN`; variables `LEDGER_LIVE`
(false), `NEON_PROJECT_ID`, `PRODUCTION_URL`, `VERCEL_SCOPE`.

**Work tracking.** `docs/TASKS.md` (93 tasks), `docs/STATUS.md`,
`docs/OWNER-CHECKLIST.md`, `docs/review/LEDGER.md`. No open GitHub issues. Open
PR: #54 (Dependabot, `next` 16.3.7 → 16.3.8), unrelated to adoption.

## Built-state table

Phase 0 is ticked in TASKS.md and its code exists; later phases were checked
against the code.

| Item | Status | Evidence |
|---|---|---|
| 0.1–0.10 Foundation (11 tasks) | built | `test/` harness; `.github/workflows/ci.yml`; `drizzle/0005_schema_additions.sql`, `0006_soft_delete_indexes.sql`, `0007_placement_progress.sql`; `src/components/IssueRow.tsx`; `scripts/perf/`; `lighthouse.yml` |
| 6.2b True unlock cost | moved (scope note, not a feature) | TASKS 6.2b: absorbed into 2.4/2.6 |
| 1.2 Undo, 1.1 Range marking, 1.6 Resume pointer | not built | no `undo`/`resume` anywhere in `src/` |
| 1.3, 1.3b, 1.3c Bulk and Metron add | not built | no add routes in `src/app/` |
| 1.4, 1.4b, 1.4c, 1.4d Books add, inbox, wishlist promotion | not built | no inbox table or add route; `wishlist` table still loaded (`src/db/schema.ts:278`) |
| 1.5 Dated reading log | not built | `book_status.finished_year` still stored (`src/db/schema.ts`), read in `src/app/books/page.tsx:85`; no `read_events` |
| 1.7 One period column | not built | `reading_plan` still has `planned_year`/`planned_quarter`, `reading_settings.plan_granularity` (`src/db/schema.ts:346`, `:358`) |
| 1.8a Design tokens and control states | partial | palette 1c token values and fonts in `src/app/globals.css`, `src/app/fonts/` (D-40); control states not built |
| 1.8, 1.8b App shell, thumb bar | not built | no shell, rail, media bar or thumb bar in `src/app/layout.tsx` |
| 1.9 Status screens | not built | no `/comics/status` route |
| 1.10 Comics Up next queue | not built | no `run_queue` table |
| 1.11 Slow failed sign-ins | not built | no delay in `src/app/api/login/route.ts` |
| 2.0 Settings | partial | `reading_settings` table (`src/db/schema.ts:358`); no page |
| 2.1, 2.1b Capacity, sessions | not built | no capacity view in `etl/views.sql` |
| 2.2, 2.2b Books dashboard, plan rail | partial | v1 `/books` list with status chips (`src/app/books/page.tsx:50`); no dashboard, no rail |
| 2.4 Comics dashboard | partial | v1 `/` with in-progress and ready runs (`src/app/page.tsx:11`), but against the catalog (mismatch 1) |
| 2.5, 2.5b Telescope | partial (data only) | `run_read_segments` (`etl/views.sql:198`), `block_position` (`:338`); no `src/components/telescope/` |
| 2.6 Unlock cost | partial (data only) | `run_ancestors()` (`etl/views.sql:232`) |
| 2.9 Run list grouped | partial | v1 run list with track and readiness filters (`src/app/comics/(list)/page.tsx:15`) |
| 2.11a Cycle check | not built | only comments in `etl/views.sql:230` |
| 2.3, 2.7, 2.8, 2.10, 2.12 | not built | no routes or views |
| 3.6 Eras | partial (schema only) | `eras` table, `run_issues.era_id` (`src/db/schema.ts:107`, `:126`) |
| 3.1–3.5, 3.6b, 3.6c, 3.7 Editing | not built | only `/api/progress/*` writes exist |
| 4.1–4.3 Enrichment in app | not built (ETL side built) | `etl/enrich_comics.py`, sidecars; no cover UI |
| 5.1 Shelves | partial (schema only) | `shelves`, `shelf_books` (`src/db/schema.ts:375`, `:384`) |
| 5.7 Books coming out | partial | `releases` table; `upcomingReleases()` on v1 `/` |
| 5.2, 5.4–5.6, 5.8 | not built | — |
| Phase 6 (14 open), 7 (6), 8 (8) | not built | no `titles`/`seasons` tables, no TMDB client |

Counts: **built 11**, **partial 12**, **not built 69** (plus 6.2b moved), out of 93.

## Inputs for /customize-kit

**`verify`**

```json
"sourceExtensions": [".ts", ".tsx", ".mjs", ".css", ".sql", ".py"],
"fast": ["npx tsc --noEmit --pretty false", "npx eslint {file} --max-warnings 0"],
"full": ["npx tsc --noEmit", "npm run lint", "npm run test:all", "npm run build"]
```

`full` equals `/verify` and CI `check`. `npm run test:all` needs
`TEST_DATABASE_URL`; `npm run build` needs a `DATABASE_URL` set (any value; CI
uses a dummy). `.sql` and `.py` edits should run only the typecheck part of
`fast` or nothing (eslint does not lint them); decide in `/customize-kit`.

**`testAudit`**: `testPathPatterns`: `test/*.test.ts`, `test/*.test.tsx`,
`etl/test_*.py`, `etl/test_views.sql`. `run`: `npx vitest run {tests}` for
Vitest files; Python tests go through `py -m unittest discover -s etl -p <file>`.

**`ui`**: `startCommand` `npm run dev -- --port {port}`; `baseUrl`
`http://localhost:{port}`; viewports 360, 390, 412 (phone), 768 (tablet, D-33),
1024 and 1280 (desktop), per the TASKS UX floor; every route but `/api/health`
is behind the passcode gate (`src/proxy.ts`), so ui-verifier signs in with the
development `APP_PASSCODE` first. Proposed `designFiles`:

```json
["design/mockups.html", "design/Ledger Feel Review.dc.html", "design/LedgerDesktop.dc.html",
 "design/tokens.css", "design/STYLE_GUIDE.md", "design/screenshots/README.md"]
```

**`workflow`**: `worktreeSetup` `["npm ci"]`; `worktreeCopyFiles` `[".env"]`
(development + `TEST_DATABASE_URL`; never `.env.live`). `wipLimit` **1**, not
the kit's 2: every worktree's `.env` names the same test database, which
`test:db:reset` rebuilds and vitest truncates, so two sessions running
`verify.full` or the test audit at once break each other (G-14). Raise it only
once each worktree gets its own test database.

**`protectedPaths`** (keep the kit defaults), proposed:

| Pattern | Reason |
|---|---|
| `.env.live` | Production connection string |
| `design/*.dc.html`, `design/tokens.css`, `design/STYLE_GUIDE.md`, `design/handoff/**`, `design/screenshots/**`, `design/archive/**` | Design source of truth; changes come from the design tool |
| `etl/data/*.xlsx` | The owner's workbooks; nothing writes back (CLAUDE.md) |
| `seed/**`, `backups/**` | Generated by extract and the nightly job |
| `src/app/fonts/**` | Vendored font files |

**Not** the migrations (G-17): a list of applied ones (`drizzle/000[0-7]_*.sql`)
goes stale the first time a migration merges, and a blanket `drizzle/0*.sql`
would block a branch regenerating its own unmerged migration.
`npm run check:migrations` enforces the real rule (nothing already on `main`
edited, standing rule 3) locally and in CI.

**Not** `design/mockups.html` or `design/mockups-index.md`: standing rule 6
makes a UI task redraw its mockup frame in the same PR. Protecting them would
block every UI task. (Decision for `/customize-kit`: protect them anyway and
make the redraw an owner step, or leave them editable as today.)

**Hard-rule candidates** (pick 3–6; each is checkable against a diff):

1. Nothing derived is stored: no count, percentage, rollup, status, span,
   credit line or finish/plan year column; it goes in `etl/views.sql`.
2. Per-user facts live in progress tables keyed `(user_id, entity_id)`; comics
   read state keys on the placement (`run_issues.id`), never on the issue.
3. Soft delete only: every read filters `deleted_at IS NULL`; removing a
   placement soft-deletes it.
4. Tests and anything that truncates read `TEST_DATABASE_URL` only; nothing
   aims at `DATABASE_URL` or `.env.live`.
5. Styling uses the custom properties in `src/app/globals.css`: no literal hex
   or `#fff`, no Tailwind classes, nothing red on a dashboard, every meter fills
   with `--ready`.
6. A new table is added to `src/db/export-tables.ts`, and a migration that
   drops or retypes a column ships `drizzle/down/<tag>.sql`, in the same PR.

**spec-reviewer project checks**: the task's **Check:** in `docs/TASKS.md` is
met exactly as written; the TASKS *UX floor* (states, 4.5:1 text, 44px thumb
bar, 24px floor, real buttons, glyph + text badges) for UI tasks; the feel pass
or mockup frame the task names was followed, and standing rule 6's redraw is in
the diff; the TASKS.md checkbox is ticked; no progress drawn against the
catalog; the mark verb names the issue by label.

**schema-reviewer**: its 12 Ledger checks are already in place (Phase 0
merge); `/customize-kit` only needs to confirm the migration specifics
(`drizzle/`, `NNNN_<name>.sql`, `drizzle/down/<tag>.sql`).

**Branch protection.** CI job to require: `check` (workflow *CI*). GitHub
returns 403 for rulesets on this private free-plan repo, so protection cannot
be enabled; the `permissions.deny` rules in `.claude/settings.json` are the only
guard (see gap G-3).

**Kit `ci.yml`**: not present; nothing to delete.

**PR template**: `.github/pull_request_template.md` is the kit's; merge in
`git.md`'s body sections (What · Why · How it was verified · Follow-ups).

**Kit workflows**: bump `actions/checkout@v6` to `@v7` in `claude.yml` and
`claude-pr-review.yml`, to match the repo's other workflows (G-18).

**Level 2 procedure** (G-13). The dispatcher starts only from `main`, checked
out, clean and level with `origin/main`, with the approved plans committed.
`git.md` forbids committing to `main`, so plans reach it through a PR:

1. On an up-to-date `main`, run `/plan-batch`. It edits task files only and
   commits nothing, so each `planned_at_commit` is a `main` commit, which
   still exists after the squash merge.
2. Review, set `plan_status: approved`, then `git switch -c docs/plans-<date>`
   (the uncommitted plans come along), commit by path, push, open a PR.
3. The owner merges it. `git switch main`, `git pull --ff-only`, then
   `dispatch-approved.ps1 -DryRun` and dispatch.

Few tasks qualify anyway: the kit keeps anything touching schema, ETL or
deletion `attended`, and most of TASKS.md does.

## Inputs for /milestones

- **Mode**: coverage check only, writing nothing (owner, 2026-10-08).
- **Source roadmap**: `docs/TASKS.md`, phases 0–8; build order is START-HERE
  Steps 11–14 and STATUS *What's next*: 1.2 → 1.1 → 1.6, with 2.11a and 1.11 at
  the end of Phase 1 before cutover.
- **Exclude as built**: 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8a, 0.8b, 0.9,
  0.10; 6.2b (moved into 2.4/2.6).
- **Partial**: see the built-state table; the task that finishes each is its
  TASKS number.
- **Toolchain gaps to schedule as early task stubs**:
  1. E2E and axe harness (Playwright + axe-core) for the UX floor and the
     feel-pass checks that TASKS 1.8b and the header already require ("an axe
     pass … reports no new violations"); before 1.8. (G-6)
  2. Convert the first sitting (1.2, 1.1, 1.6) with `/new-task`, after
     `/customize-kit`. (Owner decision: per sitting.)

## Gap report

Class: **BLOCKS TASKS** (acceptance criteria can't be written or checked),
**BLOCKS UNATTENDED** (fine attended, needed before Level 2), **NICE**.

| # | Area | Gap | Class | Fix |
|---|---|---|---|---|
| G-1 | Toolchain | `.claude/kit.json` `verify`, `testAudit`, `ui` are empty, so the post-edit hook and test-runner do nothing | BLOCKS TASKS | **task**: `/customize-kit` (inputs above) |
| G-2 | Workflow | Kit task IDs are sequential `TASK-###` and its branches/PR titles follow them; TASKS.md numbers (`1.2`), `git.md` branches (`task/1.2-undo`) and commit areas (`task 1.2:`) don't | BLOCKS UNATTENDED | **decision**: keep `TASK-###` file IDs but title each `1.2 Undo` and keep git.md's branch and PR names (proposed), or name files by TASKS number |
| G-3 | CI / data safety | No branch protection possible (private repo, free plan: rulesets 403). The deny rules cover the `Bash` tool only; the `PowerShell` tool can still `git push origin main` | BLOCKS UNATTENDED | **decision**: accept, or GitHub Pro. **doc/config**: add matching `PowerShell(...)` deny rules in `/customize-kit` |
| G-4 | CI | `claude-pr-review.yml` and `claude.yml` need `CLAUDE_CODE_OAUTH_TOKEN`, which isn't set; the kit's flow marks every draft PR ready, which triggers a failing review job | BLOCKS UNATTENDED | **decision**: run `/install-github-app`, or delete one or both workflows |
| G-5 | Workflow | Kit "Done = owner accepts" vs. TASKS "tick the checkbox in the same PR" vs. STATUS.md rollup: three status records for one task | BLOCKS UNATTENDED | **doc**: append to `CLAUDE.md` § Kit task loop — tick TASKS.md in the PR (unchanged), task file goes `Review` → `Done` on the owner's accept, STATUS.md is regenerated as today |
| G-6 | Testing | No e2e or axe suite, though the UX floor and 1.8b require axe passes and screenshots at six widths | BLOCKS UNATTENDED (UI tasks) | **task**: stub before 1.8 |
| G-7 | Decisions | `docs/review/decisions.md` uses D-24, D-25, D-26 and D-27 twice each; CLAUDE.md's "D-24 / D-25 / D-26" mean the second set | NICE | **decision**: renumber the second set D-41…D-44 in a separate `docs/` PR, or append a note disambiguating them (e.g. D-24a/b) |
| G-8 | Screens | Feel-pass-only screens (run complete, block complete) have no `data-id` | NICE | Proposed S-IDs above; 2.12 adds them |
| G-9 | Docs | `docs/STATUS.md` *What's actually built* says `.claude/` has only `/verify` and `schema-reviewer` | NICE | **doc**: regenerate STATUS after adoption merges |
| G-10 | Docs | `docs/CLAUDE-CODE.md` and `docs/CLAUDE-CODE-PROMPTS.md` describe a hand-driven four-phase loop; the kit's `/implement-task` now does the same job | NICE | **decision**: which drives a session; append a pointer to the loser |
| G-11 | Docs | `CLAUDE.md` is ~470 lines; the kit aims for ~100 so hard rules stay salient | NICE | **decision**: leave, or move *Non-obvious rules* detail to `.claude/rules/*.md` (path-scoped) in a later `claude:` PR |
| G-12 | Scope | `docs/FEATURES.md` has no feature IDs or MVP cut | NICE | None needed: TASKS numbers, phases and the cutover gate (Phase 1 + 2.11a + 1.11) are the IDs and the cut |
| G-13 | Workflow | `dispatch-approved.ps1` sees only plans committed on `main`; `git.md` forbids commits there | BLOCKS UNATTENDED | **doc**: plans reach `main` through a `docs/plans-<date>` PR (Inputs for /customize-kit, *Level 2 procedure*) |
| G-14 | Data safety | Parallel worktree sessions share one `TEST_DATABASE_URL`; `test:db:reset` and vitest's truncation collide at the kit's `wipLimit` 2 | BLOCKS UNATTENDED | **config**: `wipLimit` 1 until worktrees get their own test database |
| G-15 | Workflow | implement-task stages with `git add -A` (git.md forbids it), appends decisions to `docs/decisions.md` (the pointer file says never), and marks a PR ready on CI alone (git.md also needs the preview, Lighthouse and a preview walk) | BLOCKS TASKS | **doc**: overrides in `CLAUDE.md` § Kit task loop. Not in the skill file: `install-kit.ps1 -Upgrade` overwrites kit-owned skills |
| G-16 | Workflow | The kit's flow ends at merge, its CI-fix loop can't see a failed Vercel preview build, and its size check splits large tasks where TASKS.md needs one PR per number | BLOCKS UNATTENDED | **doc**: overrides in `CLAUDE.md` § Kit task loop |
| G-17 | Config | The proposed migration `protectedPaths` list goes stale when the next migration merges | NICE | **config**: leave migrations out; `check:migrations` enforces standing rule 3 |
| G-18 | CI | Kit workflows pin `actions/checkout@v6`; the repo's are `@v7` | NICE | **config**: bump in `/customize-kit` Phase 5 |
| G-19 | Config | The kit denies `git push --force-with-lease *`; `git.md` allows it to your own branch after a rebase, so the merged `settings.json` dropped that deny | NICE | None: intentional, recorded here |

Checked and clear: stored vs. derived is explicit (ARCHITECTURE 2.2, CLAUDE.md);
performance targets have numbers (ARCHITECTURE § 5, `scripts/perf/budget.json`);
every screen has states or the D-27 note; ACs assert relationships or build
fixtures, never mockup figures (D-7); CI runs the full gate on PRs as job
`check`; development is separate from production and no credential is
tracked; the roadmap is phased with cutover risks early and Phase 0 excluded.

### Resolutions (second gate, 2026-10-08)

| Gap | Outcome |
|---|---|
| G-1 | Open: `/customize-kit`, next |
| G-2 | Decided: `TASK-###` files titled with the TASKS.md number; branch, commit and PR names follow `git.md`. Rule appended to `CLAUDE.md` § Kit task loop |
| G-3 | Decided: accepted as is. No branch protection, no extra `PowerShell(...)` deny rules; `git.md` and the `Bash(...)` deny rules are the guard |
| G-4 | Decided: keep both workflows; the owner runs `/install-github-app` (attached terminal) to set `CLAUDE_CODE_OAUTH_TOKEN`. Until then the review job fails when a PR leaves draft |
| G-5 | Fixed: `CLAUDE.md` § Kit task loop, *Three status records, one owner each* |
| G-6 | Open: task stub (Inputs for /milestones) |
| G-7 | Fixed: note appended to `docs/review/decisions.md` (D-24a/b … D-27a/b; next is D-41) |
| G-8 | Open: 2.12 adds the `data-id`s |
| G-9 | Fixed: line appended to `docs/STATUS.md` *What's actually built* |
| G-10 | Fixed: sections appended to `docs/CLAUDE-CODE.md` and `docs/CLAUDE-CODE-PROMPTS.md` |
| G-11 | Open: not asked; leave until it hurts |
| G-12 | No fix needed |

### Resolutions (after the second gate, 2026-10-08)

G-13 to G-19 came from comparing the kit's skills, scripts and guides with this
repo's Vercel, CI and Neon setup after the gap report was written.

| Gap | Outcome |
|---|---|
| G-13 | Decided: *Level 2 procedure* in Inputs for /customize-kit |
| G-14 | Decided: `wipLimit` 1 (Inputs for /customize-kit) |
| G-15 | Fixed: `CLAUDE.md` § Kit task loop (*Stage by path*, *Decisions are proposed, not written*, the readiness line) |
| G-16 | Fixed: `CLAUDE.md` § Kit task loop (*A failed preview build is not an Actions run*, *A TASKS.md task is never split*, *Merged is not live*) |
| G-17 | Decided: migrations left out of `protectedPaths` |
| G-18 | Open: `/customize-kit` Phase 5 |
| G-19 | No fix needed |
