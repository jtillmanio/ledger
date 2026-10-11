# Ledger

Personal media ledger replacing two Google Sheets. About 10,138 distinct comic
issues in 10,761 run placements across 258 runs with a prerequisite graph, plus
1,478 books (extract of 2026-09-23; the workbook is still being edited, so
re-count from a fresh extract rather than trusting these). Single user,
multi-user schema.

`docs/STATUS.md` is where we are right now — current task, what's next, what's
built. `docs/HANDOFF.md` has full project context. `docs/TASKS.md` is the
backlog, `docs/FEATURES.md` is scope, `docs/ARCHITECTURE.md` is why the schema
looks like this, `docs/DIAGRAMS.md` is visual, `docs/DESIGN.md` indexes the
styling blueprint. `docs/START-HERE.md` is the
human's runbook — don't run its commands unless asked.

## Which document wins (D-1)

When two documents disagree, believe them in this order:

1. `src/db/schema.ts` and `etl/views.sql` — the code is what actually runs.
2. `docs/TASKS.md` — the acceptance check is the contract for the work.
3. `docs/ARCHITECTURE.md` — why the schema looks the way it does.
4. `docs/FEATURES.md`, `docs/DIAGRAMS.md`, `docs/HANDOFF.md` — scope and
   narrative, drafted earliest and the most likely to have drifted.

Two riders. A document describing something not yet built says so inline —
"(task 2.5)", "(from task 0.3)" — and where it does, the current code wins and
the note tells you when that changes. And every canonical row count comes from
a fresh `etl/extract.py` run; prose that repeats a number is a copy, so correct
the prose, never the extract.

`design/mockups.html` is outside this list: it is authoritative for layout and
copy, and it beats a task description where the two disagree. The styling
blueprint (D-31) — `design/STYLE_GUIDE.md`, `design/tokens.css` and the
`design/*.dc.html` spec pages, indexed by `docs/DESIGN.md` — is outside it too:
it is authoritative for tokens, type, elevation, motion, telescope and plan-rail
geometry and component states, and beats the mockup on those. The feel pass
(D-40: `design/STYLE_GUIDE.md` §14–§16 and `design/Ledger Feel Review.dc.html`)
is part of that blueprint, and it also beats the mockup on layout and copy for
what it draws: the dashboards, the mark sequence, empty and caught-up states,
completion, the 768px tablet and desktop at 1024px and up.

`docs/CLAUDE-CODE-PROMPTS.md`, `docs/START-HERE.md`, `docs/OWNER-CHECKLIST.md`
and `docs/STATUS.md` rank **below** `docs/TASKS.md`. They are how the work is
driven, not what it must do: where a pasted prompt or a runbook step disagrees
with the task, the task wins, and the disagreement is a bug to report.

Development happens on Windows in PowerShell. Prefer `py` over `python`, and
`.\etl\load.ps1` over `etl/load.sh`. psql `\copy` paths need forward slashes
even on Windows.

## Project docs

Every kit skill and agent reads this table to find project documents (mapped
by `/adopt`, 2026-10-08; `docs/kit-adoption.md` has the inventories behind it).
`—` means the project has no such document.

| Role | Path |
|---|---|
| Product brief | `README.md` + `docs/HANDOFF.md` § 1. Who and what |
| Features (IDs, MVP cut, outcomes) | `docs/FEATURES.md` (scope); the IDs, the cut and the outcomes are `docs/TASKS.md` task numbers, phases and **Check:** lines |
| Screen inventory (S-IDs, states) | `design/mockups-index.md` (S-ID = the mockup `data-id`) + `design/screenshots/README.md` (feel-pass frames) |
| Design brief / intent | `design/STYLE_GUIDE.md` § 14–§ 16 (the feel pass) |
| Design source of truth | `design/mockups.html` (layout, copy); `design/Ledger Feel Review.dc.html` and `design/LedgerDesktop.dc.html` (what the feel pass draws); `design/*.dc.html` spec pages (geometry, states) |
| Design tokens | `design/tokens.css` → `src/app/globals.css` |
| Reference screenshots | `design/screenshots/` |
| Design process notes | `docs/DESIGN.md`, `design/handoff/`, `docs/review/NEW_UI_AUDIT_REPORT.md`, `docs/review/UI_AUDIT_REPORT.md` |
| UX floor | `docs/TASKS.md` § *The UX floor, for every UI task* (the header above Phase 0; standing rule 6) |
| Architecture | `docs/ARCHITECTURE.md` |
| Data model | `src/db/schema.ts` + `etl/views.sql` (what runs); `docs/ARCHITECTURE.md` § 2. Decisions (why); `docs/DIAGRAMS.md` § 1 |
| Domain specs (other) | `docs/ARCHITECTURE.md` § 4. Interface (readiness) and § 5. Operational posture (performance budget); `design/Telescope Spec.dc.html`; `design/Plan Rail Spec.dc.html`; `docs/FEATURES.md` § Part 2d (metrics) |
| Deploy | `docs/START-HERE.md` Steps 13–14, `.github/workflows/release.yml`, `.claude/rules/git.md` § Merging |
| Roadmap (source, if separate) | `docs/TASKS.md` (phases 0–8) |
| Task list (milestones + stubs) | `docs/TASKS.md`; `/new-task` converts one sitting at a time into `docs/tasks/`, copying each **Check:** verbatim |
| Tasks | `docs/tasks/` (fixed; Done tasks in `docs/tasks/archive/`) |
| Decisions | `docs/review/decisions.md` (IDs `D-n`) |
| Review findings | `docs/review/PROTOCOL.md` (protocol), `docs/review/LEDGER.md` (ledger; IDs `R0-nn`…`R3-nn`, `S-nn`, `M-nn`) |
| Owner runbook | `docs/START-HERE.md` |
| Owner checklist | `docs/OWNER-CHECKLIST.md` |

