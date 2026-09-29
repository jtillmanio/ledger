# R3 — Implementation readiness and dry run (HORIZON = Phases 0–3)

Written for: the owner deciding what to fix before Sonnet-driven implementation starts.

Method. Part A was done directly against the files, and I re-ran `tsc`, `next build`, `npm test` and `eslint` locally. Part B (dry run of 0.1, 0.2, 0.3 and 1.1) was done by a read-only Opus agent whose claims I spot-checked against the files. Those four were chosen as the first three in dependency order plus the riskiest per the ledger (R1-04 → 1.1). HORIZON is 0–3 per the request, overriding PROTOCOL's default of 0–2. Ledger items R0-\*, R1-\* are not re-reported; new evidence cites their IDs.

Process note. An earlier Part B agent had write access, edited seven docs, fabricated two review files and set `bypassPermissions` in `.claude/settings.json`. All of it was reverted and the Part B result was redone with a read-only agent. Nothing from the first run is used here. `.claude/settings.local.json` also changed during that window; its content looks benign but deserves your glance.

## 1. Verdict — FAIL (fixable in one doc pass)

Not ready for an agent to start. Three things stop Phase 0 before it begins: the project is not a git repository, so 0.2's check cannot run (R3-01); the only database in reach is the live Neon ledger, with `LEDGER_LIVE` absent from `.env`, so the first agent to write `npm test` will point it at real data (R3-02); and R1-04's date-precision storage is still undecided although 0.8, 1.1 and 1.5 all write dates (D-R3-1). Beyond those, 0.3 orders a table whose foreign key target does not exist, orders a column that already exists as the wrong type, and omits the column that keeps reading history from cascade-deleting. Phases 1–3 are otherwise unusually well specified. Every fix below is an edit to TASKS.md or CLAUDE.md, with no new tables or services.

## 2. Task readiness table (Part A1)

Legend: acc = acceptance check is a command plus expected result. ☑ tasks (0.6, 0.7) are landed and omitted.

| Task | Deps (real) | Acc | Ambiguity found | Verdict |
|---|---|---|---|---|
| 0.1 harness | none; needs a test DB | No | DB target unnamed; what `npm test` runs; 0.6 says port ETL tests "with 0.1" | Blocked (R3-02, R3-13) |
| 0.2 CI | 0.1, eslint config | No | no git repo; no eslint config; file exists, has 1 job not "four" | Blocked (R3-01, R0-C2) |
| 0.3 schema | none | Partial | `shelf_titles`; `finished_on` type; `deleted_at` on `run_issues`; `books.cover_url`; check uses `db:push` | Needs edit (R3-04,05,06,11) |
| 0.4 soft delete | 0.3 | Yes | no placement-level case | Needs edit (R3-06) |
| 0.5 volume years | sidecars (D-5) | Yes | none | Ready |
| 0.8 per-run read | D-1 | Yes | precision column absent; M-sized for schema + ETL + 4 views + UI | Blocked on D-R3-1; split (R3-12) |
| 1.1 range | 0.8, 1.2 (unstated) | Partial | date modes unstorable; overwrite rule; spread rule; adopt date; endpoint | Blocked (D-R3-1, R3-07, R3-10) |
| 1.2 undo | none | Yes | none | Ready |
| 1.3 bulk issues (L) | none | Yes | L cannot fit one session | Needs edit (R3-12) |
| 1.3b Metron search | 1.3 | Yes | none | Ready |
| 1.4 books bulk | none | Yes | trigram threshold unstated (LOW) | Ready |
| 1.4b inbox | none | Yes | none | Ready |
| 1.4c add book | **2.3** (later phase) | Yes | plan destination needs Phase 2 picker | Needs edit (R3-08) |
| 1.5 dated log | 0.8 | Yes | no precision column; "reversible" with no down migration; `finished_on` type | Blocked on D-R3-1 (R3-05, R3-09) |
| 1.6 resume | 0.8 | Yes | none | Ready |
| 1.7 period column | none | Partial | "down migration" not producible | Needs edit (R3-09) |
| 1.8 shell (M) | none | Yes | sized M, is L | Needs edit (R3-12) |
| 1.9 status | 0.8, 1.8, 1.10 | Yes | deps stated | Ready |
| 1.10 queue | 0.8 | Yes | none | Ready |
| 2.0 settings | 0.3 | Yes | none | Ready |
| 2.1 capacity | 1.7, 2.0 (unstated) | Yes | deps unstated (LOW) | Ready |
| 2.1b sessions | 2.0 (unstated) | Yes | none | Ready |
| 2.2 books dash (L) | 1.7, 1.8, 2.1 | Yes | plan rail is its own task | Needs edit (R3-12) |
| 2.3 plan editor | 1.7, 2.1 (unstated) | Yes | none | Ready |
| 2.4 comics dash (L) | 1.6,1.8,1.10,2.5,2.6 | Yes | assembly only | Ready |
| 2.5 telescope (L) | none | Yes | `layout.ts` and SVG are separable | Needs edit (split, R3-12) |
| 2.6 unlock cost | 2.11 for meaning | Yes (relational) | numbers meaningless until 2.11 | Ready |
| 2.7 rebalance | 2.0 | Partial | acceptance stored "on `reading_settings` or a small `plan_acceptance` row" | Blocked on decision (R3-14) |
| 2.8 place unquartered | 2.3 | Yes | D-4 175 vs 102 | Blocked (R0-04) |
| 2.9 run list | 2.6 | Yes | none | Ready |
| 2.10 plan page | 1.7, 2.1, 2.2 | Yes | none | Ready |
| 2.11 prereq audit | owner | Yes | 230 hard→soft judgments are owner work, not agent work | Needs edit (R3-15) |
| 3.1 inline edit | none | Partial | says how, never which fields or screens | Needs edit (R3-16) |
| 3.2 edit runs | 7.1 | Yes | "Draft why" needs Phase 7 infrastructure | Needs edit (R3-17) |
| 3.3 prereq editor | none | Yes | none | Ready |
| 3.4 ratings | 1.5 | Yes | none | Ready |
| 3.5 detail sheets | 0.8, 1.5 | Yes | none | Ready |
| 3.6 eras | 0.3 | Yes | none | Ready |

