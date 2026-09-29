# R2 — independent review

HORIZON: Phases 0–3. Evidence tier **Proven** throughout unless marked.

**Test rig.** A throwaway local cluster (`initdb`, port 55432, PostgreSQL
18.6 — production is Neon **16**, see L-9). Schema built by applying
`drizzle/0000`→`0003` to an empty database, `etl/views.sql` applied, and a
fresh `etl/extract.py` run loaded with `load.ps1`'s exact `\copy` list.
259 runs / 10,285 issues / 10,835 placements / 459 prereqs / 1,478 books —
matching CLAUDE.md. No remote database was contacted.

## 1. Verdict — FAIL

Three defects must be fixed before implementation continues. `run_ancestors()`
— called on *every* run-detail page load — does not finish in usable time for
**150 of the 229 runs that have prerequisites**; the depth-cap change recorded
as D-6 is what made it exponential, and the test that was supposed to guard it
uses a linear chain, the one shape that cannot blow up. `etl/load.ps1`
truncates every progress table and has **no `LEDGER_LIVE` guard** — only a
sentence in CLAUDE.md stands between `npm run seed` and the loss of all
app-entered reading history after cutover. And the nightly backup commits a
green, empty dump when `pg_dump` fails. Everything else found is contained.
The ETL itself is in good shape: byte-identical across runs, atomic on
failure, and it reports its own ambiguities.

## 2. Coverage

| Area | Checked | Result |
| --- | --- | --- |
| A Data model / invariants | Every table's PK, FK, CHECK against `schema.ts` + migrations; stored-vs-derived duplication | R2-07, R2-10, L-3/L-4; value+source CHECK pairs sound |
| B One-way doors | 10 doors; register below | 3 unverified, all owner calls |
| C Numbers on screen | Every figure on `/`, `/comics`, `/comics/[runId]`, `/books` traced to SQL and run | R2-05, R2-06, R2-07, R2-08 |
| D ETL / rebuild | Two full extracts diffed; mid-load failure simulated; sidecar/hand rules read | Deterministic + atomic (sound); R2-09, L-8 |
| E Cutover / data after go-live | Every write path enumerated; guards grepped; restore procedure searched | R2-02, R2-03; no restore procedure exists |
| F Architecture | Coupling across views/queries/pages | No finding — the view layer is the right seam |
| G Security | Login, cookie, middleware, every route's auth, secrets, CSRF | R2-11, R2-12; CSRF and route auth sound |
| H External deps | Neon version pin, Metron quota code, backup client version | R2-03, L-9; Metron handling sound |
| I Concurrency / idempotency | Both write endpoints, double-tap path in `IssueRow` | Idempotent; last-write-wins acceptable (D-9) |
| J Silent failure | Backup, ETL row loss, wrong numbers | R2-03; `unresolved.csv` is a good existing signal |

## 3. One-way-door register

| Door | Current choice | Cost to change after go-live | Verified sound? |
| --- | --- | --- | --- |
| `issues.id` | slug of the label; 16 labels collide and get a `-2` suffix | High — merging a `-2` twin must move `issue_progress`; after cutover no script does | **unsure** — owner call |
| `run_issues` PK | `(run_id, sequence)`, no surrogate `id` | High — task 0.8 re-keys `issue_progress` to `run_issues.id`; that id must be stable across any future load | **no** — decide the id scheme before 0.8 |
| Read-state grain | `issue_progress(user_id, issue_id)` | Medium — 0.8 moves it to the placement; rows must be fanned out, not dropped | yes, if 0.8 lands before cutover |
| Run ids | hand-authored slugs | Low | yes |
| `reading_plan` PK | `(user_id, book_id, planned_year)` | Medium — task 1.7's `period` text column changes the PK; a book legitimately has two rows today (*Light Bringer*, 2026 + 2027) | **unsure** — 1.7 must say what two rows become |
| Date precision | `completed_at` NOT NULL DEFAULT now(); `finished_on` text | High — R1-04 / R3-03 / D-R3-1, still undecided; see R2-10 | **no** |
| Soft delete | no `deleted_at` anywhere | Medium — task 0.3 | no (known) |
| Export format | `GET /api/export` JSON, omits `users` | Low to change, but it is the owner's exit ramp | no — see L-1 |
| Backup format | `pg_dump` gzip committed to the repo | Low | see R2-03 |
| Serial ids | `wishlist.id`, `external_lists.id`; `TRUNCATE … RESTART IDENTITY` | Low today, High if anything ever links to them | yes, while nothing links |

