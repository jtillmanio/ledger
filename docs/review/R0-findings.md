# R0 — Consistency and closure sweep (HORIZON = Phases 0–2)

Reviewer note: `claude/` does not exist in this working copy (only the `docs/claude-outputs` zip, which holds config, not reviews), and the project is not a git repo here. Protocol paths `review/ledger.md` / `review/<id>-findings.md` are `docs/review/LEDGER.md` / `docs/review/R0-findings.md`. The ledger was empty and `decisions.md` is empty, so nothing is SETTLED except statements attributed to Justin in docs.

## 1. Verdict

**PASS WITH CONDITIONS.** The schema, views and migrations are internally coherent and 0.6/0.7 are genuinely landed. But the docs are mid-transition: CLAUDE.md, `.claude/rules/schema.md` and the schema-reviewer describe the post-0.8 model (`run_issues.id`, placement-keyed progress, `deleted_at`, `run_queue`) as if it were current, while `schema.ts`, `views.sql`, the API routes and `test_views.sql` are still issue-keyed. Two data problems will silently corrupt HORIZON numbers: the prerequisite graph is not a DAG (R0-01), and the workbook has drifted from every "expected" count in START-HERE (R0-03). The "fixed" claim for `run_ancestors` depth is false (R0-02). Fix R0-01…R0-05 before 0.8/2.6; the rest are per-task.

## Table A — Source-of-truth map

| Concept | Should be authoritative | Also described in | Agree? |
|---|---|---|---|
| DB schema | `src/db/schema.ts` + `drizzle/` | CLAUDE.md, `.claude/rules/schema.md`, ARCHITECTURE, DIAGRAMS ERD, FEATURES Part 5 SQL, HANDOFF, schema-reviewer | **No.** Docs describe target state (0.8, 0.3, 1.7, 1.10); DIAGRAMS:106 already shows `placement_id`; schema.ts comment L71-73 says "reading it once marks it read everywhere" (the reversed 0.7 behaviour). See R0-06 |
| SQL views | `etl/views.sql` | ARCHITECTURE §2/§4, DIAGRAMS §4, TASKS 0.8/2.6, `test_views.sql`, `queries.ts` | Views agree with schema.ts; docs describe `issue_read_runs`, `run_queue_state`, `plan_period` that don't exist yet (scheduled). Vocabulary split `ready-hard` (run_readiness) vs `ready_hard` (run_state) |
| Design tokens | `design/mockups.html` `:root` | `globals.css`, CLAUDE.md, ui.md, ARCHITECTURE:594, TASKS:460 | **No.** R0-08 |
| Task list / IDs | `docs/TASKS.md` | HANDOFF ("71 tasks"), START-HERE sittings, PROMPTS, FEATURES phase table | IDs resolve (all referenced 0.x–8.x exist); 0.3 text stale (R0-09); 6.7 and 7.6 are the same digest |
| Canonical numbers | Output of `etl/extract.py` on the current xlsx | CLAUDE, README, ARCHITECTURE, HANDOFF, START-HERE, TASKS, PROMPTS | **No.** R0-03, R0-04 |
| Commands | `package.json` | CLAUDE.md, START-HERE, verify skill, ci.yml, PROMPTS | **No.** R0-05 |
| Screens / routes | `design/mockups.html` (+ index) | CLAUDE.md, TASKS, FEATURES, ARCHITECTURE | Docs agree with each other (`/comics/runs`, `/status`, `/books/list`…). Code has only `/comics`, `/comics/[runId]`, `/books`; expected pre-Phase-1. Screen count: mockups 40 (index) vs HANDOFF/START-HERE "25" |
| ETL steps | `etl/rebuild.ps1` + `extract.py` | START-HERE Steps 7-8, DIAGRAMS §6, TASKS 0.7 | Steps agree; expected outputs stale (R0-03); sidecars absent (R0-10) |