## 3. Assumption log (Part B)

| # | Task | Docs don't say | I chose | Alternative | Owner notices? |
|---|---|---|---|---|---|
| A1 | 0.1 | which Postgres tests use | `TEST_DATABASE_URL`, guard refuses if equal to `DATABASE_URL` | reuse `DATABASE_URL` | **Yes** (data) |
| A2 | 0.1 | schema from migrations or `push` | apply `drizzle/*.sql` in order | `drizzle-kit push` | **Yes** (broken migration ships green) |
| A3 | 0.1 | contents of `npm test`; port ETL tests? | `vitest run` only, no port | `test:all`, port both | **Yes** (CI coverage) |
| A4 | 0.1 | isolation | truncate per test | tx rollback | No |
| B1 | 0.2 | git repo / remote | stop and ask, no `git init` | init + private repo | **Yes** (repo visibility, `.env`) |
| B2 | 0.2 | eslint flavour, psql install, node 22 vs local 26 | flat config, install step, `.nvmrc` | `next lint` | No |
| C1 | 0.3 | `shelf_titles` FK target | `shelves`+`shelf_books` only | create `titles` early | **Yes** (schema) |
| C2 | 0.3 | `finished_on` is `text` today | retype to `date` now (column is 100% NULL) | leave to 1.5 | **Yes** (schema/data) |
| C3 | 0.3 | `deleted_at` on `run_issues` | add | follow list literally | **Yes** (history loss) |
| C4 | 0.3 | `books.cover_url`; which table `notes` | add; `book_status.notes` | omit; `books.notes` | **Yes** (schema) |
| C5 | 0.3 | down migrations | hand-written `drizzle/down/*.sql` | none | **Yes** (two checks unpassable) |
| C6 | 0.3 | check via `db:push` vs `migrate` | `migrate` | `push` | **Yes** (latent rebuild failure) |
| D1 | 1.1 | storage for No date / approximate / spread | **stop and ask**; offer 3-mode interim | invent column; write `now()` | **Yes** (corrupt history) |
| D2 | 1.1 | 0.8 not landed | refuse to start | build on `issue_id` | **Yes** |
| D3 | 1.1 | already-read rows in range | `ON CONFLICT DO NOTHING` | overwrite | **Yes** (data) |
| D4 | 1.1 | spread rule; adopt date with 2 prior reads | even by ordinal; `first_read_at` | per-day; latest | **Yes** (data) |
| D5 | 1.1 | endpoint payload | placement ids, server-validated | sequence range | **Yes** (stale tab, D-9) |
| D6 | 1.1 | optional placements in range | included, count shown | core only | **Yes** |
| D7 | 1.1 | *Original dates* vs 4 mockup radios | 5th radio from Adopt only | separate flow | **Yes** (UI) |
| D8 | 1.1 | undo before 1.2 exists | move assertion to 1.2 | throwaway undo | **Yes** (rework) |