## 4. Findings

### R2-01 `run_ancestors()` is exponential; the run-detail page calls it on every load

- BLOCKER / Proven / high. New evidence on **R0-02**, and a **DECISION CHALLENGE to D-6**.
- Where: `etl/views.sql:204-220` (cap at :216); `src/db/queries.ts:137`; `etl/test_views.sql:285-298`.
- Evidence: the recursive CTE carries a `path` array and uses `UNION ALL`, so it
  enumerates every simple path, not every node. Walk rows for `hickman-krakoa`
  by cap: 20 → 10,626 (171 ms); 24 → 130,200; 28 → 983,579 (5.1 s); 32 →
  4,272,881 (39.9 s). At the committed cap of 48 it does not return. Census over
  the 229 runs that have prerequisites, 2 s budget each: **79 finish, 150 time
  out** (`hickman-ff`, `hickman-krakoa`, `aaron-watxm`, `zdarsky-daredevil` all
  still running at 30 s). The cause is R0-01's 102-run cyclic component, which
  the path array turns into combinatorial path enumeration.
- The guard that should have caught this is `etl/test_views.sql:285` — a
  **linear** 45-run chain, the one graph shape with exactly one path per node.
  It passes in 218 ms and proves nothing about branching.
- Failure scenario: opening `/comics/hickman-krakoa` never renders; on Vercel
  the function hits its wall clock and the page errors. Task 2.6's
  `run_unlock_cost` builds on the same function and cannot be computed at all.
- Why it matters here: a HORIZON screen that exists today is unusable, and 2.6
  is blocked.
- Recommended resolution (smaller than what is there): drop the `path` array and
  use `UNION`, which dedupes on the row itself and bounds the walk at
  nodes × types × cap:

  ```sql
  WITH RECURSIVE walk(run_id, type, depth) AS (
      SELECT p.prereq_run_id, p.type, 1 FROM prereqs p WHERE p.run_id = target
    UNION
      SELECT p.prereq_run_id,
             CASE WHEN w.type='hard' AND p.type='hard' THEN 'hard' ELSE 'soft' END,
             w.depth + 1
      FROM prereqs p JOIN walk w ON p.run_id = w.run_id
      WHERE w.depth < 48
  )
  SELECT run_id, MIN(type) AS type, MIN(depth)::int AS depth FROM walk GROUP BY run_id;
  ```

  Measured: all 259 runs in **2.2 s total**, max 172 ancestors. On the 40 runs
  where the current function terminates, output is **identical** (symmetric
  difference 0 on all 40). Add a branching fixture to `test_views.sql` beside
  the chain — a six-node diamond plus one back edge is enough.
- Proceed without fixing? **No.**

### R2-02 `load.ps1` truncates all progress and has no `LEDGER_LIVE` guard

- BLOCKER / Proven (Read + grep) / high.
- Where: `etl/load.ps1:71-75`, `etl/load.sh`; guard present only at
  `etl/rebuild.ps1:64` and `etl/rebuild.sh:25`; `package.json` `"seed"`.
- Evidence: `TRUNCATE issue_progress, edition_progress, book_status,
  reading_plan, … CASCADE;`. `grep -n LEDGER_LIVE etl/load.ps1 etl/load.sh` →
  no match. `.env` does not contain `LEDGER_LIVE` at all (R3-02).
- Failure scenario: after cutover the owner (or an agent) runs `npm run seed`
  to refresh the catalog after an enrichment pass. Every issue marked read in
  the app, every book status and plan row entered since cutover, is gone, in a
  committed transaction, with no prompt.
- Why it matters here: this is the "losing reading history" case at the top of
  the calibration list, reachable by one npm script.