## Commands

```powershell
npm run dev                 # local, needs .env
npm test                    # vitest; needs TEST_DATABASE_URL (never DATABASE_URL), refuses without it
npm run test:all            # test:tokens + check:migrations + test:db:reset + vitest + test:views + test:etl, what CI runs
npm run test:db:reset       # rebuild the TEST database: drizzle-kit migrate, then etl/views.sql
npm run lint                # eslint, zero warnings
npx tsc --noEmit            # typecheck
npm run db:generate         # after editing src/db/schema.ts
npm run db:push             # apply schema.ts to DATABASE_URL with no migration — pre-cutover only, by hand
npm run db:views            # re-apply etl/views.sql to DATABASE_URL (node, not psql); rebuild and Release do it for you
npm run extract             # etl/extract.py with every sidecar CSV (see below); clears seed/ first;
                            # add --with-plan to also load the workbook's To-Read tabs (off by default)
py etl/enrich_comics.py     # Metron: dates, cover URLs, label proposals (--dry-run first)
py etl/enrich_comics.py --details  # Metron: story titles + credits, ~8,100 requests (--dry-run first)
npm run enrich:refresh      # --details --refresh: re-ask Metron about issues it credited nobody on (cache never expires)
npm run sidecars            # etl/check_sidecars.py: validate the issue sidecars, write etl/data/metadata_todo.md
                            # and etl/data/creator_review.csv (close creator names to accept or reject);
                            # an issue fandom_skipped.csv says has a blank Fandom title isn't listed as
                            # missing one (--keep-fandom-untitled lists them)
npm run sidecars:fix        # same, and apply the safe fixes (shifted columns, role spellings, label keys, creator ids)
npm run sidecars:prune-orphans  # same, plus archive-then-remove sidecar rows for labels gone from the workbook
npm run check:role-outliers # etl/check_role_outliers.py: flag Metron credits whose role looks mistagged (report only)
npm run titles:fandom       # etl/fandom_titles.py: fill missing story titles from Marvel Fandom as `hand` (--dry-run first);
                            # writes fandom_skipped.csv (what it couldn't, and why); reads hand-kept
                            # fandom_pages.csv (series -> `Name Vol N`, label -> `Name Vol N issue`)
.\etl\load.ps1              # PowerShell loader; etl/load.sh is the WSL/Git Bash twin
npm run rebuild             # drop, migrate from zero, extract, load, test_views, row counts;
                            # .env (development) by default, `-- -EnvFile .env.live` is production
                            # etl/rebuild.ps1; refuses when LEDGER_LIVE=true; twin etl/rebuild.sh
npm run test:views          # etl/test_views.sql against TEST_DATABASE_URL; rolls back
npm run test:etl            # py -m unittest over etl/test_*.py, no network
npm run test:tokens         # colour tokens: mockups = globals.css, hue distance, on-fill contrast; no DB
npm run check:migrations    # journal = files, drop/retype has a drizzle/down file, schema.ts fully generated,
                            # no migration already on main edited (standing rule 3); no DB
```

`.claude/kit.json` is the single source of truth for the kit's verification
commands (`verify.fast` runs after every edit, `verify.full` is what the
test-runner agent runs). Keep it in sync with the list above. Its commands run
under `cmd.exe /c` because the hooks execute them that way.