**DECISION NEEDED D-1 (authority hierarchy).** Question: which file wins on conflict? Docs don't say. Options: (a) `schema.ts` + `views.sql` > TASKS > ARCHITECTURE > FEATURES/DIAGRAMS/HANDOFF, with target-state docs marked "planned (task N)"; (b) ARCHITECTURE as the design authority and code must converge (then schema.ts is "behind" until 0.8); (c) generated counts only from an `extract` run stored in one file, prose links to it. Recommend (a) plus (c): today's conflicts are all "doc ran ahead of code" or "number went stale". Blocks: 0.8.

## Table B — Contradictions

| ID | Sev | Concept | Locations (current value first) |
|---|---|---|---|
| R0-01 | HIGH | Prereq graph is called a DAG; it has 16 mutual pairs, 4 of them hard↔hard | `seed/prereqs.csv` (byte-identical to fresh extract); HANDOFF:37,167; README:7; views.sql:204 "cycle-safe" |
| R0-02 | HIGH | `run_ancestors` depth cap 20 vs "24 levels" and vs "fixed, 20→50" | views.sql:219 `w.depth < 20`; ARCHITECTURE:47; HANDOFF:114,167; README:7; PROMPTS:1224 |
| R0-03 | HIGH | Placements / issues / unresolved counts | Current extract: run_issues **10,835**, issues **10,285**, unresolved **108** (72 renumbered, 16 slug, 13 repeats). Docs: 10,840 / 10,273 / 104 (START-HERE:409-447, HANDOFF:49,194,456, ARCHITECTURE:10,175, README:7, CLAUDE:3-4, TASKS:123,179) |
| R0-04 | HIGH | Plan rows unquartered: **102 of 102** now; docs say 175 / 174 | TASKS:421,809 (2.8), CLAUDE rules; HANDOFF:53 (174); START-HERE:436 (102, correct) |
| R0-04b | MED | Stale figures: books 1,478 (CLAUDE, ARCH, extract) vs 1,480 (README:8, HANDOFF:49, START-HERE table); runs 259 vs 264 (HANDOFF:50, ARCH:166, PROMPTS×4, START-HERE table); prereqs 463 vs 339 (HANDOFF:37,51, FEATURES:123); events 30 vs 24; read issues 76 vs 73 (TASKS:665, PROMPTS:1149, HANDOFF); catalog total 10,273 vs 10,834 (TASKS:84,254,665, FEATURES:54,471, HANDOFF:73,368, PROMPTS:1149); schema-reviewer:21 "issues (10,835 rows)" is run_issues; CLAUDE.md:3 "about 10,270". Tables 40 (ARCH:349, HANDOFF:104) vs 39 (START-HERE:355) |
| R0-06 | MED | Read-state model: per-placement (docs) vs per-issue (code) | CLAUDE.md Non-obvious rules, schema.md, schema-reviewer #8; vs schema.ts:222-226 `issue_progress(user_id, issue_id)`, views.sql:22,164,186,240,250, `/api/progress/issue`, TASKS 0.8 ☐ |
| R0-07 | MED | Soft-delete rule vs schema | CLAUDE.md, schema.md, schema-reviewer #3 "every read"; no `deleted_at` anywhere in schema/views/queries; TASKS 0.4 ☐ |
| R0-08 | MED | `--faint` text token | globals.css:17 `--faint:#98a1b0` (2.6:1, the deco value), no `--faint-deco`; mockups `--faint:#606979`; CLAUDE.md:185 "globals.css is the same token set". `--blocked` #9a6212 (css) vs #8a560c (mockups, TASKS:461). Task 1.8 lists the fix |
| R0-09 | LOW | 0.3 still lists `cover_url`, `metron_id` as outstanding; "ten remain" | TASKS:53-62 vs schema.ts:83-85 |
| R0-11 | LOW | Open questions: START-HERE:173 (7 rows, pace "books on dashboard"; run list "flat") vs HANDOFF §8 (pace "words everywhere" answered; run list "track→block always" answered) and TASKS 2.9 | START-HERE stale |
| R0-12 | LOW | `run_readiness` emits `ready-hard/ready-all`; `run_state` and docs' badge names use `ready_hard/ready_all` | views.sql:126,151; queries.ts:16,66 |

