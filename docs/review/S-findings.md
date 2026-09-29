# S — Cross-review coherence audit (HORIZON = Phases 0–3)

> **Disposition, 2026-09-23.** The owner decided S-D1…S-D3, S-04's cost meaning
> and R2-12 (→ `decisions.md` D-18…D-23). All fifteen findings and five of the
> seven LOWs were fixed the same day in TASKS, CLAUDE.md, `.claude/rules/schema.md`,
> START-HERE, CLAUDE-CODE-PROMPTS, ARCHITECTURE, STATUS and OWNER-CHECKLIST.
> S-12 also gained code: `src/db/export-tables.ts` and `test/export-tables.test.ts`.
> S-L2 and S-L3 were finished later the same day, along with the leftover R2 and
> R3 LOWs (see OWNER-CHECKLIST, *Optional cleanups*). Per-item notes are in the ledger. The findings below
> are the review as written; they were not edited to match.

Method: the ledger, `decisions.md` and all four reports read in full, then every
seam checked against the **current** files, not either report's claim. A throwaway
local cluster (PostgreSQL 18.6, scratchpad, port 55433; `REVIEW_DATABASE_URL` was
unset, `DATABASE_URL` never touched) was built from `drizzle/0000`→`0004` +
`etl/views.sql` + today's `seed/` (extracted 2026-09-23 01:05) and used only where
two reviews' claims needed a tiebreaker. Prefix `S-`.

## 1. Verdict — COHERENT WITH GAPS

The core holds together. `schema.ts`, `views.sql`, migration `0004` and TASKS agree
with each other on every fix I traced: R2's `run_ancestors` rewrite kept D-6's cap,
R0-12's vocabulary is unified, R0-08's tokens match R1's dark-mode note, R1-03/R0-C1
landed together in 1.5, D-10 is in ARCHITECTURE 2.17, 1.1 and 1.5, and R1-12's
deferral made it into 6.12 intact. The gaps are in two places. **First, the
owner-facing runbooks never absorbed R2 and R3.** START-HERE's build sequence
schedules no sitting for 0.8a/0.8b, so following it lets cutover happen before the
read-state door closes (S-01). Its cutover procedure erases a month of app-only data
(S-02). `CLAUDE-CODE-PROMPTS.md`, the text actually pasted into agent sessions, still
orders `shelf_titles` and the Anthropic "Draft why" route (S-03). **Second, a few
task checks were made concrete in one review and then invalidated by a later fix.**
2.6 contradicts itself since R2-04 (S-04). 2.1's figure is arithmetically impossible
(S-06). Soft-deleted placements collide with both UNIQUE constraints (S-07). All of
it is fixable with document edits, and none of it touches data before cutover.

## 2. Coverage

| Step | What I checked | Rows | Result |
|---|---|---|---|
| 1 Decision map | Every ledger row and every `decisions.md` entry with status fixed / resolved / accepted / decided / deferred / retired | **78** (72 ledger + D-6, D-13…D-17) | Map in §3; 3 rows still open (R3-01, R3-02, R2-12) |
| 2 Contradictions | Four seams (below) | 4 seams, 11 pairs | 5 contradictions (S-04, S-05, S-09, S-11, S-14) |
| 3 Handoffs | Every "→ R2", "check when built", "deferred", out-of-horizon note in R0–R3 | 24 handoffs | 21 caught; 3 uncaught (§5) |
| 4 Orphans | Decided/accepted rows traced to TASKS / CLAUDE.md / START-HERE / code | 78 | D-15, D-17 unapplied (S-12, S-13); D-4 unsuperseded; the rereads tick is unrecorded (S-09) |
| 5 Regressions | Later fixes touching earlier fixes' files: `run_ancestors` (R0-02→R2-01/04), vocab (R0-12), tokens (R0-08→R1 LOW 5), `book_status` (R0-C1→R1-03→R3-05→D-10), `run_issues` (R0-15→R3-06→D-12), down-migration rule (R3-09) vs D-10 | 6 chains | 4 clean; 2 regressions (S-07, S-10) |
| 6 Emergent | Cutover × D-10 × D-13 × D-16; audit sequencing × Step 14; START-HERE × task splits | 3 | S-01, S-02, S-08 |

**Seam results (Step 2).**