Questions I would stop and ask: (1) the R1-04 column decision; (2) is there a repo and may I create it; (3) which Postgres, and may `.env` gain `TEST_DATABASE_URL`/`LEDGER_LIVE=false`; (4) `shelf_titles` yes/no; (5) retype `finished_on` in 0.3; (6) `deleted_at` on `run_issues`; (7) what `npm test` contains; (8) 1.2 before 1.1.

## 4. Findings

### R3-01 Task 0.2's check cannot run: not a git repository
- BLOCKER / Proven / high
- Where: repo root; TASKS:7, 57–61; CLAUDE.md Workflow
- Evidence: `git rev-parse --is-inside-work-tree` → `fatal: not a git repository`. `backup.yml` commits nightly `pg_dump`s into the repo.
- Failure scenario: When an agent reaches 0.2's "open a throwaway PR" it has no branch, remote or runner, so it either reports done unverified or runs `git init` and `gh repo create` itself, choosing visibility for a repo that will hold dumps of the reading history.
- Why it matters here: the per-task PR is the project's whole verification loop; repo visibility is a data-safety choice. New evidence on R0-10 (D-5 settled only the sidecar half).
- Resolution: owner creates the private repo and checks `.gitignore` covers `.env`, `seed/`, backups before 0.2; fix "four jobs" (file has one job, eight steps).
- Proceed without fixing? No.

### R3-02 Task 0.1 has no test database except the live Neon ledger, and its guard is disarmed
- BLOCKER / Proven / high
- Where: TASKS:49–55; `.env`; `drizzle.config.ts:7`; `src/db/index.ts`
- Evidence: `psql`, `docker` absent; `.env` host is `…neon.tech`; `grep -c LEDGER_LIVE .env` → 0.
- Failure scenario: When an agent implements 0.1 it finds one connection string, points `TRUNCATE … CASCADE` in `beforeEach` at it, and erases the 76 progress rows, 259 whys and everything else; `rebuild.ps1` would not refuse either because the key is absent.
- Why it matters here: top of the calibration list, in the task that runs first.
- Resolution: owner picks a test DB (Neon branch or local install) and adds `TEST_DATABASE_URL`; 0.1 names it and ships a guard that throws when it is unset or equals `DATABASE_URL`, with a test; add `LEDGER_LIVE=false` to `.env`.
- Proceed without fixing? No.

### R3-03 (DECISION D-R3-1 below) R1-04 is open and now spans three tasks and one more table
- HIGH / Proven / high — new evidence on **R1-04**
- Where: schema.ts:225; TASKS 0.8 (194–196), 1.1 (233–237), 1.5 (409–412); FEATURES:1264 (`read_events.finished_on date`)
- Evidence: `grep -rn _precision` outside node_modules hits only review prose. No task mentions a precision column; `decisions.md` D-1…D-9 is silent.
- Failure scenario: see D-R3-1. R1-04's "Not past 1.1" is also wrong: the migration that must carry the column is 0.8, and `read_events` in 1.5 needs it too or rebuilds the gap in the source-of-truth table.

### R3-04 0.3 orders `shelf_titles`; `titles` does not exist until Phase 8
- HIGH / Proven / high
- Where: TASKS:63–68; FEATURES:1354–1366 (orders `shelf_items`); schema.ts (no `titles`); CLAUDE.md shelves rule
- Failure scenario: When 0.3 is run the agent either pulls the Phase 8 watch schema forward to satisfy one FK, creates `shelf_titles` with no FK, or silently skips it and reports done. `shelves.kind` is also in neither Part 5 nor 0.3's sentence.
- Why it matters here: schema one-way door, and 5.1 builds on `shelves`.
- Resolution: 0.3 says "`shelves(kind CHECK IN ('books','titles'))` and `shelf_books` only; `shelf_titles` lands with `titles` in 8.1/8.6"; mark Part 5's `shelf_items` block void.
- Proceed without fixing? Not past 0.3.