## Table C — Closure of prior findings

`claude/pre-build-review.md` and every other `claude/*.md` are **absent**; their individual findings cannot be enumerated. I closed only items whose finding numbers are cited elsewhere (PROMPTS, TASKS).

| Item (source) | Status | Evidence |
|---|---|---|
| pre-build-review 4.6: issue ids positional (TASKS:125) | **Closed** | schema.ts:75-76 id = label slug; 0003 drops `run_id/sequence` from `issues` |
| pre-build-review 2.2: `run_ancestors` depth 20→50 (PROMPTS:1224 "already found and fixed") | **Open** | views.sql:219 still `w.depth < 20`; no test in test_views.sql references depth |
| pre-build-review 2.6/2.7: book-status POST wipes fields (PROMPTS:308,1534) | **Open** | `api/progress/book/route.ts:23-24` `finishedYear ?? null`, `rating ?? null` overwrite existing values on any status change |
| pre-build-review §3 CI can't pass: lockfile | **Closed** | `package-lock.json` present |
| …§3 eslint config / eslint dep | **Open** | no `eslint.config.*`, no eslint in package.json; ci.yml:29 and verify skill run it |
| …§3 vitest / `npm test` | **Open** | no `test` script, no vitest dep, no `*.test.*` (TASKS 0.1 ☐) |
| …§3 `db:views` CMD-only, wrong env | **Open** | package.json `%DATABASE_URL%`; ci.yml sidesteps it with raw psql |
| …§3.1 soft-delete gate "from task 0.3 onward" (PROMPTS:345) | **Open** | CLAUDE.md, schema.md, schema-reviewer #3 ungated (R0-07) |
| Other pre-build-review findings; dashboard-v4-status.md; derived-run-fields.md; issue-metadata-plan.md "remaining" lists | **Cannot verify** | files absent |
| TASKS 0.5 remaining: leading-article normalization, 3 `X-Men (vol. 2)` labels | **Superseded** by 0.7 label review, but `label_review.csv` doesn't exist here (R0-10) so unproven |
| TASKS 0.6/0.7 ☑ claims | **Closed (schema/views)**; migrate-from-zero equality and "0003 keeps 76 progress rows" not re-run (no DB) |
| HANDOFF §8 Q2, Q3, Q4, Q6 | **Open** (defaults only) — see D-3 |

## Table D — Dangling references

| Reference | Where | Problem |
|---|---|---|
| `claude/*.md` (pre-build-review, dashboard-v4-status, derived-run-fields, issue-metadata-plan) | PROMPTS ×15, TASKS:118 | directory missing (R0-13) |
| `scripts/task.sh`, `task.ps1`, `screen.*` | scripts/ | read `TASKS.md` at repo root; file is `docs/TASKS.md` — Proven: `awk: cannot open file …/TASKS.md` (R0-14) |
| `npm test`, `npx eslint .` | CLAUDE.md, ci.yml, verify skill | no script / no dep / no config (R0-05) |
| `docs/review/UI_AUDIT_REPORT.md` cited as `UI_AUDIT_REPORT.md` | TASKS:24 | path drift, LOW |
| `cover_dates.csv`, `issue_details.csv`, `issue_credits.csv`, `label_review.csv` | package.json `extract`, CLAUDE.md | absent from `etl/data/` (R0-10) |
| `src/components/telescope/layout.ts`, `RunStateBadge.tsx` | CLAUDE.md, TASKS | planned (2.5 / 1.9); CLAUDE.md states the telescope geometry file as fact |
| `planned_month` | TASKS:416,57 | column doesn't exist in schema.ts; 1.7 "three legacy columns" is two |
| `run_issues(id …)`, `placement_id`, `issue_read_runs`, `run_queue`, `era_id` | CLAUDE.md, schema.md, schema-reviewer | do not exist until 0.8/1.10/0.3 |
| `py etl/enrich_books.py` | START-HERE:955 | Phase 4.2, not built (outside horizon) |

## 3. Findings

