| ID     | Sev                      | Title                                                                                                   | Where                                                                         | Proceed w/o fix?              | Status   | Owner note                                                                                                                                                                                     |
| ------ | ------------------------ | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R0-01  | HIGH                     | Prereq graph has cycles (16 mutual pairs, 4 hard↔hard)                                                  | etl/data/Comics.xlsx PREREQS; views.sql run_readiness                         | Not past 2.4                  | fixed     | 4 hard pairs fixed; 1 hard-only 5-run cycle remains: gillen-uncanny, aaron-watxm, remender-xmen, axis, schism-regensis; plus soft/mixed cycles (98-run component). Extract check still to add. |
| R0-02 | HIGH | run_ancestors depth cap 20 vs 24-deep graph; "fixed to 50" claim false | views.sql:219; PROMPTS:1224 | Not past 2.6 | fixed | cap 48 (D-6) and the 45-chain test were already in; now also a branching test, and R2-01 rewrote run_ancestors (UNION, no path array). Executed 2026-09-20 against a local Postgres 18: test_views.sql + vitest pass, all 259 runs in 1.5s. Run it yourself: START-HERE "Test database", then `npm run test:all` |
| R0-03  | HIGH                     | Workbook drifted: run_issues 10,835 / issues 10,285 / unresolved 108 vs docs 10,840 / 10,273 / 104      | START-HERE 8a-8b; HANDOFF; ARCHITECTURE:10; README; CLAUDE.md                 | Yes (code); No before cutover | resolved | counts updated to 2026-09-20 extract                                                                                                                                                           |
| R0-04  | HIGH                     | Plan rows unquartered are 102/102, docs say 175/174                                                     | TASKS:421,809; HANDOFF:53                                                     | Not past 1.7                  | resolved | owner: books plan starts empty, built in the app. extract no longer writes reading_plan (--with-plan restores it); 175/102 is moot; 1.7/2.8 text and HANDOFF/ARCHITECTURE/CLAUDE.md updated |
| R0-05  | HIGH                     | npm test / eslint / vitest absent; CI and CLAUDE.md reference them                                      | package.json; ci.yml; CLAUDE.md                                               | Not past 0.1                  | fixed | vitest 3, eslint 9 + eslint.config.mjs, npm test / test:all / lint / test:db:reset; CI rewritten (no DATABASE_URL). tsc, lint, build, 11 vitest tests, 39 SQL/py checks pass locally. 0.1 ticked; 0.2 waits on the repo (R3-01) |
| R0-04b | MED                      | Stale figures (books 1,480, runs 264, prereqs 339, events 24, read 73, catalog 10,834, tables 39/40)    | HANDOFF, README, START-HERE, TASKS:665, FEATURES, PROMPTS, schema-reviewer:21 | Yes                           | resolved | updated                                                                                                                                                                                        |
| R0-06  | MED                      | CLAUDE.md/schema.md/schema-reviewer describe placement-keyed read state as current; code is issue-keyed | CLAUDE.md; schema.ts:222; views.sql                                           | Not past 0.8                  | resolved | gated in CLAUDE.md, schema.md, schema-reviewer                                                                                                                                                 |
| R0-07  | MED                      | deleted_at rule ungated; column does not exist                                                          | CLAUDE.md; schema.md; schema-reviewer #3                                      | Not past 0.4                  | resolved | gated in CLAUDE.md, schema.md, schema-reviewer                                                                                                                                                 |
| R0-08  | MED                      | globals.css --faint is #98a1b0 (not text-safe), --faint-deco missing, --blocked differs                 | globals.css:17; mockups :root; TASKS:460                                      | Not past 1.8                  | fixed | globals.css: --faint #606979 (dark #8a93a2), --faint-deco added, --blocked #8a560c, --rule-2 defined; matches mockups :root |
| R0-09  | LOW                      | 0.3 lists cover_url/metron_id as outstanding                                                            | TASKS:53-62                                                                   | Yes                           | resolved | fixed                                                                                                                                                                                          |
| R0-10  | MED                      | Sidecar CSVs (cover_dates etc.) absent from etl/data; no .git                                           | package.json extract; START-HERE:404                                          | No before rebuild             | accepted | D-5 accepted                                                                                                                                                                                   |
| R0-11  | LOW                      | START-HERE open-decision table stale vs HANDOFF §8                                                      | START-HERE:173                                                                | Yes                           | resolved | fixed                                                                                                                                                                                          |
| R0-12  | LOW                      | ready-hard vs ready_hard vocabularies                                                                   | views.sql:126,151                                                             | Yes                           | fixed | one vocabulary: run_readiness now emits ready_hard/ready_all; views.sql, queries.ts, pages and tests updated. R0-AR1 is retired |
| R0-13  | MED                      | claude/\*.md referenced but absent; prior findings unverifiable                                         | PROMPTS; TASKS:118                                                            | Yes                           | accepted | accepted; claude/ files absent, no action                                                                                                                                                      |
| R0-14  | LOW                      | scripts/task.\* look for TASKS.md at repo root                                                          | scripts/task.sh:14                                                            | Yes                           | resolved | fixed                                                                                                                                                                                          |
| R0-15  | MED                      | UNIQUE(run_id, sequence) non-deferrable vs 1.3 renumbering                                              | TASKS:177,297                                                                 | Not past 0.8                  | resolved | fixed in 0.8 text                                                                                                                                                                              |
| R0-C1  | HIGH                     | Book-status POST overwrites finishedYear/rating with null (pre-build 2.6/2.7 open)                      | api/progress/book/route.ts:23-24                                              | Not past 3.4                  | fixed | owner: only fields present in the request are written (undefined = keep, null = clear); saveBookStatus in src/db/writes.ts, vitest. 1.5 still owns the UI caller |
| R0-C2  | MED                      | eslint config and db:views CMD-only syntax open (pre-build §3)                                          | package.json; ci.yml                                                          | Not past 0.2                  | fixed | db:views / test:views now `node scripts/sql.mjs` (loads .env, no psql, no %VAR%); eslint config landed with R0-05 |
| D-1    | DECISION                 | Authority hierarchy across schema.ts / TASKS / ARCHITECTURE / DIAGRAMS                                  | see R0-findings §Table A                                                      | Blocks 0.8                    | decided  | decided (a)+(c)                                                                                                                                                                                |
| D-2    | DECISION                 | Cycles in prerequisites: fix sheet, reject at load, or tolerate                                         | R0-01                                                                         | Blocks 2.4/2.6                | decided  | (a) owner fixes sheet; loader check (b) still open under R0-01                                                                                                                                 |
| D-3    | DECISION                 | Accept HANDOFF §8 defaults (top-10 cap, eras collapse) into decisions.md                                | HANDOFF §8                                                                    | Blocks 2.2                    | decided  | decided: accept defaults                                                                                                                                                                       |
| D-4    | DECISION                 | Is the plan-row count 175 or 102?                                                                       | R0-04                                                                         | Blocks 2.8                    | decided  | superseded by D-13 (plan starts empty); R0-04 resolved                                                                                                                     |
| D-5    | DECISION                 | Where sidecar CSVs are kept/backed up                                                                   | R0-10                                                                         | Blocks rebuild                | decided  | decided                                                                                                                                                                                        |
| R0-AR1 | ACCEPTED RISK (proposed) | Two readiness vocabularies until 2.6                                                                    | views.sql                                                                     | Yes                           | retired | moot: R0-12 unified the two vocabularies |
| R1-01 | HIGH | run_unlock_cost check demands 4,642; seed computes 7,209 (→ R2) | TASKS 2.6; FEATURES Part 2d | Not past 2.6 | resolved | literal withdrawn, 2.6 check made relational, FEATURES cost table voided; real number waits on 2.11/R0-01 |
| R1-02 | HIGH | "41 ready" / "Show 27 hard-blocked" false: 181 of 259 runs have a hard prereq (→ R2) | TASKS 1.9/1.10/2.4/2.9; FEATURES; ARCHITECTURE | Not past 2.4 | resolved | D-7: copy computed, checks relational, switch defaults to shown; mockup figures declared illustrative; audit = new task 2.11 |
| R1-03 | HIGH | No HORIZON task changes a book's status; "finish a book" cannot complete | TASKS 1.5, 3.4 | Not past 1.5 | resolved | status + finish date moved 3.4 → 1.5; 3.4 retitled; R0-C1 folded into 1.5's check |
| R1-04 | HIGH | Range sheet's "No date" / "approximate" / "Spread" have no storage (→ R2) | schema.ts:225; mockup range; TASKS 1.1, 1.5 | Not past 1.1 | decided | D-10: precision columns, pairing CHECK (date NULL iff precision none). Implemented in migration 0004 (issue_progress, book_status), ETL loads the 76 reads as none/NULL; read_events gets it in 1.5. Closes R3-03 and R2-10 |
| R1-05 | HIGH | No task builds Settings; reading_settings drives every capacity figure | TASKS 2.0; ARCHITECTURE route table | Not past 2.1 | resolved | task 2.0 Settings · S added before 2.1; /settings added to the route table |
| R1-06 | MED | 1.8 ships nav to routes built in 5.1/5.2/6.1/6.2 or never | TASKS 1.8 | Not past 1.8 | resolved | NAV_ITEMS enabled flag; a disabled item is not rendered |
| R1-07 | MED | Failed/offline write undefined in HORIZON; pill's queued state is 6.4 | TASKS 1.8 | Not past 1.8 | resolved | failed write reverts the tick + Retry toast; pill is online/offline only until 6.4 |
| R1-08 | MED | Queue *Start* button's effect undefined (navigate vs mark) | TASKS 1.10 | Not past 1.10 | resolved | Start navigates to #p-1; only .chk and the thumb bar write progress |
| R1-09 | MED | 1.2 undo scope excludes queue reorder (1.10) and the persisted 2.7 Undo | TASKS 1.2 | Not past 1.10 | resolved | stack holds {label, undo closure}; 2.7 renamed *Undo acceptance*, not the toast |
| R1-10 | MED | Books Up next renders amber bare-year lane before 2.3/2.8 can clear it | TASKS 1.9 | Not past 1.9 | resolved | lane is grey with a count in 1.9; turns amber + *Place them* in 2.8 |
| R1-11 | MED | Focus restoration after sheets/dialogs close specified nowhere (8 sheets) | TASKS UX floor | Not past 1.1 | resolved | added to the UX floor: focus returns to the opener, Tab trapped while open |
| R1-12 | MED | Runaway timer poisons Recalculate-from-sessions; timer not device-independent (→ R2) | TASKS 6.12 | Yes | deferred | D-8 moved the timer out of HORIZON; row-not-local-state and the 4h threshold recorded in 6.12 |
| R1-13 | MED | "/" last-touched medium has no defined storage (→ R2) | TASKS 1.8 | Not past 1.8 | resolved | cookie written by the three dashboards, read in /'s route handler |
| D-R1-1 | DECISION | Is `blocked` the right default when 180 of 259 runs are blocked? | R1-02 | Blocks 2.4/2.9 | decided | D-7: keep the design, compute the numbers, default the switch to shown, audit hard edges in new task 2.11 |
| D-R1-2 | DECISION | Is 2.1b (sessions timer) worth its cost inside HORIZON? | TASKS 2.1b, 6.12 | Blocks 2.1b/2.2 | decided | D-8: 2.1b keeps minutes entry + Recalculate (now S); timer, chip, Tonight card, ETA → 6.12 |
| R1-AR1 | ACCEPTED RISK | No cross-device staleness handling (phone vs desktop) | ARCHITECTURE:377 | Yes | accepted | D-9, owner confirmed 2026-09-20 |
| R3-01 | BLOCKER | Not a git repository; 0.2's check (throwaway PR) cannot run | repo root; TASKS 0.2, :7 | No | fixed | private repo exists (verified private 2026-09-30); CI runs on every PR and went red on a broken view in throwaway #28, so 0.2 is ticked |
| R3-02 | BLOCKER | No test DB except live Neon; LEDGER_LIVE absent from .env | .env; TASKS 0.1 | Not past 0.1 | fixed | guard, TEST_DATABASE_URL, LEDGER_LIVE=false and START-HERE "Test database" are in; the owner set TEST_DATABASE_URL and `npm run test:all` passed locally on 2026-09-30 |
| R3-03 | HIGH | R1-04 precision column undecided; spans 0.8, 1.1, 1.5, read_events (FEATURES:1264) | schema.ts:225; TASKS 0.8/1.1/1.5 | Not past 0.8 | resolved | closed by D-10 / D-R3-1; 0.8a, 1.1, 1.5 rewritten around it |
| R3-04 | HIGH | 0.3 orders shelf_titles; titles table does not exist until Phase 8 | TASKS 0.3; FEATURES:1354-1366 | Not past 0.3 | resolved | 0.3: shelves(kind) + shelf_books only; FEATURES shelf_items block marked VOID |
| R3-05 | HIGH | book_status.finished_on already text; docs disagree on type | 0000 migration:20; schema.ts:242; TASKS 0.3/1.5 | Not past 0.3 | resolved | finished_on retyped to date in 0004 with USING; 0.3 and 1.5 say so |
| R3-06 | HIGH | Removing an issue from a run cascade-deletes progress; no deleted_at on run_issues | TASKS 0.3/0.4/0.8 | Not past 0.3 | resolved | 0.3 adds run_issues.deleted_at; 0.4 check asserts a soft-deleted placement keeps its progress row; CLAUDE.md rule |
| R3-07 | HIGH | 1.1 date-write rules unspecified (overwrite, spread, adopt) | TASKS 1.1; mockups:1222,1296 | Not past 1.1 | resolved | 1.1: DO NOTHING on existing dates, spread formula, Original dates radio from first_read_at |
| R3-08 | MED | 1.4c (Phase 1) depends on 2.3 picker (Phase 2) | TASKS 1.4c | Not past 1.4c | resolved | 1.4c drops the plan destination until 2.3, whose check adds the flip |
| R3-09 | HIGH | 1.5/1.7 checks require down migrations drizzle-kit does not produce | TASKS 1.5, 1.7 | Not past 1.5 | resolved | CLAUDE.md down-migration rule; drizzle/down/0004_date_precision.sql is the worked example; 1.5/1.7 checks reference it |
| R3-10 | MED | 1.1 check needs 1.2 undo; no endpoint/payload named | TASKS 1.1/1.2; ARCHITECTURE:377 | Not past 1.1 | resolved | 1.1 depends on 1.2; POST /api/progress/range takes placementIds; server validates |
| R3-11 | MED | 0.3 check uses db:push, never runs the generated migration; psql absent | TASKS 0.3 | Not past 0.3 | resolved | 0.3 check = drizzle-kit migrate on a fresh DB + push shows no diff + information_schema test; test:db:reset does the migrate |
| R3-12 | MED | L-sized and oversized M tasks exceed one session | TASKS 0.8,1.3,1.8,2.2,2.5 | Yes | resolved | split: 0.8a/0.8b, 1.3/1.3c, 1.8/1.8b, 2.2/2.2b, 2.5/2.5b |
| R3-13 | MED | npm test contents undefined; 0.6 orders port 0.1 is not sized for | package.json; TASKS 0.1/0.6 | Not past 0.1 | resolved | test = vitest run; test:all = reset + vitest + SQL + Python; 0.6 port dropped |
| R3-14 | MED | 2.7 acceptance storage left as "or" | TASKS 2.7 | Not past 2.7 | resolved | 2.7: plan_acceptance(user_id, year, accepted_at, accepted_total) |
| R3-15 | MED | 2.11 mixes agent work with owner edge judgments | TASKS 2.11 | Not past 2.4 | resolved | 2.11 split: 2.11a (loader cycle check, agent) + docs/OWNER-CHECKLIST.md (edge judgments) |
| R3-16 | MED | 3.1 names no fields, screens or route | TASKS 3.1 | Not past 3.1 | resolved | 3.1 has a per-entity allow-list and a never-editable list |
| R3-17 | HIGH | 3.2 Draft why needs 7.1 proposals table/client (Phase 7 gated after 4) | TASKS 3.2, 7.1 | Not past 3.2 | resolved | "Draft why" moved to 7.5; 3.2 is hand-edit only |
| R3-18 | MED | CLAUDE.md has no stop-and-ask rule | CLAUDE.md | Not past 0.1 | resolved | CLAUDE.md: stop-and-ask list under Workflow |
| D-R3-1 | DECISION | Where is date precision stored? | R3-03 | Blocks 0.8/1.1/1.5 | decided | D-10: completed_at_precision + finished_on_precision + read_events.finished_on_precision |
| D-R3-2 | DECISION | Which database does npm test use? | R3-02 | Blocks 0.1 | decided | D-11: TEST_DATABASE_URL, Neon branch or local *_test; guard in scripts/lib/testdb.mjs |
| R2-01 | BLOCKER | run_ancestors() is exponential: 150 of 229 runs time out; run detail calls it every load | etl/views.sql:204-220; src/db/queries.ts:137; etl/test_views.sql:285 | No | fixed | not on the owner list but R0-02 and R2-04 needed the same function: UNION rewrite as recommended, identical output, 1.5s for all 259 runs; branching fixture added |
| R2-02 | BLOCKER | load.ps1/load.sh TRUNCATE all progress tables with no LEDGER_LIVE guard | etl/load.ps1:71-75; etl/load.sh; package.json seed | No | fixed | LEDGER_LIVE guard lifted into load.ps1 and load.sh (which now reads .env); LEDGER_LIVE=false added to .env |
| R2-03 | BLOCKER | Nightly backup commits an empty dump when pg_dump fails (no pipefail) | .github/workflows/backup.yml:23-24 | No | fixed | backup.yml: set -euo pipefail + size assertion; proven locally: failing dump exit 1, tiny dump exit 1, real dump 0. Also pull --rebase before push (L-10) |
| R2-04 | HIGH | run_ancestors includes the target run itself; 102 runs list themselves as a prerequisite | etl/views.sql:204-220; src/app/comics/[runId]/page.tsx:45-63 | Not past 2.6 | fixed | run_ancestors excludes the target; 0 of 259 runs list themselves (was 102); assertion in test_views.sql |
| R2-05 | HIGH | Dashboard 'N runs unlocked and waiting' prints the LIMIT (12), truth is 30 | src/app/page.tsx:13,27; src/db/queries.ts:72 | Not past 1.9 | fixed | readyToRead returns COUNT(*) OVER () as total; dashboard prints it and "Showing 12 of N"; vitest |
| R2-06 | HIGH | /books shows 500 of 1,478 silently and returns 1,479 rows for 1,478 books | src/db/queries.ts:192,199; src/app/books/page.tsx:32 | Not past 1.9 | fixed | listBooks: one row per book (earliest plan year via LATERAL) + printed total; vitest with a 2026+2027 book |
| R2-07 | MEDIUM | Two issue counts for one run on one screen: placements (35) vs distinct (28) | etl/views.sql:11,363; src/app/comics/[runId]/page.tsx:35,41 | Not past 2.5 | fixed | D-R2-1: repeats dropped in extract, UNIQUE (run_id, issue_id) in 0004; run_progress and run_credit_line now agree by construction |
| R2-08 | MEDIUM | 11 read books have no finished_year; year chips total 148 vs 159 read | etl/views.sql:374; src/app/books/page.tsx:25-27,47-51 | Not past 1.9 | fixed | "No year" chip + ?year=none filter; readWithoutYear(); vitest |
| R2-09 | MEDIUM | Committed seed/ predates migration 0003; npm run seed fails at the first \copy | seed/issues.csv; seed/ (no run_issues.csv); load.ps1:81-82 | Not past 0.1 | fixed | extract clears seed/*.csv first; seed re-extracted (10,822 placements); load.ps1/load.sh copy lists updated for the new columns |
| R2-10 | MEDIUM | ETL never writes completed_at, so every load stamps all history with the load time | etl/load.ps1:97; src/db/schema.ts:225; etl/views.sql:158 | Not past 0.8 | fixed | extract emits completed_at blank + precision none; load copies both; test asserts it |
| R2-11 | MEDIUM | Stale cookie 500s every page; middleware checks presence only, no redirect to /login | src/middleware.ts:6; src/lib/auth.ts:41 | Not past 1.8 | fixed | requireUserId redirects to /login; route handlers return 401 via apiUserId() |
| R2-12 | MEDIUM | No throttle on POST /api/login; START-HERE asks for a phone-typable passcode | src/app/api/login/route.ts:12-19; docs/START-HERE.md:270 | Not past go-live | decided | D-23: passphrase of 4+ random words (START-HERE .env table + Step 14 gate); no throttle; better sign-in is task 6.13. Owner sets APP_PASSCODE |
| D-R2-1 | DECISION | What is a run's issue count when a placement repeats (reread vs sheet duplication)? | R2-07 | Blocks 2.5/2.6 | decided | D-12: (b) now — collapse the 13 rows in extract; rereads return deliberately at 0.8a |
| R2-AR1 | ACCEPTED RISK (proposed) | Backups live in the same private repo as the code | .github/workflows/backup.yml | Yes | accepted | accepted now that R2-03 is fixed |
| R2-AR2 | ACCEPTED RISK (proposed) | No written or tested RESTORE procedure from the nightly backup | docs/START-HERE.md:935 | Yes | fixed | D-30: every nightly run restores its own dump into a scratch Postgres, runs test_views and compares row counts with live before committing it (backup.yml); START-HERE 10d |

## UI_AUDIT_REPORT.md — triage, 2026-09-21

The audit predates R0–R3 and its 62 items (`UX-C01`–`C39`, `UX-E01`–`E23`) were
never given statuses. Triaged here by checking each item's own `Check:` line
against the repo, rather than by re-reviewing the screens. **Result: the
critical list is absorbed.** Its remedies went into `design/mockups.html` v4,
into CLAUDE.md's Design rules, and into TASKS' acceptance checks, which is why
R0–R3 kept meeting them under other IDs.

| Item(s) | Status | Evidence |
| --- | --- | --- |
| C01 era/block meter renamed `.emeter` | landed | 15 hits in mockups; CLAUDE.md Design rule "`.bar` is the app header only" |
| C02, C05, C06 telescope floor, text sizes, variants | landed | CLAUDE.md "Telescope cells have a floor — 14px phone, 16px desktop, overflow folded into `+N runs`" |
| C03 `telescope/layout.ts` + `allocate` | owned by task 2.5 | TASKS:990 names the module and :1015 carries the audit's three unit tests verbatim |
| C04 read state as segments | landed | `run_read_segments` view asserted in etl/test_views.sql:271-276; CLAUDE.md "read state is drawn as segments, not one fill" |
| C07, C18, C23, C25, C38 focusable cells, 24px/44px targets, real buttons | landed | CLAUDE.md "Contrast and targets are tokens, not taste"; TASKS UX floor; `role="tablist"` ×9 in mockups |
| C08, C09, C10 five readiness states, one badge partial | landed | CLAUDE.md "Five readiness states, one badge partial"; `.rdh` ×12 in mockups; unified vocabulary via R0-12 |
| C11, C30, C39 copy and count corrections | landed | mockups reads "67 rules · 61 series" |
| C12, C13, C14 media nav, per-medium sidebar, Tracks screen | landed | `grep -c 'class="tab">Home'` → 0; `data-id="tracks"` present; CLAUDE.md "Hue identifies data, never navigation" |
| C15 Move-sheet figures off 240k | landed | the two remaining `240k` hits are in the notes column describing what **v3** did (mockups:1909, :2160); the live figures are 760k. C15's check was over-strict |
| C16, C17 Rebalance sheet, settled stretch year | landed | `data-id="rebalance"`; CLAUDE.md "Amber clears when the user decides, including when they decide to keep the overage"; task 2.7 |
| C19, C20 estimated word counts, month granularity | landed | `planrail` ×18 with `data-wc` / `data-gran` variants |
| C21, C22 spine rebuild, issue detail sheet | landed / owned by 0.8b and 3.5 | `data-id="issuedetail"`; TASKS 0.8b spells out `.chk` `aria-pressed`, the sr-only lead-in and the hidden-when-read hint |
| C24, C31, C32 batch sheet, insertion preview, live-API states | landed | `data-id="batch"`, `insertprev` ×6; TASKS UX floor covers rate-limited and error |
| C26, C27 watch hue consistency, empty watchlist | landed | CLAUDE.md "one franchise keeps one hue on every screen; watch genre chips are grey with text" |
| C28 dropped shows | landed | etl/views.sql:405-407 reads `title_status` first for `kind='tv'`; ARCHITECTURE:75; CLAUDE.md rule |
| C29 ARCHITECTURE slot table | landed | `grep -c 'episode within season' docs/ARCHITECTURE.md` → 0 |
| C33, C34, C35 sync pill, skeletons, metadata pending | landed | `syncpill` ×46, `skel` ×7, `data-enrich` ×3; TASKS UX floor "Every screen has its states drawn" |
| C36 session sheet | landed / scoped by D-8 | `data-id="session"`; task 2.1b keeps minutes entry, the timer defers to 6.12 |
| C37 token fixes | landed, stricter | R0-08 set `--faint:#606979` (audit asked for `#6f7888`), added `--faint-deco`, `--blocked:#8a560c` |
| E01–E23 enhancements | out of horizon | E02 (`minimap`), E03 (`erachips`) and E12 (`dropdelta`) are already mocked; E06/E07/E23 are deferred by D-8 to task 6.12; E08 is TASKS 1.1's *Original dates* radio (R3-07). The rest are Phase 4+ and carry no HORIZON dependency |

Nothing in the audit is open against a HORIZON task. Superseded as a working
document: where it and the design rules disagree (CLAUDE.md's Design section, in `.claude/rules/ui.md` since 2026-10-09), the design rules win.

## S — cross-review coherence audit, 2026-09-23

Findings, orphans and decisions from `S-findings.md`. None re-reports an existing row; S-L2 is new evidence on R0-03.

| ID | Sev | Title | Where | Proceed w/o fix? | Status | Owner note |
| --- | --- | --- | --- | --- | --- | --- |
| S-01 | HIGH | START-HERE schedules no sitting for 0.8a/0.8b (or 1.3c, 1.3b, 1.4c, 1.7, 1.8, 1.8b, 1.9, 1.10); following it cuts over issue-keyed | START-HERE:868-900, :934; TASKS 0.8a | Not past Step 12 | fixed | START-HERE Steps 11-13 rebuilt from TASKS IDs (0.8a/0.8b = sitting 2, all Phase 1 tasks listed, 0.8a applied by rebuild); Step 14 gate "0.8a/0.8b ticked" |
| S-02 | HIGH | Cutover load's TRUNCATE…CASCADE erases the parallel month's app-only data (queue, shelves, eras, inbox, dated reads) | START-HERE:930-949; load.ps1:82-86 | Not past Step 14 | fixed | D-18 load first: Step 14 rewritten (final load + LEDGER_LIVE first, then the month); CLAUDE.md, schema.md and Step 13 say what the CASCADE erases |
| S-03 | HIGH | CLAUDE-CODE-PROMPTS still directs pre-R2/R3 work (shelf_titles in 0.3, Draft why in 3.2, R1-04 "open"); no prompts for split tasks | PROMPTS:53,162,328,349,779,1290,1517 | Not past 0.3 | fixed | PROMPTS: new header (TASKS wins, split-task map, D-18..D-23), master table, 0.3, 0.8a + new 0.8b, 1.5, new 2.0, 2.1, 2.5, 2.6, 2.9, new 2.11a, 3.2, 3.3, 3.4, 7.1; CLAUDE.md D-1 ranks PROMPTS/START-HERE/OWNER-CHECKLIST/STATUS below TASKS |
| S-04 | HIGH | 2.6 check contradicts itself since R2-04: SUM over run_ancestors excludes self, check also wants own count | TASKS:1064-1069; views.sql:227 | Not past 2.6 | fixed | D-22 cost = own unread + unread over run_ancestors(); 2.6 definition and check rewritten; prompt too |
| S-05 | HIGH | After 1.5, finish date written to finished_on but every reader (books_by_year, listBooks, No-year chip) reads finished_year; schema.ts:256 comment contradicts "July 1" | TASKS 1.5; views.sql:380; queries.ts:193-231; schema.ts:256 | Not past 1.5 | fixed | D-21: 1.5 drops finished_year, names every reader and extract; check asserts year chip; schema.ts:254-258 comment, CLAUDE.md, schema.md, ARCH 2.17 |
| S-06 | HIGH | 2.1 check unpassable: 4.1M words / 3.04M capacity = 135%, not 118% | TASKS:815-816 | Not past 2.1 | fixed | 2.1 check now 3.58M -> 118% (capacity formula stated); prompt too |
| S-07 | HIGH | Soft-deleted placement blocks re-adding the issue (UNIQUE run_id,issue_id); partial UNIQUE cannot be DEFERRABLE | TASKS 0.3/0.4/0.8a/1.3c; schema.ts:111 | Not past 0.4 | fixed | 0.4: re-add restores the soft-deleted row, constraints stay full-table, renumber shifts deleted rows; new 0.4 and 1.3c check lines |
| S-08 | MED | Prereq audit needs 2.6/2.11a (Phase 2) but the sheet is archived at Step 14 first; 3.3 rejects only 2-cycles | OWNER-CHECKLIST:17-32; TASKS 2.11a, 3.3; START-HERE:956 | Not past Step 14 | fixed | D-20: 2.11a built at end of Phase 1, reports by default, --fail-on-cycle at Step 14 (gate); 3.3 rejects any cycle length, soft included |
| S-09 | MED | Rereads: CLAUDE.md "return", TASKS "if", ARCHITECTURE 2.14 "not unique, count placements", D-12 "distinct"; owner tick unrecorded | CLAUDE.md:135; TASKS:245-250; ARCH:184-189,250-253 | Not past 0.8a | fixed | D-19: UNIQUE (run_id, issue_id) stays; CLAUDE.md, schema.md, TASKS 0.8a, ARCH 2.11/2.14 agree |
| S-10 | MED | 0004 down file (CLAUDE.md's worked example) turns 76 undated reads into 76 exact now() reads on up→down→up | drizzle/down/0004_date_precision.sql; CLAUDE.md:268-272 | Not past 1.5 | fixed | CLAUDE.md labels the 0004 down as lossy, not the standard; round-trip must keep precision none; 1.5 down must be lossless |
| S-11 | MED | 2.4/2.5b/2.9 checks assert seed facts today's seed falsifies (Hickman FF reading; claremont 1 of 6, 2 of 2, 0/461; 0 no-block runs) | TASKS:967, :987, :1025-1028, :1133 | Not past 2.4 | fixed | 2.4 badge test on a state fixture, 2.5b ladder on a fixture, "nine runs" removed from 2.5/2.9; prompts too |
| S-12 | MED | D-17 unapplied: export hard-codes 22 tables; no rule adds read_events, run_queue, shelves, eras, sessions, plan_acceptance, inbox | api/export/route.ts:14-19; START-HERE 10d | Not past 1.5 | fixed | src/db/export-tables.ts + test/export-tables.test.ts (passes; proven to fail on an unlisted table); standing rule 7; CLAUDE.md rule; 10d export look |
| S-13 | MED | D-15 unapplied: START-HERE:452 calls slug collisions routine; Step 14 has no gate; 1 row in today's unresolved.csv | START-HERE:452, :939-950 | Not past Step 14 | fixed | START-HERE 8b row 12 = must be zero; Step 14 gate. Owner: 1 row left in unresolved.csv |
| S-14 | MED | Done tab sorts completed_at DESC → undated (none) runs first; `✓ read · date` has no NULL rule | TASKS:700, :945; views.sql:160 | Not past 1.9 | fixed | 1.9 Done NULLS LAST + check line; 2.4 undated badge; ARCH 2.17; CLAUDE.md |
| S-15 | MED | 1.1 Adopt copies precision that 0.8a's issue_read_runs does not expose | TASKS:324, :265-267 | Not past 0.8a | fixed | 0.8a issue_read_runs gains first_read_precision + check; 1.1 table and check copy it |
| S-L1 | LOW | D-4 (175) not marked superseded by D-13; ledger D-4 note says R0-04 still open | decisions.md:8 | Yes | fixed | decisions.md D-4 struck through, superseded by D-13 |
| S-L2 | LOW | New evidence on R0-03: today's extract 258 / 10,138 / 10,758 / 438, 172 blocked; prose still 259 / 10,285 / 10,822, "181 of 259" | CLAUDE.md:3-4; TASKS:957,1137 | Yes | fixed | Counts swept to the 2026-09-23 extract: CLAUDE.md, TASKS 2.4/2.9, START-HERE 8a, HANDOFF, README, FEATURES, ARCHITECTURE, .claude/rules/ui.md, schema-reviewer; dated findings left as history |
| S-L3 | LOW | Untracked handoffs: R2 L-2…L-9, R3 LOW 3/4/6 have no rows; read_events polymorphic FK (R0) and post-cutover rename (R2) never picked up | R2/R3 findings; FEATURES:1259; TASKS 4.1 | Yes | fixed | 1.5 read_events note; 4.1 rename path; Depends lines; and the R2 LOWs: L-2 trigram index (views.sql + test_views), L-5 loader quoting + OWNER_ID slug check, L-6 enrich_books gated, L-7 series total + Show all (tested), L-8 orphan sidecar report (unittest), L-9 backup version preflight, R3 LOW 6 Node 22 via engines/.nvmrc/CI. Left for the owner: L-3/L-4 CHECK constraints, R3 LOW 3 threshold (OWNER-CHECKLIST) |
| S-L4 | LOW | 2.0 says 2.7 writes acceptance on Settings (now plan_acceptance); 2.3 says chips read 892k "on the seed" (seed plan empty) | TASKS:801, :907 | Yes | fixed | 2.0 and 2.3 text |
| S-L5 | LOW | 1.9 Books Up next is always empty in Phase 1; its one primary action has no target | TASKS 1.9 | Yes | fixed | 1.9 empty action = Add a book; 2.3 flips it to Plan a book |
| S-L6 | LOW | R2-06/R2-08 page-level fixes have query tests only; 1.8's move to /books/list does not carry them | TASKS 1.8 | Yes | fixed | 1.8 keeps the printed totals and No-year chip, with a render test |
| S-L7 | LOW | START-HERE Step 15 still says Phase 3 has book status, pull 6.2b forward, "2.11" | START-HERE:979,986-992 | Yes | fixed | START-HERE Step 15 table and unlock-cost paragraph |
| S-D1 | DECISION | What does the cutover load keep: rehearsal / load-first / additive load | S-02 | Blocks Step 14 | decided | D-18: load first, then run both for a month |
| S-D2 | DECISION | Does 0.8a bring rereads back (drop UNIQUE run_id,issue_id)? | S-09 | Blocks 0.8a | decided | D-19: no rereads inside a run |
| S-D3 | DECISION | Prereq audit before cutover (pull 2.11a) or after (pull 3.3) | S-08 | Blocks Step 14, 2.11a | decided | D-20: audit before cutover; 2.11a built in Phase 1 |

## M — mockup consistency audit, 2026-09-23

Findings from `M-findings.md`. `claude/dashboard-*.md` is absent (R0-13), so each claim was tested as quoted in the brief and where CLAUDE.md, TASKS and the mockup notes repeat it. M-04 is new evidence on audit C08, and M-09 on C21.

| ID | Sev | Title | Where | Proceed w/o fix? | Status | Owner note |
| --- | --- | --- | --- | --- | --- | --- |
| M-01 | HIGH | Identity hues duplicate functional colours (dark --t3=--ready, --t4=--blocked, --t2≈--danger 1.01:1); "no --danger" checks pass a red/amber dashboard | mockups:26-27,44-45; globals.css:26-27,50-51,67-68; TASKS:952,1029,1230 | Not past 1.8 | fixed | D-24: t2 fuchsia, t3 lime, t4 gold, m-books cyan, m-watch pink (mockups + globals.css); `npm run test:tokens` asserts ΔE ≥ 15, in test:all and CI; proven to fail on the old values. --brand distance left to 6.9 (see M-O2) |
| M-02 | HIGH | Filled controls hard-code #fff: dark .btn 2.51:1, tick 2.29:1, toast Undo 1.72:1; 1.8b's script tests token pairs only | mockups:188,270,301; globals.css:167,201; TASKS 1.8b | Not past 1.8b | fixed | --on-brand/--on-ready/--on-danger/--on-muted/--toast-link (dark #0d0f14 7.6:1, link 8.2:1); globals.css has no color:#fff; 1.8b check now measures computed pairs |
| M-03 | MED | Thumb bar not one component: desktop dashboards move verbs to the header; slots 2-3 vary; krakoa desktop has no bar | mockups:807/842,1818/1853,3281/3316,1197,4691,4495,4807,998 | Not past 1.8b | fixed | D-25; 1.8b slots + desktop header rule; CLAUDE.md/ui.md; krakoa desktop bar; search slot named |
| M-04 | MED | Reading/blocked badge drawn four ways; the mockup (which wins) contradicts 2.4's RunStateBadge table | mockups:665,848,1102,1191,2728; TASKS 2.4 | Not past 0.8b / 2.4 | fixed | ◐ 42 / 381 on telecard and spine hero; ⊘ N runs first on search; 2.4 check line |
| M-05 | MED | The same run's progress meter is green (.meter.rd) on home/runs and blue on spine/status; .meter.rg undefined | mockups:726,970,1020,1103,1926,2620,3850 | Not past 1.9 | fixed | D-26: .meter fills --ready in mockups and globals.css; 1.9 text |
| M-06 | MED | Green used for room/stated/ok/fits, outside the four meanings | mockups:1771-1773,2049-2053,3716,4025,2210-2213 | Not past 2.2b | fixed | room/stated/ok grey; moveplan preview neutral; 2.2b footer rule |
| M-07 | MED | Plan rail drawn three ways (bdash/plan/planmonth); planmonth fails 2.2b's hatch check, bdash fifth lane is not buttons | mockups:1769-1774,2033,5056; TASKS 2.2b | Not past 2.2b | fixed | one rail markup on bdash/plan/planmonth; one hue per book; 2.2b text |
| M-08 | MED | Dashboard Up next rows use an unnamed span handle, not the queue's drag button and menu | mockups:732-751,906-925,4494,999; TASKS 1.10 | Not past 1.10 | fixed | home Up next rows = queue rows (button.drag + menu); top handles are buttons; 1.10 text |
| M-09 | MED | Spine note says read rows carry "also read in", contradicting its markup, CSS and 0.8b's check | mockups:1209,1114,157; TASKS 0.8b | Not past 0.8b | fixed | spine note corrected |
| M-10 | MED | "#N" in the mark verb is the label on spine, the ordinal on krakoa | mockups:1130,4659-4660,4289; TASKS 2.5, 1.9 | Not past 1.8b | fixed | krakoa/telescope name the issue; 1.8b verb rule + check; CLAUDE.md/ui.md |
| M-11 | MED | Empty dashboard CTA "Start the top of Up next" while the queue is empty | mockups:4864-4883; TASKS 2.4 | Not past 2.4 | fixed | states frame + 2.4 text and check |
| M-12 | MED | Catalogue total appears twice on the desktop comics dashboard | mockups:841,985; TASKS 2.4:993 | Not past 2.4 | fixed | desktop lede trimmed; 2.4 text and check |
| M-13 | MED | 1.5's book finish-date control is undrawn; the only date control has no "year only" (approximate) option | mockups:2344,3725,1222; TASKS 1.5; D-21 | Not past 1.5 | fixed | blist second frame; 1.5 control spec (Year only = YYYY-07-01 approximate, per D-21) + check line |
| M-L1 | LOW | One-off literals and undefined classes (moveplan scrim, #fff chip swatch, .meter.rg, minimap .else) | mockups:2182,2267,1558,3850,4659 | Yes | fixed |  |
| M-L2 | LOW | Unnamed controls: range .chk, bookdetail span.x, moveplan and density segmented spans | mockups:1229-1235,3696,3781,2200,4017 | Yes | fixed |  |
| M-L3 | LOW | Status frames have no data-medium | mockups:1916,1943 | Yes | fixed |  |
| M-L4 | LOW | addsearch phone and desktop disagree on insert point, insertion preview and bar label | mockups:1342,1415,1346,1420 | Yes | fixed |  |
| M-L5 | LOW | moveplan desktop chips show 0k; the promised Accept-as-stretch in the preview is undrawn | mockups:2293-2294,2322; TASKS 2.3 | Yes | fixed |  |
| M-L6 | LOW | Queue toast names the wrong grabbed run; comics Stopped lists a book | mockups:4499,4504 | Yes | fixed |  |
| M-L7 | LOW | 2.8's place-one-at-a-time flow has no frame | mockups:1787,2044; TASKS 2.8 | Yes | fixed | bdash third frame; 2.8 names it |
| M-D1 | DECISION | Re-pick identity hues at 1.8, or accept the collision until 6.9 | M-01 | Blocks 1.8, 2.4 | decided | D-24 |
| M-D2 | DECISION | Desktop thumb bar: header on dashboards (as drawn) or bottom bar everywhere (1.8b text) | M-03 | Blocks 1.8b | decided | D-25 |
| M-D3 | DECISION | In-progress meter fill: --ready or --reading | M-05 | Blocks 1.9 | decided | D-26 |
| M-AR1 | ACCEPTED RISK (proposed) | Most screens draw only the populated state; the UX floor and FEATURES 2c define the rest; R1-07's failure toast is still undrawn | TASKS:23-31, 1.8:682-686 | Yes | accepted | D-27, owner confirmed 2026-09-24 |
| M-O1 | OWNER | Look at the D-24 hues on your phone, light and dark; swap any within `npm run test:tokens` | mockups `home`, `watchlist`, `bdash` | Yes | open | |
| M-O2 | DECISION | Add --brand to D-24's distance rule now (dark --t1 is ΔE 2.6 from --brand), or leave it to 6.9 | scripts/check-tokens.mjs notes | Blocks nothing in HORIZON | open | recommend 6.9 |
| M-O3 | DECISION | 5.3 "Era editor" duplicates 3.6 — delete 5.3 or narrow it | TASKS 5.3, 3.6 | Yes | fixed | owner: delete. 5.3 removed from TASKS (tombstone line) and CLAUDE-CODE-PROMPTS |
| M-O4 | DECISION | Watch (8.x): the film verb in Up next, the freeform add path for films/shows, track-scope bars on tracks/stats | mockups watchlist:3260, watchadd, tracks, stats | Out of horizon | decided | film button = Start (navigates, never writes); D-28 watch add has no freeform path, fallback Save to inbox (CLAUDE.md, ui.md, ARCHITECTURE 2.15, TASKS 8.2, mockup watchadd frame 2); D-29 tracks drawn as block rows (CLAUDE.md, ui.md, TASKS 5.2/6.2, FEATURES, mockup tracks + stats) |

## N — visual polish audit and Step 3 style guide, 2026-09-30

Findings from `NEW_UI_AUDIT_REPORT.md` (Review N), and the Step 3 style guide
(`design/STYLE_GUIDE.md`, `design/tokens.css`, the `design/*.dc.html` spec
pages) that answers most of them. The owner adopted the style guide as the
styling blueprint (D-31), so its deviations SG-D1…SG-D12 are decided, and the
audit's items are folded into the tasks that build each surface, by priority,
rather than into a separate phase. Where the audit and the style guide give
different values, the style guide wins (`docs/DESIGN.md` §2).

| Item(s) | Priority | Status | Where it lands |
| --- | --- | --- | --- |
| UX-N01 motion tokens and control-state matrix | P0 | tasked | TASKS 1.8a (tokens, state rules, test); drawn in `Specimen.dc.html` B5 |
| UX-N02 type scale, UX-X01 11px floor app-wide | P0 | tasked | 1.8a; STYLE_GUIDE §5 supersedes the audit's nine sizes (no 17/22 step; section heads 12px caps, SG-D5) |
| UX-N03 dark depth ladder | P0 | tasked | 1.8a; values from `tokens.css`. The audit's check (one luminance order for both themes) does not fit the light values; 1.8a asserts the style guide's per-theme order |
| UX-N04 elevation tiers, radius scale | P0 | tasked | 1.8a (tokens, check); 2.4 (telecard to `--sh-1`) |
| UX-N05 sticky stack, safe areas, toast position | P0 | tasked | 1.8 (`--bar-h`), 1.8b (bar, toast), 2.9 (track headers), 3.6 (era chips) |
| UX-N06 inline-edit states | P0 | tasked | 3.1 |
| UX-X02 failed-write toast, undo of a queued write | P0 | tasked | 1.8 already owns the failure toast (R1-07); the queued half is 6.4 |
| UX-N07 360px and tablet frames | P1 | tasked | 1.8: four layouts by width (D-33), 360px and 834px frames and checks |
| UX-N08 collapsible sidebar | P1 | tasked | 1.8 sets the state by width (D-33); 6.14 adds the manual toggle |
| UX-N09 icon set | P1 | tasked | 1.8 |
| UX-N10 sheet, dialog, toast and era motion | P1 | tasked | 3.5 (sheets), 1.8b (toast), 3.6 (era) |
| UX-N11 focus management for overlays | P1 | tasked | TASKS header *Focus returns where it came from* |
| UX-N12 sheet stacking | P1 | tasked | 3.5, per D-34: replace with a back chevron |
| UX-N13 finish moment | P1 | tasked | 5.4, 5.5 (3.4 owns the book rating) |
| UX-N14 prerequisite edit and cycle error | P1 | tasked | 3.3 |
| UX-N15 archive and restore | P1 | tasked | new 3.7 |
| UX-N16 run-list sort and sticky headers | P1 | tasked | 2.9 (the sort control was already there) |
| UX-N17 desktop range selection | P1 | tasked | 1.1 |
| UX-X03 desktop mark reach | P1 | tasked | 6.5 |
| UX-X04 dark review of the Sept 2026 screens | P1 | tasked | 1.8a (the mockup re-renders with the new tokens) |
| UX-N18 disabled and pending semantics | P1 | tasked | TASKS header *UX floor*; 1.8a state rules |
| UX-N19 light neutrals, quiet links, selected states | P2 | tasked | 1.8a (values), 1.8 (SG-D4, SG-D6) |
| UX-X05 neutral cover placeholders | P2 | tasked | 4.3 |
| UX-N20 4px spacing grid | P2 | tasked | 1.8a (tokens) |
| UX-X06 card kickers | P2 | tasked | 1.8 and 2.4 (SG-D7: mono `--faint`, not the medium accent the audit offered) |
| UX-N21 mark micro-interaction | P2 | tasked | 1.8b |
| UX-N22 sliding selection indicator | P2 | tasked | 1.9 |
| UX-N23 keyboard layer | P2 | tasked | 6.5 |
| UX-N24 re-read entry | P2 | partly tasked | Book *Read again*: 3.5. The run second-pass spine is **not** folded: it contradicts D-19 (no rereads inside a run) |
| UX-N25 list → sheet continuity | P2 | tasked | 3.5 |
| UX-N26 releases screen | P3 | tasked | D-35: 5.7 books coming out, 5.8 comic issues in followed series; each linked from its dashboard rollup slot. Reverses FEATURES/HANDOFF *not building* |
| UX-N27 bulk add remembers the last run | P3 | tasked | 1.3c |
| UX-X07 books and watch empty slates | P3 | tasked | 1.9, 8.8 |
| UX-N28 *Recalculate from sessions* vs *Use these* | P3 | not a valid issue | Two controls, not two names for one: TASKS 2.1b has *Recalculate from sessions* open the comparison and **Use these** confirm it |
| UX-N29 disabled nav stubs for deferred features | P3 | declined | Contradicts R1-06 (TASKS 1.8): a nav item for a route that does not exist is not rendered at all |
| SG-D1 horizontal telescope | — | decided (D-31) | ARCHITECTURE §4, TASKS 2.5 / 2.5b; the mockup's vertical frames are redrawn in 2.5b |
| SG-D2…SG-D12 | — | decided (D-31) | 1.8a, 1.8, 1.8b, 2.2b, 2.5b; each cited where it lands |
| STYLE_GUIDE §12 conflict: *Show 27 hard-blocked* vs ~180 | — | already decided | D-7 and TASKS 2.9: N is computed, the mockup's 27 is sample data |
| STYLE_GUIDE §12 conflict: thumb bar on desktop dashboards | — | already decided | D-25: header verbs on desktop dashboards, bottom bar on the run detail |
| STYLE_GUIDE §2.1 rail-block height ≈150 / 176 | LOW | noted | Its own sum is 124; the component computes 124 / 140. `docs/DESIGN.md` §5.2 uses the computed figures |
| N-DN1 Tailwind as vocabulary or implementation | DECISION | decided | D-31: vocabulary only |
| N-DN2 mono for inline counts | DECISION | decided | D-32: mono stays |
| N-DN3 tablet posture | DECISION | decided | D-33: navigation rail and bottom thumb bar at 768–1023px; header verbs from 1024px (amends D-25) |
| N-DN4 sheet over sheet | DECISION | decided | D-34: one sheet at a time, replace with a back chevron |