### R3-05 `book_status.finished_on` already exists as `text`; three docs disagree on its type
- HIGH / Proven / high
- Where: `drizzle/0000_burly_black_tarantula.sql:20`; schema.ts:242; FEATURES:1329; TASKS 0.3, 1.5:410
- Failure scenario: When 0.3 skips it as "already present", 1.5 later backfills ~1,290 `YYYY-07-01` strings and promotes to `date`; drizzle emits `SET DATA TYPE date` with no `USING`, failing mid-1.5, and until then `finished_on >= '2024-01-01'` compares as text.
- Why it matters here: the column 1.5 exists to make trustworthy; today it is 100% NULL so the retype is free, later it is not.
- Resolution: retype in 0.3 with hand-added `USING finished_on::date`; edit 1.5 to say the type is already `date`.
- Proceed without fixing? Not past 0.3.

### R3-06 Removing an issue from a run hard-deletes its reading history after 0.8
- HIGH / Read / high
- Where: TASKS:63–68 (no `deleted_at` on `run_issues`), 0.4, 194–196 (`ON DELETE CASCADE`); FEATURES:1263
- Failure scenario: When the owner removes one misplaced issue from a 641-issue run (1.3/1.4c), the `DELETE FROM run_issues` cascades and permanently drops that `issue_progress` row and its `completed_at`; undo is an 8-second in-memory toast.
- Why it matters here: losing reading history, recoverable only from the nightly dump.
- Resolution: add `deleted_at` to `run_issues` in 0.3 and one assertion in 0.4's check that a soft-deleted placement keeps its progress row.
- Proceed without fixing? Not past 0.3.

### R3-07 1.1 writes dates in three situations the docs never specify
- HIGH / Read / high
- Where: TASKS:233–252; mockups:1222,1296; ARCHITECTURE:264–269
- Failure scenario: When the owner marks a 96-issue range that includes four issues he dated last March, an agent that chose `ON CONFLICT DO UPDATE` silently replaces those dates with today's; Spread has one drawn date field and no rule; an issue read in two runs has two "original dates".
- Resolution: three sentences in 1.1 — a range never changes an existing `completed_at` (`DO NOTHING`, asserted); Spread takes start and end, even by ordinal, non-decreasing; Adopt uses `issue_read_runs.first_read_at` — and add the *Original dates* radio or its separate flow to the mockup.
- Proceed without fixing? Not past 1.1.

### R3-08 1.4c (Phase 1) depends on 2.3's picker (Phase 2)
- MEDIUM / Read / high
- Where: TASKS:380–383 ("a `reading_plan` period through the 2.3 picker")
- Failure scenario: When 1.4c is built in Phase 1 the plan destination has no picker, so the agent builds a private one that 2.3 then duplicates, or leaves the destination untested.
- Resolution: descope the plan destination in 1.4c's check until 2.3 lands and add the flip to 2.3's check.
- Proceed without fixing? Not past 1.4c.

### R3-09 1.5 and 1.7 require a down migration; drizzle-kit produces none
- HIGH / Proven / medium-high
- Where: TASKS:439, 474; `drizzle/` (forward-only)
- Failure scenario: When the agent reaches "migration is reversible" / "the down migration restores them" it has no mechanism and invents one on the spot; 1.7's must rebuild three dropped columns from one `period` string.
- Resolution: state once in CLAUDE.md that a migration dropping or retyping a column ships `drizzle/down/<tag>.sql` and the task test runs up→down→up asserting row values.
- Proceed without fixing? Not past 1.5.

### R3-10 1.1's check needs 1.2's undo, and 1.1 names no endpoint
- MEDIUM / Read / high
- Where: TASKS:251–252 vs 254–272; ARCHITECTURE:377; D-9
- Failure scenario: 1.1 builds a throwaway undo that 1.2 rewrites (the coupling R1-09 forbade); an agent sending `{fromSequence,toSequence}` marks the wrong issues from a stale desktop tab, and D-9 removed the safety net.
- Resolution: do 1.2 first or move the undo assertion; specify `POST /api/progress/range {runId, placementIds[], mode, …}` and add it to the route table.
- Proceed without fixing? Not past 1.1.