- Recommended resolution: lift the eight-line guard from `rebuild.ps1:64` /
  `rebuild.sh:25` verbatim into `load.ps1` and `load.sh`, and add
  `LEDGER_LIVE=false` to `.env` now so the variable exists before it matters.
- Proceed without fixing? **No.**

### R2-03 The nightly backup commits an empty file when `pg_dump` fails

- BLOCKER / Proven / high.
- Where: `.github/workflows/backup.yml:23-24`.
- Evidence: `pg_dump … | gzip > backups/…gz`. GitHub Actions runs `run:` under
  `bash -e`, not `-o pipefail`, so the pipeline's status is `gzip`'s. Locally:
  `bash -e -c 'false | gzip > out.gz; echo $?'` → `0`, `out.gz` 20 bytes, 0
  bytes of content. `git diff --staged --quiet ||` still sees a new file and
  commits it.
- Failure scenario: Neon is suspended, or upgraded past 16 so the pinned
  `postgresql-client-16` refuses (`server version … pg_dump version …`). The
  job goes green, a commit named `backup 2026-11-03` appears, and every nightly
  backup from then on is empty. The owner finds out when he needs one.
- Recommended resolution: `set -euo pipefail` at the top of the Dump step, plus
  one assertion after it —
  `test "$(gzip -dc "$f" | head -c 200 | wc -c)" -gt 100`.
- Proceed without fixing? **No.**

### R2-04 A run in a prerequisite cycle lists itself under "Read these first"

- HIGH / Proven / high. Related to R0-01, but this is a view defect, not sheet data.
- Where: `etl/views.sql:204-220`; `src/app/comics/[runId]/page.tsx:45-63`.
- Evidence: `run_ancestors` never excludes `target`. **102 of 259 runs are
  their own ancestor**; 5 of them via an all-hard path (`aaron-watxm`, `axis`,
  `gillen-uncanny`, `remender-xmen`, `schism-regensis` — exactly R0-01's
  remaining hard cycle, re-confirmed on the 2026-09-20 workbook). For `axis`,
  the closure returns the row `axis | hard | 2`.
- Failure scenario: `/comics/axis` renders **Read these first → Axis · hard ·
  depth 2**. Task 2.6's unlock cost counts the run's own issues as its cost.
- Recommended resolution: `WHERE run_id <> target` in the final SELECT of
  `run_ancestors`. Fold into the R2-01 rewrite; add an assertion to
  `test_views.sql`.
- Proceed without fixing? Not past 2.6.

### R2-05 The dashboard's "runs unlocked and waiting" is the page limit, not the count

- HIGH / Proven / high.
- Where: `src/app/page.tsx:13` (`readyToRead(userId, 12)`) and `:27`
  (`{ready.length} runs unlocked and waiting`); `src/db/queries.ts:72`.
- Evidence: the true count on the loaded database is **30**; the dashboard
  prints **12**, and would print 12 whether the answer were 12, 30 or 300.
- Failure scenario: the owner reads "12 runs unlocked and waiting", sees twelve
  rows, and believes the list is complete. It is 40% of it.
- Why it matters here: silently wrong number, and the one number the dashboard
  leads with.
- Recommended resolution: return a total alongside the page —
  `COUNT(*) OVER ()` in `readyToRead`, printed instead of `ready.length`.
- Proceed without fixing? Not past 1.9.

### R2-06 `/books` silently shows 500 of 1,478, and double-counts multi-year plan rows

- HIGH / Proven / high.
- Where: `src/db/queries.ts:192` (join to `reading_plan`), `:199`
  (`LIMIT 500`); `src/app/books/page.tsx:32` (`{books.length} shown`).
- Evidence: the unfiltered join returns **1,479 rows for 1,478 books** —
  *Light Bringer* is planned for both 2026 and 2027, and `reading_plan`'s PK
  `(user_id, book_id, planned_year)` permits that. The page then prints
  "500 shown" with no total, no pagination and no way to reach book 501.
- Failure scenario: the owner searches for a book that sorts after the 500th,
  finds nothing, and concludes it is not in his library. Separately, any book
  planned twice renders twice with a duplicate React key.