| Seam | Agreement confirmed | Contradiction |
|---|---|---|
| R0 authority × R2 fixes | R2-01/04 in `views.sql:212-228` and ARCHITECTURE:47 ("48-level depth cap"); D-10 in schema.ts and ARCHITECTURE 2.17 | ARCHITECTURE 2.14 (:184-189, :250-253) still says run totals count placements and that `(run_id, issue_id)` must not be unique, against D-12 and `schema.ts:111` → S-09. The `schema.ts:256` comment contradicts ARCHITECTURE 2.17 → S-05 |
| R1 flows × R2 schema | "No date" storable (0004 CHECK); cookie for `/` (1.8); undo closures (1.2); failed write reverts (1.8) | 1.9's Done order and the `✓ read · date` badge meet D-10's NULL dates → S-14 |
| R1 UI × R3 rewrites | 1.8/1.8b split keeps R1-06/07/13 and LOW 1; 2.2 keeps LOW 2; 1.9 keeps R1-10; 1.10 keeps R1-08 | 2.4 and 2.5b checks kept seed literals D-7 forbids → S-11 |
| R2 numbers × R3 checks | 2.9's switch check is relational; 0.8a's "76 rows NULL/none" matches R2-10; 1.7 answers R2's PK door | 2.6's check contradicts R2-04 → S-04; 2.1's 118% → S-06 |

## 3. Decision map (compact)

| Item | Src | Domain | Resolution |
|---|---|---|---|
| R0-01 / D-2 | R0 | ETL | Hard↔hard pairs and 5-run hard cycle broken in sheet (hard-only SCCs today: **0**); loader check → 2.11a; 74-run mixed component left to OWNER-CHECKLIST |
| R0-02 / D-6 | R0 | SQL | Cap 48; superseded by R2-01 UNION rewrite + branching test |
| R0-03, R0-04b | R0 | ops/docs | Counts updated to 2026-09-20 extract (drifted again, S-L2) |
| R0-04 / D-4 / D-13 | R0 | ETL/task | Plan starts empty; `--with-plan`; 2.8 derives count |
| R0-05, R0-C2 | R0 | ops | vitest, eslint, `scripts/sql.mjs`; CI rewritten |
| R0-06, R0-07 | R0 | docs | Target-state rules gated "(task N)" in CLAUDE.md |
| R0-08 | R0 | UI | Tokens fixed in `globals.css` |
| R0-09, -11, -14 | R0 | docs | Fixed |
| R0-10 / D-5 | R0 | ops | Accepted: sidecars produced later |
| R0-12 / R0-AR1 | R0 | SQL | One vocabulary; AR retired |
| R0-13 | R0 | docs | Accepted unverifiable |
| R0-15 | R0 | schema | 0.8a: `UNIQUE (run_id, sequence) DEFERRABLE` |
| R0-C1 | R0 | API | `saveBookStatus` undefined=keep; 1.5 owns the caller |
| D-1 | R0 | docs | Hierarchy in CLAUDE.md "Which document wins" |
| D-3 | R0 | UI | HANDOFF §8 defaults (STATUS.md, 3.6) |
| R1-01, R1-02 / D-7 / D-R1-1 | R1 | task/UI | Literals withdrawn; relational checks; switch default shown; 2.11 audit |
| R1-03 | R1 | task | Status + finish date 3.4 → 1.5 |
| R1-04 / R3-03 / R2-10 / D-10 / D-R3-1 | R1 | schema | Precision columns + pairing CHECK in 0004; `read_events` in 1.5 |
| R1-05 | R1 | task | New 2.0 Settings; `/settings` in route table |
| R1-06…R1-11, R1-13 | R1 | UI-flow | Nav `enabled` flag; failed write reverts; Start navigates; undo closures; grey lane; focus rule; `medium` cookie |
| R1-12 / D-8 / D-R1-2 | R1 | task | Timer → 6.12 with row-not-state + 4h rule |
| R1-AR1 / D-9 | R1 | ops | Accepted: no cross-device revalidation |
| R2-01, R2-04 | R2 | SQL | UNION walk; target excluded |
| R2-02 / D-16 | R2 | ops | `LEDGER_LIVE` guard in load/rebuild; placement serial safe only because nothing reloads |
| R2-03, L-10 | R2 | ops | `pipefail` + size assert; pull `--rebase` |
| R2-05, -06, -08 | R2 | API/UI | Totals printed; one row per book; No-year chip |
| R2-07 / D-12 / D-R2-1 | R2 | schema | Repeats dropped; `UNIQUE (run_id, issue_id)`; rereads "return at 0.8a" |
| R2-09 | R2 | ETL | Extract clears `seed/` |
| R2-11 | R2 | API | Redirect / 401 |
| R2-AR1, AR2 / D-14 | R2 | ops | Same-repo backups accepted; restore drill in START-HERE 10d |
| D-15 | R2 | schema | Label is identity; slug collisions block cutover |
| D-17 / L-1 | R2 | API | Export stays JSON, omits `users`, new tables added |
| R3-04, -05, -06, -11 | R3 | schema/task | 0.3: `shelf_books` only; `finished_on` already date; `run_issues.deleted_at`; migrate-not-push check |
| R3-07, R3-10 | R3 | task | 1.1 date rules, endpoint with `placementIds`, 1.2 first |
| R3-08, -14, -16, -17 | R3 | task | 1.4c plan flip in 2.3; `plan_acceptance`; 3.1 allow-list; Draft why → 7.5 |
| R3-09 | R3 | schema | Down-migration rule in CLAUDE.md, 0004 down as example |
| R3-12, R3-13, R3-15 | R3 | task | Splits (0.8a/b, 1.3/c, 1.8/b, 2.2/b, 2.5/b); `test`/`test:all`; 2.11a + checklist |
| R3-18 | R3 | docs | Stop-and-ask list in CLAUDE.md |
| D-11 / D-R3-2 | R3 | ops | `TEST_DATABASE_URL` + guard |
| UI audit C01–C39 | pre | UI | Triaged as absorbed (LEDGER foot) |