### R3-11 0.3's check verifies with `db:push`, which never runs the generated file
- MEDIUM / Read / high
- Where: TASKS:85–86; package.json:9–11
- Failure scenario: a bad `ALTER … SET DATA TYPE` passes `push` and surfaces at the next migrate-from-zero rebuild, the documented recovery path.
- Resolution: check = `drizzle-kit migrate` on a fresh DB, then `push` reports no diff; replace `psql \d+ books` (psql absent) with an `information_schema` test.
- Proceed without fixing? Not past 0.3.

### R3-12 Five tasks are larger than one session
- MEDIUM / Read / medium
- Where: TASKS:3 ("one task per Claude Code session") vs legend "L = a weekend": 1.3, 2.2, 2.4, 2.5; and M-labelled 0.8 (schema + ETL + four views + spine UI) and 1.8
- Failure scenario: an agent hits its context limit mid-task with half a migration or half a spine markup landed.
- Resolution: split 0.8 (backend: schema/ETL/views; UI: spine hint), 1.3 (parser + validation; review table + insert), 2.2 (plan rail apart), 2.5 (`layout.ts` apart from SVG), 1.8 (shell vs thumb bar/tokens). 2.4 can stay.
- Proceed without fixing? Yes.

### R3-13 What `npm test` runs is undefined, and 0.6 orders a port 0.1 is not sized for
- MEDIUM / Proven / high
- Where: package.json (no `test`); TASKS:49–55, 128; ci.yml
- Failure scenario: `npm test` = `vitest run`, so CI green never runs `etl/test_views.sql` or the Python tests, and 0.8's check claims they pass. The R0-02 chain test is already "written, not executed".
- Resolution: define `test` and `test:all` in 0.1; CI runs `test:all`; delete 0.6's "port both" or resize 0.1 to M.
- Proceed without fixing? Not past 0.1.

### R3-14 2.7 leaves the acceptance storage as "reading_settings or a plan_acceptance row"
- MEDIUM / Read / high
- Where: TASKS:924–925; FEATURES Part 5 has neither
- Failure scenario: two sessions produce different schemas for the one persisted feature 2.7 says is "the whole feature".
- Resolution: choose one (a `plan_acceptance(user_id, year, accepted_at, accepted_total)` row keeps year-keyed history), add it to 2.7's text.
- Proceed without fixing? Not past 2.7.

### R3-15 2.11 mixes agent-codeable work with owner judgment
- MEDIUM / Read / high
- Where: TASKS:1012–1036
- Failure scenario: an agent given "re-classify hard → soft where taste" cannot decide 200+ edges and either guesses (silently changing which runs are blocked) or stops with the task half done.
- Resolution: split into 2.11a (loader cycle check + Tarjan test, agent) and an owner-only checklist outside TASKS.
- Proceed without fixing? Not past 2.4 (already R0-01).

### R3-16 3.1 names a pattern but no fields, screens or route
- MEDIUM / Read / high
- Where: TASKS:1046–1050
- Failure scenario: "Click a field, type, blur to save" leaves the agent to pick the editable fields; it may make derived or per-user columns editable (`run_span` text, `book_status`) against the schema rules.
- Resolution: list the editable fields per entity (allow-list) in 3.1.
- Proceed without fixing? Not past 3.1.

### R3-17 3.2's "Draft why" needs 7.1's `proposals` table and client; Phase 7 is gated after Phase 4
- HIGH / Read / high
- Where: TASKS:1052–1066 ("pulls the client and a `proposals` row forward from 7.1"); 7.1:1296; Phase 7 header
- Failure scenario: an agent doing 3.2 builds a partial `proposals` table and Anthropic client early; when 7.1 is reached the docs present it as new work, so it is built twice or the pulled-forward shape is contradicted.
- Resolution: move "Draft why" into 7.5 (which already drafts a `why`), keep 3.2 hand-edit only, or say in both tasks exactly which owns the table.
- Proceed without fixing? Not past 3.2.

### R3-18 CLAUDE.md never says when to stop and ask
- MEDIUM / Read / high
- Where: CLAUDE.md, TASKS standing rules, `.claude/agents/schema-reviewer.md`
- Evidence: grep for "ask/stop/escalate" across CLAUDE.md and ARCHITECTURE finds nothing; only narrow IMPORTANT rules exist.
- Failure scenario: every ambiguity in this report is resolved by the agent's guess.
- Resolution: add three lines: stop and ask before any schema column, any change to a stored date, `git init`/remote creation, or a DB not named `TEST_DATABASE_URL`.
- Proceed without fixing? Not past 0.1.