- Recommended resolution: two lines — `SELECT DISTINCT ON (b.id) …` (or
  aggregate the plan years) and print `count(*) OVER ()` as "500 of 1,478".
  Task 1.7's `period` migration must state what a two-year entry becomes.
- Proceed without fixing? Not past 1.9.

### R2-07 Two different issue counts for the same run, on the same screen

- MEDIUM / Proven / high.
- Where: `etl/views.sql:11` (`COUNT(ri.issue_id)` — placements) vs `:363`
  (`COUNT(DISTINCT ri.issue_id)`); both reach
  `src/app/comics/[runId]/page.tsx` at `:35` and `:41`.
- Evidence: 13 `(run_id, issue_id)` pairs are duplicated across 4 runs.
  `zdarsky-asm` has 35 placements over 28 distinct issues —
  `spider-man-life-story` #1–6 + annual appear at sequences 22–28 *and* 29–35,
  with the annual's `type` differing between them. The page renders "Credits
  from the N of **28** issues credited" three lines above "0 of **35** read".
  `extract.py` does flag these as `run_issues,label repeats in run` in
  `unresolved.csv`, so the data is disclosed — the views are what disagree.
- Failure scenario: the run page shows two totals for one run, and
  `readyToRead` orders "shortest first" by the inflated 35.
- Recommended resolution: decide one meaning (D-R2-1) and make both views use it.
- Proceed without fixing? Not past 2.5.

### R2-08 11 read books have no year, so the year chips and the Read chip disagree

- MEDIUM / Proven / high.
- Where: `etl/views.sql:374` (`AND s.finished_year IS NOT NULL`);
  `src/app/books/page.tsx:25-27,47-51`.
- Evidence: 159 books have `status='read'`; **11 have `finished_year IS NULL`**.
  The year chips sum to 148. Nothing on the page accounts for the other 11.
- Failure scenario: the owner adds the year chips, gets 148, and cannot reach
  the 11 missing books through any filter on the page.
- Recommended resolution: add a "no year" chip fed by the same view with the
  filter removed, or state the total beside the chips.
- Proceed without fixing? Not past 1.9.

### R2-09 The committed `seed/` predates migration 0003; `npm run seed` fails outright

- MEDIUM / Proven / high.
- Where: `seed/issues.csv` header; missing `seed/run_issues.csv`,
  `seed/creators.csv`, `seed/issue_credits.csv`; stale `seed/event_tracks.csv`.
- Evidence: `head -1 seed/issues.csv` → `id,run_id,sequence,label,type,notes,…`
  — the pre-0003 shape. `load.ps1:81` expects
  `issues(id,label,cover_date,…,cover_url,metron_id)` and `:82` reads
  `seed/run_issues.csv`, which does not exist. `event_tracks.csv` is output of a
  table renamed in migration 0001, and `extract.py` never removes stale output.
- Failure scenario: `npm run seed` (or `rebuild -SkipExtract`) fails at the
  first `\copy`; rebuild's row-count check at `rebuild.ps1:116-123` compares
  live counts against CSVs from a different schema.
- Recommended resolution: re-run `npm run extract` and commit, or delete
  `seed/` (it is `.gitignore`d anyway — itself worth resolving) and have
  `extract.py` clear its output directory first.
- Proceed without fixing? Not past 0.1.

### R2-10 Every load stamps all reading history with the load time

- MEDIUM / Proven / high. New evidence on **R1-04 / R3-03 / D-R3-1**.
- Where: `etl/load.ps1:97` copies `issue_progress(user_id, issue_id)` only;
  `src/db/schema.ts:225` `completed_at … defaultNow().notNull()`;
  `etl/views.sql:158` surfaces it as `finished_at`.
- Evidence: the column is never written by the ETL, so all 76 rows take the
  wall-clock time of the load. `run_state.finished_at` — the value behind
  "read · Sep 2026" — is the rebuild timestamp for every pre-cutover run.
- Failure scenario: the owner sees every historical run dated the day he last
  rebuilt, and has no column in which to record that a date is unknown or
  approximate — exactly what R1-04 asked for and D-R3-1 has not decided.