### R0-01 Prerequisite graph has cycles, including hard↔hard pairs
- **HIGH / Proven / high.** Where: `etl/data/Comics.xlsx` PREREQS → `prereqs.csv`; consumers views.sql `run_readiness`, `run_ancestors`; tasks 2.4, 2.6, 2.7.
- Evidence: DFS over the 463 edges finds 48 back-edges; 16 mutual pairs, 4 both-hard: `bendis-daredevil↔mack-dd`, `gaiman-eternals↔gillis-eternals`, `ewing-immortal-hulk↔jenkins-hulk`, `jms-thor↔thor-ragnarok`. `extract.py` has no cycle check (`grep cycle` → nothing).
- Failure: When those 8 runs are unread, each is `blocked` by the other, so `readyToRead` and "N runs first" never surface them, and 2.6 cost/leverage counts a run as its own ancestor's ancestor.
- Why it matters: the whole Phase 2 comics dashboard rests on prerequisite counts.
- Resolution: add a cycle report to `extract.py` `unresolved.csv`; owner breaks the edges in the sheet (or marks one soft). Add a `test_views` case that the loaded graph has no hard cycle.
- Proceed without fixing? Not past 2.4.

### R0-02 `run_ancestors` cap of 20 vs a 24-deep graph; "fixed" claim false
- **HIGH / Read / high.** views.sql:219 `w.depth < 20`; README/HANDOFF say 24 levels; PROMPTS:1224 says the fix (→50) landed and every HANDOFF unlock-cost figure was computed on the buggy version.
- Failure: When a run has an ancestor chain longer than 20, "N runs first" and the frontier undercount and a run can show ready while a hard ancestor at depth 21+ is unread.
- Resolution: raise to 50 (cycle-safe already via path array); add a 25-node chain test.
- Proceed? Not past 2.6.

### R0-03 Workbook drifted from every documented expected count
- **HIGH / Proven / high.** `Comics.xlsx` mtime Sep 18 14:33, after the Sep 16 export documented. Fresh `extract.py` (no sidecars): run_issues 10,835, issues 10,285, unresolved 108, "sequence renumbered" 72 (docs: 0, START-HERE:455 "spot-check three runs").
- Failure: When the owner follows START-HERE 8a ("If `run_issues` is not 10,840, stop"), they stop on a correct load; and 72 renumbered rows means the sheet's Sequence column has more split runs than documented, which affects 1.3 insert order.
- Resolution: rerun extract, replace every count with a link to one dated "expected output" block; investigate the 72.
- Proceed? Yes, for code; No before cutover.

### R0-04 Plan-row count wrong in a HORIZON task
- **HIGH / Proven / high.** Extract yields 102 `reading_plan` rows, all with null quarter (102/102). TASKS:809 (2.8) and 1.7 say 175; HANDOFF 174.
- Failure: When 2.8 is built to "Place the unquartered" with an acceptance test on 175, it fails or invents rows; the "175" also suggests something (wishlist dedupe? a different sheet) is not in the load.
- Resolution: confirm with owner whether 175 counts entries the extract dropped; set 2.8 to derive the count from `plan_period`.
- Proceed? Not past 1.7.

### R0-05 Verification gate cannot run
- **HIGH / Read / high.** No `test` script, vitest, eslint dep or config; ci.yml runs `eslint`, `npm test`. Task 0.1 says it blocks everything; CLAUDE.md lists `npm test` as a command.
- Failure: When any task's "no merge without a failing-before test" rule is applied, there is no runner; CI is red on `npm test`.
- Resolution: 0.1/0.2 as written; mark CLAUDE.md `npm test` "after 0.1".
- Proceed? Not past 0.1 (already stated).

### R0-06 / R0-07 Docs assert target-state rules as current
MEDIUM. See Table B. When an agent works on 0.4 or 1.1 with CLAUDE.md as truth it writes queries against `placement_id` / `deleted_at` that don't exist. Resolution: gate each bullet "(from 0.8)", "(from 0.3/0.4)" in CLAUDE.md, schema.md and schema-reviewer #3, #8. Not past 0.4/0.8.