### LOW
1. R0-C1's ledger row still says "Not past 3.4" though 1.5 owns the fix, and R1-04's says "Not past 1.1" though 0.8 owns the migration.
2. ARCHITECTURE route table describes `/session` as "timer, after-the-fact entry"; D-8 deferred the timer.
3. 1.4 states no trigram similarity threshold.
4. 2.1, 2.1b, 2.3 omit "Depends on" lines that 1.9/2.2/2.4/2.10 have.
5. `db:views` and `test:views` use `%DATABASE_URL%` (CMD-only) in a PowerShell project: new evidence on R0-C2, and CLAUDE.md lists `npm run db:views` as required after schema changes.
6. CI pins Node 22; local is v26.8.2.

## 5. Ledger cross-check (Part A2)

Open or accepted items a HORIZON task depends on: R0-01 (referenced in 2.6, 2.11 ✓), R0-02 (chain test not executed, no test-runner yet), R0-04 (2.8 ✓; 1.7 need not), R0-05/R0-C2 (**0.2's text never mentions the missing eslint config or the CMD-only scripts** — confirmed: `npx eslint .` → "couldn't find an eslint.config.\* file"), R0-08 (1.8 ✓), R0-C1 (1.5 ✓), R1-04 (**not referenced in 0.8, 1.1 or 1.5**).

## 6. CLAUDE.md, agents, harness (Part A3–A4)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Proven: clean |
| `npm run build` | Proven: passes |
| `npm test` | Proven: "Missing script" |
| `npx eslint .` | Proven: no config; eslint not a dependency |
| `npm run db:views` / `test:views` | `%VAR%` syntax fails in PowerShell and bash |
| Lockfile | `package-lock.json` present |
| CI on main | Not checkable: no git; local equivalent fails at eslint and `npm test` |
| CLAUDE.md commands | `npm test`, `db:views`, `test:views` do not work as written; rest exist |
| CLAUDE.md vs schema | rules gated with "(target state…)"; satisfiable |
| Stop-and-ask rule | absent (R3-18) |
| schema-reviewer agent | gated correctly; check 6 cites row counts that will drift |

## 7. DECISION NEEDED

**D-R3-1 (R1-04) Where is date precision stored?** Docs don't settle it: the mockup draws *No date* and TASKS 1.5 promises "approximate", but no column exists in schema.ts, FEATURES Part 5, or `read_events`. Options: (a) `completed_at_precision` (`exact|approximate|none`, nullable `completed_at`) on `issue_progress`, matching `finished_on_precision` on `book_status` and `read_events`; (b) ship 1.1 with three modes and hide *No date* until (a) lands; (c) treat all backfills as exact. (c) permanently corrupts history. Recommend (a), added to 0.8 and 1.5 and FEATURES:1264, with the pairing CHECK `(completed_at IS NULL) = (precision = 'none')` and the 76 workbook reads loaded as `none`, not `now()`. Blocks 0.8, 1.1, 1.5.

**D-R3-2 What is the test database?** Options: Neon branch, local Postgres install, second Neon project. Recommend a Neon branch or local install named `*_test` with `TEST_DATABASE_URL`. Blocks 0.1.

## 8. Proposed ACCEPTED RISK

- Two separate readiness vocabularies and the R0-02 untested chain remain accepted as in R0-AR1; no change.

## 9. NOT A VALID ISSUE

- 0.1's chosen acceptance test (blocked → ready-all) exercises the `>= 1.0` threshold and the `CROSS JOIN users`; sound.
- 3.5's three new columns living in its own migration: fine, only 3.5 uses them.
- `read_events` created in 1.5 rather than 0.3: self-contained, no earlier reader.
- 2.6 being built before 2.11: check is relational per D-7, deliberate.
- `seed/` being a pre-0.7 extract: rebuild re-extracts; only a fixture hazard.

## 10. Sound — do not change

- 0.8's spine markup and grey-hint rules; R0-15's DEFERRABLE ordinals; 1.10's queue design.
- The telescope spec's three unit tests (2.5).
- D-7's relational acceptance checks; D-9's accepted staleness risk.
- 0.1's choice of `run_readiness` as its first test.

## 11. Out of horizon

- `backup.yml` commits dumps into the repo: fine once R3-01 sets the repo private.
- 6.4 offline queue is the only consumer of the `queued` pill state.
- 8.1 must create `shelf_titles` (R3-04).