- Recommended resolution: settle D-R3-1 before 0.8; make the precision column
  nullable so "unknown" is representable, and have `extract.py` emit
  `completed_at` (NULL where the sheet has no date) rather than letting the
  default fire.
- Proceed without fixing? Not past 0.8.

### R2-11 A stale cookie 500s the whole app with no way back to `/login`

- MEDIUM / Read / high.
- Where: `src/middleware.ts:6` (`if (req.cookies.has("rt_session"))`);
  `src/lib/auth.ts:41` (`throw new Error("not signed in")`).
- Evidence: the middleware checks **presence**, not signature; `requireUserId`
  then throws, which Next renders as a 500, not a redirect.
- Failure scenario: the owner rotates `SESSION_SECRET` (or the cookie is
  truncated). Every page — including `/` — shows "Application error", and the
  middleware keeps letting him through because the cookie is still *present*,
  so he never reaches `/login` unless he knows to type the URL or clear site
  data on the phone.
- Recommended resolution: in `requireUserId`, `redirect("/login")` instead of
  throwing; in the route handlers, return 401. Three lines, no new abstraction.
- Proceed without fixing? Not past 1.8.

### R2-12 The passcode has no throttle and the runbook asks for a short one

- MEDIUM / Read / medium.
- Where: `src/app/api/login/route.ts:12-19`; `docs/START-HERE.md:270`
  (`APP_PASSCODE` → "something you'll type on a phone keyboard").
- Evidence: no delay, no counter, no lockout anywhere in the app;
  `grep -rn -i "rate.limit\|throttle\|lockout" src/` → no match.
- Failure scenario: a scanner that finds the URL POSTs to `/api/login` in a
  loop. A 4–6 digit phone-friendly passcode falls in minutes, and the attacker
  then has `GET /api/export` — the entire library and reading history in one
  request.
- Why it matters here: this is the calibrated attacker (an automated scanner,
  or someone who finds the URL), not a targeted adversary.
- Recommended resolution, smallest that works:
  `await new Promise(r => setTimeout(r, 1000))` on every failed match, and
  change START-HERE to "a passphrase of at least four words — you type it once
  a year". No rate-limit store, no dependency.
- Proceed without fixing? Not past go-live.

### LOW (10)

- L-1 `GET /api/export` omits `users`; a restore from it cannot satisfy the
  `user_id` foreign keys. One line in `route.ts:13`.
- L-2 `views.sql:404` `books_title_trgm` is a btree on `lower(title)`; the name
  promises a trigram index and `listBooks`'s `ILIKE '%q%'` cannot use it.
- L-3 `prereqs.type` has no CHECK, unlike every sibling column; a typo'd `Hard`
  silently becomes a soft edge in `run_readiness`.
- L-4 `events.verdict` and `runs.tier` are likewise unconstrained.
- L-5 `load.ps1:68` interpolates `$ownerName` into SQL unescaped; an apostrophe
  breaks the load.
- L-6 `START-HERE.md:946` tells the owner to run `py etl/enrich_books.py`,
  which does not exist and is not gated with "(task N)" as D-1 requires.
- L-7 `books/page.tsx:82` renders `series.slice(0, 40)` of 181 series with no
  count and no link to the rest.
- L-8 Sidecar rows for labels that leave the workbook are never pruned; a label
  later re-created silently inherits the old value.
- L-9 `backup.yml:16` pins `postgresql-client-16` while the Neon version is not
  pinned anywhere; a Neon major upgrade breaks the dump (see R2-03).
- L-10 `backup.yml` pushes without a rebase; a concurrent push makes the backup
  job fail rather than retry.

## 5. DECISION NEEDED

### D-R2-1 What is a run's issue count when a placement repeats?

`run_progress.total_issues` counts placements (35 for `zdarsky-asm`);
`run_credit_line.issue_count` counts distinct issues (28). `schema.ts:100` calls
the repeat "a planned reread"; the actual data — the same seven issues twice in
a row, with different `type` values — looks like the sheet listing a block
twice. `extract.py` flags 13 such rows and cannot tell the two cases apart, so
the docs do not settle which number is the run's length.