## 4. Cross-review contradictions

Five, all reported as findings: S-04 (R1's relational 2.6 check × R2-04), S-05
(R1-03's move × R2-08's reader × R3-05/D-10's column × the `schema.ts` comment),
S-09 (D-12 × ARCHITECTURE 2.14 × CLAUDE.md × TASKS 0.8a), S-11 (D-7 × R3's 2.5
split), S-14 (D-10 × R1's Done tab and badge). Everything else in the seam table
agrees.

## 5. Orphaned items

**Decided but not applied** (the agent never reads `decisions.md`):
- **D-15** — no cutover gate anywhere → S-13.
- **D-17** — the export still hard-codes the pre-HORIZON tables, and nothing tells a task to extend it → S-12.
- **D-4** — still says "175", never marked superseded by D-13; its ledger note says "R0-04 stays open" while R0-04 is resolved → S-L1.
- **OWNER-CHECKLIST "[x] Rereads (at task 0.8a)"** — ticked, and no outcome recorded anywhere → S-09.
- **OWNER-CHECKLIST second pass says "the drift in CLAUDE-CODE-PROMPTS.md is fixed"** (:166). Only the `claude/*.md` links, `db:push`, the cap and 175 were fixed → S-03.

**Deferred and never caught:**
- R0 out-of-horizon: "`read_events` uses a `num_nonnulls` polymorphic FK that CLAUDE.md forbids for shelves — check when built (1.5)". No later review picked it up. FEATURES:1259-1270 still has it, and 1.5 elides the columns (`read_events(…, finished_on …)`). Low cost, because the CHECK keeps it honest; 1.5 should say it is deliberate → S-L3.
- R2 out-of-horizon: "a label rename accepted after cutover changes `issues.id` with nothing to move progress". 4.1's text doesn't carry it. Out of horizon, and cheap to add later (`ON UPDATE CASCADE`) → S-L3.
- R2 LOW L-2…L-9 and R3 LOW 3, 4, 6 never got ledger rows. L-6 (`START-HERE:1009` runs `enrich_books.py` ungated) and R3 LOW 4 (no *Depends on* line in 2.1/2.1b/2.3) are still present → S-L3.

**Still open by status:** R3-01 and R3-02 (BLOCKER, owner), R2-12 (MEDIUM, owner). OWNER-CHECKLIST:227-234 promised to write the passcode rule into START-HERE Step 14 "or add the task". Neither has been done.

## 6. Findings

### S-01 START-HERE never schedules 0.8a/0.8b, so following it cuts over with read state still keyed on the issue

- HIGH / Read / high
- Where: START-HERE:868-869 (Step 11 = "Tasks 0.1 through 0.5"), :884-900 (Step 12 lists 1.1, 1.2, 1.6, 1.3, 1.4, 1.4b, 1.5), :934 ("Do not cut over before Step 12 finishes"); TASKS:236-238; D-16; R2 door register ("read-state grain: yes, *if 0.8 lands before cutover*")
- Evidence: no sitting names 0.8a, 0.8b, 1.3c, 1.3b, 1.4c, 1.7, 1.8, 1.8b, 1.9 or 1.10. Step 11 also says 0.3 creates `sessions`, `read_events` and `inbox` (:876-879), but TASKS assigns those to 2.1b, 1.5 and 1.4b. Step 12's "Phase 1 complete" and its *Done when* (paste a 24-issue run) need 1.3c, which is unlisted.
- Failure scenario: the owner works through the sittings, finishes Step 12, runs the parallel month and cuts over. `issue_progress` is still `(user_id, issue_id)`. 0.8a then becomes a live data migration that fans each read out to placements, the door R2 marked safe only pre-cutover. It must guess which runs a read belonged to.
- Recommended resolution: rewrite the Step 11/12 tables from TASKS' current IDs, with 0.8a/0.8b in Step 11. Add "0.8a merged" as the first line of Step 14's preconditions. Also say in Step 13 that 0.8a's schema change is applied by `npm run rebuild`, not `db:migrate` (TASKS:237 "this is a rebuild, not a data migration").
- Proceed without fixing? Not past Step 12.

### S-02 The cutover load erases everything the parallel month wrote in the app

- HIGH / Proven / high
- Where: START-HERE:930-932 (parallel month, sheet authoritative), :948-949 (`load.ps1 seed-final`); `etl/load.ps1:82-86` (`TRUNCATE … runs … books … CASCADE`); D-10; D-16
- Evidence: on the scratch DB, with tables shaped as 0.3/1.4b/1.10 specify, the loader's own statement prints `truncate cascades to table "run_queue"`, `"shelf_books"`, `"eras"`, `"inbox"`. All four are then empty, as is everything that cascades from `run_issues`/`books` (`issue_progress`, `book_status`, and 1.5's `read_events`).
- Failure scenario: during the month the owner queues runs, shelves books, captures inbox notes and marks reads with exact dates in the app. The parallel month exists to exercise exactly those features. Cutover truncates all of it. The queue, shelves and inbox have no sheet column to reload from. The month's reads come back from the sheet as `none`, which is the loss D-10 exists to prevent.
- Recommended resolution: DECISION S-D1. Whichever option is chosen, Step 14 must say in one sentence what the load destroys.
- Proceed without fixing? Not past Step 14.

### S-03 The agent prompt file still directs pre-R2/R3 behaviour

- HIGH / Read / high
- Where: `docs/CLAUDE-CODE-PROMPTS.md`:328, :349 (0.3: "shelves must be shelf_books **and shelf_titles**"); :162, :1496, :1517 (3.2: "the 'Draft why' button calls a new server-side route … via ANTHROPIC_API_KEY"); :779 (1.5: "promote finished_year to finished_on"); :1290-1293 (2.6: the S-04 contradiction verbatim); :53-55 (header: "Still open, not past 1.1: R1-04 … Awaiting R2"); no prompt for 0.8a, 0.8b, 1.3c, 1.8b, 2.0, 2.2b, 2.5b, 2.11a. OWNER-CHECKLIST:166 marks it fixed.
- Failure scenario: the owner pastes the 0.3 Plan prompt. The agent is told directly to create `shelf_titles` with no `titles` table to reference (R3-04), and to make `completed_at` nullable, which 0004 already did. In 3.2 it builds the Anthropic route R3-17 moved to 7.5. D-1 does not rank this file, and its own header limits "the task wins" to R1's changes.
- Recommended resolution: add one line to CLAUDE.md's D-1 section ranking the prompt file and START-HERE **below TASKS**. Replace the prompt header's R1 block with "R0–R3 changed TASKS after these prompts were written; where a prompt disagrees, the task wins", then fix the four prompts cited above.
- Proceed without fixing? Not past 0.3.

### S-04 2.6's acceptance check contradicts itself since R2-04

- HIGH / Proven / high
- Where: TASKS:1038-1039, :1064-1069; `views.sql:227` (`WHERE w.run_id <> target`); FEATURES:419-425 ("true cost" includes the run's own size); PROMPTS:1290-1293
- Evidence: the check requires both "`run_unlock_cost(A)` equals the summed `issue_count` of its ancestor set, **and equals its own issue count for a run with no prerequisites**" and "every run's cost equals `SUM(issue_count)` over `run_ancestors()`". Scratch DB: `claremont-xmen` has 0 ancestors, `SUM` = **0**, own = **461**. R1's check was written while `run_ancestors` still returned the target, and R2-04 removed it.
- Failure scenario: an agent building 2.6 cannot satisfy both clauses. It either adds the target back into `run_ancestors` to make the numbers match, which brings back R2-04's "Read these first → Axis", or it drops one clause at random.
- Recommended resolution: 2.6 says cost = own `issue_count` + `SUM(issue_count)` over `run_ancestors()`, and the check asserts that. While editing, state whether cost counts **unread** issues, because *costs 44* on an *Unlocked and waiting* row only makes sense if it does.
- Proceed without fixing? Not past 2.6.

### S-05 After 1.5 a book has two finish-year columns, and every reader uses the one 1.5 doesn't write

- HIGH / Read (grep) / high
- Where: TASKS:525-527, :529-533 (1.5 writes through `read_events` → `finished_on`); `views.sql:380-384` (`books_by_year` on `finished_year`); `queries.ts:193, 208, 212, 231` (listBooks, year filter, R2-08's No-year chip); `writes.ts:18` (R0-C1 writes `finishedYear`); `schema.ts:256` ("never a fabricated July 1st") vs TASKS:526, CLAUDE.md, ARCHITECTURE 2.17 ("its July 1")
- Evidence: `grep finished_on src/ etl/views.sql` finds no reader. The `schema.ts` comment rules out the only date the pairing CHECK allows for `approximate`.
- Failure scenario: the owner marks a book read on 2026-10-02 through 1.5's new control. `finished_on` is set and `finished_year` is not. The book is missing from the 2026 chip, lands under R2-08's *No year*, and 2.2's *year so far* undercounts. Nothing errors.
- Recommended resolution: 1.5 states one rule: `finished_year` is dropped and its readers move to `extract(year from finished_on)` (CLAUDE.md "derived data is never stored"), or it is written in the same statement. Add one assertion to 1.5's check that a book finished through the UI appears in its year's chip. Fix the `schema.ts:256` comment to match 2.17.
- Proceed without fixing? Not past 1.5.

### S-06 2.1's check is arithmetically impossible

- HIGH / Proven / high
- Where: TASKS:815-816; mockups:2103 ("3.58M words against a 3.04M capacity")
- Evidence: `45 × 185 × 365 = 3,038,625`; `4.1M / 3.04M = 134.9%`, not 118 ± 1. The mockup's 118% comes from a 3.58M plan. The check mixes a fixture total with the mockup's result, which is the D-7 failure. D-13 also removed the workbook plan the 118% came from.
- Failure scenario: an agent builds a correct capacity view, the test returns 135%, and it "fixes" the view, for example by counting reading days instead of calendar days, until it returns 118%. Every capacity figure in 2.2, 2.3, 2.7 and 2.10 then inherits the bend.
- Recommended resolution: change "4.1M" to "3.58M" (or 118% to 135%). The check then builds its own consistent fixture, as D-7 requires.
- Proceed without fixing? Not past 2.1.

### S-07 A soft-deleted placement blocks re-adding the issue, and the constraint can't be made partial

- HIGH / Proven / high — regression chain R0-15 → R3-06 → D-12
- Where: TASKS:97-102 (0.3 `run_issues.deleted_at`), :134-141 (0.4 "restoring the placement brings the read mark back"), :241-243 (0.8a `DEFERRABLE` sequence UNIQUE), :416-418 (1.3c); `schema.ts:111`
- Evidence (scratch DB):
  ```
  re-add x2 after soft delete: ERROR: duplicate key value violates unique constraint "iss_u"
  CREATE UNIQUE INDEX … WHERE deleted_at IS NULL DEFERRABLE …  → syntax error at "DEFERRABLE"
  ALTER TABLE … ADD CONSTRAINT … UNIQUE (…) WHERE (…)            → syntax error at "WHERE"
  ```
- Failure scenario: the owner removes a misplaced issue (soft delete, R3-06) and later re-adds it through 1.3c or 1.3b. The insert fails. The obvious "fix", deleting the old row to make room, is the hard delete that cascades its `issue_progress` row, exactly what R3-06 exists to prevent. The soft-deleted row's `sequence` also still occupies its slot during 1.3c's renumber.
- Recommended resolution: two sentences in 0.4, repeated in 1.3c. **Adding an issue whose placement in this run is soft-deleted restores that row** (clear `deleted_at`, then move it to the requested sequence) rather than inserting. Both UNIQUE constraints stay full-table, and renumbering shifts every placement in the run, deleted or not. No schema change. (An `EXCLUDE … WHERE … DEFERRABLE` constraint works if a partial rule is ever wanted, but it isn't needed.)
- Proceed without fixing? Not past 0.4.

### S-08 The prerequisite audit needs Phase 2 tools, but START-HERE freezes the sheet before Phase 2

- MEDIUM / Read / medium
- Where: OWNER-CHECKLIST:17-32 ("data work in `Comics.xlsx`"; "2.11a's loader check will list them"; "work down from … `run_leverage` once 2.6 exists"); TASKS 2.11a (:1181-1200), 3.3 (:1243-1248); START-HERE:956 (sheet archived read-only at Step 14), :972-984 (Phases 2–7 come after Step 14)
- Evidence: today's `prereqs.csv` has 0 hard-only cycles and one **74-run** mixed component (Tarjan over 438 edges). 2.11a fails extract on *any* component larger than one. 3.3's check rejects only a 2-cycle.
- Failure scenario: the owner cuts over after Phase 1, then gets 2.6's leverage and 2.11a's list in Phase 2. The audit tells them to edit a workbook that is now archived, and edits there never reach the app. Readiness stays at 172 of 258 blocked until 3.3 lands. 2.11a guards a loader that `LEDGER_LIVE` no longer lets run.
- Recommended resolution: DECISION S-D3. In either case, 3.3's check should reject any cycle length that 2.11a's invariant forbids.
- Proceed without fixing? Not past Step 14.

### S-09 Rereads: four documents, three positions, and an owner tick with no recorded outcome

- MEDIUM / Read / high
- Where: CLAUDE.md:135 ("Rereads **return** deliberately in 0.8a"); TASKS:245-250 ("*If* the owner wants … decide before dropping the UNIQUE"); decisions.md:16 (D-12: "a run's issue count is distinct issues"); ARCHITECTURE:184-189, :250-253 ("run totals count placements"; key "not `(run_id, issue_id)` because … a planned reread inside a run is legitimate"); OWNER-CHECKLIST:36 `[x]`, :197-204 (`X-Men Annual (2023) #1` may be a genuine reread)
- Failure scenario: the 0.8a agent follows ARCHITECTURE 2.14, which the task cites, and CLAUDE.md, and drops `UNIQUE (run_id, issue_id)`. `run_progress` (0.8a: "counts the run's own placements") and `run_credit_line` (distinct) diverge again, which is R2-07 reintroduced by the doc R0 ranked third.
- Recommended resolution: DECISION S-D2. Then write one sentence into all three documents, and rewrite ARCHITECTURE 2.14's key rationale to cite D-12.
- Proceed without fixing? Not past 0.8a.

### S-10 The down-migration worked example violates the rule that cites it

- MEDIUM / Proven / high — R3-09 × D-10
- Where: CLAUDE.md:268-272 ("see `drizzle/down/0004_date_precision.sql`"; "asserting row values"); `drizzle/down/0004_date_precision.sql:2-3, :8`
- Evidence (scratch DB, in a rolled-back transaction):
  ```
  before           | none  | 76 rows | 0 dated
  after up-down-up | exact | 76 rows | 76 dated
  ```
  All 76 undated reads come back `exact`, stamped with the time of the round trip. That is R2-10's failure.
- Failure scenario: the 1.5 agent copies the example for `read_events`, the ledger's source of truth. Its up→down→up test passes because it asserts row counts. A later rollback silently re-dates history.
- Recommended resolution: label the 0004 file in CLAUDE.md as a counter-example. Its lossiness was acceptable only because the DB was disposable. State that 1.5/1.7 downs must round-trip precision, and that their test asserts the `none` rows stay `none`.
- Proceed without fixing? Not past 1.5.

### S-11 Three checks still assert seed facts that today's seed falsifies

- MEDIUM / Proven / high — D-7 × R3-12
- Where: TASKS:967-968 (2.4 "Hickman FF renders outlined green, Immortal Hulk amber"); :1025-1028 (2.5b "block 1 of 7", "run 2 of 5", "issue 42 of 381"); :987, :1133 ("nine" runs with no block)
- Evidence (today's seed): `hickman-ff` = `reading` (28/61); `claremont-xmen` = block 1 of **6**, run 2 of **2**, **0 / 461**; runs with `block_id IS NULL` = **0**. (`claremont-xmen` leverage 13 still holds.)
- Failure scenario: 2.4's snapshot fails on correct code. The agent changes `<RunStateBadge>`'s mapping or the `run_state` view until Hickman FF draws outlined green, which puts a wrong badge on every screen.
- Recommended resolution: make each check use a built fixture (D-7's own rule). Name the state, not the run: "a `ready_hard` run renders outlined green".
- Proceed without fixing? Not past 2.4.

### S-12 D-17 is not applied: the exit ramp omits every table HORIZON adds, including the reading log

- MEDIUM / Read / high
- Where: `src/app/api/export/route.ts:14-19` (22 hard-coded tables); decisions.md:21; START-HERE 10d (:769-805, no export check); TASKS (no mention of export in any task or standing rule)
- Failure scenario: after 1.5, `read_events` is the log that `book_status`/`issue_progress` are projected from. The export has the projections, not the log. It also omits `run_queue`, shelves, eras, sessions, `plan_acceptance` and inbox. D-14 accepted same-repo backups *because* the export is the second copy. D-17's "tables added **after** cutover" wording exempts all of these, since every one lands before cutover.
- Recommended resolution: add a TASKS standing rule and a CLAUDE.md line: "a task that creates a table adds it to `/api/export` and to its test". Add the hand check D-17 promised to 10d.
- Proceed without fixing? Not past 1.5.

### S-13 D-15 is not applied: slug collisions are still documented as routine, and there is no cutover gate

- MEDIUM / Read / high
- Where: decisions.md:19 ("a non-empty list … is a cutover blocker, not a warning"); START-HERE:452 ("Usually one comic spelled two ways — fix the sheet or accept"); Step 14 :939-950 (no check); today's `seed/unresolved.csv`: **1** `labels share a slug` row
- Failure scenario: the owner cuts over with that row present. The `-2` twin becomes permanent identity, and reading one leaves the other unread with no script to merge them.
- Recommended resolution: Step 14, step 2: "stop if `unresolved.csv` has any `labels share a slug` row". Reword row 12 of the table.
- Proceed without fixing? Not past Step 14.

### S-14 The Done tab puts undated reads first, and the badge has no NULL rule

- MEDIUM / Proven / high — D-10 × R1's 1.9/2.4 specs
- Where: TASKS:700 (Done: "latest `completed_at` first"); :945 (`✓ read · date`); `views.sql:160-164` (`finished_at` = max, NULL when all reads are `none`); ARCHITECTURE:372-374
- Evidence: `ORDER BY x DESC` over `(NULL, 2026-01-01, 2025-06-01)` → `NULL 2026-01-01 2025-06-01`. The one read run in today's seed has `finished_at` NULL.
- Failure scenario: every run finished before cutover (all `none`) sorts above what the owner finished last week, and the badge renders `✓ read · null` or `Invalid Date`.
- Recommended resolution: 1.9: `ORDER BY finished_at DESC NULLS LAST`. 2.4: an undated `read` badge is `✓ read` with no date. Add one assertion each.
- Proceed without fixing? Not past 1.9.

### S-15 1.1's *Original dates* copies a precision that 0.8a's view doesn't expose

- MEDIUM / Read / high — R3-07 × 0.8a
- Where: TASKS:324 (precision "copied from that read"); :265-267 (`issue_read_runs(user_id, issue_id, run_ids[], first_read_at)`)
- Failure scenario: Adopt copies an `approximate` Spread date and, with no precision to copy, writes `exact`. That guess then counts in pace maths as a real date.
- Recommended resolution: 0.8a adds `first_read_precision` to `issue_read_runs`, and 1.1's Adopt test asserts it is carried over.
- Proceed without fixing? Not past 0.8a.

### LOW

- **S-L1** D-4 still says 175 and is not marked superseded by D-13 (decisions.md:8). The ledger's D-4 note says "R0-04 stays open".
- **S-L2** New evidence on **R0-03**: today's extract has 258 runs / 10,138 issues / 10,758 placements / 438 prereqs / 172 blocked, against CLAUDE.md:3-4's 259 / 10,285 / 10,822 and TASKS:957, :1137-1138 ("181 of 259", "around 180"). Per D-1, fix the prose.
- **S-L3** Untracked handoffs: R2 L-2…L-9 and R3 LOW 3/4/6 have no ledger rows. L-6 (`START-HERE:1009`) and R3 LOW 4 are still present. The `read_events` polymorphic FK (R0) and the post-cutover rename path (R2) were never picked up.
- **S-L4** 2.0 (:801-802) says 2.7 "writes the stretch-year acceptance" on Settings, but R3-14 put it in `plan_acceptance`. 2.3 (:907) says chips "read 892k … on the seed", but D-13 makes the seed plan empty.
- **S-L5** 1.9's Books *Up next* can only be empty in Phase 1 (D-13 plus R3-08 keep plan rows out until 2.3). Its mandated "one primary action" has no target until then. Name it: *Add a book* → 1.4c.
- **S-L6** R2-06/R2-08's page-level fixes (printed total, No-year chip) are tested only at query level. Nothing in 1.8's move to `/books/list` carries them.
- **S-L7** START-HERE Step 15 (:979, :986-992) still says Phase 3 holds "book status" (moved to 1.5, R1-03), still recommends pulling 6.2b forward (absorbed into 2.6), and still says "2.11" (now 2.11a plus the checklist).

## 7. DECISION NEEDED

### S-D1 What does the cutover load keep? (from S-02)

The docs require a month of parallel use (START-HERE:930) and a final truncating load (:948). The two cannot both hold for app-only data.
- **(a) The parallel month is a rehearsal.** Step 14 says everything entered in the app before cutover is erased, and that the queue, shelves and inbox are re-entered afterwards. Cheapest; it loses the month's exact dates.
- **(b) Load first, then run in parallel.** The final load and `LEDGER_LIVE=true` happen at the *start* of the month. The frozen sheet becomes the comparison, not the authority. No loss; the sheet stops being a live fallback a month earlier.
- **(c) An additive final load** that doesn't truncate app-only tables. `CASCADE` from `runs`/`books` rules out a one-line change; it needs a new loader mode.

Recommendation: **(b)**. D-10's promise that dates are recorded as they happen only holds if the app is authoritative from the day it starts recording them. Blocks: Step 14.

### S-D2 Does 0.8a bring rereads back? (from S-09; D-12 and D-R2-1 stand, but their application is unrecorded)

- **(a) No.** `UNIQUE (run_id, issue_id)` stays; a planned reread is a note on the placement. `run_progress` and `run_credit_line` keep agreeing. CLAUDE.md:135 and ARCHITECTURE 2.14 get corrected.
- **(b) Yes, with `run_issues.reread`.** Then decide which count the run shows. D-12 says distinct issues, but 0.8a's `run_progress` counts placements, so one of them changes.

Recommendation: **(a)**. The owner's `[x]` suggests the 11 dropped rows were duplicates. The one open case (`X-Men Annual (2023) #1`) resolves by relabelling (OWNER-CHECKLIST:197). Blocks: 0.8a.

### S-D3 Where does the prerequisite audit happen? (from S-08)

- **(a) Before cutover.** Pull 2.11a (S, pure ETL) into Phase 1, and make "OWNER-CHECKLIST prereq audit done" a Step 14 gate. The audit works from `prereqs.csv` degree counts rather than 2.6's leverage.
- **(b) After cutover, in the app.** Move 3.3 (prereq editor) into Phase 2, rewrite the checklist to use it, and retire 2.11a's workbook check in favour of a DB-side test.

Recommendation: **(a)**. Cycle-breaking is sheet work the owner has already started (the hard cycle is gone), and 2.11a's guard only has a job while extract still runs. Blocks: Step 14, 2.11a.

## 8. Readiness call

| Criterion | Call | Evidence |
|---|---|---|
| Authority settled | **Met** | D-1 is in CLAUDE.md "Which document wins". The one gap: START-HERE and CLAUDE-CODE-PROMPTS, the two documents the owner drives with, are unranked (S-01, S-03). A one-line fix |
| BLOCKERs / HIGHs handled | **Not met** | R3-01 and R3-02 are still open (owner). S-01…S-07 are new HIGHs |
| One-way doors confirmed | **Not met** | Confirmed on paper (D-10, D-12, D-15, D-16, D-17, 1.7's PK). In practice: D-15 has no gate (S-13), D-16 relies on 0.8a landing before a cutover START-HERE doesn't sequence (S-01), and D-17 is unapplied (S-12) |
| No open decisions | **Not met** | S-D1…S-D3; the rereads outcome is unrecorded; R2-12's passcode choice is still pending |
| Dry run clean | **Not met** | R3's dry run (0.1–0.3, 1.1) was never re-run after its fixes, and the 0.3 prompt an agent would be handed still contradicts 0.3 (S-03) |
| CI green | **Not met** | No repository. CI has never run (R3-01; OWNER-CHECKLIST:151-156) |
| Rebuild works | **Met** | Migrate-from-zero 0000→0004 + `views.sql` + today's seed loaded clean on PG 18 (Proven here); R2 ran the full rebuild on 2026-09-20. Caveat: once 2.11a lands, extract will fail on today's 74-run component until the audit is done (S-08) |
| Go-live gated separately | **Not met** | The `LEDGER_LIVE` guards are in place (R2-02, verified by the closure sweep). Step 14 lacks the 0.8a precondition (S-01), the slug gate (S-13), the passcode (R2-12), the export check (S-12), and says nothing about what the load destroys (S-02) |

Scratch cluster removed after the run; nothing outside the scratchpad was written
except this file and the ledger rows below.