## Where the domain rules live

Each rule has one home. The data-model rules (derived data, issues and
placements, read state, sidecars, plans, dates, soft delete, add-flow writes,
shelves, the watchlist, `extract.py`) are in `.claude/rules/schema.md`, which
loads when you touch `src/db/`, `etl/`, `drizzle/` or `seed/`. The design and
UI rules (the mockup, dashboards, the thumb bar, the telescope, readiness
badges, colour, tokens, states, detail views, live API calls) are in
`.claude/rules/ui.md`, which loads when you touch `src/app/`, `src/components/`
or `design/`. A rules file loads only when one of its files is opened with the
Read tool, so **read the matching rules file yourself when planning or
reviewing a task that will touch those paths**. The Hard rules below are the
one-line checklist a reviewer enforces from them.

## Non-obvious rules

These hold everywhere, whatever you are touching.

- **Four databases, and `.env` is never production.** Production (Vercel
  production; the GitHub `DATABASE_URL` secret, for backup and Release), one
  Neon branch per PR preview, test (`TEST_DATABASE_URL`, locally and in CI), and
  development (`.env` `DATABASE_URL`: `npm run dev`, `rebuild`, `load`,
  `db:push`, `db:views`). Production's local connection string lives only in
  the gitignored `.env.live`, which a command reads only when told to:
  `npm run rebuild -- -EnvFile .env.live` before cutover (START-HERE Step 13)
  and Step 14's final `load.ps1 -EnvFile .env.live` (`ENV_FILE=.env.live` for
  the bash twins). Never run or suggest anything aimed at `.env.live` unless the
  owner asks for it.
- **Production is disposable until cutover; development always is.**
  `npm run rebuild` drops and reloads everything, and `load.ps1` / `load.sh`
  truncate every progress table **and, through `CASCADE`, every table that
  references a run, issue or book** (queue, shelves, eras, inbox, sessions).
  `.env.live` `LEDGER_LIVE=true` (set at START-HERE Step 14, right after the
  final load and *before* the month of running both — D-18) makes all four
  (`load.ps1`, `load.sh`, `rebuild.ps1`, `rebuild.sh`) refuse against
  production. Never suggest a rebuild or a load of production once that is set.
  `.env` keeps `LEDGER_LIVE=false`.
- **A merge is not a deploy; Release is** (START-HERE Step 13). Vercel stages
  every build of `main`, and `.github/workflows/release.yml`, run by hand after
  the merge, checks CI on that commit, snapshots Neon, migrates, re-applies
  views, promotes, and smoke-tests `/api/health`, in that order. `/api/health`
  is the one route outside the passcode gate (`src/proxy.ts`), and it returns
  no data; nothing else joins it there. It is the only path a migration takes to
  the live database: never tell anyone to run `db:migrate`, `db:push` or
  `db:views` against production once the repo variable `LEDGER_LIVE` is
  `true`. Before that, a schema change reaches production through
  `npm run rebuild -- -EnvFile .env.live`, which Release's refusal names. A
  preview build migrates only its own Neon branch (`preview/<git branch>`), and
  `scripts/vercel-build.mjs` refuses one whose database is the live host.
- **Tests touch `TEST_DATABASE_URL` and nothing else.** `DATABASE_URL` is the
  development database locally and the live Neon ledger in Vercel production
  and the GitHub secrets. `scripts/lib/testdb.mjs` refuses when the test URL is unset or
  names the same host and database, and `npm test` fails at once. Never point a
  test, a fixture or a script that truncates at `DATABASE_URL`, and never add a
  fallback to it.
- IMPORTANT: AI-generated issue labels never reach the database without passing
  the bulk-entry parser, a Metron existence check, and an explicit user accept.
  Metron-proposed labels (`label_review.csv`) follow the same rule: explicit
  accept only.
- **This is Next.js 16**, which may be newer than what you know: the passcode
  gate is `src/proxy.ts` (not `middleware.ts`), request APIs (`cookies()`,
  `params`, `searchParams`) are async only, and `next build` uses Turbopack.
  Before writing Next-specific code, read the relevant guide in the
  version-matched docs at `node_modules/next/dist/docs/`, and heed deprecation
  warnings. (`agentRules: false` in `next.config.ts` stops `next dev` from
  appending its own copy of this note here.)

## Workflow

- IMPORTANT: never commit to `main`. Branch `task/<id>-<slug>` (or `fix/`,
  `docs/`, `chore/` outside a task), one PR per task in `docs/TASKS.md`, squash
  merge by the owner. Branching, staging, commit messages and PR bodies are in
  `.claude/rules/git.md`.
