# Ledger

Personal media ledger replacing two Google Sheets: about 10,138 comic issues in
10,761 run placements across 258 runs with a prerequisite graph, plus 1,478
books (extract of 2026-09-23; re-count from a fresh extract, never trust these).
Single user, multi-user schema.

`docs/STATUS.md` is where we are now. `docs/HANDOFF.md` is full context,
`docs/TASKS.md` the backlog, `docs/FEATURES.md` scope, `docs/ARCHITECTURE.md`
why the schema looks like this, `docs/DIAGRAMS.md` visual, `docs/DESIGN.md` the
styling blueprint index. `docs/START-HERE.md` is the human's runbook: don't run
its commands unless asked. Large docs are guarded (`largeFiles` in
`.claude/kit.json`): grep for the section, then read it with offset and limit.

## Which document wins (D-1)

When two documents disagree, believe them in this order:

1. `src/db/schema.ts` and `etl/views.sql` — the code is what actually runs.
2. `docs/TASKS.md` — the acceptance check is the contract for the work.
3. `docs/ARCHITECTURE.md` — why the schema looks the way it does.
4. `docs/FEATURES.md`, `docs/DIAGRAMS.md`, `docs/HANDOFF.md` — scope and
   narrative, the most likely to have drifted.

A document describing something not yet built says so inline ("(task 2.5)"),
and until then the current code wins. Every canonical row count comes from a
fresh `etl/extract.py` run: correct the prose, never the extract.

Outside the list: `design/mockups.html` is authoritative for layout and copy
and beats a task description. The styling blueprint (D-31: `design/STYLE_GUIDE.md`,
`design/tokens.css`, the `design/*.dc.html` spec pages) beats the mockup on
tokens, type, elevation, motion, telescope and plan-rail geometry and component
states. The feel pass (D-40: `design/STYLE_GUIDE.md` §14–§16 and
`design/Ledger Feel Review.dc.html`) also beats the mockup on layout and copy
for what it draws: dashboards, the mark sequence, empty and caught-up states,
completion, the 768px tablet and desktop at 1024px and up.

`docs/CLAUDE-CODE-PROMPTS.md`, `docs/START-HERE.md`, `docs/OWNER-CHECKLIST.md`
and `docs/STATUS.md` rank **below** `docs/TASKS.md`: where they disagree with a
task, the task wins and the disagreement is a bug to report.

Development is on Windows in PowerShell. Prefer `py` over `python` and
`.\etl\load.ps1` over `etl/load.sh`. psql `\copy` paths need forward slashes.

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

The everyday ones. Every command (ETL, enrichment, sidecars, the single
suites) is in `docs/COMMANDS.md`.

```powershell
npm run dev                 # local, needs .env
npm test                    # vitest; needs TEST_DATABASE_URL (never DATABASE_URL), refuses without it
npm run test:all            # everything CI runs
npm run test:db:reset       # rebuild the TEST database: drizzle-kit migrate, then etl/views.sql
npm run lint                # eslint, zero warnings
npx tsc --noEmit            # typecheck
npm run db:generate         # after editing src/db/schema.ts
npm run extract             # etl/extract.py with every sidecar CSV; clears seed/ first
npm run rebuild             # drop, migrate, extract, load (.env); asks first, refuses when LEDGER_LIVE=true
```

`.claude/kit.json` is the single source of truth for the verification
commands (`verify.fast` after every edit, `verify.full` for the test-runner);
keep it in sync with `docs/COMMANDS.md`.

## Where the domain rules live

Each rule has one home. Data-model rules are in `.claude/rules/schema.md`
(loads for `src/db/`, `etl/`, `drizzle/`, `seed/`); design and UI rules in
`.claude/rules/ui.md` (loads for `src/app/`, `src/components/`, `design/`). A
rules file loads only when one of its files is opened with Read, so **read the
matching rules file yourself when planning or reviewing a task that touches
those paths**. The Hard rules below are the checklist a reviewer enforces.

## Non-obvious rules

- **Four databases, and `.env` is never production.** Production (Vercel
  production; the GitHub `DATABASE_URL` secret), one Neon branch per PR
  preview, test (`TEST_DATABASE_URL`), and development (`.env` `DATABASE_URL`:
  `npm run dev`, `rebuild`, `load`, `db:push`, `db:views`). Production's local
  connection string lives only in the gitignored `.env.live`, read only when a
  command is told to (`-EnvFile .env.live`, `ENV_FILE=.env.live`). Never run or
  suggest anything aimed at `.env.live` unless the owner asks for it.