### R0-08 Token drift
MEDIUM. globals.css `--faint` is the non-text-safe grey and `--faint-deco` is missing. When 1.8 copies `.faint` text classes, contrast is 2.6:1 against a 4.5:1 floor. 1.8 lists the fix; add it to that task's Check.

### R0-15 Renumbering under `UNIQUE (run_id, sequence)`
- **MEDIUM / Inferred / medium.** TASKS:177 makes `(run_id, sequence)` UNIQUE (non-deferrable) and 1.3 "renumbers later ones". Postgres checks a plain UNIQUE row by row, so `UPDATE … SET sequence = sequence + 1` can fail mid-statement. 1.10 specifies DEFERRABLE for its own table (TASKS:522) but 0.8 does not.
- Resolution: `UNIQUE (run_id, sequence) DEFERRABLE INITIALLY DEFERRED` in 0.8.
- Not past 0.8.

### R0-10 Sidecar CSVs absent
MEDIUM / Read. `cover_dates.csv` etc. are not in `etl/data/` (not gitignored) and there is no `.git`; START-HERE:404 expects "8159 dates from Metron". If they exist only on another machine, a rebuild here drops all Metron dates and run years, and re-fetching is days of quota. Cannot verify where they live.

### R0-13 / R0-14 Missing `claude/`; `scripts/task.*` broken
MEDIUM / LOW. See Tables C and D.

### LOW (max 10)
R0-09, R0-11, R0-12 above; `seed/` is stale (old pre-0003 layout) but gitignored, harmless; `run_readiness` treats a prereq on a placeholder run as unmet forever (placeholder has no issues → pct null → blocked) — check when 2.6 lands.

## 4. DECISION NEEDED

- **D-1** Authority hierarchy (above). Blocks 0.8.
- **D-2 Cycles in prerequisites.** Docs promise a DAG. Options: (a) owner fixes the sheet (16 pairs); (b) loader rejects cycles and lists them; (c) schema tolerates cycles and readiness ignores back-edges. Recommend (a)+(b). Blocks 2.4/2.6.
- **D-3 HANDOFF §8 open Qs** that HORIZON depends on: top-books list capped at 10 (2.2), rating scale (only 5.4, outside), collapse finished eras (2.5/3.6). START-HERE lists a seventh, "watched recently" (8.7, outside). Defaults exist; recommend accepting the defaults in `decisions.md` so agents stop re-asking. Blocks 2.2.
- **D-4 Reading-plan count 175 vs 102** (R0-04): which is true? Blocks 2.8.
- **D-5 Where do sidecar CSVs live** (git-tracked, or backed up)? Blocks any rebuild.

## 5. Proposed ACCEPTED RISK
- Two readiness vocabularies (`ready-hard` in `run_readiness`, `ready_hard` in `run_state`): contained in two files; unify only when 2.6 touches them.

## 6. NOT A VALID ISSUE
- Table count "23 today": counted 23 `pgTable` in schema.ts, correct.
- `prepare: false` present at `src/db/index.ts:7`.
- Task cross-references (0.x–8.x) all resolve; no missing task IDs.
- `design/mockups-index.md` exists; standing rule 6 is satisfiable.
- The `--blocked` hex difference by itself is cosmetic; only `--faint` matters.

## 7. Sound — do not change
- Paired value/source CHECKs on `issues` (schema.ts:90-95) written with IS NULL on both sides; migration 0002/0003 match schema.ts.
- `run_ancestors` cycle guard via path array (views.sql:215).
- `issues.id` slug + `label UNIQUE`, placements in `run_issues`; `run_span` derived rather than stored.
- 1.10's DEFERRABLE ordinal design (TASKS:522).

## 8. Out of horizon
- 4.2 `enrich_books.py` doesn't exist; 6.7 and 7.6 duplicate the release digest; FEATURES `read_events` uses a `num_nonnulls` polymorphic FK that CLAUDE.md forbids for shelves (Phase 1.5 is in horizon — check when built, see R0-06); backup.yml commits dumps into the repo (Phase 6 concern).