- (a) Placements are the truth; a reread is a second thing to read. Progress
  must then move to the placement (task 0.8) or a reread can never be marked.
- (b) Distinct issues are the truth; `extract.py` collapses repeats and drops
  them into `unresolved.csv`. Simplest; loses genuine rereads.
- (c) Keep both, but mark the placement: add `run_issues.reread boolean` and
  have the owner resolve the 13 rows once.

Recommendation: **(b) now, (a) at task 0.8** — collapse the 13 rows so the two
views agree today, and let placement-keyed progress reintroduce rereads
deliberately rather than by accident. Blocks 2.5 (telescope ordinals) and 2.6.

## 6. Proposed ACCEPTED RISK

- **R2-AR1** Backups live in the same private repo as the code, so one repo loss
  takes both. For a single-user tracker with a working export endpoint, a second
  destination costs more than the expected harm — *provided R2-03 is fixed*,
  because an undetected empty backup is a different risk entirely.
- **R2-AR2** No restore procedure has ever been run. `START-HERE.md:935` lists
  "confirm it restores into a scratch database" as a quarterly chore and gives
  no commands. Accepting this means accepting that the first restore attempt
  happens during an incident. The cheap alternative is four lines in START-HERE
  (`createdb scratch`; `gzip -dc backups/…gz | psql scratch`;
  `psql scratch -f etl/views.sql`; `psql scratch -f etl/test_views.sql`) —
  `test_views.sql` already rolls back, so it is a safe restore check.

## 7. NOT A VALID ISSUE

- Prereqs pointing at empty placeholder runs would block forever — **0
  placeholder runs exist** in the current extract; latent, not live.
- Self-edges in `prereqs` — 0 rows.
- `issue_progress` fanning out `run_progress` counts — the PK makes it
  impossible; verified by construction.
- CSRF on the progress endpoints — `sameSite: "lax"` blocks cross-site POST
  cookies, and `fetch` with `application/json` is preflighted.
- `series_progress.pct > 1` when `total_books` understates — 0 rows.
- Missing `users` row on load — `load.ps1:68` inserts it before the truncate.
- Non-atomic partial load — proven atomic, see §8.
- R1-01 and R1-02's literal figures (4,642 / 7,209 / "41 ready") — confirmed
  withdrawn from TASKS, FEATURES and HANDOFF; no literal survives.
- R1-12 (runaway timer) — confirmed out of HORIZON by D-8, TASKS:1229.
- R1-13 ("/" last-touched medium) — confirmed specified as a cookie, TASKS:535.

## 8. Sound — do not change

- **`extract.py` is deterministic.** Two full runs into separate directories:
  `diff -rq` → identical, every file. Do not add timestamps or ordering churn.
- **The load is atomic.** A `\copy` failure mid-script leaves 0 rows committed
  and psql exits 3, which `load.ps1:109` checks. Proven with a deliberately
  malformed CSV.
- **`unresolved.csv` is a real silent-failure signal**, and better than most
  dashboards: 108 rows, including 16 slug collisions resolved by a `-2` suffix
  with both spellings preserved, 13 repeated labels, and one
  read-in-one-run-not-another. Keep it, and keep printing the count.
- **The value/provenance CHECK pairs** on `issues` (`schema.ts:90-95`) are
  written with `IS NULL` on both sides precisely because a bare `IN (…)` passes
  on NULL. That comment is correct and the constraint is right.
- **`etl/test_views.sql`** passes in 218 ms against a fully loaded database and
  rolls back cleanly. Add to it; do not replace it.
- **Metron rate-limit handling** in `enrich_comics.py` (`:401,419,432`) honours
  `Retry-After`, reads `X-RateLimit-Sustained-Remaining`, stops cleanly on quota
  exhaustion and resumes from its cache. Leave it alone.

## 9. Out of horizon

- Applying a label review after cutover has no write path until task 4.1; a
  rename accepted post-cutover changes `issues.id` with nothing to move
  `issue_progress`.
- `run_unlock_cost` (2.6) inherits R2-01 and R2-04 — fix them in the view, not
  in 2.6.
- No task anywhere writes the restore procedure R2-AR2 describes.