- **Production is disposable until cutover; development always is.**
  `rebuild` drops and reloads everything; `load.ps1` / `load.sh` truncate every
  progress table **and, through `CASCADE`, every table that references a run,
  issue or book**. `.env.live` `LEDGER_LIVE=true` (START-HERE Step 14, D-18)
  makes `load` and `rebuild` (both twins) refuse against production. Never
  suggest a rebuild or a load of production once it is set.
- **A merge is not a deploy; Release is** (START-HERE Step 13,
  `.github/workflows/release.yml`, run by hand). It is the only path a migration
  takes to the live database: never tell anyone to run `db:migrate`, `db:push`
  or `db:views` against production once the repo variable `LEDGER_LIVE` is
  `true`; before that, `npm run rebuild -- -EnvFile .env.live`. `/api/health`
  is the one route outside the passcode gate (`src/proxy.ts`), returns no data,
  and nothing else joins it. A preview build migrates only its own Neon branch.
- **Tests touch `TEST_DATABASE_URL` and nothing else.** `scripts/lib/testdb.mjs`
  refuses when it is unset or names the same database as `DATABASE_URL`. Never
  point a test, fixture or truncating script at `DATABASE_URL`, and never add a
  fallback to it.
- IMPORTANT: AI-generated issue labels never reach the database without passing
  the bulk-entry parser, a Metron existence check, and an explicit user accept.
  Metron-proposed labels (`label_review.csv`) follow the same rule.
- **This is Next.js 16**: the passcode gate is `src/proxy.ts` (not
  `middleware.ts`), request APIs (`cookies()`, `params`, `searchParams`) are
  async only, `next build` uses Turbopack. Read the guide in
  `node_modules/next/dist/docs/` before writing Next-specific code, and heed
  deprecation warnings.

## Workflow

- IMPORTANT: never commit to `main`; a PR is ready only when everything that
  can test it has passed **on the branch**. Both are in `.claude/rules/git.md`.
- IMPORTANT: no task merges without a test that would have failed before it.
- Tick the task's checkbox in `docs/TASKS.md` in the same PR.
- Migrations that drop or retype a column ship `drizzle/down/<tag>.sql` and an
  up → down → up test (full rule in `.claude/rules/schema.md`).
- **Stop and ask before** adding or changing a schema column; changing how any
  stored date is written or interpreted; creating a git repo or remote, or
  changing its visibility, or deleting or archiving one; touching any database
  that is not `TEST_DATABASE_URL`; deleting or rewriting rows in
  `issue_progress`, `book_status` or `reading_plan`; deleting anything outside
  the project and the temp folder, the project itself, its `.git`, or a
  worktree (use `git worktree remove`); deleting a folder that holds files git
  doesn't ignore (remove tracked files with `git rm -r`), or discarding
  uncommitted work: `git clean -f`, `git reset --hard`, `git checkout -- .`,
  `git restore .`, `git stash drop`.
  An ambiguity in a task is a question, not a guess: write it down and stop.
  One exception (owner, 2026-10-09): the **development** database may be
  written *through the running app* without asking (`npm run dev`, a
  ui-verifier walk), as long as the data is left as found. A `rebuild`, `load`,
  `db:push` or `db:views` against it still asks first; production is never
  touched.
- `.claude/hooks/guard-destructive.ps1` is a net, not permission: never route
  around a block with another command, tool, script, or path spelling.
- One task per session. Attended: `/clear`, then `/implement-task TASK-###`
  or `/next-task`. Unattended: `.claude/scripts/dispatch-approved.ps1`.
- No code before the plan is approved (`plan_status: approved`; the plan lives
  in the task file's `## Plan`). If the spec is ambiguous or contradicts the
  code, ask: never guess, widen scope, or rewrite acceptance criteria. Change
  files outside the plan's list only after explaining why.
- Work noticed and left out is a follow-up, written where the work that will do
  it will read it (`workflow.followUps`); the PR lists where each went.
- Done = test-runner green, test-auditor PASS, every applicable reviewer
  APPROVE, the ready gates passed, and the owner's manual check. Claude sets
  `Review`; only the owner's "accepted" sets `Done` (merged and accepted, not
  deployed).
- Never hand-edit `docs/tasks/INDEX.md`; run `.claude/scripts/build-index.ps1`.
  `.claude/scripts/archive-done.ps1` moves every Done task to
  `docs/tasks/archive/` at close-out and accept, never on `main`.
- Post-edit check failures in the middle of a multi-file change are expected.
  Finish the change, then fix whatever still fails.
- Kit behaviour changes through `.claude/kit.json` and `.claude/project/`,
  never by editing the kit's skills, hooks or scripts (upgrades overwrite them).

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