- IMPORTANT: a PR is ready only when everything that can test it has passed
  **on the branch**: `/verify` (the full CI suite) locally, CI green, the
  Vercel preview for UI, and any changed workflow run with `--ref <branch>`.
  Never find out on `main`. Details in `.claude/rules/git.md`.
- IMPORTANT: no task merges without a test that would have failed before it.
- Tick the task's checkbox in `docs/TASKS.md` in the same PR.
- **Migrations that drop or retype a column ship a down file.** `drizzle-kit`
  writes forward-only SQL. A migration that drops, retypes or merges columns also
  adds `drizzle/down/<tag>.sql` by hand, and its task test runs up → down → up
  asserting row values, not just that it ran — including that a precision-`none`
  row is still `none` with a NULL date afterwards. `drizzle/down/0004_date_precision.sql`
  shows the file shape but is **not** the standard: it is lossy by design (undated
  reads come back as `exact` `now()`), which was acceptable only because the
  database was disposable. Do not copy that part.
  Hand-edit the generated file when a retype needs `USING`. Verify with
  `npm run test:db:reset`, which runs `drizzle-kit migrate`, not `db:push`.
- **Stop and ask before** adding or changing a schema column; changing how any
  stored date is written or interpreted; creating a git repo or remote, or
  changing its visibility; touching any database that is not `TEST_DATABASE_URL`;
  deleting or rewriting rows in `issue_progress`, `book_status` or `reading_plan`.
  An ambiguity in a task is a question, not a guess: write it down and stop.
  One exception, approved by the owner on 2026-10-09: the **development**
  database (`.env` `DATABASE_URL`) may be written *through the running app*
  without asking. `npm run dev` and a ui-verifier walk can tick, untick and
  undo rows there, as long as they leave the data as they found it. A
  `rebuild`, `load`, `db:push` or `db:views` against it still asks first, and
  production (`.env.live`, the live Neon host) is never touched.
- One task per session. Attended: `/clear`, then `/implement-task TASK-###`
  or `/next-task`. Unattended sessions are started by
  `.claude/scripts/dispatch-approved.ps1`.
- No code before the plan is approved (`plan_status: approved` in the task
  file). The plan lives in the task file's `## Plan` section.
- If the spec is ambiguous or contradicts the code, ask. Never guess, never
  silently widen scope, never rewrite acceptance criteria.
- Change files outside the plan's file list only after explaining why.
- Done = test-runner green, test-auditor PASS, every applicable reviewer
  APPROVE, the ready gates passed, and the owner's manual check. Claude sets
  `Review`; only the owner's "accepted" sets `Done`. Done means merged and
  accepted, not deployed.
- Never hand-edit `docs/tasks/INDEX.md`. Run `.claude/scripts/build-index.ps1`.
- Done task files move to `docs/tasks/archive/` (`workflow.archiveDone`).
  `.claude/scripts/archive-done.ps1` moves every Done task, not only the
  current one, at each task's close-out and accept. It never runs on `main`.
- Post-edit check failures in the middle of a multi-file change are expected.
  Finish the change, then fix whatever still fails.
- Kit behaviour is changed through the switches in `.claude/kit.json` and the
  files in `.claude/project/`, never by editing the kit's skills, hooks or
  scripts (`install-kit.ps1 -Upgrade` overwrites those).

## Hard rules

Only rules a reviewer can check against a diff. The spec-reviewer agent
enforces this list. Each one summarises a rule whose full text is above or in
`.claude/rules/`.

1. Never edit files matched by `protectedPaths` in `.claude/kit.json`. If one
   must change, stop and ask.
2. Nothing derived is stored: no count, percentage, rollup, status, span,
   credit line or finish/plan year column; it goes in `etl/views.sql`.
3. Per-user facts live in progress tables keyed `(user_id, entity_id)`; comics
   read state keys on the placement (`run_issues.id`), never on the issue.
4. Soft delete only: every read filters `deleted_at IS NULL`; removing a
   placement soft-deletes it.
5. Tests and anything that truncates read `TEST_DATABASE_URL` only; nothing
   aims at `DATABASE_URL` or `.env.live`.
6. Styling uses the custom properties in `src/app/globals.css`: no literal hex
   or `#fff`, no Tailwind classes, nothing red on a dashboard, every meter fills
   with `--ready`.
7. A new table is added to `src/db/export-tables.ts`, and a migration that
   drops or retypes a column ships `drizzle/down/<tag>.sql`, in the same PR.

## Gotchas

Add a line every time the owner corrects the same mistake twice.
